import fs from 'fs';

const code = fs.readFileSync('src/api/server.ts', 'utf8');

function extractBlock(keyword: string): string {
    const lines = code.split('\n');
    let startIdx = lines.findIndex(l => l.trim().startsWith(keyword));
    if (startIdx === -1) throw new Error(`Not found: ${keyword}`);
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

const COMMON_SCENE = `import { Request, Response } from 'express';
import { sceneRepo, presetRepo, activeContextsRepo, eventLogRepo } from '../../infrastructure/repositories';
`;

const COMMON_META = `import { Request, Response } from 'express';
import { updateConfig, activeConfig } from '../../prompts/config';
import { generateCharacterContext } from '../../orchestration/characterGenerator/generator';
import { composePromptSections } from '../../orchestration/characterGenerator/promptComposer';
import { setGeneratedProfile } from '../../orchestration/characterGenerator/profileStore';
import { ensureGeneratedProfile } from '../../orchestration/characterGenerator/profileManager';
`;

try {
    const getScenes = extractBlock("app.get('/api/scenes'").replace('placeholder', 'getScenes');
    const moveScene = extractBlock("app.post('/api/scene/move'").replace('placeholder', 'moveScene');
    const getContexts = extractBlock("app.get('/api/contexts'").replace('placeholder', 'getContexts');
    const toggleContext = extractBlock("app.post('/api/contexts/toggle'").replace('placeholder', 'toggleContext');
    
    fs.writeFileSync('src/api/controllers/sceneController.ts', `${COMMON_SCENE}\n\n${getScenes}\n\n${moveScene}\n\n${getContexts}\n\n${toggleContext}\n`);
    fs.writeFileSync('src/api/routes/sceneRoutes.ts', `import { Router } from 'express';
import { getScenes, moveScene, getContexts, toggleContext } from '../controllers/sceneController';

const router = Router();
router.get('/scenes', getScenes as any);
router.post('/scene/move', moveScene as any);
router.get('/contexts', getContexts as any);
router.post('/contexts/toggle', toggleContext as any);
export default router;
`);

    const getConfig = extractBlock("app.get('/api/config'").replace('placeholder', 'getConfig');
    const postConfig = extractBlock("app.post('/api/config'").replace('placeholder', 'postConfig');
    const profile = extractBlock("app.get('/api/characters/profile'").replace('placeholder', 'getCharacterProfile');
    const prompt = extractBlock("app.post('/api/characters/prompt'").replace('placeholder', 'getCharacterPrompt');

    fs.writeFileSync('src/api/controllers/metaController.ts', `${COMMON_META}\n\n${getConfig}\n\n${postConfig}\n\n${profile}\n\n${prompt}\n`);
    fs.writeFileSync('src/api/routes/metaRoutes.ts', `import { Router } from 'express';
import { getConfig, postConfig, getCharacterProfile, getCharacterPrompt } from '../controllers/metaController';

const router = Router();
router.get('/config', getConfig as any);
router.post('/config', postConfig as any);
router.get('/characters/profile', getCharacterProfile as any);
router.post('/characters/prompt', getCharacterPrompt as any);
export default router;
`);
    console.log("Rest generated.");
} catch(e) { console.error(e); }
