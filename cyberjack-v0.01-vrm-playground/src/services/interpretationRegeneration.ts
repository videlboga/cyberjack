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

/** Собирает батч-промпт: генерирует content сразу для группы нод одного kind. */
function buildBatchPrompt(subjectId: string, nodes: InterpretationNode[], characterName: string): { system: string; user: string } {
    const facts = interpretationRepo.listFacts();
    const factLines = facts.map(fact => `- ${fact.term}: ${fact.fact}`).join('\n');
    const subjectFacts = interpretationRepo.listSubjectFacts(subjectId);
    const bioLines = subjectFacts.map(f => `- ${f.term}: ${f.fact}`).join('\n');

    const kindHint: Record<string, string> = {
        worldview: 'общий взгляд на мир и на себя (сценарий жизни)',
        biography: 'интерпретация темы собственной биографии',
        world_knowledge: 'изначальное понимание аспекта мира',
        accumulated: 'накопленное понимание (сводка)',
        self: 'отношение к себе',
        others: 'отношение к другим людям',
        world: 'понимание мира по новым событиям',
        relationships: 'отношение к конкретному человеку',
        trait: 'понимание собственного обучения/склонности',
        episode: 'интерпретация эпизода',
    };

    // episode-ноды опираются на собственный текст, а не на факты мира/биографию.
    if (nodes[0].kind === 'episode') {
        const entries = nodes.map(node => {
            const source = node.sourceText || node.content || node.label;
            return `НОДА ${node.id} («${node.label}»):\n${source}\nвалентность ${node.valence.toFixed(2)}, сила ${node.strength.toFixed(2)}`;
        }).join('\n\n');
        const system = `Ты — ${characterName}, персонаж на изолированной космической станции. Ты пересматриваешь несколько эпизодов из своей памяти. Для КАЖДОГО эпизода напиши 1–3 предложения от первого лица («я/мне/меня»), как ты сейчас понимаешь и чувствуешь ЭТОТ эпизод. Опирайся ТОЛЬКО на текст эпизода; не придумывай событий, которых в нём нет, и не своди его к другим воспоминаниям. Называй секс, насилие, боль, страх своими именами, если они есть. Верни только JSON-объект, где ключ — id ноды, значение — строка текста.`;
        return { system, user: `ЭПИЗОДЫ:\n\n${entries}` };
    }

    const entries = nodes.map(node => {
        const children = interpretationRepo.children(subjectId, node.id)
            .map(child => `- ${child.label}: ${child.content || '(нет интерпретации)'}`).join('\n');
        const ownFact = node.id.startsWith('bio:')
            ? subjectFacts.find(f => f.id === `bio_${node.id.slice(4)}`)
            : null;
        const bioForNode = ownFact ? `- ${ownFact.term}: ${ownFact.fact}` : bioLines;
        return `НОДА ${node.id} («${node.label}», ${kindHint[node.kind] || 'интерпретация'}):\nвалентность ${node.valence.toFixed(2)}, сила ${node.strength.toFixed(2)}\nДОЧЕРНИЕ:\n${children || '(нет)'}\nБИОГРАФИЯ:\n${bioForNode || '(нет)'}`;
    }).join('\n\n');

    const system = `Ты — ${characterName}, персонаж на изолированной космической станции. Ты пересматриваешь несколько своих интерпретаций. Для КАЖДОЙ напиши 1–3 предложения от первого лица («я/мне/меня»), как ты сейчас это понимаешь. Опирайся ТОЛЬКО на факты и дочерние интерпретации; не добавляй событий, которых нет. Факты — неизменяемая истина, но твоё ОТНОШЕНИЕ к ним зависит от твоего характера и опыта. Называй секс, насилие, боль, страх своими именами, если они есть. Верни только JSON-объект, где ключ — id ноды, значение — строка текста.`;
    const user = `ФАКТЫ МИРА:\n${factLines}\n\n${entries}`;
    return { system, user };
}

/** Регенерирует батч dirty-нод одного kind за один LLM-запрос (листья раньше родителей). */
export async function consolidateNextInterpretation(): Promise<boolean> {
    if (running) return false;
    running = true;
    try {
        const subjects = db.prepare(`SELECT DISTINCT subject_id FROM interpretation_nodes WHERE status = 'dirty'`).all() as Array<{ subject_id: string }>;
        if (!subjects.length) return false;

        // Один субъект за проход (round-robin по порядку).
        const subjectId = subjects[0].subject_id;
        const dirty = interpretationRepo.listForSubject(subjectId).filter(node => node.status === 'dirty');

        // Листья (episode/trait/relationships) раньше родителей (self/others/world/accumulated/worldview).
        const leafFirst = ['episode', 'trait', 'relationships', 'world_knowledge', 'biography', 'self', 'others', 'world', 'accumulated', 'worldview'];
        dirty.sort((a, b) => leafFirst.indexOf(a.kind) - leafFirst.indexOf(b.kind));
        if (!dirty.length) return false;

        const character = db.prepare(`SELECT name FROM characters WHERE id = ? OR subject_id = ? LIMIT 1`).get(subjectId, subjectId) as any;
        const characterName = character?.name || subjectId;

        // Батч: все dirty-ноды одного (первого по приоритету) kind за один запрос.
        const batchKind = dirty[0].kind;
        const batch = dirty.filter(node => node.kind === batchKind);

        // Отфильтровать ноды, чей fingerprint не изменился (снять dirty без LLM).
        const toGenerate: InterpretationNode[] = [];
        for (const node of batch) {
            const fingerprint = fingerprintFor(subjectId, node);
            if (node.fingerprint === fingerprint && node.content) {
                interpretationRepo.setStatus(subjectId, node.id, 'ready');
            } else {
                toGenerate.push({ ...node, fingerprint });
            }
        }
        if (!toGenerate.length) return true;

        for (const node of toGenerate) interpretationRepo.setStatus(subjectId, node.id, 'generating');
        const { system, user } = buildBatchPrompt(subjectId, toGenerate, characterName);
        const result = await parseVerbalInputWithLLM([{ role: 'system', content: system }, { role: 'user', content: user }], { type: 'json_object' }, 'memory');
        const parsed = result?.parsed;
        for (const node of toGenerate) {
            const content = String(parsed?.[node.id] || '').trim();
            if (!content) {
                interpretationRepo.setStatus(subjectId, node.id, 'ready');
                continue;
            }
            interpretationRepo.upsert({
                ...node,
                content,
                fingerprint: node.fingerprint,
                status: 'ready',
            });
        }
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
