import { Request, Response } from 'express';
import { buyOffer, getScenarioSnapshot, travelTo, useLabAsset, recruitCandidate, changeLaboratoryRole, controlDeviceSession } from '../../scenario/worldService';
import { moveCharacterInLaboratory } from '../../scenario/spatialContext';
import { getTimeFlowState, setTimeFlowPaused } from '../../scenario/timeFlow';
import { advanceSimulationTime } from '../../scenario/simulationTime';
import { db } from '../../infrastructure/db';
import { chatMemoryRepo } from '../../infrastructure/repositories';

export const getScenario = (req: Request, res: Response) => {
    try {
        res.json({ success: true, ...getScenarioSnapshot(String(req.query.playerId || 'PL-1')) });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const travel = (req: Request, res: Response) => {
    try {
        const result = travelTo(String(req.body.locationId || ''), String(req.body.playerId || 'PL-1'));
        res.json({ success: true, result, scenario: getScenarioSnapshot(String(req.body.playerId || 'PL-1')) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const buy = (req: Request, res: Response) => {
    try {
        const playerId = String(req.body.playerId || 'PL-1');
        const purchase = buyOffer(req.params.offerId, playerId);
        res.json({ success: true, purchase, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const useEquipment = (req: Request, res: Response) => {
    try {
        const playerId = String(req.body.playerId || 'PL-1');
        const subjectId = String(req.body.subjectId || '');
        if (!subjectId) throw new Error('Не выбран персонаж');
        const result = useLabAsset(req.params.assetId, subjectId, playerId);
        res.json({ success: true, result, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const controlEquipment = (req: Request, res: Response) => {
    try {
        const playerId = String(req.body.playerId || 'PL-1');
        const command = String(req.body.command || '') as 'configure' | 'settings' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop';
        if (!['configure', 'settings', 'start', 'adjust', 'pause', 'resume', 'stop'].includes(command)) throw new Error('Неизвестная команда устройства');
        const result = controlDeviceSession(req.params.assetId, command, req.body, playerId);
        res.json({ success: true, result, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const passTime = async (req: Request, res: Response) => {
    try {
        const minutes = Math.max(10, Math.min(480, Number(req.body.minutes) || 60));
        const clock = await advanceSimulationTime(minutes, 'Ожидание');
        res.json({ success: true, clock, scenario: getScenarioSnapshot(String(req.body.playerId || 'PL-1')) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const getTimeFlow = (_req: Request, res: Response) => {
    try {
        res.json({ success: true, timeFlow: getTimeFlowState() });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const controlTimeFlow = (req: Request, res: Response) => {
    try {
        const paused = Boolean(req.body.paused);
        res.json({ success: true, timeFlow: setTimeFlowPaused(paused) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const recruit = (req: Request, res: Response) => {
    try {
        const playerId = String(req.body.playerId || 'PL-1');
        const role = req.body.role === 'asset' ? 'asset' : 'staff';
        const result = recruitCandidate(req.params.characterId, role, playerId);
        res.json({ success: true, result, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const changeRole = (req: Request, res: Response) => {
    try {
        const playerId = String(req.body.playerId || 'PL-1');
        const role = req.body.role === 'asset' ? 'asset' : 'staff';
        const result = changeLaboratoryRole(req.params.characterId, role, playerId);
        res.json({ success: true, result, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const moveLaboratoryCharacter = (req: Request, res: Response) => {
    try {
        const playerId = String(req.body.playerId || 'PL-1');
        const target = String(req.body.roomId || '');
        if (!target) throw new Error('Не выбрано помещение');
        const characterId = req.params.characterId;
        // Get old room before move
        const oldAssignment = (db as any).prepare(
            'SELECT a.room_id, r.name AS room_name FROM laboratory_room_assignments a JOIN laboratory_rooms r ON r.player_id = a.player_id AND r.room_id = a.room_id WHERE a.player_id = ? AND a.character_id = ?'
        ).get(playerId, characterId) as any;
        const result = moveCharacterInLaboratory(characterId, target, playerId);
        if (!result.handled || !result.moved) throw new Error(result.reason || 'Перемещение не выполнено');
        // Record move event in chat memory of all characters in old and new room
        const character = (db as any).prepare('SELECT name FROM characters WHERE id = ? OR subject_id = ? LIMIT 1').get(characterId, characterId) as any;
        const charName = character?.name || characterId;
        const notice = `→ ${charName} переместилась ${result.label || ''}`;
        // Get characters in old and new room
        const oldRoomChars = oldAssignment
            ? ((db as any).prepare('SELECT character_id FROM laboratory_room_assignments WHERE player_id = ? AND room_id = ?').all(playerId, oldAssignment.room_id) as any[])
            : [];
        const newRoomChars = (db as any).prepare('SELECT character_id FROM laboratory_room_assignments WHERE player_id = ? AND room_id = ?')
            .all(playerId, (db as any).prepare('SELECT room_id FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?').get(playerId, characterId)?.room_id) as any[];
        const allChars = new Map<string, boolean>();
        for (const c of oldRoomChars) allChars.set(c.character_id, true);
        for (const c of newRoomChars) allChars.set(c.character_id, true);
        for (const charId of allChars.keys()) {
            chatMemoryRepo.append(charId, 'user', notice, 'Система');
        }
        res.json({ success: true, result, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};
