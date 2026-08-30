import { db } from '../infrastructure/db';
import { interpretationRepo } from '../infrastructure/interpretationRepo';
import { WORLD_GLOSSARY } from '../domain/worldGlossary';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';

/**
 * Сид графа интерпретаций: глоссарий → world_facts (неизменяемые атомы),
 * и каркас дерева нод для каждого субъекта.
 *
 * Структура отражает личность, а не «склад знаний»:
 *
 *   worldview (жизненный сценарий — ядро)
 *   ├── biography (идентичность — неизменяемые факты)
 *   │   └── bio:<n>
 *   ├── world_knowledge (изначальные знания о мире — неизменяемые)
 *   │   └── world_knowledge:<key>
 *   └── accumulated (накопленное — меняется от событий)
 *       ├── self (я-концепция)
 *       │   ├── self_esteem / self_image / boundaries
 *       │   └── trait:<tag>
 *       ├── others (модели других)
 *       │   └── rel:<person> → episode:<id>
 *       └── world (убеждения о мире)
 *           └── episode:<id>
 *
 * biography и world_knowledge консолидируются ОДИН раз при создании персонажа
 * (или при прямом вмешательстве через кресло) и дальше заморожены. Регулярно
 * консолидируется только accumulated.
 */

const FACT_IDS: Record<string, string> = {
    'станция': 'fact_station',
    'Аномалия': 'fact_anomaly',
    'изучение Аномалии': 'fact_study',
    'Актив': 'fact_asset',
    'Калибровка': 'fact_calibration',
    'Калибратор': 'fact_calibrator',
    'Эксперимент': 'fact_experiment',
    'Контракт': 'fact_contract',
};

export function seedWorldFacts() {
    WORLD_GLOSSARY.forEach((entry, index) => {
        interpretationRepo.upsertFact({
            id: FACT_IDS[entry.term] || `fact_${index}`,
            term: entry.term,
            fact: entry.fact,
            sortOrder: index,
        });
    });
}

/** Ключи изначальных знаний о мире (подветви world_knowledge). */
const WORLD_KNOWLEDGE_KEYS = ['аномалия', 'активы', 'калибровка', 'контракты', 'эксперименты'];

/** Подветви я-концепции (self). */
const SELF_FACETS = [
    { id: 'self_esteem', label: 'Самооценка' },
    { id: 'self_image', label: 'Самообраз' },
    { id: 'boundaries', label: 'Границы' },
];

/** Каркас дерева для субъекта: worldview → biography / world_knowledge / accumulated. */
export function ensureInterpretationTree(subjectId: string) {
    const upsert = (id: string, kind: string, parentId: string | null, label: string) => {
        const existing = interpretationRepo.get(subjectId, id);
        if (existing) return;
        // Каркас создаётся dirty, чтобы сконсолидировался ОДИН раз при первом
        // проходе (biography/world_knowledge — изначальные, дальше заморожены).
        interpretationRepo.upsert({ id, subjectId, kind: kind as any, parentId, label, content: null, sourceText: null, valence: 0, strength: 0, fingerprint: null, status: 'dirty' });
    };
    upsert('worldview', 'worldview', null, 'Сценарий жизни');
    // Изначальное (неизменяемое).
    upsert('biography', 'biography', 'worldview', 'Биография');
    upsert('world_knowledge', 'world_knowledge', 'worldview', 'Знания о мире');
    for (const key of WORLD_KNOWLEDGE_KEYS) {
        upsert(`world_knowledge:${key}`, 'world_knowledge', 'world_knowledge', key);
    }
    // Накопленное (меняется от событий).
    upsert('accumulated', 'accumulated', 'worldview', 'Накопленное');
    upsert('self', 'self', 'accumulated', 'Я-концепция');
    for (const facet of SELF_FACETS) {
        upsert(facet.id, 'self', 'self', facet.label);
    }
    upsert('others', 'others', 'accumulated', 'Другие');
    upsert('world', 'world', 'accumulated', 'Мир');
}

/** Все субъекты (не PL-1 и не пустые legacy-строки), для которых строится дерево. */
export function allSubjectIds(): string[] {
    const rows = db.prepare(`SELECT id FROM subjects WHERE id != 'PL-1' AND id != ''`).all() as Array<{ id: string }>;
    return rows.map(row => row.id);
}

/** Разбивает биографию субъекта на атомы-факты (неизменяемые, как глоссарий),
 *  и создаёт под ветвью biography отдельную ноду-интерпретацию на каждый факт. */
