import fs from 'fs';

const code = fs.readFileSync('src/api/server.ts', 'utf8');

// A function to extract a route handler block
function extractBlock(startMarker: string): string {
    const lines = code.split('\n');
    let startIdx = lines.findIndex(l => l.includes(startMarker));
    if (startIdx === -1) throw new Error(`Not found: ${startMarker}`);
    
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
    
    // The handler body is from startIdx+1 to endIdx-1, but wait, it's `app.post(..., async (req, res) => {`
    // Let's just return the inner lines and wrap them.
    const firstLine = lines[startIdx];
    const signatureMatch = firstLine.match(/app\.(get|post)\(['"]([^'"]+)['"],\s*(async\s*)?\((req, res)\)\s*=>\s*\{/);
    if (!signatureMatch) {
       // Support 'req: Request, res: Response' or similar... Or just return the block
       return lines.slice(startIdx, endIdx + 1).join('\n');
    }
    
    return lines.slice(startIdx, endIdx + 1).join('\n');
}

// Convert app.post('/api/tick', async (req, res) => { ... })
// to export const processTick = async (req: Request, res: Response) => { ... }
function convertToControllerMethod(block: string, methodName: string): string {
    return block.replace(
        /app\.(get|post)\(['"][^'"]+['"],\s*(async\s*)?\((req, res|req: Request, res: Response)\)\s*=>\s*\{/,
        `export const ${methodName} = $2(req: Request, res: Response) => {`
    ).replace(/\n\}\);$/, '\n};');
}

const COMMON_IMPORTS = `import { Request, Response } from 'express';
import { dispatchEvent } from '../../orchestration/eventRouter';
import { subjectRepo, playerRepo, presetRepo, activeContextsRepo, eventLogRepo, sceneRepo, chatMemoryRepo, characterRepo, characterRelationRepo, sceneCharacterRepo } from '../../infrastructure/repositories';
import { sendToSillyTavern, sendNarratorDescription } from '../../adapters/sillyTavernAdapter';
import { activeConfig, updateConfig } from '../../prompts/config';
import { runGameTick } from '../../orchestration/runGameTick';
import { clamp } from '../../engine/utils';
import { generateCharacterContext } from '../../orchestration/characterGenerator/generator';
import { composePromptSections } from '../../orchestration/characterGenerator/promptComposer';
import { setGeneratedProfile } from '../../orchestration/characterGenerator/profileStore';
import { applyGeneratedContextToSillyTavern } from '../../adapters/sillyTavernManager';
import { maybeSummarizeChat } from '../../services/chatSummary';
import { recordMemoryEvent } from '../../services/memoryLayer';
import { ensureGeneratedProfile } from '../../orchestration/characterGenerator/profileManager';
import { buildPromptPayload } from '../../prompts/buildPromptPayload';
import { orchestrateSceneActors, executeTurnConversations } from '../../orchestration/sceneOrchestrator';
import { describeActionNarrative, describeContextNarrative } from '../../narrative/eventTemplates';
import { ContextManager } from '../../engine/contextManager';
import { db } from '../../infrastructure/db';

const pendingActionNarratives: Record<string, string[]> = {};

function buildAutoUserMessage(opts: { actionLabel: string; pointLabel?: string }): string {
    const pointPart = opts.pointLabel ? \` — точка \${opts.pointLabel}\` : '';
    return \`*(Без слов)* [Калибратор применяет воздействие: \${opts.actionLabel}\${pointPart}]\`;
}

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
    const waitBlock = convertToControllerMethod(extractBlock("app.post('/api/wait'"), 'processWait');
    const tickBlock = convertToControllerMethod(extractBlock("app.post('/api/tick'"), 'processTick');
    
    fs.writeFileSync('src/api/controllers/tickController.ts', `${COMMON_IMPORTS}\n\n${waitBlock}\n\n${tickBlock}\n`);
    
    // Create tickRoutes
    fs.writeFileSync('src/api/routes/tickRoutes.ts', `import { Router } from 'express';
import { processTick, processWait } from '../controllers/tickController';

const router = Router();

router.post('/tick', processTick as any);
router.post('/wait', processWait as any);

export default router;
`);

    console.log("Tick controller & routes generated.");
} catch(e) {
    console.error(e);
}
