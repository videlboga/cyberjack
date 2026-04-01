import express from 'express';
import cors from 'cors';
import { dispatchEvent } from '../orchestration/eventRouter';
import { subjectRepo } from '../infrastructure/repositories';
import { sendToSillyTavern } from '../adapters/sillyTavernAdapter';
import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { buildPromptPayload } from '../prompts/buildPromptPayload';
import { activeConfig, updateConfig } from '../prompts/config';
import { runGameTick } from '../orchestration/runGameTick';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/wait', async (req, res) => {
    try {
        const { subjectId = 'S-01', ticks = 1, eventId = 'lab', callLLM = false } = req.body;
        let lastOutput;
        
        // Run N silent ticks
        for (let i = 0; i < ticks; i++) {
            lastOutput = runGameTick({
                subjectId,
                pointId: 'general',
                playerId: 'PL-1',
                sceneId: eventId,
                presetId: 'wait'
            });
        }

        let stReply, promptMessages;
        if (callLLM) {
            const promptPayload = await buildPromptPayload(subjectId, lastOutput, eventId);
            const stRes = await sendToSillyTavern(promptPayload, `[Прошло времени: ${ticks} тиков. Ничего нового не произошло.]`);
            stReply = stRes.reply;
            promptMessages = stRes.sentMessages;
        }

        const fullState = subjectRepo.getWithPoint(subjectId, 'general');
        res.json({
            success: true,
            state: fullState,
            reply: stReply || null,
            promptMessages: promptMessages || null,
            tickResult: lastOutput?.result
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

import { resolveAvailableFunctions, canExecuteCommand } from '../domain/resolver';
// ...existing code...
app.post('/api/tick', async (req, res) => {
    try {
        const { subjectId = 'S-01', textMessage } = req.body;
        
        // 1. Dispatch through Orchestrator (handles Parsing + Engine Tick)
        const { engineOutput, dynamicModifiers, pointIdUsed } = await dispatchEvent(req.body);
        
        // 1.5 Handle special actions returned by parser (like context changes)
        if (dynamicModifiers && dynamicModifiers.commandIntent && dynamicModifiers.commandIntent.type !== 'none') {
            const commandIntent = dynamicModifiers.commandIntent;
            const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);
            
            const eventId = req.body.sceneId || 'lab';
            let targetCtxId: string | undefined;

            if (commandIntent.type === 'change_pose') {
                targetCtxId = commandIntent.targetPoseId;
            } else if (commandIntent.type === 'activate_context') {
                targetCtxId = commandIntent.targetContextId;
            }

            if (targetCtxId) {
                const targetContext = presetRepo.getContextPreset(targetCtxId);
                if (targetContext) {
                    // Check logic based on anatomical constraints
                    const allPoints = presetRepo.getAllPointPresets();
                    const activeIds = activeContextsRepo.getAllForEvent(eventId);
                    const allActiveContexts = activeIds.map(aId => presetRepo.getContextPreset(aId)).filter(Boolean);
                    
                    const resolvedFunctions = resolveAvailableFunctions({
                        anatomyPoints: allPoints,
                        activeContexts: allActiveContexts
                    });
                    
                    const contextPresetsAll = presetRepo.getAllContextPresetsFull();
                    
                    const executionCheck = canExecuteCommand({
                        commandIntent,
                        contextPresets: contextPresetsAll,
                        resolvedFunctions
                    });
                    
                    const opennessTarget = 30; // Threshold hardcoded for testing, usually 50
                    const currentOpenness = fullState?.openness ?? fullState?.core?.openness ?? 0;
                    
                    if (executionCheck.allowed && currentOpenness >= opennessTarget) {
                        if (targetContext.slot) {
                            for (const aPreset of allActiveContexts) {
                                if (aPreset && aPreset.slot === targetContext.slot && aPreset.id !== targetContext.id) {
                                    activeContextsRepo.remove(eventId, aPreset.id);
                                    eventLogRepo.append(subjectId, 'context_change', 
                                        { presetId: 'context_change', action: null, actionLabel: `Снятие контекста: ${aPreset.label}` },
                                        { removed: true, point_id: aPreset.point_id }
                                    );
                                }
                            }
                        }
                        activeContextsRepo.add(eventId, targetCtxId, -1);
                        eventLogRepo.append(subjectId, 'context_change', {
                            presetId: 'context_change', action: null, actionLabel: `Ты послушно принимаешь позу/состояние: ${targetContext.label}`
                        }, { added: true });
                    } else {
                        let failReason = '';
                        if (!executionCheck.allowed) {
                            failReason = `Команда отклонена из-за ограничений тела:\n - ${executionCheck.blockedReasons.join('\n - ')}`;
                        } else {
                            failReason = `Тебе приказали: ${targetContext.label}, но ты отказываешься подчиниться, т.к уровень Открытости (${currentOpenness.toFixed(1)}) недостаточен.`;
                        }
                        eventLogRepo.append(subjectId, 'context_change', {
                            presetId: 'context_change', action: null, actionLabel: failReason, actionFailed: true
                        }, { failed: true, reasons: executionCheck.blockedReasons });
                    }
                }
            }
        }

        // 2. Load latest full UI state from DB
// ...existing code...
        const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);

        // 3. Post-Tick Diagnostics
        const action = engineOutput.tickMeta?.inputs?.action || {intensity:0, valence:0, contact:0, sharpness:0, novelty:0};
        const previousCore = engineOutput.tickMeta?.inputs?.core || fullState;
        const diagnostics = buildDiagnostics(action, previousCore, engineOutput);
        
        // 4. SillyTavern Communication (External Adapter)
        const promptPayload = await buildPromptPayload(subjectId, engineOutput as any);
        const {reply: stReply, sentMessages} = await sendToSillyTavern(promptPayload, textMessage);

        res.json({
            success: true,
            tickResult: engineOutput.result,
            state: fullState,
            diagnostics,
            reply: stReply,
            promptMessages: sentMessages,
            classifierLog: dynamicModifiers?.raw ?? null,
            classifierModel: dynamicModifiers?.model ?? null
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/state', (req, res) => {
    const subjectId = req.query.subjectId as string || 'S-01';
    const pointId = req.query.pointId as string || 'hands';
    
    try {
        const uiState = subjectRepo.getUIState(subjectId, pointId);
        res.json({ success: true, ...uiState });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

import { presetRepo, activeContextsRepo, eventLogRepo } from '../infrastructure/repositories';

app.get('/api/contexts', (req, res) => {
    try {
        const eventId = req.query.eventId as string || 'lab';
        const allPresets = presetRepo.getAllContextPresets();
        const activeIds = activeContextsRepo.getAllForEvent(eventId);

        res.json({ success: true, allPresets, activeIds });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/contexts/toggle', (req, res) => {
    try {
        const { eventId = 'lab', subjectId = 'S-01', contextId, isActive } = req.body;
        const targetContext = presetRepo.getContextPreset(contextId);
        
        if (!targetContext) throw new Error("Context preset not found.");

        if (isActive) {
            // Find EXCLUSIVE contexts in the same slot/point
            if (targetContext.slot && targetContext.exclusiveWithinSlot) {
                const activeIds = activeContextsRepo.getAllForEvent(eventId);
                for (const aId of activeIds) {
                    const aPreset = presetRepo.getContextPreset(aId);
                    if (aPreset && aPreset.slot === targetContext.slot && aPreset.id !== targetContext.id) {
                        activeContextsRepo.remove(eventId, aId);
                        eventLogRepo.append(subjectId, 'context_change', 
                            { presetId: 'context_change', action: null, actionLabel: `Снятие контекста: ${aPreset.label}` },
                            { removed: true, slot: aPreset.slot }
                        );
                    }
                }
            } else if (targetContext.point_id && !targetContext.slot) { // Fallback to old behavior
                const activeIds = activeContextsRepo.getAllForEvent(eventId);
                for (const aId of activeIds) {
                    const aPreset = presetRepo.getContextPreset(aId);
                    if (aPreset && aPreset.point_id === targetContext.point_id && aPreset.id !== targetContext.id) {
                        activeContextsRepo.remove(eventId, aId);
                        eventLogRepo.append(subjectId, 'context_change', 
                            { presetId: 'context_change', action: null, actionLabel: `Снятие контекста: ${aPreset.label}` },
                            { removed: true, point_id: aPreset.point_id }
                        );
                    }
                }
            }
            activeContextsRepo.add(eventId, contextId, -1);
            eventLogRepo.append(subjectId, 'context_change', 
                { presetId: 'context_change', action: null, actionLabel: `Применение контекста: ${targetContext.label}` },
                { added: true, point_id: targetContext.point_id, slot: targetContext.slot }
            );
        } else {
            activeContextsRepo.remove(eventId, contextId);
            eventLogRepo.append(subjectId, 'context_change', 
                { presetId: 'context_change', action: null, actionLabel: `Снятие контекста: ${targetContext.label}` },
                { removed: true, point_id: targetContext.point_id }
            );
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json({ success: true, config: activeConfig });
});

app.post('/api/config', (req, res) => {
    try {
        updateConfig(req.body.config);
        res.json({ success: true, config: activeConfig });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});