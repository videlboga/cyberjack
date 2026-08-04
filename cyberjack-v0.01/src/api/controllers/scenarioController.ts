import { Request, Response } from 'express';
import { buyOffer, getScenarioSnapshot, travelTo, useLabAsset, recruitCandidate, changeLaboratoryRole, controlDeviceSession } from '../../scenario/worldService';
import { moveCharacterInLaboratory } from '../../scenario/spatialContext';
import { getTimeFlowState, setTimeFlowPaused } from '../../scenario/timeFlow';
import { advanceSimulationTime } from '../../scenario/simulationTime';

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
        const result = moveCharacterInLaboratory(req.params.characterId, target, playerId);
        if (!result.handled || !result.moved) throw new Error(result.reason || 'Перемещение не выполнено');
        res.json({ success: true, result, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};
