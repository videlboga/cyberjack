import fs from 'fs';

const code = fs.readFileSync('src/api/server.ts', 'utf8');

function extractBlock(keyword: string): string {
    const lines = code.split('\n');
    let startIdx = lines.findIndex(l => l.trim().startsWith(keyword));
    if (startIdx === -1) throw new Error(`Not found keywords: ${keyword}`);
    
    let openBraces = 0;
    let isStarted = false;
    let endIdx = -1;
    
    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        openBraces += (line.match(/\{/g) || []).length;
        openBraces -= (line.match(/\}/g) || []).length;
        if (!isStarted && line.includes('{')) isStarted = true;
        if (isStarted && openBraces === 0) {
            endIdx = i;
            break;
        }
    }
    
    let block = lines.slice(startIdx, endIdx + 1).join('\n');
    return block.replace(
        /app\.(get|post)\(['"][^'"]+['"],\s*(async\s*)?\((req, res|req: Request, res: Response)\)\s*=>\s*\{/,
        `export const placeholder = $2(req: Request, res: Response) => {`
    ).replace(/\n\}\);$/, '\n};');
}

const COMMON_IMPORTS = `import { Request, Response } from 'express';
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
`;

try {
    const updatePlayer = extractBlock("app.post('/api/player/update'").replace('placeholder', 'updatePlayer');
    const updateRelations = extractBlock("app.post('/api/relations/update'").replace('placeholder', 'updateRelations');
    const getRelations = extractBlock("app.get('/api/relations'").replace('placeholder', 'getRelations');
    
    fs.writeFileSync('src/api/controllers/playerController.ts', `${COMMON_IMPORTS}\n\n${updatePlayer}\n\n${updateRelations}\n\n${getRelations}\n`);
    
    fs.writeFileSync('src/api/routes/playerRoutes.ts', `import { Router } from 'express';
import { updatePlayer, updateRelations, getRelations } from '../controllers/playerController';

const router = Router();

router.post('/player/update', updatePlayer as any);
router.post('/relations/update', updateRelations as any);
router.get('/relations', getRelations as any);

export default router;
`);

    console.log("Player controller & routes generated.");
} catch(e) {
    console.error(e);
}
