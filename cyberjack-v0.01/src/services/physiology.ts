import { db } from '../infrastructure/db';
import { subjectRepo, presetRepo, activeContextsRepo } from '../infrastructure/repositories';
import { DAY_CYCLE, isScheduledSleep, minuteOfDay, nextScheduledWakeMinuteOfDay } from '../domain/dayCycle';
import { enqueueBackgroundJob } from '../orchestration/backgroundJobs';
import { memoryRepo } from '../infrastructure/repositories';
import { buildEmbedding } from './embeddingService';
import { recordSceneObservation } from './sceneAwareness';
import { moveCharacterInLaboratory, getLaboratoryPresence, ENCLOSED_DEVICE_ASSETS } from '../scenario/spatialContext';
import { ContextManager } from '../orchestration/contextManager';

/**
 * Физиология персонажа: сон, голод, туалет, недосып.
 * Значения меняются одним проходом игрового времени, а не при чтении UI/промпта.
 */

export interface PhysiologyRow {
    subject_id: string;
    hunger: number;
    bladder: number;
    sleep_debt: number;
    sleep_state: 'awake' | 'sleeping';
    state_changed_minute: number;
    planned_wake_minute: number | null;
    wake_reason: string | null;
    last_meal_minute: number | null;
    last_toilet_minute: number | null;
}

const PHYSIO_COLS = `subject_id, hunger, bladder, sleep_debt, sleep_state, state_changed_minute, planned_wake_minute, wake_reason, last_meal_minute, last_toilet_minute`;

function mapRow(r: any): PhysiologyRow {
    return {
        subject_id: r.subject_id,
        hunger: r.hunger,
        bladder: r.bladder,
        sleep_debt: r.sleep_debt,
        sleep_state: r.sleep_state,
        state_changed_minute: r.state_changed_minute,
        planned_wake_minute: r.planned_wake_minute,
        wake_reason: r.wake_reason,
        last_meal_minute: r.last_meal_minute,
        last_toilet_minute: r.last_toilet_minute,
    };
}

