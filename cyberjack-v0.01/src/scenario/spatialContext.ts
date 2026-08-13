import { db } from '../infrastructure/db';
import { clearCalibrationSetupContexts } from './calibrationContextCleanup';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { sexMachineStimulation } from '../domain/sexMachineStimulation';
import type { DeviceSessionMetadata, MentalSessionMetadata } from '../domain/sessionMetadata';

export type SpatialContext = {
    locationTitle: string;
    description: string;
    roomId: string | null;
    containerName: string | null;
    postureDescription: string | null;
    isolated: boolean;
    characterIds: string[];
    subjectIds: string[];
    characterNames: string[];
};

export type LaboratoryMoveResult = {
    handled: boolean;
    moved: boolean;
    label?: string;
    slotId?: string;
    reason?: string;
};

/** The sole resolved representation of a laboratory position. */
export type LaboratoryPresence = {
    characterId: string;
    slotId: string;
    roomId: string | null;
    status: string;
    anchorId: string | null;
};

const parseMetadata = (value: string) => {
    try { return JSON.parse(value || '{}') as Record<string, unknown>; }
    catch { return {}; }
};

const LAB_SCENE_ID = 'scene_lab_calibrator';

function roomForSlot(slotId: string, assets: Array<{ asset_id: string; metadata: string }>, visited = new Set<string>()): string | null {
    if (slotId.startsWith('room:')) return slotId.slice('room:'.length) || null;
    const anchorId = slotId.startsWith('device:') ? slotId.slice('device:'.length)
        : slotId.startsWith('near:') ? slotId.slice('near:'.length) : '';
    const asset = anchorId ? assets.find(entry => entry.asset_id === anchorId) : undefined;
    if (asset) return String(parseMetadata(asset.metadata).roomId || '') || null;
    if (!anchorId || visited.has(anchorId)) return null;
    visited.add(anchorId);
    const characterSlot = (db.prepare(`SELECT slot_id FROM scene_characters WHERE scene_id = ? AND character_id = ?`).get(LAB_SCENE_ID, anchorId) as any)?.slot_id;
    return characterSlot ? roomForSlot(String(characterSlot), assets, visited) : null;
}

/**
 * Resolve every reader's spatial data from `scene_characters.slot_id`.
 * The room assignment is a roster/status projection, never a location fallback.
 */
export function getLaboratoryPresence(characterOrSubjectId: string, playerId = 'PL-1'): LaboratoryPresence | null {
    const character = db.prepare(`SELECT id FROM characters WHERE id = ? OR subject_id = ? LIMIT 1`)
        .get(characterOrSubjectId, characterOrSubjectId) as any;
    if (!character) return null;
    const presence = db.prepare(`SELECT slot_id FROM scene_characters WHERE scene_id = ? AND character_id = ?`)
        .get(LAB_SCENE_ID, character.id) as any;
    const assignment = db.prepare(`SELECT room_id, status FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`)
        .get(playerId, character.id) as any;
    const assets = db.prepare(`SELECT asset_id, metadata FROM laboratory_assets WHERE player_id = ?`).all(playerId) as any[];
    const slotId = String(presence?.slot_id || '');
    if (!slotId) return null;
    const roomId = roomForSlot(slotId, assets);
    const anchorId = slotId.includes(':') ? slotId.slice(slotId.indexOf(':') + 1) || null : null;
    return { characterId: character.id, slotId, roomId, status: String(assignment?.status || 'resident'), anchorId };
}

/**
 * The only writer for a laboratory position.  The room assignment is kept as
 * a roster/index projection of the authoritative slot for existing UI data.
 */
export function setLaboratoryPresence(input: {
    characterId: string;
    slotId: string;
    roomId: string;
    status: string;
    playerId?: string;
}) {
    const playerId = input.playerId || 'PL-1';
    db.prepare(`INSERT INTO laboratory_room_assignments (player_id, room_id, character_id, status)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(player_id, character_id) DO UPDATE SET room_id = excluded.room_id, status = excluded.status`)
        .run(playerId, input.roomId, input.characterId, input.status);
    db.prepare(`UPDATE scene_characters SET slot_id = ?, presence_state = 'present' WHERE scene_id = ? AND character_id = ?`)
        .run(input.slotId, LAB_SCENE_ID, input.characterId);
    db.prepare(`UPDATE characters SET current_scene_id = ? WHERE id = ?`).run(LAB_SCENE_ID, input.characterId);
}

