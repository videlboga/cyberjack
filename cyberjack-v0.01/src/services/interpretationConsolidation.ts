import { db } from '../infrastructure/db';
import { interpretationRepo } from '../infrastructure/interpretationRepo';
import { ensureInterpretationTree } from './interpretationSeed';

/**
 * Консолидация графа интерпретаций — детерминированное распространение.
 *
 * Шаг 3 плана: из ассоциаций эпизода вычисляем, какие родительские ноды
 * затронуты и с каким delta, БЕЗ LLM. Регенерация content (шаг 4-5) — отдельный
 * воркер, который читает ноды со status='dirty'.
 *
 * Маппинг ассоциация → родитель:
 *   person-ассоциация → rel:<person>  (delta = valence × strength)
 *   tag-ассоциация    → trait:<tag>    (delta = valence × strength)
 *   тема биографии    → bio:<key>      (по тегам/названию эпизода)
 *   appraisal/agency  → self           (delta по appraisal)
 */

const DELTA_THRESHOLD = 0.15;
const MAX_NODES_PER_CONSOLIDATION = 5;

export interface AssociationSignal {
    type: 'person' | 'concept';
    key: string;
    label: string;
    tagLinks: string[];
    valence: number;
    strength: number;
    expectation: string;
}

/** Создаёт/обновляет episode-ноду и возвращает её id. */
function ensureEpisodeNode(subjectId: string, episodeId: number, title: string, text: string): string {
    const id = `episode:${episodeId}`;
    const existing = interpretationRepo.get(subjectId, id);
    interpretationRepo.upsert({
        id,
        subjectId,
        kind: 'episode',
        parentId: null, // эпизод висит на родителях через кросс-линки
        label: title || `Эпизод ${episodeId}`,
        content: text,
        valence: 0,
        strength: 0,
        fingerprint: text.slice(0, 200),
    });
    return id;
}

/** Детерминированно вычисляет затронутых родителей и delta. */
export function propagateEpisode(
    subjectId: string,
    episodeId: number,
    title: string,
    text: string,
    associations: AssociationSignal[],
    appraisal?: string,
): { touched: string[]; deltas: Map<string, number> } {
    ensureInterpretationTree(subjectId);
    const episodeNodeId = ensureEpisodeNode(subjectId, episodeId, title, text);

    const deltas = new Map<string, number>();
    const touched: string[] = [];

    const addDelta = (nodeId: string, delta: number) => {
        deltas.set(nodeId, (deltas.get(nodeId) || 0) + delta);
    };

    for (const assoc of associations) {
        if (assoc.type === 'person') {
            // rel:<person>
            const relId = `rel:${assoc.key}`;
            ensureNode(subjectId, relId, 'relationships', 'relationships', assoc.label);
            addDelta(relId, assoc.valence * assoc.strength);
            // кросс-линк эпизод → rel
            link(subjectId, episodeNodeId, relId, 'evidence', Math.abs(assoc.valence) * assoc.strength);
        }
        // tag-ассоциации → trait:<tag>
        for (const tag of assoc.tagLinks) {
            if (!/^[a-z0-9_-]+$/i.test(tag)) continue;
            const traitId = `trait:${tag}`;
            ensureNode(subjectId, traitId, 'trait', 'self', tag);
            addDelta(traitId, assoc.valence * assoc.strength);
            link(subjectId, episodeNodeId, traitId, 'evidence', Math.abs(assoc.valence) * assoc.strength);
        }
    }

    // appraisal/agency → self
    if (appraisal) {
        const selfDelta = appraisalValence(appraisal);
        if (Math.abs(selfDelta) >= DELTA_THRESHOLD) {
            addDelta('self', selfDelta);
            link(subjectId, episodeNodeId, 'self', 'evidence', Math.abs(selfDelta));
        }
    }

    // Применяем только значимые delta, ограничивая число нод.
    const significant = Array.from(deltas.entries())
        .filter(([, delta]) => Math.abs(delta) >= DELTA_THRESHOLD)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, MAX_NODES_PER_CONSOLIDATION);

    for (const [nodeId, delta] of significant) {
        const node = interpretationRepo.get(subjectId, nodeId);
        if (!node) continue;
        const nextValence = clamp(node.valence + delta, -1, 1);
        const nextStrength = clamp(node.strength + Math.abs(delta) * 0.5, 0, 1);
        interpretationRepo.upsert({
            ...node,
            valence: nextValence,
            strength: nextStrength,
            status: 'dirty', // регенерация content воркером
        });
        touched.push(nodeId);
    }

    return { touched, deltas: new Map(significant) };
}

function ensureNode(subjectId: string, id: string, kind: string, parentId: string, label: string) {
    if (interpretationRepo.get(subjectId, id)) return;
    interpretationRepo.upsert({ id, subjectId, kind: kind as any, parentId, label, content: null, valence: 0, strength: 0, fingerprint: null });
}

function link(subjectId: string, fromId: string, toId: string, kind: 'cross' | 'evidence', weight: number) {
    const id = `${fromId}->${toId}`;
    interpretationRepo.upsertLink({ id, subjectId, fromId, toId, kind, weight });
}

function appraisalValence(appraisal: string): number {
    const text = appraisal.toLowerCase();
    if (/бессмысленн|никто не понима|не поддержива|одинок|отверг|брошен|унижен|сломан/.test(text)) return -0.3;
    if (/понял|поддержал|принял|укрепил|стало легче|справил|горжусь/.test(text)) return 0.3;
    return 0;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
