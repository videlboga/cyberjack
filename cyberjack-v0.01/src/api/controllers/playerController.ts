import { Request, Response } from 'express';
import { playerRepo, characterRepo, characterRelationRepo } from '../../infrastructure/repositories';

const DEFAULT_PLAYER = {
    id: 'PL-1',
    resources: {
        credits: 0,
        authority: 0,
        timeBudget: 0
    }
};

function normalizePlayer(playerObj?: { id: string; resources: Record<string, number> } | null) {
    const src = playerObj || DEFAULT_PLAYER;
    characterRepo.ensurePlayer(src.id, src.id === 'PL-1' ? 'Калибратор' : src.id);
    return { ...DEFAULT_PLAYER, ...src };
}


export const updatePlayer = (req: Request, res: Response) => {
    try {
        const { playerId = 'PL-1', resources = {} } = req.body || {};
        const existing = normalizePlayer(playerRepo.get(playerId));
        const nextResources: Record<string, number> = { ...existing.resources };

        for (const [key, value] of Object.entries(resources || {})) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) continue;
            nextResources[key] = numeric;
        }

        const nextPlayer = { id: playerId, resources: nextResources };
        playerRepo.save(nextPlayer);
        res.json({ success: true, player: normalizePlayer(nextPlayer) });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateRelations = (req: Request, res: Response) => {
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
