import 'dotenv/config';
import '../src/infrastructure/db';
import { subjectRepo, pointStateRepo, characterRelationRepo, presetRepo } from '../src/infrastructure/repositories';
import { compileAction } from '../src/compiler/compileAction';
import { runTick } from '../src/engine/runTick';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';
import { buildReactionTurnMessage } from '../src/narrative/reactionFrame';
import { generateCharacterReply } from '../src/adapters/llmAdapter';

const SUBJ = 'S-AV-01';
const INITIATOR = 'PL-1';

// Разнообразный набор: боль, ласка, фиксация, электро, интим, поза, осмотр
const EVENTS: Array<[string, string]> = [
    ['act_slap', 'face'],
    ['act_punch', 'belly'],
    ['act_caress', 'neck'],
    ['act_kiss', 'lips'],
    ['act_apply_collar', 'neck'],
    ['act_shock_collar', 'neck'],
    ['eq_blindfold_apply', 'head'],
    ['eq_gag_apply', 'lips'],
    ['act_apply_handcuffs', 'hands'],
    ['act_suspend_wrists', 'hands'],
    ['act_connect_tens', 'nipples'],
    ['act_start_electrostimulation', 'clitoris'],
    ['act_start_vibrator', 'clitoris'],
    ['act_insert_plug', 'vagina'],
    ['finger_insertion', 'vagina'],
    ['act_start_penetration', 'vagina'],
    ['act_start_oral_giving', 'lips'],
    ['act_sexual_climax', 'clitoris'],
    ['act_examine', 'chest'],
    ['act_present_feet', 'feet'],
];

function defaultPoint(pointId: string) {
    return { pointId, localSensitivity: 50, localAttitude: 50, localOpenness: 50, familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 50, baselineLocalAttitude: 50, baselineLocalOpenness: 50 };
}

async function runOne(actionId: string, pointId: string, index: number) {
    const core = subjectRepo.get(SUBJ)!;
    const point = pointStateRepo.get(SUBJ, pointId) || defaultPoint(pointId);
    const relation = characterRelationRepo.get(SUBJ, INITIATOR);
    const action = compileAction({ presetId: actionId, eventId: 'scene_lab_calibrator', activeContexts: [], familiarity: point.familiarity ?? 0 });
    const output = runTick({ subjectId: SUBJ, pointId, action, core, point, relationship: relation ? { attitude: relation.attitude, openness: relation.openness, plasticity: relation.plasticity, familiarityLevel: relation.familiarityLevel } : undefined });
    const payload = await buildPromptPayloadWithDB(SUBJ, SUBJ, output, 'scene_lab_calibrator', { initiatorId: INITIATOR });
    const userInput = payload.reactionFrame ? buildReactionTurnMessage(payload.reactionFrame) : undefined;
    const reply = await generateCharacterReply(payload, userInput);

    const label = presetRepo.getActionPreset(actionId)?.label || actionId;
    const pointLabel = presetRepo.getPointPreset(pointId)?.label || pointId;
    const speech = reply.reply && typeof reply.reply === 'object' ? (reply.reply as any).speech : String(reply.reply);

    // Extract the full sensory block (5 fields) from the turn message
    const sv = payload.reactionFrame?.event?.sensoryVariant;
    const sensoryLines = sv
        ? [sv.stimulus, sv.texture, sv.rhythm, sv.bodilyResponse, sv.aftereffect].filter(Boolean)
        : ['(нет варианта в матрице — fallback)'];

    console.log(`\n${'─'.repeat(64)}`);
    console.log(`[${String(index + 1).padStart(2)}/20] ${label} → ${pointLabel}`);
    console.log(`${'─'.repeat(64)}`);
    for (const line of sensoryLines) console.log(`  ${line}`);
    console.log(`  ── ОТВЕТ: ${speech.replace(/\n/g, ' ').slice(0, 180)}`);
}

async function main() {
    console.log(`Субъект: ${SUBJ} (${subjectRepo.get(SUBJ)?.name}) | sensitivity=${subjectRepo.get(SUBJ)?.sensitivity?.toFixed(1)} capacity=${subjectRepo.get(SUBJ)?.capacity?.toFixed(1)} attitude=${subjectRepo.get(SUBJ)?.attitude?.toFixed(1)} tension=${subjectRepo.get(SUBJ)?.tension?.toFixed(1)}`);
    await generateCharacterReply({ systemPrompt: 'тест', reactionFrame: undefined } as any, 'тест').catch(() => {});
    for (let i = 0; i < EVENTS.length; i++) {
        const [a, p] = EVENTS[i];
        try { await runOne(a, p, i); } catch (e: any) { console.log(`\n[${i + 1}/20] ${a} × ${p} — ОШИБКА: ${e?.message || e}`); }
    }
    console.log('\n=== ГОТОВО ===');
}

main();
