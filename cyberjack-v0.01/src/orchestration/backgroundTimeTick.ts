import { db } from '../infrastructure/db';
import { activeContextsRepo, chatMemoryRepo, subjectRepo } from '../infrastructure/repositories';
import { planSustainedPulses } from './sustainedEffects';
import { runGameTick } from './runGameTick';
import { ContextManager } from './contextManager';
import { generateCharacterReply } from '../adapters/llmAdapter';
import { buildReactionTurnMessage } from '../narrative/reactionFrame';
import { buildPairedDialogueHistory } from '../narrative/dialogueHistory';
import { buildPromptPayloadWithDB } from '../prompts/buildPromptPayloadWrapper';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';
import { passiveArousalAfterMinutes } from '../domain/arousalDynamics';
import { runAutonomousSceneMinute } from './autonomousScene';
import { syncLaboratorySpatialRelations } from '../services/sceneRelations';
import { describeDeviceAction, describeDeviceProtocolEvent, describeDeviceSensation } from '../narrative/deviceExperience';

let running = false;
let pendingMinutes = 0;
const pendingDeviceReactions = new Set<string>();

type BackgroundDeviceSession = {
  deviceId:string;
  subjectId:string;
  status:string;
  intensity:number;
  phase:string;
  targetPointIds?:string[];
  startedAtTick:number | null;
  updatedAtTick:number;
  targetMode?:string;
  rhythm?:string;
  orgasmPolicy?:string;
  valencePolicy?:string;
  maxTension?:number;
  minCapacity?:number;
  stopAfterMinutes?:number | null;
  orgasmTargetCount?:number | null;
  orgasmCount?:number;
  stopAtReserve?:boolean;
  lastReactionTick?:number;
};

const clamp01 = (value:number) => Math.max(0, Math.min(1, value));

function sexMachineVector(session:BackgroundDeviceSession, worldMinute:number) {
  const power = clamp01(Number(session.intensity || 0) / 100);
  const policy = session.valencePolicy || 'adaptive';
  const valence = policy === 'positive' ? .78
    : policy === 'negative' ? -.68
      : policy === 'mixed' ? (Math.floor(worldMinute / 5) % 2 ? .52 : -.42)
        : policy === 'neutral' ? .15 : .48;
  const rhythmNovelty = session.rhythm === 'random' ? .65
    : session.rhythm === 'pulse' ? .42
      : session.rhythm === 'wave' ? .3 : .16;
  const rhythmText = session.rhythm === 'random'
    ? 'Ритм намеренно непредсказуем: следующий толчок нельзя угадать заранее.'
    : session.rhythm === 'pulse'
      ? 'Серия коротких толчков чередуется с различимыми паузами.'
      : session.rhythm === 'wave'
        ? 'Ход плавно ускоряется и замедляется длинными волнами.'
        : 'Механизм сохраняет ровный повторяющийся темп.';
  return {
    intensity:.16 + power * .62,
    valence,
    contact:.92,
    sharpness:.06 + power * .18,
    novelty:rhythmNovelty,
    tags:['intimate', 'penetration', 'continuous', 'machine', `rhythm_${session.rhythm || 'steady'}`],
    label:describeDeviceAction(session),
    description:describeDeviceSensation(session),
    sensory:{
      stimulus:'Каждый ход создаёт внутреннее давление, движение и трение по одной траектории.',
      texture:'Давление приходит изнутри и не исчезает при попытке изменить положение тела.',
      rhythm:rhythmText,
      bodilyResponse:'Новый ход начинается до того, как след предыдущего успевает полностью исчезнуть.',
    },
  };
}

