import { db } from '../infrastructure/db';
import type { TickEffect } from '../orchestration/tickEffectPlan';
import { getCharacterHomeRoom, ENCLOSED_DEVICE_ASSETS } from './spatialContext';

/**
 * Read-only resolution of a laboratory relocation. No writes are performed
 * here: a successful move is expressed as a set of `TickEffect`s that the
 * caller applies inside the common tick commit, so that the relocation is
 * atomic with the rest of the action.
 */

export type LaboratoryMoveOutcome = 'allowed' | 'unchanged' | 'blocked' | 'unresolved';

export interface LaboratoryMoveResolution {
    outcome: LaboratoryMoveOutcome;
    /** Legacy compatibility flags kept so callers can branch uniformly. */
    handled: boolean;
    moved: boolean;
    label?: string;
    slotId?: string;
    reason?: string;
    /** Populated only for a successful relocation. */
    effects: TickEffect[];
}

const parseMetadata = (value: string) => {
    try { return JSON.parse(value || '{}') as Record<string, unknown>; }
    catch { return {}; }
};

const normalized = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
const matches = (query: string, ...values: string[]) => values.some(value => {
    const candidate = normalized(value || '');
    return candidate === query || candidate.includes(query) || query.includes(candidate);
});

const HOME_QUERY = /^(своя камера|свою камеру|в камеру|домой|ко мне домой|к себе)$/;

