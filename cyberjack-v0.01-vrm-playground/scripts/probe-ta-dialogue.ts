import 'dotenv/config';
import '../src/infrastructure/seed';
import { db } from '../src/infrastructure/db';
import { createSocialTurnPlan, describeSocialObservation } from '../src/services/socialTransactions';
import { characterRelationRepo } from '../src/infrastructure/repositories';
import { buildCharacterTurnContext } from '../src/orchestration/characterTurnContext';
import { prepareCharacterSpeechStimuli } from '../src/services/characterSpeechStimulus';
import { executeCharacterSpeech } from '../src/services/characterSpeechExecutor';
import { getLaboratoryPresence } from '../src/scenario/spatialContext';
import { characterRepo } from '../src/infrastructure/repositories';
import { computeTransactionalStep } from '../src/services/transactionalStep';
import { strokeHunger } from '../src/services/transactionalStrategy';

const A = 'NPC-CAND-01'; // Ника
const B = 'NPC-CAND-SUMI'; // Суми

function currentWorldMinute() {
    const row = db.prepare("SELECT MAX(world_minute) AS m FROM chat_memory").get() as any;
    return Number(row?.m || 0);
}

function coPresence(actorId: string, targetId: string) {
    const ap = getLaboratoryPresence(actorId, 'PL-1');
    const tp = getLaboratoryPresence(targetId, 'PL-1');
    if (!ap?.roomId || ap.roomId !== tp?.roomId) return undefined;
    const room = db.prepare(`SELECT room_id, name, room_type FROM laboratory_rooms WHERE player_id = ? AND room_id = ?`).get('PL-1', ap.roomId) as any;
    return room ? { roomId: room.room_id, roomName: room.name, roomType: room.room_type } : undefined;
}

async function generateOne(speakerId: string, recipientId: string, worldMinute: number, incomingSpeech?: string, showPrompt = false) {
    const plan = createSocialTurnPlan(speakerId, recipientId, worldMinute, 'co_presence', undefined, coPresence(speakerId, recipientId));
    if (!plan) return { ok: false, reason: 'no plan' };
    const payload = (await buildCharacterTurnContext({
        subjectId: plan.speakerId,
        stimulus: { kind: 'internal_impulse', impulseId: `social:${plan.id}` },
        eventId: 'scene_lab_calibrator',
        initiatorId: plan.recipientId,
        addresseeId: plan.recipientId,
    })).payload;
    const recipientName = characterRepo.displayNameFor(plan.recipientId);
    const rr = characterRelationRepo.get(speakerId, recipientId);
    const familiarity = rr ? Number(rr.familiarityLevel || 0) : 0;
    const taStep = computeTransactionalStep({
        myEgo: plan.derivedEgoState || plan.egoState,
        familiarity,
        lifePosition: plan.hiddenPosition || 'ok_ok',
        need: plan.need,
        stress: strokeHunger(plan.strokeBalance) * 100,
        gameActive: Boolean(plan.gameId),
        gameDrive: plan.gameId || undefined,
    });
    const observation = describeSocialObservation(plan.observation, plan.recipientId);
    const stimuli = [
        ...(incomingSpeech ? [{ kind: 'external_speech' as const, speech: incomingSpeech }] : []),
        {
            kind: 'internal_impulse' as const,
            event: {
                action: incomingSpeech ? 'ответ в самостоятельном разговоре' : 'самостоятельное начало разговора',
                target: recipientName,
                experience: [`Тема: ${plan.topic}.`, plan.topicContext, observation].filter(Boolean).join(' '),
                directlyExperienced: true,
                affectedCharacter: characterRepo.displayNameFor(plan.speakerId),
            },
            impulse: {
                id: `social:${plan.act}`,
                primaryIntent: `${taStep.image}`,
                secondaryConflict: `Ты обращаешься к ${recipientName} по теме «${plan.topic}»: ${plan.topicContext}`,
                allowedSpeechActs: ['probe', 'acknowledge', 'admit'],
            },
        },
    ];
    const prepared = prepareCharacterSpeechStimuli(payload, stimuli as any);
    if (!prepared) return { ok: false, reason: 'no reactionFrame' };
    if (showPrompt) {
        console.log("\n--- systemPrompt (ужатый) ---");
        console.log(prepared.payload.systemPrompt);
        console.log("\n--- userMsg ---");
        console.log(prepared.userInput);
    }
    const result = await executeCharacterSpeech({
        payload: prepared.payload,
        userInput: prepared.userInput,
        history: [],
        source: 'social_initiative',
    });
    if (result.success) return { ok: true, speech: result.speech, topic: plan.topic, act: plan.act };
    return { ok: false, reason: result.error };
}

const name = (id: string) => id === A ? 'Ника' : 'Суми';

async function main() {
    const showPrompt = process.argv.includes('--prompt');
    let worldMinute = currentWorldMinute() || 1440;
    let lastSpeech: string | undefined;
    const speakers = [A, B];
    for (let i = 0; i < 12; i++) {
        const speaker = speakers[i % 2];
        const recipient = speaker === A ? B : A;
        const res = await generateOne(speaker, recipient, worldMinute, lastSpeech, showPrompt && i === 1);
        if (!res.ok) { console.log(`[${i+1}] FAILED: ${res.reason}`); break; }
        console.log(`[${i+1}] ${name(speaker)} (${res.act}, ${res.topic}): ${res.speech}`);
        lastSpeech = res.speech;
        worldMinute += 3;
    }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