/** Resolve the character's actual laboratory room/container without duplicating it in simulation state. */
export function getLaboratorySpatialContext(characterOrSubjectId: string, playerId = 'PL-1'): SpatialContext | null {
    const character = db.prepare(`
        SELECT id, name, subject_id FROM characters
        WHERE id = ? OR subject_id = ? LIMIT 1
    `).get(characterOrSubjectId, characterOrSubjectId) as any;
    if (!character) return null;

    const resolvedPresence = getLaboratoryPresence(character.id, playerId);
    if (!resolvedPresence?.roomId) return null;
    const room = db.prepare(`SELECT name, description FROM laboratory_rooms WHERE player_id = ? AND room_id = ?`)
        .get(playerId, resolvedPresence.roomId) as any;
    if (!room) return null;

    const assets = db.prepare(`SELECT asset_id, name, description, metadata FROM laboratory_assets WHERE player_id = ?`).all(playerId) as any[];
    const occupiedAsset = assets.find(asset => String(parseMetadata(asset.metadata).subjectId || '') === character.id);
    const nearAssetId = resolvedPresence.slotId.startsWith('near:') ? resolvedPresence.slotId.slice(5) : '';
    const nearAsset = !occupiedAsset && nearAssetId ? assets.find(asset => asset.asset_id === nearAssetId) : null;
    const isolated = ['lab_recovery_capsule', 'lab_mental_correction_chair'].includes(String(occupiedAsset?.asset_id || ''));
    const isolatedCharacterIds = new Set(assets
        .filter(asset => ['lab_recovery_capsule', 'lab_sex_machine', 'lab_mental_correction_chair'].includes(asset.asset_id))
        .map(asset => String(parseMetadata(asset.metadata).subjectId || ''))
        .filter(Boolean));
    const roster = db.prepare(`
        SELECT c.id, c.name, c.subject_id, a.status
        FROM laboratory_room_assignments a JOIN characters c ON c.id = a.character_id
        WHERE a.player_id = ?
    `).all(playerId) as any[];
    const occupants = roster.filter(entry => getLaboratoryPresence(entry.id, playerId)?.roomId === resolvedPresence.roomId);
    const audible = isolated
        ? occupants.filter(entry => entry.id === character.id)
        : occupants.filter(entry => entry.id === character.id || !isolatedCharacterIds.has(entry.id));

    const containerName = occupiedAsset?.name || (nearAsset ? `рядом с оборудованием «${nearAsset.name}»` : null);
    const locationTitle = containerName ? `${room.name} / ${containerName}` : room.name;
    const deviceDescription = String(occupiedAsset?.description || 'Изолированное устройство').replace(/[.\s]+$/, '');
    const occupiedMetadata = occupiedAsset ? parseMetadata(occupiedAsset.metadata) : {};
    const deviceSession = occupiedMetadata.deviceSession as DeviceSessionMetadata | undefined;
    const worldMinute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
    const machineIntensity = Number(deviceSession?.intensity || 0);
    const stimulation = sexMachineStimulation(deviceSession?.stimulationMode);
    const tickling = deviceSession?.stimulationMode === 'tickling';
    const feltPower = machineIntensity >= 75 ? 'Воздействие ощущается беспощадно сильным'
        : machineIntensity >= 45 ? 'Воздействие ощущается настойчивым и мощным'
        : 'Воздействие остаётся умеренным, но непрерывным';
    const feltRhythm = tickling
        ? deviceSession?.rhythm === 'pulse' ? 'серии касаний сменяются короткими паузами'
            : deviceSession?.rhythm === 'wave' ? 'касания накатывают и отступают волнами'
                : deviceSession?.rhythm === 'random' ? 'точки контакта меняются непредсказуемо'
                    : 'касания возвращаются ровными повторяющимися сериями'
        : deviceSession?.rhythm === 'pulse' ? 'ритм приходит отчётливыми повторяющимися толчками'
            : deviceSession?.rhythm === 'wave' ? 'ритм накатывает и отступает волнами'
                : 'ритм остаётся ровным и повторяющимся';
    const feltPolicy = deviceSession?.orgasmPolicy === 'deny'
        ? 'каждый подъём обрывается прежде, чем напряжение успевает разрешиться'
        : deviceSession?.orgasmPolicy === 'force'
            ? 'ритм снова и снова подталкивает тебя к неизбежному пику'
            : 'ритм не отступает, когда напряжение приближается к пику';
    const deviceProtocolDescription = occupiedAsset?.asset_id === 'lab_sex_machine' && deviceSession
        ? [
            `Ты лежишь на металлической поверхности секс-машины`,
            `твои руки и ноги зажаты жёсткими фиксаторами, поэтому ты не можешь самостоятельно изменить положение тела`,
            tickling
                ? `ступни закреплены в отдельных держателях; механические щётки проходят по подошвам, под пальцами и вдоль сводов, а фиксаторы не дают отдёрнуть ноги`
                : stimulation.pointId === 'anus'
                    ? `в твой анус введён крупный поршень с рельефной поверхностью; изнутри ты постоянно ощущаешь его объём, давление и движение`
                    : `в твоё влагалище введён крупный поршень с рельефной поверхностью; изнутри ты постоянно ощущаешь его объём, давление и движение`,
            deviceSession.status === 'running' ? feltPower : deviceSession.status === 'paused' ? 'механизм замер, но давление и фиксация никуда не исчезли' : 'механизм остановлен, хотя твоё тело всё ещё удерживается на месте',
            feltRhythm,
            feltPolicy,
            `ты чувствуешь, что это продолжается уже ${Math.max(0, worldMinute - Number(deviceSession.startedAtTick || worldMinute)) < 15 ? 'несколько минут' : 'достаточно долго, чтобы потерять ощущение короткой процедуры'}`,
        ].join('; ') + '.'
        : '';
    const postureDescription = occupiedAsset?.asset_id === 'lab_sex_machine'
        ? 'ты лежишь на металлической поверхности и не можешь самостоятельно изменить положение из-за фиксаторов'
        : occupiedAsset?.asset_id === 'lab_recovery_capsule'
            ? 'твоё тело удерживается в вертикальном положении внутри капсулы; ты не стоишь на полу и не лежишь'
            : occupiedAsset?.asset_id === 'lab_mental_correction_chair'
                ? 'ты сидишь глубоко в фиксирующем кресле; визор закрывает глаза, руки лежат на подлокотниках'
            : occupiedAsset?.asset_id === 'lab_diagnostic_table'
                ? 'ты лежишь на диагностическом столе; ты не стоишь на полу'
            : null;
    const capsuleExperience = occupiedAsset?.asset_id === 'lab_recovery_capsule'
        ? 'Это вертикальная ёмкость, наполненная вязкой тёплой жидкостью. Ощущения внутри странные и приглушённые, но чувствуется, как тело понемногу расслабляется. На лице закреплена маска, через которую подаётся кислород; к углу рта подведена трубка, из которой иногда поступает сладковатая жидкость.'
        : '';
    const mentalChairExperience = occupiedAsset?.asset_id === 'lab_mental_correction_chair'
        ? 'Мягкие фиксаторы удерживают тебя в кресле, а плотный визор отсекает комнату. В наушниках остаётся тихий направленный звук; под ним можно различить ровное тепло подголовника и едва заметную тактильную отдачу подлокотников.'
        : '';
    const mentalSession = occupiedMetadata.mentalSession as MentalSessionMetadata | undefined;
    const mentalProtocolDescription = occupiedAsset?.asset_id === 'lab_mental_correction_chair' && mentalSession?.status === 'running' && mentalSession.memoryText
        ? `Система возвращает тебя к одному эпизоду из твоей памяти: «${String(mentalSession.memoryText).slice(0, 650)}». Сейчас идёт этап ${mentalSession.phase === 'recall' ? 'извлечения деталей' : mentalSession.phase === 'immersion' ? 'повторного переживания' : 'закрепления новой ассоциации'}; внимание удерживается на теме «${mentalSession.focusTag || 'не выбрана'}».`
        : '';
    const description = isolated
        ? `${capsuleExperience || mentalChairExperience || deviceDescription}${mentalProtocolDescription ? ` ${mentalProtocolDescription}` : ''} Связь с калибратором идёт по интеркому; происходящее в комнате непосредственно не слышно и не видно.`
        : `${room.description || 'Помещение лаборатории.'}${deviceProtocolDescription ? ` ${deviceProtocolDescription}` : ''}${nearAsset ? ` ${character.name} находится рядом с оборудованием «${nearAsset.name}», но не занимает его.` : ''}`;

    return {
        locationTitle,
        description,
        roomId: resolvedPresence.roomId,
        containerName,
        postureDescription,
        isolated,
        characterIds: audible.map(entry => entry.id),
        subjectIds: audible.map(entry => entry.subject_id || entry.id),
        characterNames: audible.map(entry => entry.name)
    };
}

