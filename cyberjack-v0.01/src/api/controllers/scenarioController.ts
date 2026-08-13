import { Request, Response } from 'express';
import { buyOffer, getScenarioSnapshot, travelTo, useLabAsset, recruitCandidate, changeLaboratoryRole, controlDeviceSession, moveLaboratoryCharacter as moveLabCharacter } from '../../scenario/worldService';
import { getTimeFlowState, setTimeFlowPaused } from '../../scenario/timeFlow';

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

export const controlEquipment = async (req: Request, res: Response) => {
    try {
        const playerId = String(req.body.playerId || 'PL-1');
        const command = String(req.body.command || '') as 'configure' | 'settings' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop' | 'intervene';
        if (!['configure', 'settings', 'start', 'adjust', 'pause', 'resume', 'stop', 'intervene'].includes(command)) throw new Error('Неизвестная команда устройства');
        const result = await controlDeviceSession(req.params.assetId, command, req.body, playerId);
        // The client refreshes its scenario state immediately after a device
        // command. Building another full snapshot here duplicates expensive
        // work and makes simple settings changes feel delayed.
        res.json({ success: true, result });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const passTime = (_req: Request, res: Response) => {
    try {
        res.status(409).json({
            success: false,
            error: 'Ручное продвижение времени отключено: временем управляет фоновый игровой clock.',
        });
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
        const characterId = String(req.params.characterId);
        const outcome = moveLabCharacter(characterId, target, playerId);
        if (!outcome.handled) throw new Error(outcome.reason || 'Перемещение не выполнено');
        res.json({ success: true, result: outcome.result, scenario: getScenarioSnapshot(playerId) });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};
