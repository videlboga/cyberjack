import { db } from '../infrastructure/db';
import { activeContextsRepo, chatMemoryRepo, subjectPreferencesRepo, subjectRepo, subjectEdgeStateRepo } from '../infrastructure/repositories';
import { planSustainedPulses } from './sustainedEffects';
import { runGameTick } from './runGameTick';
import { ContextManager } from './contextManager';
import { type InternalImpulse } from '../narrative/reactionFrame';
import { executeInternalImpulseConversation } from './sceneOrchestrator';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';
import { passiveArousalAfterMinutes } from '../domain/arousalDynamics';
import { syncLaboratorySpatialRelations } from '../services/sceneRelations';
import { describeDeviceAction, describeDeviceProtocolEvent, describeDeviceSensation } from '../narrative/deviceExperience';
import { describeEdgeHold, edgeHoldMinutes } from '../domain/edgeState';
import { sexMachineStimulation } from '../domain/sexMachineStimulation';

let running = false;
let pendingMinutes = 0;
const pendingDeviceReactions = new Set<string>();
const pendingEdgeReactions = new Set<string>();

type LongEdgeExpression = InternalImpulse;

type BackgroundDeviceSession = {
  deviceId:string;
  subjectId:string;
  status:string;
  intensity:number;
  phase:string;
  targetPointIds?:string[];
  stimulationMode?:string;
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
  lastDischargeEvent?:{ id:number; worldMinute:number };
};

type MentalChairSession = {
  subjectId:string;
  status:'loaded'|'running'|'paused'|'stopped';
  intensity:number;
  frame:'reinforce'|'anxiety'|'contradiction'|'reframe';
  phase:'recall'|'immersion'|'consolidation';
  memoryText:string|null;
  focusTag:string|null;
  startedAtTick:number|null;
  updatedAtTick:number;
  lastNarrativePhase?:'recall'|'immersion'|'consolidation';
};

const mentalChairPhaseFor = (session:MentalChairSession, minute:number): MentalChairSession['phase'] => {
  const elapsed = Math.max(0, minute - Number(session.startedAtTick ?? minute));
  return elapsed < 5 ? 'recall' : elapsed < 20 ? 'immersion' : 'consolidation';
};

function runMentalChairMinute(stimulatedSubjects:Set<string>) {
  const minute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
  const rows = db.prepare(`
    SELECT player_id, asset_id, name, metadata
    FROM laboratory_assets
    WHERE asset_id = 'lab_mental_correction_chair' AND state = 'installed'
  `).all() as Array<{player_id:string;asset_id:string;name:string;metadata:string}>;
  for (const row of rows) {
    let metadata:Record<string,any> = {};
    try { metadata = JSON.parse(row.metadata || '{}'); } catch { continue; }
    const session = metadata.mentalSession as MentalChairSession | undefined;
    if (!session || session.status !== 'running' || !session.memoryText || !session.focusTag) continue;
    const subject = subjectRepo.get(session.subjectId);
    if (!subject) continue;
    stimulatedSubjects.add(session.subjectId);
    const phase = mentalChairPhaseFor(session, minute);
    const intensity = Math.max(.1, Math.min(1, Number(session.intensity || 0) / 100));
    const phaseFactor = phase === 'recall' ? .5 : phase === 'immersion' ? 1 : .65;
    const preferences = subjectPreferencesRepo.get(session.subjectId);
    const current = Number(preferences.tags[session.focusTag] || 0);
    const baseDelta = .012 * intensity * phaseFactor;
    const direction = session.frame === 'reinforce' ? (current < 0 ? -1 : 1)
      : session.frame === 'anxiety' ? -1
        : session.frame === 'contradiction' ? (current === 0 ? -1 : -Math.sign(current))
          : current === 0 ? 0 : -Math.sign(current);
    if (direction) subjectPreferencesRepo.adjust(session.subjectId, 'tags', session.focusTag, direction * baseDelta);
    const capacityCost = (.025 + intensity * .045) * (phase === 'immersion' ? 1 : .6);
    const plasticityGain = intensity * .018 * phaseFactor;
    const opennessShift = session.frame === 'anxiety' ? -.006 * intensity : session.frame === 'reframe' ? .004 * intensity : 0;
    subjectRepo.save(session.subjectId, subject.name, {
      ...subject,
      capacity: Math.max(0, subject.capacity - capacityCost),
      plasticity: Math.min(100, subject.plasticity + plasticityGain),
      openness: Math.max(0, Math.min(100, subject.openness + opennessShift)),
    });
    const phaseChanged = phase !== session.lastNarrativePhase;
    const next = { ...session, phase, updatedAtTick:minute, lastNarrativePhase:phase };
    db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
      .run(JSON.stringify({ ...metadata, mentalSession:next }), row.player_id, row.asset_id);
    if (phaseChanged) {
      const phaseTitle = phase === 'recall' ? 'извлечение эпизода' : phase === 'immersion' ? 'повторное переживание' : 'закрепление ассоциации';
      db.prepare(`INSERT INTO scenario_events (world_minute,type,title,description,metadata) VALUES (?,?,?,?,?)`)
        .run(minute, 'mental_correction', `Кресло: ${phaseTitle}`, `${row.name}: фокус «${session.focusTag}», рамка «${session.frame}».`, JSON.stringify({ subjectId:session.subjectId, assetId:row.asset_id, phase, focusTag:session.focusTag, frame:session.frame }));
    }
  }
}