const normalized = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
const matches = (query: string, ...values: string[]) => values.some(value => {
    const candidate = normalized(value || '');
    return candidate === query || candidate.includes(query) || query.includes(candidate);
});

/** Move a free character to a room/near an object without occupying that object. */
export function moveCharacterInLaboratory(characterOrSubjectId: string, targetLocation: string, playerId = 'PL-1'): LaboratoryMoveResult {
    const character = db.prepare(`SELECT id, name FROM characters WHERE id = ? OR subject_id = ? LIMIT 1`)
        .get(characterOrSubjectId, characterOrSubjectId) as any;
    if (!character) return { handled: false, moved: false };
    const assignment = db.prepare(`SELECT room_id, status FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`)
        .get(playerId, character.id) as any;
    if (!assignment) return { handled: false, moved: false };
    if (String(assignment.status || '').startsWith('device:')) {
        return { handled: true, moved: false, reason: `${character.name} находится в оборудовании и не может самостоятельно переместиться.` };
    }

    const query = normalized(targetLocation);
    if (!query || query === 'initiator') return { handled: false, moved: false };
    const rooms = db.prepare(`SELECT room_id, name, room_type AS type, capacity FROM laboratory_rooms WHERE player_id = ?`).all(playerId) as any[];
    const assets = (db.prepare(`SELECT asset_id, name, metadata FROM laboratory_assets WHERE player_id = ?`).all(playerId) as any[])
        .map(asset => ({ ...asset, parsed: parseMetadata(asset.metadata) }));
    const characters = db.prepare(`
        SELECT c.id, c.name, a.room_id FROM laboratory_room_assignments a
        JOIN characters c ON c.id = a.character_id WHERE a.player_id = ?
    `).all(playerId) as any[];

    const targetAsset = assets.find(asset =>
        matches(query, asset.name, asset.asset_id) ||
        (asset.asset_id === 'lab_diagnostic_table' && /(диагност|калибровоч|процедурн).*(стол)|\bстол/u.test(query)) ||
        (asset.asset_id === 'lab_mental_correction_chair' && /(ментальн|нейро|коррекц).*(кресл)|\bкресл/u.test(query)) ||
        (asset.asset_id === 'lab_terminal' && /(терминал|пульт)/u.test(query)) ||
        (asset.asset_id.includes('capsule') && /(капсул)/u.test(query))
    );
    const targetRoom = targetAsset
        ? rooms.find(room => room.room_id === targetAsset.parsed.roomId)
        : rooms.find(room => matches(query, room.name, room.room_id));
    const targetCharacter = !targetAsset && !targetRoom
        ? characters.find(entry => entry.id !== character.id && matches(query, entry.name, entry.id))
        : null;
    const room = targetRoom || (targetCharacter ? rooms.find(entry => entry.room_id === targetCharacter.room_id) : null);
    if (!room) return { handled: false, moved: false };

    const occupied = db.prepare(`SELECT COUNT(*) AS count FROM laboratory_room_assignments WHERE player_id = ? AND room_id = ? AND character_id != ? AND status != 'operator'`)
        .get(playerId, room.room_id, character.id) as any;
    // The calibrator is an operator, not an additional room occupant. The
    // previous unconditional capacity check left the UI focused on a subject
    // while the authoritative player slot remained at the prior screen.
    if (character.id !== playerId && assignment.room_id !== room.room_id && Number(occupied?.count || 0) >= Number(room.capacity || 1)) {
        return { handled: true, moved: false, reason: `В помещении «${room.name}» нет свободного места.` };
    }

    const slotId = targetAsset ? `near:${targetAsset.asset_id}` : targetCharacter ? `near:${targetCharacter.id}` : `room:${room.room_id}`;
    const label = targetAsset ? `к оборудованию «${targetAsset.name}»` : targetCharacter ? `к ${targetCharacter.name}` : `в ${room.name}`;
    const unchanged = assignment.room_id === room.room_id && (db.prepare(`SELECT slot_id FROM scene_characters WHERE scene_id = 'scene_lab_calibrator' AND character_id = ?`).get(character.id) as any)?.slot_id === slotId;
    if (unchanged) return { handled: true, moved: false, label, slotId, reason: `${character.name} уже находится ${label}.` };

    db.transaction(() => {
        // A free move starts a new physical scene: table-bound poses and
        // restraints cannot follow the character into another room.
        clearCalibrationSetupContexts(character.id);
        // The player is an operator rather than a room occupant. Moving them
        // to the screen's physical slot must not make them consume capacity.
        const nextStatus = character.id === playerId ? 'operator' : 'resident';
        setLaboratoryPresence({ characterId: character.id, slotId, roomId: room.room_id, status: nextStatus, playerId });
    })();
    // Relocation ends the current physical scene. A private cell additionally
    // gives the subject room to recover, but does not erase learned history.
    interactionStanceRepo.softenAll(character.id, room.type === 'cell' ? .5 : .3);
    return { handled: true, moved: true, label, slotId };
}

export function listLaboratoryDestinations(playerId = 'PL-1'): string[] {
    const rooms = (db.prepare(`SELECT name FROM laboratory_rooms WHERE player_id = ? ORDER BY rowid`).all(playerId) as any[]).map(row => row.name);
    const assets = (db.prepare(`SELECT name FROM laboratory_assets WHERE player_id = ? ORDER BY rowid`).all(playerId) as any[]).map(row => row.name);
    return [...rooms, ...assets];
}