function queueDeviceReaction(subjectId:string, bundle:Awaited<ReturnType<typeof runGameTick>>, reason:string) {
  if (pendingDeviceReactions.has(subjectId)) return;
  pendingDeviceReactions.add(subjectId);
  void (async () => {
    try {
      const history = buildPairedDialogueHistory(
        chatMemoryRepo.getRecent(subjectId, 32)
          .filter(entry => !/^\[Действие\]/.test(entry.content))
          .map(entry => ({ role:entry.role as 'user' | 'assistant', content:entry.content, worldMinute:entry.worldMinute, contextLabel:entry.contextLabel })),
        12,
      );
      const turnMessage = bundle.prompt.reactionFrame
        ? buildReactionTurnMessage(bundle.prompt.reactionFrame, `[Событие секс-машины] ${reason}`)
        : `[Событие секс-машины] ${reason}. Отреагируй естественно, только если персонаж стал бы говорить вслух.`;
      const generated = await generateCharacterReply(bundle.prompt, turnMessage, history);
      const reply = generated.reply && typeof generated.reply === 'object'
        ? String((generated.reply as any).speech || '')
        : String(generated.reply || '');
      if (reply.trim()) chatMemoryRepo.append(subjectId, 'assistant', reply.trim(), 'Модуль секс-машины: автоматический протокол');
    } catch (error) {
      console.warn(`[TimeFlow] sex machine reaction failed for ${subjectId}:`, error);
    } finally {
      pendingDeviceReactions.delete(subjectId);
    }
  })();
}

