import 'dotenv/config';
import '../src/infrastructure/seed';
import { db } from '../src/infrastructure/db';
import { createSocialTurnPlan, describeSocialObservation } from '../src/services/socialTransactions';
import { buildCharacterTurnContext } from '../src/orchestration/characterTurnContext';
import { prepareCharacterSpeechStimuli } from '../src/services/characterSpeechStimulus';
import { executeCharacterSpeech } from '../src/services/characterSpeechExecutor';
import { getLaboratoryPresence } from '../src/scenario/spatialContext';
import { characterRepo } from '../src/infrastructure/repositories';

const A = 'NPC-CAND-01'; // Ника
const B = 'NPC-CAND-SUMI'; // Суми

function currentWorldMinute(): number {
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

async function generateOne(speakerId: string, recipientId: string, worldMinute: number, incomingSpeech?: string) {
    const plan = createSocialTurnPlan(speakerId, recipientId, worldMinute, 'co_presence', undefined, coPresence(speakerId, recipientId));
    if (!plan) return { ok: false, reason: 'no plan (no topic/relation)' };
    const payload = (await buildCharacterTurnContext({
        subjectId: plan.speakerId,
        stimulus: { kind: 'internal_impulse', impulseId: `social:${plan.id}` },
        eventId: 'scene_lab_calibrator',
        initiatorId: plan.recipientId,
        addresseeId: plan.recipientId,
    })).payload;
    const recipientName = characterRepo.displayNameFor(plan.recipientId);
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
                primaryIntent: `Ты сама выбираешь социальный акт «${plan.act}» и обращаешься именно к ${recipientName}.`,
                secondaryConflict: `Ты обращаешься к ${recipientName} по теме «${plan.topic}»: ${plan.topicContext}`,
                allowedSpeechActs: ['probe', 'acknowledge', 'admit'],
            },
        },
    ];
    const prepared = prepareCharacterSpeechStimuli(payload, stimuli as any);
    if (!prepared) return { ok: false, reason: 'no reactionFrame' };
    const result = await executeCharacterSpeech({
        payload: prepared.payload,
        userInput: prepared.userInput,
        history: [],
        source: 'social_initiative',
    });
    if (result.success) {
        return { ok: true, speech: result.speech, topic: plan.topic, act: plan.act, error: undefined };
    }
    return { ok: false, speech: undefined, topic: plan.topic, act: plan.act, error: result.error };
}

const name = (id: string) => id === A ? 'Ника' : id === B ? 'Суми' : id;

async function main() {
    let worldMinute = currentWorldMinute() || 1440;
    let lastSpeech: string | undefined;
    const speakers = [A, B];
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) {
        const speaker = speakers[i % 2];
        const recipient = speaker === A ? B : A;
        const res = await generateOne(speaker, recipient, worldMinute, lastSpeech);
        if (!res.ok) {
            lines.push(`[${i + 1}] ${name(speaker)} -> ${name(recipient)}: FAILED (${res.reason || res.error})`);
            break;
        }
        lines.push(`[${i + 1}] ${name(speaker)} (${res.act}, тема: ${res.topic}): ${res.speech}`);
        lastSpeech = res.speech;
        worldMinute += 3;
    }
    console.log('\n===== ДИАЛОГ (20 ходов) =====');
    for (const l of lines) console.log(l);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