/** Получить физиологию персонажа (создаёт строку при отсутствии). */
export function getPhysiology(subjectId: string): PhysiologyRow {
    const row = db.prepare(`SELECT ${PHYSIO_COLS} FROM subject_physiology WHERE subject_id = ?`).get(subjectId) as any;
    if (row) return mapRow(row);
    const fresh: PhysiologyRow = {
        subject_id: subjectId,
        hunger: 0, bladder: 0, sleep_debt: 0,
        sleep_state: 'awake', state_changed_minute: 0,
        planned_wake_minute: null, wake_reason: null,
        last_meal_minute: null, last_toilet_minute: null,
    };
    db.prepare(`INSERT INTO subject_physiology (${PHYSIO_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(subjectId, 0, 0, 0, 'awake', 0, null, null, null, null);
    return fresh;
}

/** Сохранить физиологию. */
export function savePhysiology(p: PhysiologyRow): void {
    db.prepare(`UPDATE subject_physiology SET
        hunger=?, bladder=?, sleep_debt=?, sleep_state=?, state_changed_minute=?,
        planned_wake_minute=?, wake_reason=?, last_meal_minute=?, last_toilet_minute=?
        WHERE subject_id=?`)
        .run(p.hunger, p.bladder, p.sleep_debt, p.sleep_state, p.state_changed_minute,
            p.planned_wake_minute, p.wake_reason, p.last_meal_minute, p.last_toilet_minute,
            p.subject_id);
}

/** Спит ли персонаж сейчас. */
export function isSleeping(subjectId: string): boolean {
    return getPhysiology(subjectId).sleep_state === 'sleeping';
}

/** Принудительное пробуждение спящего персонажа (внешнее событие/воздействие). */
export function wakeUp(subjectId: string, reason: string): void {
    const phys = getPhysiology(subjectId);
    if (phys.sleep_state !== 'sleeping') return;
    const now = getWorldMinute();
    phys.sleep_state = 'awake';
    phys.state_changed_minute = now;
    // Разбуженный принудительно персонаж остаётся бодрствующим до планового
    // подъёма: следующий ночной проход не должен снова уложить его спать.
    phys.planned_wake_minute = now + minutesUntilNextWake(now);
    phys.wake_reason = reason;
    savePhysiology(phys);
}

/** Текущее мировое время (минуты). */
function getWorldMinute(): number {
    const row = db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any;
    return Number(row?.total_minutes) || 0;
}

/** Присутствует ли персонаж в лаборатории (не в in_transfer). */
function isPresentInLab(subjectId: string): boolean {
    const row = db.prepare(`SELECT 1 FROM asset_contracts WHERE attached_subject_id = ? AND state = 'in_transfer'`).get(subjectId) as any;
    return !row;
}

/**
 * Пакетный проход физиологии за `minutes` игрового времени.
 * Вызывается из авторитетного продвижения worldMinute.
 */
export function advancePhysiology(minutes: number, worldMinute: number): void {
    if (minutes <= 0) return;
    const hours = minutes / 60;

    // Все присутствующие персонажи (не в in_transfer).
    const subjects = db.prepare(`SELECT id FROM subjects`).all() as { id: string }[];
    for (const { id } of subjects) {
        if (!isPresentInLab(id)) continue;
        const core = subjectRepo.get(id);
        if (!core) continue;
        const phys = getPhysiology(id);

        // --- Сон ---
        const scheduled = isScheduledSleep(worldMinute);
        const inCapsule = isInCapsule(id);
        const deviceBlocksSleep = hasSleepBlockingDevice(id);
        // Принудительно разбуженный персонаж остаётся бодрствующим до планового
        // подъёма (planned_wake_minute), даже если сейчас ночь.
        const forcedAwake = phys.wake_reason != null && phys.planned_wake_minute != null
            && worldMinute < phys.planned_wake_minute;

        if (scheduled && !inCapsule && !deviceBlocksSleep && !forcedAwake) {
            // Переход в сон.
            if (phys.sleep_state !== 'sleeping') {
                phys.sleep_state = 'sleeping';
                phys.state_changed_minute = worldMinute;
                phys.planned_wake_minute = worldMinute + minutesUntilNextWake(worldMinute);
                phys.wake_reason = null;
                // Уходим спать в свою жилую комнату (не трогаем тех, кто в оборудовании).
                retireToLivingRoom(id, playerIdForSubject(id), worldMinute);
                // Консолидация памяти происходит во сне (период бодрствования → эпизоды).
                enqueueBackgroundJob({
                    type: 'memory.consolidate',
                    key: `consolidate:${id}:${worldMinute}`,
                    subjectId: id,
                    dueMinute: worldMinute,
                });
            }
            // Сон снимает недосып.
            phys.sleep_debt = Math.max(0, phys.sleep_debt - hours * 6);
        } else {
            // Бодрствование.
            if (phys.sleep_state === 'sleeping') {
                // Плановое пробуждение или принудительное.
                phys.sleep_state = 'awake';
                phys.state_changed_minute = worldMinute;
                phys.planned_wake_minute = null;
                phys.wake_reason = null;
            }
            // Накопление недосыпа при бодрствовании.
            phys.sleep_debt = Math.min(100, phys.sleep_debt + hours * 1.2);
        }

        // --- Голод ---
        phys.hunger = Math.min(100, phys.hunger + hours * 2.5);
        // --- Туалет ---
        phys.bladder = Math.min(100, phys.bladder + hours * 1.8);

        // --- Обычная рутина (тихая, без событий) ---
        applyRoutine(id, phys, worldMinute);

        savePhysiology(phys);
    }
}

/** PlayerId для перемещения персонажа (единый игрок лаборатории). */
function playerIdForSubject(_subjectId: string): string {
    return 'PL-1';
}

/** Переместить персонажа спать в его назначенную жилую комнату (не трогает тех, кто в оборудовании). */
function retireToLivingRoom(subjectId: string, playerId: string, worldMinute: number): void {
    try {
        // moveCharacterInLaboratory сам блокирует персонажей в оборудовании (device: статус).
        const presence = getLaboratoryPresence(subjectId, playerId);
        if (!presence || !presence.roomId) return;
        // Назначенная жилая комната персонажа (cell для активов, room_staff_living для ассистентов).
        const assignment = db.prepare(`SELECT room_id FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`).get(playerId, subjectId) as any;
        if (!assignment) return;
        const targetRoom = db.prepare(`SELECT room_type FROM laboratory_rooms WHERE player_id = ? AND room_id = ?`).get(playerId, assignment.room_id) as any;
        // Перемещаем только в жилые комнаты (cell/staff) и только если персонаж ещё не в ней.
        if (!targetRoom || !(targetRoom.room_type === 'cell' || targetRoom.room_type === 'staff')) return;
        if (presence.roomId === assignment.room_id) return; // уже в жилой комнате
        moveCharacterInLaboratory(subjectId, assignment.room_id, playerId);
    } catch (e) {
        // Не фатально: если переместить не удалось, персонаж просто остаётся на месте.
    }
}

/** Минут до следующего планового подъёма. */
function minutesUntilNextWake(worldMinute: number): number {
    const wake = nextScheduledWakeMinuteOfDay(worldMinute);
    const now = minuteOfDay(worldMinute);
    return wake - now;
}

/** В капсуле ли персонаж. */
function isInCapsule(subjectId: string): boolean {
    const row = db.prepare(`SELECT 1 FROM laboratory_assets WHERE state='installed' AND metadata LIKE ?`).get(`%"subjectId":"${subjectId}"%`) as any;
    return Boolean(row);
}

/** Есть ли устройство, блокирующее сон. */
function hasSleepBlockingDevice(subjectId: string): boolean {
    const row = db.prepare(`SELECT 1 FROM laboratory_assets WHERE state='installed' AND metadata LIKE ?`).get(`%"subjectId":"${subjectId}"%`) as any;
    if (!row) return false;
    const devices = db.prepare(`SELECT asset_id FROM laboratory_assets WHERE state='installed' AND metadata LIKE ?`).all(`%"subjectId":"${subjectId}"%`) as { asset_id: string }[];
    return devices.some(d => d.asset_id.includes('stim') || d.asset_id.includes('electro'));
}

/** Тихая обычная рутина: еда и санитарный модуль в обычной камере. */
/** Оборудование, в котором персонаж физически зафиксирован (asset_id) или null.
 *  Только закрытые устройства (капсула, секс-машина, кресло ментальной коррекции)
 *  фиксируют персонажа. Диагностический стол не удерживает — персонаж на нём
 *  свободен и может самостоятельно сходить в туалет/поесть. */
function occupiedDeviceId(subjectId: string): string | null {
    const row = db.prepare(
        `SELECT asset_id FROM laboratory_assets WHERE state='installed' AND metadata LIKE ?`
    ).get(`%"subjectId":"${subjectId}"%`) as { asset_id: string } | undefined;
    if (!row?.asset_id) return null;
    return ENCLOSED_DEVICE_ASSETS.has(row.asset_id) ? row.asset_id : null;
}

/** Свободен ли персонаж (не в оборудовании). */
function isFree(subjectId: string): boolean {
    return occupiedDeviceId(subjectId) === null;
}

/** Зафиксирован ли персонаж в закрытом устройстве (капсула/секс-машина/кресло). */
export function isSubjectFixedInDevice(subjectId: string): boolean {
    return occupiedDeviceId(subjectId) !== null;
}

/** В капсуле восстановления. */
function isInRecoveryCapsule(subjectId: string): boolean {
    return occupiedDeviceId(subjectId) === 'lab_recovery_capsule';
}

/** Событие «описалась»: персонаж зафиксирован в оборудовании (не капсула) и
 *  bladder достиг максимума. Срабатывает один раз, видимо другим. */
function handleIncontinence(subjectId: string, phys: PhysiologyRow, worldMinute: number): void {
    const deviceId = occupiedDeviceId(subjectId);
    if (!deviceId || deviceId === 'lab_recovery_capsule') return;
    if (phys.bladder < 100) return;
    // Сброс.
    phys.bladder = 0;
    phys.last_toilet_minute = worldMinute;
    // Прямое описание ощущений (без эвфемизмов) — личная память.
    memoryRepo.save({
        subjectId,
        text: `Я описалась: моча потекла по ногам, я не смогла сдержаться, потому что была зафиксирована в оборудовании.`,
        embedding: buildEmbedding(`${subjectId} описалась в оборудовании`),
        tags: ['physiology', 'incontinence', 'shame'],
        relatedSubjects: [subjectId],
        type: 'episode_v2',
        metadata: {
            observed: false,
            sceneId: 'scene_lab_calibrator',
            worldMinute,
            actionLabel: 'Описаться',
            incontinence: true,
        },
    });
    // Видимо другим: наблюдатели в комнате увидят.
    try {
        recordSceneObservation({
            sceneId: 'scene_lab_calibrator',
            playerId: 'PL-1',
            actorId: subjectId,
            targetId: subjectId,
            actionId: 'incontinence',
            actionLabel: 'Описаться',
            pointId: 'systemic',
            pointLabel: 'низ живота',
            actionTags: ['physiology', 'incontinence'],
            finalValence: -0.6,
            notable: true,
            background: false,
            worldMinute,
            outcomeText: 'Моча потекла по ногам, персонаж не смог сдержаться.',
        });
    } catch (error) {
        console.warn('[Physiology] incontinence observation failed:', error);
    }
}

/** Повесить контекст рутины (еда/туалет) на персонажа. */
function applyRoutineContext(id: string, actionId: string, worldMinute: number): void {
    try {
        const preset = presetRepo.getActionPreset(actionId);
        if (!preset) return;
        // Не вешаем повторно, если контекст уже активен.
        const existing = activeContextsRepo.getAllForSubject(id).some(ctx => ctx.actionId === actionId);
        if (existing) return;
        ContextManager.applyContext(id, actionId, preset, 'systemic', id);
    } catch (e) {
        // Не фатально.
    }
}

/**
 * Выполнить рутину по команде («сходи в туалет», «поешь»).
 * Сбрасывает соответствующую потребность и вешает 10-минутный контекст рутины.
 * Возвращает false, если персонаж зафиксирован в закрытом устройстве и не может
 * выполнить рутину самостоятельно (для туалета/еды).
 */
export function performRoutine(subjectId: string, routineId: 'routine_toilet' | 'routine_eat'): boolean {
    const worldMinute = getWorldMinute();
    const phys = getPhysiology(subjectId);

    // Зафиксирован в закрытом устройстве (капсула/секс-машина/кресло) — не может
    // самостоятельно сходить в туалет или поесть.
    if (isSubjectFixedInDevice(subjectId)) return false;

    if (routineId === 'routine_toilet') {
        phys.bladder = 0;
        phys.last_toilet_minute = worldMinute;
    } else if (routineId === 'routine_eat') {
        phys.hunger = Math.max(0, phys.hunger - 40);
        phys.last_meal_minute = worldMinute;
    }
    savePhysiology(phys);
    applyRoutineContext(subjectId, routineId, worldMinute);
    return true;
}

function applyRoutine(id: string, phys: PhysiologyRow, worldMinute: number): void {
    const m = minuteOfDay(worldMinute);
    // Еда в обычные часы — вешаем контекст «Ест» на несколько минут.
    if (DAY_CYCLE.mealMinutes.some(mm => Math.abs(m - mm) < 30)) {
        if (phys.last_meal_minute === null || worldMinute - phys.last_meal_minute >= 60) {
            phys.hunger = Math.max(0, phys.hunger - 40);
            phys.last_meal_minute = worldMinute;
            applyRoutineContext(id, 'routine_eat', worldMinute);
        }
    }
    // Санитарный модуль — вешаем контекст «В санитарном модуле».
    if (isFree(id)) {
        // Свободен — автономно сходит в санитарный модуль при bladder >= 45.
        if (phys.bladder >= 45) {
            phys.bladder = 0;
            phys.last_toilet_minute = worldMinute;
            applyRoutineContext(id, 'routine_toilet', worldMinute);
        }
    } else if (isInRecoveryCapsule(id)) {
        // В капсуле — свободно, без события.
        if (phys.bladder >= 45) {
            phys.bladder = 0;
            phys.last_toilet_minute = worldMinute;
            applyRoutineContext(id, 'routine_toilet', worldMinute);
        }
    } else {
        // Зафиксирован в оборудовании (не капсула) — не может сходить.
        // При bladder = 100 — событие «описалась» (один раз).
        handleIncontinence(id, phys, worldMinute);
    }
}


/** Контекст физиологии для промпта (только заметные уровни). */
export function formatPhysiologyContext(subjectId: string, worldMinute: number): string | null {
    const phys = getPhysiology(subjectId);
    const parts: string[] = [];
    // Промпт строится только когда персонаж действует, значит он уже не спит.
    // Вместо «ты спишь» показываем факт принудительного пробуждения.
    if (phys.sleep_debt >= 40) {
        parts.push('ты сильно не выспалась');
    } else if (phys.sleep_debt >= 20) {
        parts.push('ты немного устала');
    }
    if (phys.hunger >= 70) parts.push('ты очень голодна');
    else if (phys.hunger >= 45) parts.push('ты голодна');
    // Контекст по положению: свободен / в капсуле / зафиксирован в оборудовании.
    const deviceId = occupiedDeviceId(subjectId);
    if (phys.bladder >= 100 && deviceId && deviceId !== 'lab_recovery_capsule') {
        // Зафиксирован и не смог сдержаться — прямо, без эвфемизмов.
        parts.push('ты описалась: моча потекла по ногам, ты не смогла сдержаться, потому что зафиксирована в оборудовании');
    } else if (phys.bladder >= 70) {
        parts.push(deviceId && deviceId !== 'lab_recovery_capsule'
            ? 'тебе срочно нужно в туалет, но ты зафиксирована в оборудовании и не можешь сходить'
            : 'тебе срочно нужно в туалет');
    } else if (phys.bladder >= 45) {
        parts.push(deviceId && deviceId !== 'lab_recovery_capsule'
            ? 'тебе нужно в туалет, но ты зафиксирована в оборудовании и не можешь сходить'
            : 'тебе нужно в туалет');
    }
    if (phys.wake_reason) parts.push(`тебя разбудили: ${phys.wake_reason}`);
    if (parts.length === 0) return null;
    return `[Физиология] ${parts.join('; ')}.`;
}