async function runBackgroundDeviceMinute(): Promise<Set<string>> {
  const stimulatedSubjects = new Set<string>();
  const worldMinute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
  const rows = db.prepare(`
    SELECT player_id, asset_id, name, metadata
    FROM laboratory_assets
    WHERE asset_id = 'lab_sex_machine' AND state = 'installed'
  `).all() as Array<{ player_id:string; asset_id:string; name:string; metadata:string }>;
  for (const row of rows) {
    let metadata:Record<string,any> = {};
    try { metadata = JSON.parse(row.metadata || '{}'); } catch { continue; }
    const session = metadata.deviceSession as BackgroundDeviceSession | undefined;
    if (!session || session.status !== 'running') continue;
    stimulatedSubjects.add(session.subjectId);
    const incompatible = new Set([
      'act_start_vibrator', 'act_adjust_vibration', 'act_activate_plug',
      'act_start_electrostimulation', 'act_adjust_electrostimulation',
      'finger_insertion', 'act_start_penetration', 'act_increase_friction',
    ]);
    for (const context of activeContextsRepo.getAllForSubject(session.subjectId)) {
      if (incompatible.has(context.actionId)) activeContextsRepo.remove(context.id);
    }
    const timerReached = Boolean(
      session.stopAfterMinutes
      && session.startedAtTick !== null
      && worldMinute - session.startedAtTick >= session.stopAfterMinutes
    );
    if (timerReached) {
      const stopped = { ...session, status:'stopped', phase:'sustain', startedAtTick:null, updatedAtTick:worldMinute };
      db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
        .run(JSON.stringify({ ...metadata, deviceSession:stopped }), row.player_id, row.asset_id);
      db.prepare(`INSERT INTO scenario_events (world_minute,type,title,description,metadata) VALUES (?,?,?,?,?)`)
        .run(worldMinute, 'device_protocol', 'Сеанс секс-машины завершён', `${row.name}: сработал установленный лимит сеанса.`, JSON.stringify({ subjectId:session.subjectId, assetId:row.asset_id, significant:true }));
      continue;
    }
    const pointId = session.targetPointIds?.find(point => point && point !== 'systemic') || 'vagina';
    try {
      const before = subjectRepo.get(session.subjectId);
      const edgeBrake = session.targetMode === 'edge' && Number(before?.tension || 0) >= Number(session.maxTension ?? 88) - 2;
      const bundle = await runGameTick({
        subjectId:session.subjectId,
        pointId,
        playerId:row.player_id,
        sceneId:'scene_lab_calibrator',
        presetId:'sustained_sexual_pulse',
        deltaTime:1,
        // The common sustained preset is authored for occasional pulses.
        // A machine pulse happens every world minute, so its learning/state
        // delta must be correspondingly smaller.
        stateDeltaScale:edgeBrake ? .0025 : .02,
        dynamicModifiers:sexMachineVector(session, worldMinute),
        customPayload:{
          sustainedSource:'lab_sex_machine',
          backgroundTime:true,
          deviceSession:{
            targetMode:session.targetMode,
            rhythm:session.rhythm,
            orgasmPolicy:session.orgasmPolicy,
            intensity:session.intensity,
          },
        },
        skipPrompt:true,
      });
      let after = subjectRepo.get(session.subjectId);
      const maxTension = Math.max(20, Math.min(100, Number(session.maxTension ?? 95)));
      const minCapacity = Math.max(0, Math.min(80, Number(session.minCapacity ?? 15)));
      if (after && (session.targetMode === 'edge' || session.orgasmPolicy === 'deny') && after.tension > maxTension) {
        subjectRepo.save(session.subjectId, after.name || session.subjectId, { ...after, tension:maxTension });
        after = subjectRepo.get(session.subjectId);
      }
      const ratio = Number(after?.tension || 0) / Math.max(1, maxTension);
      const phase = ratio >= .92 ? 'peak' : ratio >= .6 ? 'intense' : 'sustain';
      const transitions = bundle.diagnostics?.observation?.transitions || [];
      const justStarted = session.startedAtTick !== null && worldMinute - session.startedAtTick <= 1;
      const reserveReached = Number(after?.capacity ?? 100) <= minCapacity;
      const reserveTargetReached = reserveReached && Boolean(session.stopAtReserve);
      const orgasmCount = Number(session.orgasmCount || 0) + (bundle.output?.notableEvent === 'positive_discharge' ? 1 : 0);
      const orgasmTargetReached = Boolean(
        session.orgasmTargetCount
        && orgasmCount >= session.orgasmTargetCount
      );
      const significant = justStarted || reserveReached || reserveTargetReached || orgasmTargetReached || phase !== session.phase || transitions.length > 0;
      const canReact = justStarted || worldMinute - Number(session.lastReactionTick || -Infinity) >= 10;
      const nextSession = {
        ...session,
        phase,
        // Low reserve is a risk/response threshold, not an implicit stop.
        // A running machine remains continuous until its configured duration
        // expires or the operator explicitly pauses/stops it.
        status:orgasmTargetReached || reserveTargetReached ? 'stopped' : session.status,
        startedAtTick:orgasmTargetReached || reserveTargetReached ? null : session.startedAtTick,
        orgasmCount,
        updatedAtTick:worldMinute,
        lastReactionTick:significant && canReact ? worldMinute : session.lastReactionTick,
      };
      db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
        .run(JSON.stringify({ ...metadata, deviceSession:nextSession }), row.player_id, row.asset_id);
      if (significant) {
        const transitionText = transitions.map((entry:any) => entry.label || entry.kind).filter(Boolean).join(', ');
        const reason = transitionText
          || (orgasmTargetReached
            ? 'Острый пик завершается оргазмом, и механизм останавливается.'
            : reserveTargetReached
              ? 'Ресурс тела достигает заданного предела, и механизм останавливается.'
            : reserveReached
            ? `${describeDeviceSensation(session)} Тело заметно утомлено, но движение не прекращается.`
            : justStarted
              ? describeDeviceProtocolEvent('start', session)
              : phase === 'peak'
                ? `${describeDeviceSensation(session)} Ощущения подходят к особенно острой грани.`
                : phase === 'intense'
                  ? `${describeDeviceSensation(session)} Тело уже не успевает полностью расслабиться между движениями.`
                  : describeDeviceSensation(session));
        db.prepare(`INSERT INTO scenario_events (world_minute,type,title,description,metadata) VALUES (?,?,?,?,?)`)
          .run(
            worldMinute,
            'device_effect',
            orgasmTargetReached || reserveTargetReached ? 'Сеанс секс-машины: цель достигнута' : phase === 'peak' ? 'Секс-машина: достигнут порог' : phase === 'intense' ? 'Секс-машина: интенсивная фаза' : 'Секс-машина: стабилизация',
            reason,
            JSON.stringify({ subjectId:session.subjectId, assetId:row.asset_id, phase, transitions, significant:true }),
          );
        if (canReact) {
          bundle.prompt = await buildPromptPayloadWithDB(
            session.subjectId,
            session.subjectId,
            bundle.output,
            'scene_lab_calibrator',
            { initiatorId:row.player_id },
          );
          queueDeviceReaction(session.subjectId, bundle, reason);
        }
      }
    } catch (error) {
      console.warn(`[TimeFlow] skipped sex machine pulse for ${session.subjectId}:`, error);
    }
  }
  return stimulatedSubjects;
}

