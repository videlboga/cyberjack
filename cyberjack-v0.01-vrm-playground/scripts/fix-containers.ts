/**
 * Разовый ремонт: контейнер-ветки (biography/world_knowledge/accumulated/others/
 * worldview) с content=NULL у субъектов, чьи дети уже готовы. Переводим в dirty;
 * fingerprint чистим. Прогнать onepass.ts.
 */
import { db } from '../src/infrastructure/db';

const containers = db.prepare(`
    SELECT n.subject_id, n.id, n.kind, n.label
    FROM interpretation_nodes n
    WHERE n.kind IN ('biography','world_knowledge','accumulated','others','worldview','self','world')
      AND (n.content IS NULL OR n.content = '')
      AND EXISTS (SELECT 1 FROM interpretation_nodes c
                  WHERE c.subject_id = n.subject_id AND c.parent_id = n.id
                    AND c.content IS NOT NULL AND c.content != '')
    ORDER BY n.subject_id, n.id
`).all() as Array<{ subject_id: string; id: string; kind: string; label: string }>;
console.log(`[FixContainers] контейнеров с детьми и пустым content: ${containers.length}`);
const upd = db.prepare(`UPDATE interpretation_nodes SET status='dirty', fingerprint=NULL WHERE subject_id=? AND id=?`);
for (const row of containers) {
    upd.run(row.subject_id, row.id);
    console.log(`  ${row.subject_id} ${row.id} (${row.kind}) → dirty`);
}
console.log('[FixContainers] готово');