export function seedSubjectFacts(subjectId: string) {
    const profile = ensureGeneratedProfile(subjectId);
    const bio = profile.biography || {} as any;
    const lines: Array<{ term: string; fact: string }> = [];
    const push = (term: string, fact: string | undefined) => { if (fact && String(fact).trim()) lines.push({ term, fact: String(fact).trim() }); };
    for (const origin of (Array.isArray(bio.origin) ? bio.origin : [])) push('происхождение', origin);
    push('прежняя роль', bio.formerRole);
    push('причина статуса', bio.statusCause);
    for (const event of (Array.isArray(bio.formativeEvents) ? bio.formativeEvents : [])) push('событие', event);
    lines.forEach((line, index) => {
        interpretationRepo.upsertSubjectFact({
            id: `bio_${index}`,
            subjectId,
            term: line.term,
            fact: line.fact,
            sortOrder: index,
        });
        // Нода-интерпретация под ветвью biography: label — краткая выжимка факта.
        const label = line.fact.length > 48 ? line.fact.slice(0, 48).trimEnd() + '…' : line.fact;
        const nodeId = `bio:${index}`;
        if (!interpretationRepo.get(subjectId, nodeId)) {
            interpretationRepo.upsert({
                id: nodeId,
                subjectId,
                kind: 'biography',
                parentId: 'biography',
                label,
                content: null,
                sourceText: line.fact,
                valence: 0,
                strength: 0,
                fingerprint: null,
                status: 'dirty',
            });
        }
    });
}

/**
 * Миграция legacy-структуры в новую. Перемапливает старые ноды:
 *   station → world_knowledge, station:<key> → world_knowledge:<key>,
 *   relationships → others, rel:<person> parent → others,
 *   trait:<tag> parent → self, self parent → accumulated.
 * Идемпотентна: применяется только если найдены legacy-ноды.
 */
export function migrateInterpretationTree(subjectId: string) {
    const nodes = interpretationRepo.listForSubject(subjectId);
    const byId = new Map(nodes.map(n => [n.id, n]));

    // 1. station → world_knowledge (ветка и подветки).
    const stationBranch = byId.get('station');
    if (stationBranch) {
        interpretationRepo.upsert({ ...stationBranch, id: 'world_knowledge', kind: 'world_knowledge' as any, parentId: 'worldview', label: 'Знания о мире' });
        interpretationRepo.remove(subjectId, 'station');
    }
    for (const node of nodes) {
        if (node.id.startsWith('station:') && node.kind === 'station') {
            const key = node.id.slice('station:'.length);
            interpretationRepo.upsert({ ...node, id: `world_knowledge:${key}`, kind: 'world_knowledge' as any, parentId: 'world_knowledge' });
            interpretationRepo.remove(subjectId, node.id);
        }
    }

    // 2. relationships → others.
    const relBranch = byId.get('relationships');
    if (relBranch) {
        interpretationRepo.upsert({ ...relBranch, id: 'others', kind: 'others' as any, parentId: 'accumulated', label: 'Другие' });
        interpretationRepo.remove(subjectId, 'relationships');
    }

    // 3. self parent → accumulated (если ещё под worldview).
    const selfBranch = byId.get('self');
    if (selfBranch && selfBranch.parentId !== 'accumulated') {
        interpretationRepo.upsert({ ...selfBranch, parentId: 'accumulated' });
    }

    // 4. rel:<person> parent → others.
    for (const node of interpretationRepo.listForSubject(subjectId)) {
        if (node.id.startsWith('rel:') && node.kind === 'relationships') {
            interpretationRepo.upsert({ ...node, kind: 'relationships' as any, parentId: 'others' });
        }
    }

    // 5. trait:<tag> parent → self.
    for (const node of interpretationRepo.listForSubject(subjectId)) {
        if (node.id.startsWith('trait:') && node.kind === 'trait') {
            interpretationRepo.upsert({ ...node, parentId: 'self' });
        }
    }
}

export function seedInterpretationTrees() {
    seedWorldFacts();
    // Убираем осиротевшие ноды/линки от legacy-пустого subject_id (id='').
    db.prepare(`DELETE FROM interpretation_links WHERE subject_id = ''`).run();
    db.prepare(`DELETE FROM interpretation_nodes WHERE subject_id = ''`).run();
    for (const subjectId of allSubjectIds()) {
        ensureInterpretationTree(subjectId);
        migrateInterpretationTree(subjectId);
        seedSubjectFacts(subjectId);
    }
}