function settleUnstimulatedArousalMinute(stimulatedSubjects:Set<string>) {
  // Cell residents and recovery capsule occupants have their tension managed
  // by applyPassiveLaboratoryEffects (worldService) with a controlled
  // tensionPerHour rate. Applying passive arousal decay on top erases that
  // recovery in a single background tick loop.
  const managedSubjects = db.prepare(`
    SELECT COALESCE(c.subject_id,c.id) AS subject_id
    FROM laboratory_room_assignments a
    JOIN laboratory_rooms r ON r.player_id=a.player_id AND r.room_id=a.room_id
    JOIN characters c ON c.id=a.character_id
    WHERE r.room_type='cell' AND a.status='resident'
    UNION
    SELECT json_extract(metadata,'$.subjectId') AS subject_id
    FROM laboratory_assets
    WHERE json_extract(metadata,'$.subjectId') IS NOT NULL
      AND asset_id IN ('lab_recovery_capsule')
  `).all() as Array<{subject_id:string}>;
  for (const { subject_id } of managedSubjects) {
    if (subject_id) stimulatedSubjects.add(subject_id);
  }

  const subjects = db.prepare(`SELECT id, tension FROM subjects`).all() as Array<{id:string; tension:number}>;
  const update = db.prepare(`UPDATE subjects SET tension = ? WHERE id = ?`);
  for (const subject of subjects) {
    if (stimulatedSubjects.has(subject.id)) continue;
    const next = passiveArousalAfterMinutes(subject.tension, 1);
    if (next !== subject.tension) update.run(next, subject.id);
  }
}

function recoverIsolatedResidentsMinute() {
  const residents = db.prepare(`
    SELECT COALESCE(c.subject_id,c.id) AS subject_id
    FROM laboratory_room_assignments a
    JOIN laboratory_rooms r ON r.player_id=a.player_id AND r.room_id=a.room_id
    JOIN characters c ON c.id=a.character_id
    WHERE r.room_type='cell' AND a.status='resident'
      AND (SELECT COUNT(*) FROM laboratory_room_assignments x
           WHERE x.player_id=a.player_id AND x.room_id=a.room_id) = 1
  `).all() as Array<{subject_id:string}>;
  for (const resident of residents) {
    interactionStanceRepo.softenAll(resident.subject_id,.02);
    relationshipDynamicsRepo.recoverAlone(resident.subject_id,1);
  }
}

/**
 * Applies ongoing physical processes as world time crosses a simulation step.
 * Routine state evolution is engine work. Device speech is queued only for
 * explicit phase changes, limits and other exceptional events.
 */
export async function runBackgroundSustainedTicks(deltaTime = 1) {
  pendingMinutes += Math.max(0, deltaTime);
  if (running) return;
  running = true;
  try {
    while (pendingMinutes >= 1) {
      pendingMinutes -= 1;
      const stimulatedSubjects = await runBackgroundDeviceMinute();
      recoverIsolatedResidentsMinute();
      const subjects = db.prepare(`
        SELECT DISTINCT subject_id AS subjectId
        FROM active_contexts
      `).all() as Array<{ subjectId: string }>;
      for (const { subjectId } of subjects) {
        const plans = planSustainedPulses(activeContextsRepo.getAllForSubject(subjectId), 1);
        if (!plans.length) {
          ContextManager.processTick(subjectId, 1);
          continue;
        }
        let advancedContextTime = false;
        stimulatedSubjects.add(subjectId);
        for (const plan of plans) {
          for (let pulse = 0; pulse < plan.pulses; pulse++) {
            try {
              await runGameTick({
                subjectId,
                pointId:plan.pointId,
                playerId:'PL-1',
                sceneId:'scene_lab_calibrator',
                presetId:plan.presetId,
                // Several processes and physical pulses may coexist inside one
                // world minute, but context duration advances only once.
                deltaTime:advancedContextTime ? 0 : 1,
                stateDeltaScale:.2,
                customPayload:{
                  sustainedSource:plan.sourceActionId,
                  backgroundTime:true,
                  pulse:pulse + 1,
                  pulseCount:plan.pulses,
                },
                skipPrompt:true,
              });
              advancedContextTime = true;
            } catch (error) {
              console.warn(`[TimeFlow] skipped ${plan.sourceActionId} for ${subjectId}:`, error);
              break;
            }
          }
        }
        if (!advancedContextTime) ContextManager.processTick(subjectId, 1);
      }
      settleUnstimulatedArousalMinute(stimulatedSubjects);
      syncLaboratorySpatialRelations();
      await runAutonomousSceneMinute();
    }
  } catch (error) {
    console.error('[TimeFlow] sustained background tick failed:', error);
  } finally {
    running = false;
  }
}
