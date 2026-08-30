import { db } from '../infrastructure/db';
import { interpretationRepo } from '../infrastructure/interpretationRepo';
import { WORLD_GLOSSARY } from '../domain/worldGlossary';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';

/**
 * Сид графа интерпретаций: глоссарий → world_facts (неизменяемые атомы),
 * и каркас дерева нод (worldview → ветви) для каждого субъекта.
 * Листья (episode/rel/trait) заполняются консолидацией из существующих данных.
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

/** Каркас дерева для субъекта: worldview + 4 ветви + station-подветви. */
export function ensureInterpretationTree(subjectId: string) {
    const upsert = (id: string, kind: string, parentId: string | null, label: string) => {
        const existing = interpretationRepo.get(subjectId, id);
        if (existing) return;
        interpretationRepo.upsert({ id, subjectId, kind: kind as any, parentId, label, content: null, sourceText: null, valence: 0, strength: 0, fingerprint: null });
    };
    upsert('worldview', 'worldview', null, 'Сценарий жизни');
    upsert('relationships', 'relationships', 'worldview', 'Отношения');
    upsert('biography', 'biography', 'worldview', 'Биография');
    upsert('station', 'station', 'worldview', 'Станция');
    upsert('self', 'self', 'worldview', 'Отношение к себе');
    for (const key of ['аномалия', 'активы', 'калибровка', 'контракты', 'эксперименты']) {
        upsert(`station:${key}`, 'station', 'station', key);
    }
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
            });
        }
    });
}

export function seedInterpretationTrees() {
    seedWorldFacts();
    // Убираем осиротевшие ноды/линки от legacy-пустого subject_id (id='').
    db.prepare(`DELETE FROM interpretation_links WHERE subject_id = ''`).run();
    db.prepare(`DELETE FROM interpretation_nodes WHERE subject_id = ''`).run();
    for (const subjectId of allSubjectIds()) {
        ensureInterpretationTree(subjectId);
        seedSubjectFacts(subjectId);
    }
}