const clamp01 = (value:number) => Math.max(0, Math.min(1, value));

function sexMachineVector(session:BackgroundDeviceSession, worldMinute:number) {
  const stimulation = sexMachineStimulation(session.stimulationMode);
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
    tags:[...stimulation.tags, `rhythm_${session.rhythm || 'steady'}`],
    label:describeDeviceAction(session),
    description:describeDeviceSensation(session),
    sensory:{
      stimulus:session.stimulationMode === 'tickling' ? 'Механизм возвращается к щекочущим касаниям сериями, не давая привыкнуть к следующему месту.' : 'Каждый ход создаёт внутреннее давление, движение и трение по одной траектории.',
      texture:session.stimulationMode === 'tickling' ? 'Лёгкие импульсы быстро меняют точку контакта и не дают телу заранее собраться.' : 'Давление приходит изнутри и не исчезает при попытке изменить положение тела.',
      rhythm:rhythmText,
      bodilyResponse:'Новый ход начинается до того, как след предыдущего успевает полностью исчезнуть.',
    },
  };
}

function queueDeviceReaction(subjectId:string, bundle:Awaited<ReturnType<typeof runGameTick>>, reason:string, contextLabel:string) {
  if (pendingDeviceReactions.has(subjectId)) return;
  pendingDeviceReactions.add(subjectId);
  void (async () => {
    try {
      await executeInternalImpulseConversation({
        subjectId,
        latestResult: bundle.output,
        initiatorId: bundle.event.playerId,
        interactionContext: contextLabel,
        event: {
          action: 'работа секс-машины',
          target: 'собственное тело',
          experience: reason,
          mandatoryPhysiologicalFocus: true,
        },
        impulse: {
          id: 'notice_device_change',
          primaryIntent: 'Ты пытаешься осмыслить заметное изменение собственного состояния и решить, нужно ли обозначить его вслух',
          secondaryConflict: 'Телесная реакция не отменяет твоих границ, оценок и самостоятельного отношения к происходящему',
          allowedSpeechActs: ['admit', 'set_boundary', 'request', 'warn'],
        },
      });
    } catch (error) {
      console.warn(`[TimeFlow] sex machine reaction failed for ${subjectId}:`, error);
    } finally {
      pendingDeviceReactions.delete(subjectId);
    }
  })();
}

function edgeExpressionProbability(minutes: number): number {
  if (minutes >= 300) return .25;
  if (minutes >= 120) return .20;
  if (minutes >= 30) return .15;
  if (minutes >= 5) return .10;
  return 0;
}

