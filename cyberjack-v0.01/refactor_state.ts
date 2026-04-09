import fs from 'fs';

const code = fs.readFileSync('src/api/server.ts', 'utf8');

// Function to extract matching chunk
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
import { subjectRepo, playerRepo, presetRepo, sceneRepo, characterRepo, characterRelationRepo, sceneCharacterRepo } from '../../infrastructure/repositories';
import { activeConfig, updateConfig } from '../../prompts/config';

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
    const stateBlock = extractBlock("app.get('/api/state'").replace('placeholder', 'getState');
    const updateSubjectBlock = extractBlock("app.post('/api/subject/update'").replace('placeholder', 'updateSubject');
    
    fs.writeFileSync('src/api/controllers/stateController.ts', `${COMMON_IMPORTS}\n\n${stateBlock}\n\n${updateSubjectBlock}\n`);
    
    fs.writeFileSync('src/api/routes/stateRoutes.ts', `import { Router } from 'express';
import { getState, updateSubject } from '../controllers/stateController';

const router = Router();

router.get('/state', getState as any);
router.post('/subject/update', updateSubject as any);

export default router;
`);

    console.log("State controller & routes generated.");
} catch(e) {
    console.error(e);
}
