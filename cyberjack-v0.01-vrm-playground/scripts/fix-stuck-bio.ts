/**
 * Разовый ремонт: биографические ноды bio:N с content=NULL, «залипшие» в ready
 * (LLM не вернул ключ в батч-ответе — воркер молча снял dirty).
 * Переводим их обратно в dirty; fingerprint чистим, чтобы fingerprint-фильтр
 * их не отбросил. Затем прогнать scripts/onepass.ts (или preconsolidate --all).
 */
import { db } from '../src/infrastructure/db';

const stuck = db.prepare(`
    SELECT subject_id, id, label FROM interpretation_nodes
    WHERE kind IN ('biography','world_knowledge') AND (content IS NULL OR content = '')
    ORDER BY subject_id, id
`).all() as Array<{ subject_id: string; id: string; label: string }>;
console.log(`[FixStuck] залипших пустых нод: ${stuck.length}`);
const upd = db.prepare(`UPDATE interpretation_nodes SET status='dirty', fingerprint=NULL WHERE subject_id=? AND id=?`);
for (const row of stuck) {
    upd.run(row.subject_id, row.id);
    console.log(`  ${row.subject_id} ${row.id} «${row.label.slice(0, 40)}» → dirty`);
}
console.log('[FixStuck] готово');