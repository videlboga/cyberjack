import {
  characterRelationRepo,
  SocialMemoryKind,
  SocialMemoryOwner,
  socialMemoryRepo,
} from "../infrastructure/repositories";
import { emitPromiseCreated } from "../scenario/eventDirector";
import { parseVerbalInputWithLLM } from "../adapters/llmAdapter";

export interface SocialMemoryCandidate {
  kind: SocialMemoryKind;
  owner: SocialMemoryOwner;
  content: string;
  importance: number;
  confidence: number;
}

export type PromiseOutcome = "fulfilled" | "broken";

export interface PromiseOutcomeSignal {
  outcome: PromiseOutcome;
  owner: SocialMemoryOwner;
  evidence: string;
}

const clean = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?…]+$/, "");

/**
 * Единый LLM-классификатор социального смысла реплики. Заменяет регекс:
 * извлекает долгосрочные социальные воспоминания (обещания, границы,
 * предпочтения, общие планы) и исход обещания (сдержано/нарушено).
 * Языконезависимо — естественный язык обрабатывается только LLM-слоем.
 */
export async function classifySocialMemoriesLLM(
  role: "user" | "assistant",
  text: string,
): Promise<{ memories: SocialMemoryCandidate[]; outcome: PromiseOutcomeSignal | null }> {
  const owner: SocialMemoryOwner = role === "assistant" ? "character" : "other";
  const empty = { memories: [], outcome: null };
  const content = (text || "").trim();
  if (!content || /^\s*\[(?:Действие|Воздействие)\]/i.test(content)) return empty;

  const prompt = `Ты анализируешь реплику в диалоге и извлекаешь из неё только долгосрочные социальные смыслы. Не придумывай того, чего нет в тексте. Верни JSON:
{
  "memories": [
    {
      "kind": "promise|shared_plan|preference|boundary|subjective_report|personal_fact",
      "content": "короткая формулировка смысла (1 предложение)",
      "importance": 0..1,
      "confidence": 0..1
    }
  ],
  "promiseOutcome": null | { "outcome": "fulfilled|broken", "evidence": "цитата из реплики" }
}

Правила:
- promise — явное обещание что-то сделать/не делать.
- shared_plan — отложенная совместная договорённость («потом», «в следующий раз»).
- preference — устойчивое предпочтение или вкус («мне нравится», «не люблю»).
- boundary — граница/ограничение на поведение («не делай», «остановись», «моя граница»).
- subjective_report — рассказ о собственном переживании/состоянии (когда говорит персонаж).
- personal_fact — сообщённый факт о себе (когда говорит собеседник).
- promiseOutcome — если реплика подтверждает выполнение («сдержал слово») или нарушение («нарушил обещание») ранее данного обещания.
Верни memories максимум 2, promiseOutcome null если исхода нет. Реплика: ${JSON.stringify(content)}`;

  try {
    const result = await parseVerbalInputWithLLM(
      [{ role: "system", content: prompt }, { role: "user", content: content }],
      { type: "json_object" },
      "memory",
    );
    const parsed = (result as any)?.parsed;
    if (!parsed || typeof parsed !== "object") return empty;
    const memories: SocialMemoryCandidate[] = Array.isArray(parsed.memories)
      ? parsed.memories
          .map((item: any) => ({
            kind: item?.kind as SocialMemoryKind,
            owner,
            content: String(item?.content || "").trim().slice(0, 200),
            importance: Math.max(0, Math.min(1, Number(item?.importance) || 0.5)),
            confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0.7)),
          }))
          .filter((item: SocialMemoryCandidate) =>
            item.content && ["promise", "shared_plan", "preference", "boundary", "subjective_report", "personal_fact"].includes(item.kind),
          )
          .slice(0, 2)
      : [];
    const out = parsed.promiseOutcome;
    const outcome = out && ["fulfilled", "broken"].includes(out.outcome)
      ? { outcome: out.outcome as PromiseOutcome, owner, evidence: String(out.evidence || content).slice(0, 200) }
      : null;
    return { memories, outcome };
  } catch (error: any) {
    console.warn("[SocialMemory] classification failed:", error?.message || error);
    return empty;
  }
}

export async function applyPromiseOutcome(input: {
  subjectId: string;
  relatedSubjectId: string;
  role: "user" | "assistant";
  text: string;
}): Promise<PromiseOutcome | null> {
  const { outcome: signal } = await classifySocialMemoriesLLM(input.role, input.text);
  if (!signal) return null;
  const promise = socialMemoryRepo.listActive(
    input.subjectId,
    input.relatedSubjectId,
    1,
    { kind: "promise", owner: signal.owner },
  )[0];
  if (!promise) return null;

  socialMemoryRepo.resolve(promise.id, signal.evidence, signal.outcome);

  // Relations are directional: only the interlocutor's kept or broken word
  // changes the character's model of that interlocutor.
  if (signal.owner === "other") {
    const relation = characterRelationRepo.ensure(
      input.subjectId,
      input.relatedSubjectId,
    );
    const direction = signal.outcome === "fulfilled" ? 1 : -1;
    characterRelationRepo.updateAttitude(
      input.subjectId,
      input.relatedSubjectId,
      Math.max(0, Math.min(100, relation.attitude + direction * 4)),
      {
        openness: Math.max(
          0,
          Math.min(
            100,
            (relation.openness ?? 50) +
              direction * (signal.outcome === "fulfilled" ? 3 : 5),
          ),
        ),
      },
    );
    characterRelationRepo.updateSocialStats(
      input.subjectId,
      input.relatedSubjectId,
      {
        familiarityDelta: 0.03,
        generalOpinion:
          signal.outcome === "fulfilled"
            ? "Он подтвердил поступком, что его словам можно придавать вес."
            : "Он нарушил данное слово; следующих обещаний недостаточно без поступков.",
        newMemory:
          signal.outcome === "fulfilled"
            ? `Сдержал обещание: ${promise.content}`
            : `Нарушил обещание: ${promise.content}`,
      },
    );
  }
  return signal.outcome;
}

