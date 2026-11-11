import { db } from '../infrastructure/db';
import { memoryRepo } from '../infrastructure/repositories';
import { buildEmbedding } from './embeddingService';

/**
 * Пересаживает изначальную биографию персонажа с заготовленного текста
 * на атомы памяти (type='biography'). Каждый элемент origin/formerRole/
 * formativeEvents становится отдельным фактом-атомом, на который потом
 * ссылаются эпизоды, разговоры и темы. Идемпотентно по типу 'biography'.
 */

const BIOGRAPHY_IDS = ['S-AV-01', 'NPC-LAB-01', 'NPC-CAND-01', 'NPC-CAND-SUMI',
    'NPC-CAND-GEN-02', 'NPC-CAND-GEN-03', 'NPC-CAND-GEN-04', 'NPC-CAND-GEN-05', 'NPC-CAND-KATE'];

export function seedBiographyFacts(characterId: string): number {
    const row = db.prepare('SELECT profile_json, subject_id FROM characters WHERE id = ?').get(characterId) as any;
    if (!row) return 0;
    let bio: any = {};
    try {
        const d = JSON.parse(row.profile_json || '{}');
        bio = d.generatedProfile?.biography || d.biography || {};
    } catch { return 0; }

    const facts: Array<{ text: string; tag: string }> = [];
    const origin = Array.isArray(bio.origin) ? bio.origin.map(String) : [];
    const formerRole = bio.formerRole ? String(bio.formerRole) : '';
    const formativeEvents = Array.isArray(bio.formativeEvents) ? bio.formativeEvents.map(String) : [];

    for (const item of origin) if (item.trim()) facts.push({ text: item.trim(), tag: 'biography_origin' });
    if (formerRole.trim()) facts.push({ text: formerRole.trim(), tag: 'biography_former_role' });
    for (const item of formativeEvents) if (item.trim()) facts.push({ text: item.trim(), tag: 'biography_formative_event' });

    if (!facts.length) return 0;
    const subjectId = row.subject_id || characterId;

    let written = 0;
    for (const fact of facts) {
        // Идемпотентность: пропускаем, если такой факт уже есть.
        const existing = db.prepare(
            `SELECT id FROM memory_embeddings WHERE subject_id = ? AND type = 'biography' AND text = ?`
        ).get(subjectId, fact.text);
        if (existing) continue;
        memoryRepo.save({
            subjectId,
            text: fact.text,
            embedding: buildEmbedding(fact.text),
            tags: ['biography', fact.tag],
            relatedSubjects: [characterId],
            type: 'biography',
            metadata: { biography: true, biographyKind: fact.tag },
        });
        written++;
    }
    return written;
}

export function seedAllBiographies(): number {
    let total = 0;
    for (const id of BIOGRAPHY_IDS) {
        total += seedBiographyFacts(id);
    }
    return total;
}