export function resolveLaboratoryMove(
    characterOrSubjectId: string,
    targetLocation: string,
    playerId = 'PL-1',
): LaboratoryMoveResolution {
    const character = db.prepare(`SELECT id, name FROM characters WHERE id = ? OR subject_id = ? LIMIT 1`)
        .get(characterOrSubjectId, characterOrSubjectId) as any;
    if (!character) return { outcome: 'unresolved', handled: false, moved: false, effects: [] };

    const assignment = db.prepare(`SELECT room_id, status FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`)
        .get(playerId, character.id) as any;
    if (!assignment) return { outcome: 'unresolved', handled: false, moved: false, effects: [] };

    // Only enclosed devices physically fix a character in place. The diagnostic
    // table does not restrain the subject, so a free move off it is allowed —
    // table-bound poses and equipment are cleared as part of the move.
    const deviceStatus = String(assignment.status || '');
    if (deviceStatus.startsWith('device:')) {
        const assetId = deviceStatus.slice('device:'.length);
        if (ENCLOSED_DEVICE_ASSETS.has(assetId)) {
            return {
                outcome: 'blocked', handled: true, moved: false,
                reason: `${character.name} зафиксирована в оборудовании и не может самостоятельно переместиться.`,
                effects: [],
            };
        }
        // Non-enclosed device (diagnostic table): treat the character as free.
    }

    const query = normalized(targetLocation);
    if (!query || query === 'initiator') return { outcome: 'unresolved', handled: false, moved: false, effects: [] };

    const rooms = db.prepare(`SELECT room_id, name, room_type AS type, capacity FROM laboratory_rooms WHERE player_id = ?`).all(playerId) as any[];
    const assets = (db.prepare(`SELECT asset_id, name, metadata FROM laboratory_assets WHERE player_id = ?`).all(playerId) as any[])
        .map(asset => ({ ...asset, parsed: parseMetadata(asset.metadata) }));
    const characters = db.prepare(`
        SELECT c.id, c.name, a.room_id FROM laboratory_room_assignments a
        JOIN characters c ON c.id = a.character_id WHERE a.player_id = ?
    `).all(playerId) as any[];

    // «своя камера» / «домой» / «в камеру» resolve to the character's own cell.
    let room: any = null;
    let slotId: string;
    let label: string;
    if (HOME_QUERY.test(query)) {
        const homeRoomId = getCharacterHomeRoom(character.id, playerId);
        if (!homeRoomId) return { outcome: 'unresolved', handled: false, moved: false, effects: [] };
        room = rooms.find(entry => entry.room_id === homeRoomId) || null;
        slotId = `room:${homeRoomId}`;
        label = room ? `в ${room.name}` : 'в свою камеру';
    } else {
        const targetAsset = assets.find(asset =>
            matches(query, asset.name, asset.asset_id) ||
            (asset.asset_id === 'lab_diagnostic_table' && /(диагност|калибровоч|процедурн).*(стол)|\bстол/u.test(query)) ||
            (asset.asset_id === 'lab_mental_correction_chair' && /(ментальн|нейро|коррекц).*(кресл)|\bкресл/u.test(query)) ||
            (asset.asset_id === 'lab_terminal' && /(терминал|пульт)/u.test(query)) ||
            (asset.asset_id.includes('capsule') && /(капсул)/u.test(query))
        );
        const targetRoom = targetAsset
            ? rooms.find(entry => entry.room_id === targetAsset.parsed.roomId)
            : rooms.find(entry => matches(query, entry.name, entry.room_id));
        const targetCharacter = !targetAsset && !targetRoom
            ? characters.find(entry => entry.id !== character.id && matches(query, entry.name, entry.id))
            : null;
        room = targetRoom || (targetCharacter ? rooms.find(entry => entry.room_id === targetCharacter.room_id) : null);
        slotId = targetAsset ? `near:${targetAsset.asset_id}` : targetCharacter ? `near:${targetCharacter.id}` : `room:${room?.room_id || ''}`;
        label = targetAsset ? `к оборудованию «${targetAsset.name}»` : targetCharacter ? `к ${targetCharacter.name}` : (room ? `в ${room.name}` : '');
    }
    if (!room) return { outcome: 'unresolved', handled: false, moved: false, effects: [] };

    const occupied = db.prepare(`SELECT COUNT(*) AS count FROM laboratory_room_assignments WHERE player_id = ? AND room_id = ? AND character_id != ? AND status != 'operator'`)
        .get(playerId, room.room_id, character.id) as any;
    // The calibrator is an operator, not an additional room occupant. The
    // previous unconditional capacity check left the UI focused on a subject
    // while the authoritative player slot remained at the prior screen.
    if (character.id !== playerId && assignment.room_id !== room.room_id && Number(occupied?.count || 0) >= Number(room.capacity || 1)) {
        return {
            outcome: 'blocked', handled: true, moved: false,
            reason: `В помещении «${room.name}» нет свободного места.`,
            effects: [],
        };
    }

    const unchanged = assignment.room_id === room.room_id && (db.prepare(`SELECT slot_id FROM scene_characters WHERE scene_id = 'scene_lab_calibrator' AND character_id = ?`).get(character.id) as any)?.slot_id === slotId;
    if (unchanged) {
        return {
            outcome: 'unchanged', handled: true, moved: false, label, slotId,
            reason: `${character.name} уже находится ${label}.`,
            effects: [],
        };
    }

    // The player is an operator rather than a room occupant. Moving them
    // to the screen's physical slot must not make them consume capacity.
    const nextStatus = character.id === playerId ? 'operator' : 'resident';
    const wasOnDevice = deviceStatus.startsWith('device:');
    const effects: TickEffect[] = [
        // A free move starts a new physical scene: table-bound poses and
        // restraints cannot follow the character into another room.
        { kind: 'lab.clear-setup-contexts', subjectId: character.id },
        // Walking off a non-enclosed surface (diagnostic table) frees its slot.
        ...(wasOnDevice ? [{ kind: 'lab.release-device', subjectId: character.id, playerId } as TickEffect] : []),
        { kind: 'lab.set-presence', characterId: character.id, slotId, roomId: room.room_id, status: nextStatus, playerId },
        // Relocation ends the current physical scene. A private cell
        // additionally gives the subject room to recover, but does not erase
        // learned history.
        { kind: 'stance.soften-all', subjectId: character.id, amount: room.type === 'cell' ? 0.5 : 0.3 },
    ];

    return { outcome: 'allowed', handled: true, moved: true, label, slotId, effects };
}
