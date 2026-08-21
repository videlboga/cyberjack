import { db } from '../infrastructure/db';
import { interpretationRepo, InterpretationNode } from '../infrastructure/interpretationRepo';
import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';

/**
 * Регенерация content интерпретационных нод (шаг 4–5 плана).
 *
 * Читает ноды со status='dirty' и пересобирает их content через LLM, от
 * листьев к родителям. Одна нода за проход (как у subjective-memory воркера),
 * чтобы не забивать LLM. Каскад на worldview — только если значимо.
 *
 * Детерминированность: fingerprint = хеш входов (дети + факты + valence).
 * Если fingerprint не изменился — content не перегенерируется.
 */

const MAX_NODES_PER_PASS = 1;

let running = false;

/** Хеш входов ноды: дети + факты + valence/strength. */
function fingerprintFor(subjectId: string, node: InterpretationNode): string {
    const children = interpretationRepo.children(subjectId, node.id)
        .map(child => `${child.id}:${child.content || ''}:${child.valence.toFixed(2)}`)
        .join('|');
    const facts = interpretationRepo.listFacts()
        .map(fact => `${fact.term}:${fact.fact}`)
        .join('|');
    return `${node.kind}:${node.label}:${node.valence.toFixed(2)}:${node.strength.toFixed(2)}:${children}:${facts}`;
}

/** Собирает промпт для регенерации content ноды. */
function buildRegenerationPrompt(subjectId: string, node: InterpretationNode, characterName: string): { system: string; user: string } {
    const children = interpretationRepo.children(subjectId, node.id);
    const facts = interpretationRepo.listFacts();
    const childLines = children.map(child => `- ${child.label}: ${child.content || '(нет интерпретации)'}`).join('\n');
    const factLines = facts.map(fact => `- ${fact.term}: ${fact.fact}`).join('\n');
    // Персональные атомы-факты (биография, разбитая на неизменяемые факты).
    const subjectFacts = interpretationRepo.listSubjectFacts(subjectId);
    const bioLines = subjectFacts.map(f => `- ${f.term}: ${f.fact}`).join('\n');

    const kindHint: Record<string, string> = {
        worldview: 'общий взгляд на мир и на себя (сценарий жизни)',
        relationships: 'отношение к конкретному человеку',
        biography: 'интерпретация темы собственной биографии',
        station: 'понимание аспекта станции',
        self: 'отношение к себе',
        trait: 'понимание собственного обучения/склонности',
        episode: 'интерпретация эпизода',
    };

    const system = `Ты — ${characterName}, персонаж на изолированной космической станции. Ты пересматриваешь свою интерпретацию: «${node.label}» (${kindHint[node.kind] || 'интерпретация'}). Напиши 1–3 предложения от первого лица («я/мне/меня»), как ты сейчас это понимаешь. Опирайся ТОЛЬКО на факты и дочерние интерпретации ниже; не добавляй событий, которых нет. Факты — неизменяемая истина, но твоё ОТНОШЕНИЕ к ним зависит от твоего характера и опыта. Называй секс, насилие, боль, страх своими именами, если они есть. Верни только JSON: {"content":"..."}.`;

    const user = `ФАКТЫ МИРА:\n${factLines}\n\nТВОЯ БИОГРАФИЯ:\n${bioLines || '(нет)'}\n\nДОЧЕРНИЕ ИНТЕРПРЕТАЦИИ:\n${childLines || '(нет)'}\n\nТекущая валентность: ${node.valence.toFixed(2)} (от -1 до 1), сила: ${node.strength.toFixed(2)}.`;

    return { system, user };
}

/** Регенерирует одну dirty-ноду (листья раньше родителей). */
export async function consolidateNextInterpretation(): Promise<boolean> {
    if (running) return false;
    running = true;
    try {
        const subjects = db.prepare(`SELECT DISTINCT subject_id FROM interpretation_nodes WHERE status = 'dirty' OR content IS NULL OR content = ''`).all() as Array<{ subject_id: string }>;
        if (!subjects.length) return false;

        // Один субъект за проход (round-robin по порядку).
        const subjectId = subjects[0].subject_id;
        const dirty = interpretationRepo.listForSubject(subjectId).filter(node => node.status === 'dirty' || !node.content);

        // Листья (episode/trait/rel) раньше родителей (self/relationships/worldview).
        const leafFirst = ['episode', 'trait', 'rel', 'station', 'biography', 'self', 'relationships', 'worldview'];
        dirty.sort((a, b) => leafFirst.indexOf(a.kind) - leafFirst.indexOf(b.kind));
        const node = dirty[0];
        if (!node) return false;

        const character = db.prepare(`SELECT name FROM characters WHERE id = ? OR subject_id = ? LIMIT 1`).get(subjectId, subjectId) as any;
        const characterName = character?.name || subjectId;

        const fingerprint = fingerprintFor(subjectId, node);
        if (node.fingerprint === fingerprint && node.content) {
            // Входы не изменились — просто снимаем dirty.
            interpretationRepo.setStatus(subjectId, node.id, 'ready');
            return true;
        }

        interpretationRepo.setStatus(subjectId, node.id, 'generating');
        const { system, user } = buildRegenerationPrompt(subjectId, node, characterName);
        const result = await parseVerbalInputWithLLM([{ role: 'system', content: system }, { role: 'user', content: user }], { type: 'json_object' }, 'memory');
        const content = String(result?.parsed?.content || '').trim();
        if (!content) {
            interpretationRepo.setStatus(subjectId, node.id, 'ready');
            return true;
        }

        interpretationRepo.upsert({
            ...node,
            content,
            fingerprint,
            status: 'ready',
        });
        return true;
    } catch (error: any) {
        console.warn('[Interpretation] consolidation failed:', error?.message || error);
        return false;
    } finally {
        running = false;
    }
}

/** Помечает ноду dirty (для вмешательства из кресла). */
export function markInterpretationDirty(subjectId: string, nodeId: string) {
    interpretationRepo.markDirty(subjectId, nodeId);
}
