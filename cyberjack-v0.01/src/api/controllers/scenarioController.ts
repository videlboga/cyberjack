import { Request, Response } from 'express';
import { buyOffer, getScenarioSnapshot, travelTo, useLabAsset, advanceWorldTime, recruitCandidate, changeLaboratoryRole } from '../../scenario/worldService';

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

export const passTime = (req: Request, res: Response) => {
    try {
        const minutes = Math.max(10, Math.min(480, Number(req.body.minutes) || 60));
        const clock = advanceWorldTime(minutes, 'Ожидание');
        res.json({ success: true, clock, scenario: getScenarioSnapshot(String(req.body.playerId || 'PL-1')) });
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
