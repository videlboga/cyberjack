import 'dotenv/config';
import '../src/infrastructure/db';
import { db } from '../src/infrastructure/db';
import { runAutonomousSceneMinute } from '../src/orchestration/autonomousScene';
import { processPendingSocialTurns } from '../src/services/socialTransactions';

async function main() {
    const row = db.prepare(`SELECT total_minutes FROM world_state WHERE id='main'`).get() as any;
    const cur = Number(row.total_minutes);
    const forced = Math.ceil(cur / 5) * 5;
    console.log(`worldMinute: ${cur} -> форсируем до ${forced}`);

    // Время двигается только вперёд. Откат часов назад ломает производные
    // данные (chat_memory.world_minute, subject_physiology.last_meal_minute и
    // т.п.), записанные с «будущим» временем: проверки вида
    // `worldMinute - last_meal_minute >= 60` перестают работать. Поэтому
    // форсированное время остаётся, а не возвращается к исходному.
    db.prepare(`UPDATE world_state SET total_minutes=? WHERE id='main'`).run(forced);

    console.log('=== Автономная симуляция (создание соц.планов) ===');
    const executed = await runAutonomousSceneMinute();
    console.log('Создано планов:', executed.length);
    for (const e of executed) console.log(`  ${e.actorId} -> ${e.targetId} : ${e.actionId}`);

    console.log('=== Генерация реплик ===');
    await processPendingSocialTurns();

    const applied = (db.prepare(`SELECT COUNT(*) c FROM pending_social_turns WHERE status='applied'`).get() as any).c;
    console.log('Всего applied-ходов:', applied);
    console.log(`Время осталось: ${forced} (без отката)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
