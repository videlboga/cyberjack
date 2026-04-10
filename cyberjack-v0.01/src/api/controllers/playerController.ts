import { Request, Response } from 'express';
import { resourceRepo, characterRepo, characterRelationRepo } from '../../infrastructure/repositories';
import { ResourceState } from '../../domain/types';

const DEFAULT_PLAYER = {
    id: 'PL-1',
    resources: {
        credits: { characterId: 'PL-1', resourceKey: 'credits', amount: 0 },
        authority: { characterId: 'PL-1', resourceKey: 'authority', amount: 0 }
    }
};

export function normalizePlayer(playerObj?: ResourceState | null) {
    const src = playerObj || DEFAULT_PLAYER;
    characterRepo.ensureCharacter(src.id, src.id === 'PL-1' ? 'Калибратор' : src.id);
    
    const flatResources: Record<string, number> = {};
    for (const [key, res] of Object.entries(src.resources)) {
        flatResources[key] = res.amount;
    }
    
    return { id: src.id, resources: flatResources };
}

export const updatePlayer = (req: Request, res: Response) => {
    try {
        const { playerId = 'PL-1', resources = {} } = req.body || {};
        const existing = resourceRepo.get(playerId) || { id: playerId, resources: {} };
        const nextResources = { ...existing.resources };
        
        for (const [key, value] of Object.entries(resources || {})) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) continue;
            if (nextResources[key]) {
                nextResources[key].amount = numeric;
            } else {
                nextResources[key] = { characterId: playerId, resourceKey: key, amount: numeric };
            }
        }

        const nextPlayer = { id: playerId, resources: nextResources };
        resourceRepo.save(nextPlayer);
        res.json({ success: true, player: normalizePlayer(nextPlayer) });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};export const updateRelations = (req: Request, res: Response) => {
    try {
        const { fromId, toId, knows, present, canInteract, attitude } = req.body || {};
        if (!fromId || !toId) {
            return res.status(400).json({ success: false, error: 'fromId и toId обязательны' });
        }

        if (knows !== undefined || present !== undefined || canInteract !== undefined) {
            characterRelationRepo.updateFlags(fromId, toId, {
                knows,
                present,
                canInteract
            });
        }

        if (typeof attitude === 'number' && Number.isFinite(attitude)) {
            characterRelationRepo.updateAttitude(fromId, toId, attitude, { baselineAttitude: attitude });
        }

        const relation = characterRelationRepo.get(fromId, toId);
        res.json({ success: true, relation });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getRelations = (req: Request, res: Response) => {
    try {
        const fromId = (req.query.fromId as string) || '';
        if (!fromId) {
            return res.status(400).json({ success: false, error: 'fromId обязателен' });
        }
        const relations = characterRelationRepo.listFor(fromId);
        res.json({ success: true, relations });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
