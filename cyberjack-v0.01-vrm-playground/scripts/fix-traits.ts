/**
 * Точечная догенерация: trait/relationships/others-ноды, чей ключ LLM
 * систематически пропускает в батч-ответе. Генерируем по одной ноде,
 * одиночным запросом, пока content не появится (до 3 попыток на ноду).
 */
import { db } from '../src/infrastructure/db';
import { interpretationRepo } from '../src/infrastructure/interpretationRepo';
import { parseVerbalInputWithLLM } from '../src/adapters/llmAdapter';

const stuck = db.prepare(`
    SELECT id, subject_id, kind, parent_id, label, content, source_text, valence, strength, fingerprint, status
    FROM interpretation_nodes
    WHERE (content IS NULL OR content = '') AND kind IN ('trait','relationships','others')
    ORDER BY subject_id, id
`).all().map((row: any) => ({
    id: row.id,
    subjectId: row.subject_id,
    kind: row.kind,
    parentId: row.parent_id,
    label: row.label,
    content: row.content,
    sourceText: row.source_text,
    valence: row.valence,
    strength: row.strength,
    fingerprint: row.fingerprint,
    status: row.status,
})) as any[];

console.log(`[FixTraits] одиночных догенераций: ${stuck.length}`);

for (const node of stuck) {
    const character = db.prepare(`SELECT name FROM characters WHERE id = ? OR subject_id = ? LIMIT 1`).get(node.subject_id, node.subject_id) as any;
    const characterName = character?.name || node.subject_id;
    const facts = interpretationRepo.listSubjectFacts(node.subject_id)
        .map(f => `- ${f.term}: ${f.fact}`).join('\n');
    const kindHint = node.kind === 'trait' ? 'понимание собственного обучения/склонности'
        : node.kind === 'relationships' ? 'отношение к конкретному человеку' : 'отношение к другим людям';
    // Ассоциации-источники для trait/rel: из links evidence к этой ноде.
    const evidence = db.prepare(`
        SELECT l.weight, e.label, e.content FROM interpretation_links l
        JOIN interpretation_nodes e ON e.subject_id = l.subject_id AND e.id = l.from_id
        WHERE l.subject_id = ? AND l.to_id = ? ORDER BY l.weight DESC LIMIT 5
    `).all(node.subject_id, node.id) as any[];
    const evLines = evidence.map(e => `- «${e.label}»: ${(e.content || '').slice(0, 120)}`).join('\n') || '(нет)';

    for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await parseVerbalInputWithLLM([
            { role: 'system', content: `Ты — ${characterName}, персонаж на изолированной космической станции. Напиши 1–3 предложения от первого лица («я/мне/меня»): как ты сейчас понимаешь это про себя. Опирайся ТОЛЬКО на факты и подтверждения. Верни только JSON-объект с ключом "${node.id}", значение — строка текста.` },
            { role: 'user', content: `ФАКТЫ:\n${facts}\n\nПОДТВЕРЖДЕНИЯ:\n${evLines}\n\nНОДА ${node.id} («${node.label}», ${kindHint}):\nвалентность ${Number(node.valence).toFixed(2)}, сила ${Number(node.strength).toFixed(2)}` },
        ], { type: 'json_object' }, 'memory');
        const content = String((result?.parsed as any)?.[node.id] || '').trim();
        if (content) {
            interpretationRepo.upsert({ ...node, content, status: 'ready', fingerprint: `manual:${attempt}` });
            console.log(`  ok ${node.subject_id} ${node.id}: ${content.slice(0, 60)}…`);
            break;
        }
        console.log(`  attempt ${attempt} пусто для ${node.subject_id} ${node.id}`);
    }
}
console.log('[FixTraits] готово');