/** Core chooses motive and speech-act space; the LLM owns the actual words. */
function chooseLongEdgeExpression(input: {
  minutes: number;
  valence: 'positive' | 'negative' | 'mixed';
  recentContextLabels: string[];
}): LongEdgeExpression {
  const common: LongEdgeExpression[] = [
    { id:'seek_orientation', primaryIntent:'Ты хочешь вернуть себе опору во времени и понять, сколько ещё продлится это состояние', secondaryConflict:'Повторяющиеся подъёмы и спады размыли ощущение времени, и тебе трудно доверять собственному счёту', allowedSpeechActs:['probe', 'request', 'admit'] },
    { id:'preserve_self', primaryIntent:'Ты хочешь удержать ощущение себя и связную мысль, прежде чем длительное напряжение окончательно вытеснит всё остальное', secondaryConflict:'Тело снова перетягивает внимание на себя, и сосредоточенность даётся всё дороже', allowedSpeechActs:['admit', 'request', 'deflect'] },
    { id:'seek_contact', primaryIntent:'Ты хочешь получить от собеседника простое подтверждение, что он видит твоё состояние и не оставляет тебя в нём одной', secondaryConflict:'Просить о такой опоре уязвимо, особенно когда тело выдаёт то, что ты пытаешься скрыть', allowedSpeechActs:['request', 'admit', 'probe'] },
  ];
  const byValence: Record<typeof input.valence, LongEdgeExpression[]> = {
    positive: [
      { id:'seek_orgasm', primaryIntent:'Ты хочешь наконец кончить: не просто пережить ещё одну волну, а получить давно удерживаемую разрядку', secondaryConflict:'Тяга к оргазму сильна, но после долгого удержания она смешалась с усталостью и почти болезненной навязчивостью', allowedSpeechActs:['request', 'bargain', 'admit'] },
      { id:'ask_when_allowed_orgasm', primaryIntent:'Ты хочешь узнать, когда тебе позволят кончить, или добиться понятного условия для этого', secondaryConflict:'Тебе приходится говорить о собственном желании прямо, хотя усталость и уязвимость делают это трудно', allowedSpeechActs:['bargain', 'request', 'probe'] },
    ],
    negative: [
      { id:'seek_relief', primaryIntent:'Ты хочешь добиться паузы, ослабления или прекращения повторяющегося удержания', secondaryConflict:'Раздражение накопилось, но усталость мешает превратить его в ровное и уверенное требование', allowedSpeechActs:['set_boundary', 'request', 'warn'] },
      { id:'reclaim_agency', primaryIntent:'Ты хочешь вернуть себе право влиять на следующий шаг, а не просто пережидать очередную волну', secondaryConflict:'Тело устало и выдаёт реакцию раньше, чем ты успеваешь решить, что показать собеседнику', allowedSpeechActs:['challenge', 'set_boundary', 'request'] },
    ],
    mixed: [
      { id:'seek_change', primaryIntent:'Ты хочешь, чтобы повторяющаяся петля изменилась: стала яснее, слабее или получила определённый конец', secondaryConflict:'Одна часть тебя тянется к следующему подъёму, а другая больше не хочет оставаться в этой незавершённости', allowedSpeechActs:['request', 'bargain', 'admit'] },
      { id:'name_conflict', primaryIntent:'Ты хочешь честно обозначить противоречие своего состояния, чтобы собеседник не принимал одну телесную реакцию за весь твой выбор', secondaryConflict:'Тебе трудно отделить собственное желание от того, что навязало долгое удержание', allowedSpeechActs:['admit', 'challenge', 'request'] },
    ],
  };
  const candidates = [...common, ...byValence[input.valence]];
  const recent = new Set(input.recentContextLabels
    .map(label => /^Длительное удержание на грани · (.+)$/u.exec(label)?.[1])
    .filter((id): id is string => Boolean(id)));
  const unused = candidates.filter(candidate => !recent.has(candidate.id));
  const pool = unused.length ? unused : candidates;
  return pool[Math.floor(input.minutes / 10) % pool.length];
}

function queueEdgeHoldReaction(subjectId: string, worldMinute: number, state: ReturnType<typeof subjectEdgeStateRepo.get>) {
  if (!state || pendingEdgeReactions.has(subjectId)) return;
  pendingEdgeReactions.add(subjectId);
  const reason = describeEdgeHold(state, worldMinute);
  const recentEntries = chatMemoryRepo.getRecent(subjectId, 20);
  const expression = chooseLongEdgeExpression({
    minutes: edgeHoldMinutes(state, worldMinute),
    valence: state.valence,
    recentContextLabels: recentEntries.map(entry => entry.contextLabel || ''),
  });
  void (async () => {
    try {
      await executeInternalImpulseConversation({
        subjectId,
        initiatorId: 'PL-1',
        interactionContext: 'Внутренний импульс: длительное удержание на грани',
        event: {
          action: 'длительное удержание на грани',
          target: 'собственное тело',
          experience: reason,
          mandatoryPhysiologicalFocus: true,
        },
        impulse: expression,
      });
      subjectEdgeStateRepo.markExpression(subjectId, worldMinute);
    } catch (error) {
      console.warn(`[TimeFlow] edge reaction failed for ${subjectId}:`, error);
    } finally {
      pendingEdgeReactions.delete(subjectId);
    }
  })();
}

