import {
  characterRelationRepo,
  SocialMemoryKind,
  SocialMemoryOwner,
  socialMemoryRepo,
} from "../infrastructure/repositories";
import { emitPromiseCreated } from "../scenario/eventDirector";

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

export function extractSocialMemories(
  role: "user" | "assistant",
  text: string,
): SocialMemoryCandidate[] {
  const content = clean(text);
  if (!content || /^\s*\[(?:Действие|Воздействие)\]/i.test(content)) return [];
  const owner: SocialMemoryOwner = role === "assistant" ? "character" : "other";
  const candidates: SocialMemoryCandidate[] = [];
  const add = (
    kind: SocialMemoryKind,
    importance: number,
    confidence: number,
  ) => {
    if (
      !candidates.some(
        (candidate) =>
          candidate.kind === kind &&
          candidate.content.toLowerCase() === content.toLowerCase(),
      )
    ) {
      candidates.push({ kind, owner, content, importance, confidence });
    }
  };

  if (
    /(?:^|[\s,;:—-])(?:обещаю|клянусь|я\s+(?:не\s+)?буду|я\s+(?:сделаю|расскажу|покажу|объясню|вернусь|помогу|проверю)|мы\s+(?:сделаем|поговорим|верн[её]мся|проверим))(?:\s|$|[,.!?;:—-])/i.test(
      content,
    )
  ) {
    add("promise", 0.9, 0.9);
  } else if (
    /(?:^|[\s,;:—-])(?:потом|позже|в следующий раз|напомни)(?:\s|$|[,.!?;:—-])/i.test(content)
  ) {
    add("shared_plan", 0.7, 0.72);
  }
  if (
    /(?:^|[\s,;:—-])(?:мне нравится|я люблю|мне не нравится|я не люблю|предпочитаю|терпеть не могу)/i.test(
      content,
    )
  ) {
    add("preference", 0.72, 0.88);
  }
  if (
    /(?:^|[\s,;:—-])(?:я боюсь|я работал[а]?|я был[а]?|я вырос(?:ла)?|у меня есть|для меня важно|я никогда|я всегда)/i.test(
      content,
    )
  ) {
    // Generated character speech proves what was expressed, not that every
    // implied event in the character's past actually happened. Character
    // canon comes from authored profiles and the story layer instead.
    add(role === "assistant" ? "subjective_report" : "personal_fact", 0.66, 0.78);
  }
  if (
    /(?:^|[\s,;:—-])(?:не делай|не надо|не смей|останов(?:ись|итесь)|хватит|не хочу|моя граница|больше так не)/i.test(
      content,
    )
  ) {
    add("boundary", 0.95, 0.92);
  }
  return candidates.slice(0, 2);
}

export function detectPromiseOutcome(
  role: "user" | "assistant",
  text: string,
): PromiseOutcomeSignal | null {
  const content = clean(text);
  if (!content) return null;
  const owner: SocialMemoryOwner = role === "assistant" ? "character" : "other";
  if (
    /(?:как|всё)\s+(?:и\s+)?обещал[аи]?|сдержал[аи]?\s+(?:сво[её]|данное)\s+слово|выполнил[аи]?\s+обещание/i.test(
      content,
    )
  ) {
    return { outcome: "fulfilled", owner, evidence: content };
  }
  if (
    /(?:не\s+сдержал[аи]?\s+(?:слово|обещание)|нарушил[аи]?\s+обещание|обещание\s+нарушено|не\s+(?:смогу|собираюсь)\s+выполнить)/i.test(
      content,
    )
  ) {
    return { outcome: "broken", owner, evidence: content };
  }
  return null;
}

export function applyPromiseOutcome(input: {
  subjectId: string;
  relatedSubjectId: string;
  role: "user" | "assistant";
  text: string;
}): PromiseOutcome | null {
  const signal = detectPromiseOutcome(input.role, input.text);
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
            relation.openness +
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

export function rememberSocialExchange(input: {
  subjectId: string;
  relatedSubjectId: string;
  userText?: string;
  assistantText?: string;
}) {
  const messages: Array<{ role: "user" | "assistant"; text?: string }> = [
    { role: "user", text: input.userText },
    { role: "assistant", text: input.assistantText },
  ];
  for (const message of messages) {
    if (!message.text) continue;
    applyPromiseOutcome({
      subjectId: input.subjectId,
      relatedSubjectId: input.relatedSubjectId,
      role: message.role,
      text: message.text,
    });
    for (const memory of extractSocialMemories(message.role, message.text)) {
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
