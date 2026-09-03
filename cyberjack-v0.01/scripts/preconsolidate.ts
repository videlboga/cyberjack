/**
 * Предварительная консолидация графа интерпретаций.
 *
 * Biography/world_knowledge сидируются заранее и неизменяемы — их первичная
 * интерпретация зависит только от характера, поэтому генерируется офлайн,
 * ДО запуска мира. Рантайм-воркер остаётся только для опытных delta
 * (episode/trait/self/others от эпизодов).
 *
 * Запуск: npx tsx scripts/preconsolidate.ts [--all]
 *   по умолчанию — только неизменяемые kind (biography, world_knowledge);
 *   --all — всё грязное, включая опытные ветки (self/trait/rel/others/world).
 */
import { db } from '../src/infrastructure/db';
import { interpretationRepo } from '../src/infrastructure/interpretationRepo';
import { consolidateNextInterpretation } from '../src/services/interpretationRegeneration';

const immutableKinds = new Set(['biography', 'world_knowledge']);
const all = process.argv.includes('--all');

async function main() {
    // Прогоняем только сидированные (ещё не интерпретированные) неизменяемые ноды:
    // content IS NULL и source_text IS NOT NULL — именно так выглядит свежий seed.
    const pending = db.prepare(`
        SELECT subject_id, COUNT(*) AS cnt
        FROM interpretation_nodes
        WHERE status = 'dirty' AND content IS NULL AND source_text IS NOT NULL
        GROUP BY subject_id
    `).all() as Array<{ subject_id: string; cnt: number }>;
    const total = pending.reduce((sum, row) => sum + row.cnt, 0);
    console.log(`[PreConsolidate] субъектов: ${pending.length}, сидированных нод: ${total}${all ? ' (+--all: опытные ветки тоже)' : ''}`);
    if (!total) { console.log('[PreConsolidate] нечего консолидировать'); return; }

    let pass = 0;
    const startedAt = Date.now();
    // Цикл до исчерпания: воркер берёт одного субъекта за проход (round-robin).
    for (;;) {
        const ok = await consolidateNextInterpretation();
        if (!ok) break;
        const row = db.prepare(`SELECT COUNT(*) AS cnt FROM interpretation_nodes WHERE status = 'dirty' AND content IS NULL AND source_text IS NOT NULL`).get() as { cnt: number };
        if (row.cnt % 20 < 5) console.log(`[PreConsolidate] осталось сидированных dirty: ${row.cnt}`);
        // --all: продолжаем, пока есть любые dirty; иначе останавливаемся, когда
        // неизменяемые исчерпаны (опытные ветки оставляем рантайму).
        if (!all) {
            const immovable = db.prepare(`SELECT COUNT(*) AS cnt FROM interpretation_nodes WHERE status = 'dirty' AND content IS NULL AND source_text IS NOT NULL AND kind IN ('biography','world_knowledge')`).get() as { cnt: number };
            if (!immovable.cnt) break;
        }
        if (Date.now() - startedAt > 55 * 60 * 1000) { console.log('[PreConsolidate] таймаут 55 мин — прерываюсь'); break; }
    }
    const done = db.prepare(`SELECT status, COUNT(*) AS cnt FROM interpretation_nodes GROUP BY status`).all();
    console.log(`[PreConsolidate] готово за ${Math.round((Date.now() - startedAt) / 1000)}с:`, JSON.stringify(done));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });