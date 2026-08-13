import { randomUUID } from 'crypto';
import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';
import { db } from '../infrastructure/db';
import { characterRelationRepo, memoryRepo, subjectRepo } from '../infrastructure/repositories';
import { buildPromptPayloadWithDB } from '../prompts/buildPromptPayloadWrapper';
import { buildCharacterTurnContext } from '../orchestration/characterTurnContext';
import { buildEmbedding } from './embeddingService';
import { executeCharacterSpeech } from './characterSpeechExecutor';
import { deliverCharacterSpeech } from './characterSpeechDelivery';
import { prepareCharacterSpeechStimuli, type CharacterSpeechStimulus } from './characterSpeechStimulus';

export type EgoState = 'nurturing_parent' | 'critical_parent' | 'adult' | 'free_child' | 'adapted_child' | 'rebellious_child';
export type SocialNeed = 'safety' | 'clarity' | 'approval' | 'autonomy' | 'connection';
export type SocialAct = 'introduce' | 'check_in' | 'offer_support' | 'ask_boundary' | 'answer_question' | 'acknowledge_boundary' | 'continue_topic';
export type LifePosition = 'ok_ok' | 'ok_not_ok' | 'not_ok_ok' | 'not_ok_not_ok';
export type SocialObservation = {
    actorId?: string;
    targetId?: string;
    actionId?: string;
    actionLabel?: string;
    pointId?: string;
    worldMinute?: number | null;
};
export type SocialTurnPlan = { id:string; speakerId:string; recipientId:string; stimulus:'co_presence'|'observed_event'; egoState:EgoState; hiddenPosition:LifePosition; need:SocialNeed; act:SocialAct; topic:string; topicContext?:string; expectedReply:'adult_reply'|'accept_support'|'boundary'|'refusal'; physicalPermission:'none'|'request_only'; worldMinute:number; replyToTurnId?:string; incomingSpeech?:string; threadId?:string; observation?:SocialObservation };
export type SpeechSemantics = { speechAct:'answer'|'question'|'support'|'boundary'|'refusal'|'request'|'provocation'|'self_disclosure'; apparentEgoState:EgoState|'unclear'; transaction:'complementary'|'crossed'|'ulterior'|'unclear'; boundary:'none'|'set'|'accepted'|'violated'; invitation:'none'|'conversation'|'help'|'physical_contact'; openLoop:'none'|'question'|'request'|'offer'|'boundary'; conversationDisposition:'continue'|'close'|'unclear'; confidence:number };
export type PhysicalInitiativeBasis = 'consensual' | 'care' | 'protocol' | 'coercive' | 'violent' | null;
export type ConversationState = { turnCount:number; maxTurns:number; hardLimit:number; engagement:number };

const clamp = (value:number) => Math.max(0, Math.min(100, value));
const defaults = { egoState:'adult' as EgoState, hiddenPosition:'ok_ok' as LifePosition, need:'clarity' as SocialNeed };

function conversationState(sourceJson:string | undefined): ConversationState {
    try {
        const saved = JSON.parse(sourceJson || '{}').conversation;
        if (saved && typeof saved === 'object') return {
            turnCount: Math.max(0, Number(saved.turnCount || 0)),
            maxTurns: Math.max(2, Number(saved.maxTurns || 2)),
            hardLimit: Math.max(2, Number(saved.hardLimit || 6)),
            engagement: clamp(Number(saved.engagement ?? 50)),
        };
    } catch { /* keep the stable default for older threads */ }
    return { turnCount:0, maxTurns:2, hardLimit:6, engagement:50 };
}

function threadSource(sourceJson:string | undefined, conversation:ConversationState) {
    try { return { ...JSON.parse(sourceJson || '{}'), conversation }; }
    catch { return { conversation }; }
}

export function shouldContinueConversation(semantics:SpeechSemantics, current:ConversationState) {
    const turnCount = current.turnCount + 1;
    const declined = semantics.speechAct === 'refusal';
    const interrupted = semantics.boundary === 'violated' || semantics.transaction === 'crossed';
    const explicitlyClosed = semantics.conversationDisposition === 'close' || declined || interrupted;
    const openLoop = semantics.openLoop !== 'none';
    const cooperative = semantics.transaction === 'complementary' && semantics.boundary !== 'violated';
    const engagement = clamp(current.engagement + (cooperative ? 8 : -14) + (openLoop ? 5 : 0) + (semantics.speechAct === 'refusal' ? -25 : 0));
    // A new open loop earns one more turn, but never bypasses the hard limit.
    const maxTurns = Math.min(current.hardLimit, Math.max(current.maxTurns, turnCount) + (openLoop && cooperative ? 1 : 0));
    const state = { ...current, turnCount, maxTurns, engagement };
    const continueConversation = !explicitlyClosed && turnCount < maxTurns && engagement >= 25 && (openLoop || (cooperative && semantics.conversationDisposition === 'continue'));
    return { continueConversation, state, status: declined ? 'declined' : interrupted ? 'interrupted' : continueConversation ? 'open' : 'resolved' };
}

function profileSocial(characterId:string) {
    const row = db.prepare('SELECT profile_json FROM characters WHERE id=? OR subject_id=? LIMIT 1').get(characterId, characterId) as any;
    try { return JSON.parse(row?.profile_json || '{}').social || {}; } catch { return {}; }
}

export type CoPresenceContext = {
    roomId?: string;
    roomName?: string;
    roomType?: string;
};

function sharedRoomTopic(context: CoPresenceContext | undefined) {
    if (!context?.roomId) return null;
    const roomName = context.roomName || context.roomId;
    if (context.roomType === 'cell') {
        return {
            topic: 'shared_cell',
            context: `Вы живёте в одной камере «${roomName}». Это ваш общий быт и неизбежное соседство; можно начать знакомство, осторожно спросить о самочувствии или о том, как другая переносит происходящее. Не выдавай это за дружбу или доверие.`,
        };
    }
    return {
        topic: 'shared_room',
        context: `Вы находитесь в одном помещении «${roomName}» лаборатории. Общая обстановка — достаточный повод заговорить, но не доказательство близости или согласия.`,
    };
}

function chooseTopic(speakerId:string, recipientId:string, worldMinute:number, stimulus:'co_presence'|'observed_event', coPresence?:CoPresenceContext) {
    const active = db.prepare(`SELECT * FROM social_threads WHERE from_id=? AND to_id=? AND status='open' AND COALESCE(cooldown_until_minute,0)<=? ORDER BY salience DESC,last_touched_minute ASC LIMIT 1`).get(speakerId,recipientId,worldMinute) as any;
    if (active) {
        const saved = (() => { try { return JSON.parse(active.source_json || '{}'); } catch { return {}; } })();
        return { id:active.id, topic:active.topic, context: typeof saved.topicContext === 'string' ? saved.topicContext : undefined };
    }
    const social = profileSocial(speakerId);
    const declared = Array.isArray(social.conversationHooks) ? social.conversationHooks.map(String) : [];
    // A topic must come from an observed event or an authored profile hook.
    // The core must not invent a generic conversation merely to avoid silence.
    const shared = stimulus === 'co_presence' ? sharedRoomTopic(coPresence) : null;
    const candidates = stimulus === 'observed_event'
        ? [{ topic:'observed_event' }, ...declared.map(topic => ({ topic }))]
        : [
            ...(shared ? [shared] : []),
            ...declared.map(topic => ({ topic })),
        ];
    const choice = candidates.find(candidate => !db.prepare('SELECT 1 FROM social_threads WHERE from_id=? AND to_id=? AND topic=? AND COALESCE(cooldown_until_minute,0)>?').get(speakerId,recipientId,candidate.topic,worldMinute));
    if (!choice) return null;
    const source = JSON.stringify({stimulus,profileHook:declared.includes(choice.topic),topicContext:choice.context,conversation:{turnCount:0,maxTurns:2,hardLimit:6,engagement:50}});
    const previous = db.prepare('SELECT id FROM social_threads WHERE from_id=? AND to_id=? AND topic=?').get(speakerId,recipientId,choice.topic) as any;
    if (previous) {
        db.prepare('UPDATE social_threads SET status=?, salience=?, source_json=?, last_touched_minute=?, cooldown_until_minute=NULL WHERE id=?')
          .run('open', stimulus === 'observed_event' ? .9 : .6, source, worldMinute, previous.id);
        return { id:previous.id, topic:choice.topic, context:choice.context };
    }
    const id=randomUUID();
    db.prepare('INSERT INTO social_threads (id,from_id,to_id,topic,status,salience,source_json,last_touched_minute) VALUES (?,?,?,?,?,?,?,?)')
      .run(id,speakerId,recipientId,choice.topic,'open',stimulus === 'observed_event' ? .9 : .6,source,worldMinute);
    return { id, topic:choice.topic, context:choice.context };
}

/** The core chooses a social act, never a line of dialogue. */
export function createSocialTurnPlan(
    speakerId:string,
    recipientId:string,
    worldMinute:number,
    stimulus:'co_presence'|'observed_event'='co_presence',
    observation?: SocialObservation,
    coPresence?: CoPresenceContext,
): SocialTurnPlan | null {
    const relation = characterRelationRepo.get(speakerId, recipientId);
    if (!relation) return null;
    const familiarity = Number(relation.familiarityLevel || 0);
    const thread = chooseTopic(speakerId,recipientId,worldMinute,stimulus,coPresence);
    if (!thread) return null;
    const social = profileSocial(speakerId);
    const egoState = social.defaultEgoState || defaults.egoState;
    const need = (social.stressNeeds?.[0] || defaults.need) as SocialNeed;
    const firstEncounter = familiarity < .12 && ['orientation', 'shared_cell', 'shared_room'].includes(thread.topic);
    const act:SocialAct = firstEncounter ? 'introduce' : thread.topic === 'boundaries' ? 'ask_boundary' : stimulus === 'observed_event' || thread.topic === 'shared_cell' || thread.topic === 'shared_room' ? 'check_in' : 'offer_support';
    return { id:randomUUID(), speakerId, recipientId, stimulus, egoState, hiddenPosition:social.lifePosition || defaults.hiddenPosition, need, act, topic:thread.topic, topicContext:thread.context, threadId:thread.id, expectedReply:act === 'ask_boundary' ? 'boundary' : act === 'offer_support' ? 'accept_support' : 'adult_reply', physicalPermission:'none', worldMinute, observation };
}

export function describeSocialObservation(observation: SocialObservation | undefined, recipientId: string) {
    if (!observation?.targetId) return '';
    const targetName = subjectRepo.get(observation.targetId)?.name || observation.targetId;
    const actorName = observation.actorId ? (subjectRepo.get(observation.actorId)?.name || observation.actorId) : null;
    const action = observation.actionLabel || observation.actionId || 'событие';
    const point = observation.pointId ? `, область: ${observation.pointId}` : '';
    if (observation.targetId === recipientId) {
        return `Непосредственный повод: ${actorName || 'кто-то'} только что воздействовал${point ? '' : 'а'} на тебя (${action}${point}). Обращайся к собеседнику на «ты»; не называй его «она» или «он».`;
    }
    return `Непосредственный повод: вы наблюдали событие с ${targetName}${actorName ? `; действовал${actorName === 'Калибратор' ? '' : 'а'} ${actorName}` : ''} (${action}${point}). Если упоминаешь этого третьего персонажа, сначала назови его по имени, а не «она» или «он».`;
}

/**
 * Consent is one possible basis, not a universal gate. The core makes this
 * decision from durable relation/context state; speech only supplies inputs.
 */
export function resolvePhysicalInitiativeBasis(actorId:string, targetId:string): PhysicalInitiativeBasis {
    const relation = characterRelationRepo.get(actorId, targetId);
    if (!relation) return null;
    const pair = db.prepare('SELECT trust,safety,last_intent FROM social_pair_states WHERE from_id=? AND to_id=?').get(actorId,targetId) as any;
    const trust = Number(pair?.trust ?? 50);
    const safety = Number(pair?.safety ?? 50);
    const familiarity = Number(relation.familiarityLevel ?? 0);
    const openness = Number(relation.openness ?? 0);
    const actor = db.prepare('SELECT profile_json FROM characters WHERE id=? OR subject_id=? LIMIT 1').get(actorId,actorId) as any;
    const targetAssignment = db.prepare(`SELECT status FROM laboratory_room_assignments a JOIN characters c ON c.id=a.character_id WHERE c.id=? OR c.subject_id=? LIMIT 1`).get(targetId,targetId) as any;
    let protocolAuthority = false;
    try { protocolAuthority = Boolean(JSON.parse(actor?.profile_json || '{}').social?.authority?.protocol); } catch { /* explicit profile data is optional */ }
    if (protocolAuthority && String(targetAssignment?.status || '').startsWith('device:')) return 'protocol';
    if (familiarity >= .35 && openness >= 35 && trust >= 55 && safety >= 55 && pair?.last_intent === 'physical_consent') return 'consensual';
    if (relation.attitude <= 15 && safety <= 20) return 'violent';
    if (relation.attitude <= 30 && safety <= 35) return 'coercive';
    return null;
}

export function enqueueSocialTurn(plan:SocialTurnPlan) {
    db.prepare('INSERT INTO pending_social_turns (id,speaker_id,recipient_id,plan_json,created_world_minute) VALUES (?,?,?,?,?)')
        .run(plan.id, plan.speakerId, plan.recipientId, JSON.stringify(plan), plan.worldMinute);
}

export async function classifySocialSpeech(text:string): Promise<SpeechSemantics> {
    const prompt = `Классифицируй только социальный смысл реплики. Не назначай физических действий и не придумывай фактов. openLoop — конкретная незавершённость, требующая ответа; conversationDisposition — намерение продолжить или закрыть разговор. Верни JSON: {"speechAct":"answer|question|support|boundary|refusal|request|provocation|self_disclosure","apparentEgoState":"nurturing_parent|critical_parent|adult|free_child|adapted_child|rebellious_child|unclear","transaction":"complementary|crossed|ulterior|unclear","boundary":"none|set|accepted|violated","invitation":"none|conversation|help|physical_contact","openLoop":"none|question|request|offer|boundary","conversationDisposition":"continue|close|unclear","confidence":0..1}. Реплика: ${JSON.stringify(text)}`;
    const { parsed } = await parseVerbalInputWithLLM([{ role:'system', content:prompt }, { role:'user', content:text }]);
    return { speechAct:parsed.speechAct || 'answer', apparentEgoState:parsed.apparentEgoState || 'unclear', transaction:parsed.transaction || 'unclear', boundary:parsed.boundary || 'none', invitation:parsed.invitation || 'none', openLoop:parsed.openLoop || (parsed.speechAct === 'question' ? 'question' : parsed.speechAct === 'request' ? 'request' : 'none'), conversationDisposition:parsed.conversationDisposition || 'unclear', confidence:Math.max(0, Math.min(1, Number(parsed.confidence || 0))) };
}

export function applySocialTransition(plan:SocialTurnPlan, speech:string, semantics:SpeechSemantics) {
    const cooperative = semantics.transaction === 'complementary' && semantics.boundary !== 'violated';
    const familiarityDelta = cooperative ? .05 : .02;
    const relationDelta = cooperative ? .35 : semantics.boundary === 'set' ? .05 : -.25;
    for (const [fromId,toId] of [[plan.speakerId,plan.recipientId],[plan.recipientId,plan.speakerId]] as const) {
        const relation = characterRelationRepo.get(fromId,toId);
        if (!relation) continue;
        characterRelationRepo.updateSocialStats(fromId,toId,{ familiarityDelta });
        characterRelationRepo.updateAttitude(fromId,toId,clamp(relation.attitude + relationDelta),{ openness:clamp(Number(relation.openness || 0) + (cooperative ? .8 : 0)), plasticity:relation.plasticity });
    }
    const trust = cooperative ? 2 : semantics.boundary === 'set' ? .5 : -1;
    const recordedIntent = cooperative && semantics.invitation === 'physical_contact' ? 'physical_consent' : plan.act;
    db.prepare(`INSERT INTO social_pair_states (from_id,to_id,trust,safety,last_ego_state,last_need,last_intent,last_world_minute) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(from_id,to_id) DO UPDATE SET trust=MAX(0,MIN(100,trust+excluded.trust-50)), safety=MAX(0,MIN(100,safety+excluded.safety-50)), last_ego_state=excluded.last_ego_state,last_need=excluded.last_need,last_intent=excluded.last_intent,last_world_minute=excluded.last_world_minute`)
      .run(plan.speakerId,plan.recipientId,50+trust,50+(cooperative?2:0),plan.egoState,plan.need,recordedIntent,plan.worldMinute);
    memoryRepo.save({ subjectId:plan.speakerId, text:speech, embedding:buildEmbedding(`${plan.speakerId} ${speech}`), tags:['social_transaction',plan.egoState,plan.act], relatedSubjects:[plan.recipientId], type:'episode_v2', metadata:{socialTransaction:true,planId:plan.id,semantics,worldMinute:plan.worldMinute} });
    const speakerName = subjectRepo.get(plan.speakerId)?.name || plan.speakerId;
    memoryRepo.save({ subjectId:plan.recipientId, text:`${speakerName}: ${speech}`, embedding:buildEmbedding(`${plan.recipientId} ${plan.speakerId} ${speech}`), tags:['social_transaction','heard_speech'], relatedSubjects:[plan.speakerId], type:'episode_v2', metadata:{socialTransaction:true,heardSpeech:true,planId:plan.id,semantics,worldMinute:plan.worldMinute} });
    if (plan.threadId) {
        const thread = db.prepare('SELECT source_json FROM social_threads WHERE id=?').get(plan.threadId) as any;
        const decision = shouldContinueConversation(semantics, conversationState(thread?.source_json));
        db.prepare('UPDATE social_threads SET status=?, source_json=?, last_touched_minute=?, cooldown_until_minute=? WHERE id=?')
          .run(decision.status, JSON.stringify(threadSource(thread?.source_json, decision.state)), plan.worldMinute, decision.continueConversation ? null : plan.worldMinute + 30, plan.threadId);
        if (!decision.continueConversation) return;
        const recipientSocial = profileSocial(plan.recipientId);
        const replyAct:SocialAct = semantics.openLoop === 'question' || semantics.openLoop === 'request' ? 'answer_question'
            : semantics.openLoop === 'boundary' ? 'acknowledge_boundary' : 'continue_topic';
        enqueueSocialTurn({
            ...plan,
            id: randomUUID(),
            speakerId: plan.recipientId,
            recipientId: plan.speakerId,
            egoState: recipientSocial.defaultEgoState || defaults.egoState,
            hiddenPosition: recipientSocial.lifePosition || defaults.hiddenPosition,
            need: (recipientSocial.stressNeeds?.[0] || defaults.need) as SocialNeed,
            stimulus: 'observed_event',
            act: replyAct,
            replyToTurnId: plan.id,
            incomingSpeech: speech,
        });
    }
}

let processing = false;
export async function processPendingSocialTurns() {
    if (processing) return;
    const row = db.prepare("SELECT * FROM pending_social_turns WHERE status='planned' ORDER BY created_world_minute,id LIMIT 1").get() as any;
    if (!row) return;
    processing = true;
    try {
        const plan = JSON.parse(row.plan_json) as SocialTurnPlan;
        db.prepare("UPDATE pending_social_turns SET status='speaking',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(plan.id);
        const payload = (await buildCharacterTurnContext({
            subjectId: plan.speakerId,
            stimulus: { kind: 'internal_impulse', impulseId: `social:${plan.id}` },
            eventId: 'scene_lab_calibrator',
            initiatorId: plan.recipientId,
            addresseeId: plan.recipientId,
        })).payload;
        const recipientName = subjectRepo.get(plan.recipientId)?.name || plan.recipientId;
        const observation = describeSocialObservation(plan.observation, plan.recipientId);
        const stimuli: CharacterSpeechStimulus[] = [
            ...(plan.incomingSpeech ? [{ kind: 'external_speech' as const, speech: plan.incomingSpeech }] : []),
            {
                kind: 'internal_impulse',
                event: {
                    action: plan.incomingSpeech ? 'ответ в самостоятельном разговоре' : 'самостоятельное начало разговора',
                    target: recipientName,
                    experience: [`Тема: ${plan.topic}.`, plan.topicContext, observation].filter(Boolean).join(' '),
                    directlyExperienced: true,
                    affectedCharacter: subjectRepo.get(plan.speakerId)?.name || plan.speakerId,
                },
                impulse: {
                    id: `social:${plan.act}`,
                    primaryIntent: `Ты сама выбираешь социальный акт «${plan.act}» и обращаешься именно к ${recipientName}.`,
                    secondaryConflict: `Потребность: ${plan.need}. Эго-состояние: ${plan.egoState}. Вы не оператор и не объект процедуры друг для друга; не назначай физических действий и не придумывай фактов.`,
                    allowedSpeechActs: plan.act === 'answer_question' ? ['answer', 'set_boundary']
                        : plan.act === 'ask_boundary' ? ['probe', 'set_boundary']
                            : plan.act === 'offer_support' ? ['reassure', 'probe']
                                : ['probe', 'acknowledge', 'admit'],
                },
            },
        ];
        const prepared = prepareCharacterSpeechStimuli(payload, stimuli);
        if (!prepared) throw new Error('social speech reaction frame unavailable');
        const generated = await executeCharacterSpeech({
            source: 'social_initiative',
            payload: prepared.payload,
            userInput: prepared.userInput,
            history: [],
        });
        if (!generated.success) throw new Error(generated.error);
        const speech = generated.speech;
        const semantics = await classifySocialSpeech(speech.trim());
        // Chat history is participant-owned. Deliver one authored message to
        // both transcripts; the renderer uses speakerId, not the recipient's
        // local role, so this is still one line from the actual speaker.
        deliverCharacterSpeech({
            speakerId: plan.speakerId,
            speech,
            contextLabel: 'Социальная транзакция',
            messageId: plan.id,
            transcriptOwnerIds: [plan.speakerId, plan.recipientId],
        });
        applySocialTransition(plan,speech.trim(),semantics);
        db.prepare("UPDATE pending_social_turns SET status='applied',speech=?,semantics_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(speech.trim(),JSON.stringify(semantics),plan.id);
    } catch (error:any) { db.prepare("UPDATE pending_social_turns SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(error?.message || error),row.id); }
    finally {
        processing=false;
        // A social session is a sequence of core-approved turns. Drain only
        // the already queued next turn; shouldContinueConversation bounds it.
        if (db.prepare("SELECT 1 FROM pending_social_turns WHERE status='planned' LIMIT 1").get()) void processPendingSocialTurns();
    }
}