// Социальная LLM-классификация запускается не чаще этого интервала на пару,
// иначе каждый игровой ход создавал бы LLM-запрос (лавина). Один вызов
// обрабатывает обе стороны обмена.
const SOCIAL_CLASSIFY_THROTTLE_MS = 60_000;
const socialClassifyLastRun = new Map<string, number>();

/** Test hook: сбрасывает throttle-карту, чтобы тесты могли вызывать подряд. */
export function __resetSocialThrottle() {
    socialClassifyLastRun.clear();
}

export async function rememberSocialExchange(input: {
  subjectId: string;
  relatedSubjectId: string;
  userText?: string;
  assistantText?: string;
}) {
  const pairKey = `${input.subjectId}:${input.relatedSubjectId}`;
  const now = Date.now();
  const lastRun = socialClassifyLastRun.get(pairKey) || 0;
  if (now - lastRun < SOCIAL_CLASSIFY_THROTTLE_MS) return;
  socialClassifyLastRun.set(pairKey, now);

  const userText = (input.userText || "").trim();
  const assistantText = (input.assistantText || "").trim();
  const messages: Array<{ role: "user" | "assistant"; text: string }> = [];
  if (userText) messages.push({ role: "user", text: userText });
  if (assistantText) messages.push({ role: "assistant", text: assistantText });

  for (const message of messages) {
    const { memories, outcome } = await classifySocialMemoriesLLM(message.role, message.text);
    if (outcome) {
      await applyPromiseOutcome({
        subjectId: input.subjectId,
        relatedSubjectId: input.relatedSubjectId,
        role: message.role,
        text: message.text,
      });
    }
    for (const memory of memories) {
      const memoryId = socialMemoryRepo.save({
        subjectId: input.subjectId,
        relatedSubjectId: input.relatedSubjectId,
        ...memory,
      });
      if (memoryId && memory.kind === "promise") {
        emitPromiseCreated({
          memoryId,
          subjectId: input.subjectId,
          relatedSubjectId: input.relatedSubjectId,
          owner: memory.owner,
          content: memory.content,
          importance: memory.importance,
        });
      }
    }
  }
}

export function renderSocialMemories(
  subjectId: string,
  relatedSubjectId: string,
): {
  beliefs: string[];
  openThreads: string[];
} {
  const records = socialMemoryRepo.listActive(subjectId, relatedSubjectId, 10);
  const beliefs: string[] = [];
  const openThreads: string[] = [];
  let rememberedBoundary = false;
  for (const record of records) {
    const own = record.owner === "character";
    if (record.kind === "promise") {
      beliefs.push(
        own
          ? `Ты помнишь собственное обещание: «${record.content}». Оно влияет на твоё чувство ответственности, но не обязано становиться темой сейчас.`
          : `Ты помнишь обещание собеседника: «${record.content}». Оно влияет на твоё доверие, но не обязано становиться темой сейчас.`,
      );
    } else if (record.kind === "shared_plan") {
      openThreads.push(
        own
          ? `Ты помнишь своё незавершённое обязательство: «${record.content}». События ещё не подтвердили его выполнение.`
          : `Ты ждёшь выполнения обязательства собеседника: «${record.content}». События ещё не подтвердили его выполнение.`,
      );
    } else if (record.kind === "boundary") {
      // A boundary is relationship history, not an indefinitely active
      // command. The recent dialogue already carries an acute boundary
      // verbatim when it still belongs to the current exchange.
      rememberedBoundary = true;
    } else if (record.kind === "subjective_report") {
      beliefs.push(
        `Ты помнишь собственные слова или переживание: «${record.content}». Это твоя субъективная память, а не подтверждение внешних событий.`,
      );
    } else {
      beliefs.push(own
        ? `Ты помнишь собственный рассказ о себе: «${record.content}».`
        : `Ты помнишь, как собеседник сообщил о себе: «${record.content}».`);
    }
  }
  if (rememberedBoundary) {
    beliefs.push(
      "Ты помнишь, что уже приходилось обозначать границы в общении с этим человеком; это часть ваших отношений.",
    );
  }
  return { beliefs: beliefs.slice(0, 4), openThreads: openThreads.slice(0, 4) };
}