function queueLongEdgeExpressions(worldMinute: number) {
  for (const { subjectId, state } of subjectEdgeStateRepo.listActive()) {
    const minutes = edgeHoldMinutes(state, worldMinute);
    const probability = edgeExpressionProbability(minutes);
    const cooledDown = worldMinute - Number(state.lastExpressionMinute ?? -Infinity) >= 10;
    if (probability && cooledDown && Math.random() < probability) queueEdgeHoldReaction(subjectId, worldMinute, state);
  }
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
    const pointId = sexMachineStimulation(session.stimulationMode).pointId;
    try {
      const before = subjectRepo.get(session.subjectId);
      const bundle = await runGameTick({
        subjectId:session.subjectId,
        pointId,
        playerId:row.player_id,
        sceneId:'scene_lab_calibrator',
        presetId:'sustained_sexual_pulse',
        deltaTime:1,
        // The machine is a continuous, full-strength source of stimulation.
        // Only the edge controller below reduces its effect near the selected
        // ceiling; ordinary operation uses the engine's normal tick delta.
        // The edge controller caps tension below. Scaling the entire state
        // here previously made fatigue, learning and all bodily consequences
        // effectively stop while the device was at its strongest.
        stateDeltaScale:1,
        dynamicModifiers:sexMachineVector(session, worldMinute),
        customPayload:{
          sustainedSource:'lab_sex_machine',
          backgroundTime:true,
          deviceSession:{
            targetMode:session.targetMode,
            rhythm:session.rhythm,
            orgasmPolicy:session.orgasmPolicy,
            intensity:session.intensity,
            stimulationMode:session.stimulationMode || 'vaginal',
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
      const discharged = bundle.output?.notableEvent === 'positive_discharge'
        || transitions.some((transition:any) => transition?.kind === 'discharge');
      const orgasmCount = Number(session.orgasmCount || 0) + (discharged ? 1 : 0);
      const orgasmTargetReached = Boolean(
        session.orgasmTargetCount
        && orgasmCount >= session.orgasmTargetCount
      );
      const significant = justStarted || reserveReached || reserveTargetReached || orgasmTargetReached || discharged || phase !== session.phase || transitions.length > 0;
      const canReact = justStarted || worldMinute - Number(session.lastReactionTick || -Infinity) >= 10;
      let dischargeEventId: number | undefined;
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
        const eventResult = db.prepare(`INSERT INTO scenario_events (world_minute,type,title,description,metadata) VALUES (?,?,?,?,?)`)
          .run(
            worldMinute,
            'device_effect',
            orgasmTargetReached || reserveTargetReached ? 'Сеанс секс-машины: цель достигнута' : discharged ? 'Секс-машина: разрядка' : phase === 'peak' ? 'Секс-машина: достигнут порог' : phase === 'intense' ? 'Секс-машина: интенсивная фаза' : 'Секс-машина: стабилизация',
            reason,
            JSON.stringify({ subjectId:session.subjectId, assetId:row.asset_id, phase, transitions, discharged, significant:true }),
          );
        if (discharged) dischargeEventId = Number(eventResult.lastInsertRowid);
        if (canReact) {
          queueDeviceReaction(session.subjectId, bundle, reason, `${row.name}: фиксированная платформа`);
          subjectEdgeStateRepo.markExpression(session.subjectId, worldMinute);
        }
      }
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
        lastDischargeEvent: dischargeEventId
          ? { id:dischargeEventId, worldMinute }
          : session.lastDischargeEvent,
      };
      db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
        .run(JSON.stringify({ ...metadata, deviceSession:nextSession }), row.player_id, row.asset_id);
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
      runMentalChairMinute(stimulatedSubjects);
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
      // A long-held edge can create speech on its own even when no device
      // phase changes. The state belongs to the subject, so this covers every
      // source of edging and only uses the device as one possible tick source.
      queueLongEdgeExpressions(Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0));
      syncLaboratorySpatialRelations();
      // Autonomous scene pulses are driven by the unified background job
      // queue (scene.autonomous) scheduled from advanceSimulationTime, so a
      // repeated worker run never duplicates an autonomous action.
    }
  } catch (error) {
    console.error('[TimeFlow] sustained background tick failed:', error);
  } finally {
    running = false;
  }
}
