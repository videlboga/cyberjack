import 'dotenv/config';
import '../src/infrastructure/seed';
import { createSocialTurnPlan, enqueueSocialTurn, processPendingSocialTurns } from '../src/services/socialTransactions';
import { db } from '../src/infrastructure/db';

/**
 * Изолированный прогон диалога между двумя персонажами.
 * Использование: npx tsx scripts/probe-dialogue-pair.ts <speakerId> <recipientId> [maxTurns]
 */
const speakerId = process.argv[2] || 'NPC-CAND-SUMI';
const recipientId = process.argv[3] || 'NPC-CAND-01';
const maxTurns = parseInt(process.argv[4] || '6', 10);

async function run() {
    // Очистить диалоги и thread'ы для этой пары
    db.prepare("DELETE FROM chat_memory WHERE (speaker_id=? AND addressee_id=?) OR (speaker_id=? AND addressee_id=?)").run(speakerId, recipientId, recipientId, speakerId);
    db.prepare("DELETE FROM social_threads WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)").run(speakerId, recipientId, recipientId, speakerId);
    db.prepare("DELETE FROM pending_social_turns WHERE (speaker_id=? AND recipient_id=?) OR (speaker_id=? AND recipient_id=?)").run(speakerId, recipientId, recipientId, speakerId);

    const worldMinute = 110000;
    let current = speakerId;
    let other = recipientId;

    console.log(`\n=== Диалог: ${speakerId} ↔ ${recipientId} (${maxTurns} ходов) ===\n`);

    for (let i = 0; i < maxTurns; i++) {
        const plan = createSocialTurnPlan(current, other, worldMinute + i, 'co_presence');
        if (!plan) {
            console.log(`[ход ${i+1}] нет плана (${current} → ${other})`);
            break;
        }
        // Показать тему и мотивацию
        console.log(`[ход ${i+1}] ${current} → ${other} | тема: ${plan.topic}`);
        if (plan.topicContext) {
            const firstLine = plan.topicContext.split('\n')[0];
            console.log(`   контекст: ${firstLine.slice(0, 120)}`);
        }
        enqueueSocialTurn(plan);
        await processPendingSocialTurns();
        // Переключить говорящего
        [current, other] = [other, current];
    }

    // Показать результат
    const lines = db.prepare(
        "SELECT speaker_id, content FROM chat_memory WHERE (speaker_id=? AND addressee_id=?) OR (speaker_id=? AND addressee_id=?) ORDER BY id"
    ).all(speakerId, recipientId, recipientId, speakerId) as Array<{ speaker_id: string; content: string }>;

    console.log(`\n=== Результат (${lines.length} реплик) ===\n`);
    for (const l of lines) {
        console.log(`${l.speaker_id}: ${l.content.slice(0, 200)}`);
    }
}

run().catch(e => { console.error('ERR', e); process.exit(1); });
