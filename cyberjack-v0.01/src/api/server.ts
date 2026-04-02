import express from 'express';
import cors from 'cors';
import { dispatchEvent } from '../orchestration/eventRouter';
import { subjectRepo } from '../infrastructure/repositories';
import { sendToSillyTavern } from '../adapters/sillyTavernAdapter';
import { activeConfig, updateConfig } from '../prompts/config';
import { runGameTick } from '../orchestration/runGameTick';
import { clamp } from '../engine/utils';
import { generateCharacterContext } from '../orchestration/characterGenerator/generator';
import { composePromptSections } from '../orchestration/characterGenerator/promptComposer';
import { setGeneratedProfile } from '../orchestration/characterGenerator/profileStore';
import { applyGeneratedContextToSillyTavern } from '../adapters/sillyTavernManager';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/wait', async (req, res) => {
    try {
        const { subjectId = 'S-01', ticks = 1, eventId = 'lab', callLLM = false } = req.body;
        let lastBundle: Awaited<ReturnType<typeof runGameTick>> | null = null;
        
        // Run N silent ticks
        for (let i = 0; i < ticks; i++) {
            lastBundle = await runGameTick({
                subjectId,
                pointId: 'general',
                playerId: 'PL-1',
                sceneId: eventId,
                presetId: 'wait'
            });
        }

        let stReply, promptMessages;
        if (callLLM && lastBundle) {
            const stRes = await sendToSillyTavern(lastBundle.prompt, `[Прошло времени: ${ticks} тиков. Ничего нового не произошло.]`);
            stReply = stRes.reply;
            promptMessages = stRes.sentMessages;
        }

        const fullState = subjectRepo.getWithPoint(subjectId, 'general');
        res.json({
            success: true,
            state: fullState,
            reply: stReply || null,
            promptMessages: promptMessages || null,
            tickResult: lastBundle?.output.result,
            bundle: lastBundle
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
        const { bundle, dynamicModifiers, pointIdUsed } = await dispatchEvent(req.body);
        
        const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);

        // 1.5 Handle special actions returned by parser (like context changes)
        if (dynamicModifiers && dynamicModifiers.commandIntent && dynamicModifiers.commandIntent.type !== 'none') {
            const commandIntent = dynamicModifiers.commandIntent;
            
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
                    const allActiveContexts = activeIds.map(a => presetRepo.getContextPreset(a.id)).filter(Boolean);
                    
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
        // 4. SillyTavern Communication (External Adapter)
        const {reply: stReply, sentMessages} = await sendToSillyTavern(bundle.prompt, textMessage);

        res.json({
            success: true,
            tickResult: bundle.output.result,
            state: fullState,
            diagnostics: bundle.diagnostics,
            bundle,
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
                for (const aObj of activeIds) {
                    const aId = aObj.id;
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
                for (const aObj of activeIds) {
                    const aId = aObj.id;
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

app.post('/api/characters/prompt', async (req, res) => {
    try {
        const subjectId = req.body.subjectId || 'S-01';
        const includeTags = Array.isArray(req.body.includeTags) ? req.body.includeTags : undefined;
        const excludeTags = Array.isArray(req.body.excludeTags) ? req.body.excludeTags : undefined;
        const seed = typeof req.body.seed === 'string' && req.body.seed.trim() ? req.body.seed.trim() : undefined;
        const applyToSillyTavern = Boolean(req.body.applyToSillyTavern);

        const context = generateCharacterContext({
            seed,
            includeTags,
            excludeTags
        });

        const narrative = context.narrative || {
            identityParagraphs: [],
            historyParagraphs: [],
            activationParagraphs: []
        };

        const hasGeneratedNarrative =
            (narrative.identityParagraphs?.length || 0) > 0 ||
            (narrative.historyParagraphs?.length || 0) > 0 ||
            (narrative.activationParagraphs?.length || 0) > 0;

        const identityBlocks = narrative.identityParagraphs.length
            ? narrative.identityParagraphs
            : hasGeneratedNarrative
            ? []
            : [activeConfig.character.identity];
        const historyBlocks = narrative.historyParagraphs.length
            ? narrative.historyParagraphs
            : hasGeneratedNarrative
            ? []
            : [activeConfig.character.history];
        const activationBlocks = narrative.activationParagraphs || [];

        const sections = composePromptSections(context, {
            identity: activeConfig.character.identity,
            history: activeConfig.character.history,
            instructions: activeConfig.character.formatInstructions,
            identityBlocks,
            historyBlocks,
            activationBlocks
        });

        let stUpdate: { worldInfoName: string } | null = null;
        if (applyToSillyTavern) {
            const personaForSt =
                sections.personaWithoutTraits ||
                [activeConfig.character.identity, activeConfig.character.history].join('\n\n');
            const scenarioForSt =
                [sections.historyText, sections.activationText].filter(Boolean).join('\n\n') ||
                activeConfig.character.history;

            stUpdate = await applyGeneratedContextToSillyTavern({
                subjectId,
                context,
                personaText: personaForSt,
                traitBlock: sections.traitBlock,
                scenarioText: scenarioForSt,
                instructions: activeConfig.character.formatInstructions
            });
        }

        const responsePayload = {
            success: true,
            subjectId,
            seed: context.seed,
            tags: context.tags,
            grouped: context.grouped,
            personaNotes: context.personaNotes,
            personaText: sections.personaText,
            loreNotes: context.loreNotes,
            loreRefs: context.loreRefs,
            systemPrompt: `${activeConfig.adapters.sillyTavernSystemPrefix}\n${sections.systemPrompt}`,
            stUpdate,
            narrative
        };

        setGeneratedProfile(subjectId, {
            personaText: sections.personaText,
            personaWithoutTraits: sections.personaWithoutTraits,
            traitBlock: sections.traitBlock,
            loreNotes: context.loreNotes,
            loreRefs: context.loreRefs,
            systemPrompt: sections.systemPrompt,
            identityText: sections.identityText,
            historyText: sections.historyText,
            activationText: sections.activationText,
            seed: context.seed
        });

        res.json(responsePayload);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/subject/update', (req, res) => {
    try {
        const subjectId = req.body.subjectId || 'S-01';
        const current = subjectRepo.get(subjectId);

        if (!current) {
            return res.status(404).json({ success: false, error: 'Subject not found' });
        }

        const asNumber = (value: any, fallback: number) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const updated = {
            sensitivity: clamp(asNumber(req.body.sensitivity, current.sensitivity), 0, 100),
            attitude: clamp(asNumber(req.body.attitude, current.attitude), 0, 100),
            capacity: clamp(asNumber(req.body.capacity, current.capacity), 0, 100),
            openness: clamp(asNumber(req.body.openness, current.openness), 0, 100),
            plasticity: clamp(asNumber(req.body.plasticity, current.plasticity), 0, 100)
        };

        subjectRepo.save(subjectId, current.name || subjectId, updated as any);
        const fullState = subjectRepo.getWithPoint(subjectId, req.body.pointId || 'general');
        res.json({ success: true, state: fullState });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});
