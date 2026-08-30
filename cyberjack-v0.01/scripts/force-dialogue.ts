import 'dotenv/config';
import '../src/infrastructure/db';
import { db } from '../src/infrastructure/db';
import { createSocialTurnPlan, enqueueSocialTurn, processPendingSocialTurns } from '../src/services/socialTransactions';

async function main() {
    const wm = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id='main'`).get() as any).total_minutes);
    console.log(`worldMinute: ${wm}`);

    // Ника (NPC-CAND-01) и Суми (NPC-CAND-SUMI) — обе в комнате B, свободны
    const pairs = [
        ['NPC-CAND-01', 'NPC-CAND-SUMI'],
        ['NPC-CAND-SUMI', 'NPC-CAND-01'],
    ];
    for (const [speaker, recipient] of pairs) {
        const plan = createSocialTurnPlan(speaker, recipient, wm, 'co_presence', undefined, {
            roomId: 'room_cell_b',
            roomName: 'Жилая камера B',
            topicContext: 'Вы живёте в одной камере «Жилая камера B». Это ваш общий быт и неизбежное соседство; можно начать знакомство, осторожно спросить о самочувствии или о том, как другая переносит происходящее. Не выдавай это за дружбу или доверие.',
        });
        if (plan) {
            enqueueSocialTurn(plan);
            console.log(`План: ${speaker} -> ${recipient} : act=${plan.act} ego=${plan.egoState}`);
        } else {
            console.log(`Нет плана: ${speaker} -> ${recipient}`);
        }
    }

    console.log('=== Генерация реплик ===');
    await processPendingSocialTurns();

    const applied = db.prepare(`SELECT id, speaker_id, recipient_id, speech FROM pending_social_turns WHERE status='applied' ORDER BY updated_at DESC LIMIT 4`).all() as any[];
    console.log('=== Свежие диалоги ===');
    for (const a of applied) {
        console.log(`\n[${a.speaker_id} -> ${a.recipient_id}]`);
        console.log(`  ${a.speech}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
