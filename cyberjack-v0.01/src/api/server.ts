import express from 'express';
import cors from 'cors';
import { dispatchEvent } from '../orchestration/eventRouter';
import { subjectRepo, playerRepo, presetRepo, activeContextsRepo, eventLogRepo, sceneRepo, chatMemoryRepo, memoryRepo } from '../infrastructure/repositories';
import { sendToSillyTavern } from '../adapters/sillyTavernAdapter';
import { activeConfig, updateConfig } from '../prompts/config';
import { runGameTick } from '../orchestration/runGameTick';
import { clamp } from '../engine/utils';
import { generateCharacterContext } from '../orchestration/characterGenerator/generator';
import { composePromptSections } from '../orchestration/characterGenerator/promptComposer';
import { setGeneratedProfile } from '../orchestration/characterGenerator/profileStore';
import { applyGeneratedContextToSillyTavern } from '../adapters/sillyTavernManager';
import { maybeSummarizeChat } from '../services/chatSummary';
import { buildEmbedding } from '../services/embeddingService';

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
    return {
        id: src.id,
        resources: {
            ...DEFAULT_PLAYER.resources,
            ...(src.resources || {})
        }
    };
}

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
            const waitMessage = `[Прошло времени: ${ticks} тиков. Ничего нового не произошло.]`;
            const chatHistory = chatMemoryRepo.getRecent(subjectId, 10).map(entry => ({
                role: entry.role,
                content: entry.content
            }));
            const stRes = await sendToSillyTavern(lastBundle.prompt, waitMessage, chatHistory);
            stReply = stRes.reply;
            promptMessages = stRes.sentMessages;
            chatMemoryRepo.append(subjectId, 'user', waitMessage);
            if (stReply && typeof stReply === 'object' && (stReply as any).speech) {
                chatMemoryRepo.append(subjectId, 'assistant', (stReply as any).speech);
            }
            recordMemoryEntry({
                subjectId,
                bundle: lastBundle,
                userText: waitMessage,
                assistantText: typeof stReply === 'object' ? stReply.speech : ''
            });
            maybeSummarizeChat(subjectId);
        }

        const fullState = subjectRepo.getWithPoint(subjectId, 'general');
        const player = normalizePlayer(playerRepo.get('PL-1'));
        res.json({
            success: true,
            state: fullState,
            reply: stReply || null,
            promptMessages: promptMessages || null,
            tickResult: lastBundle?.output.result,
            bundle: lastBundle,
            player
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
        const { subjectId = 'S-01', textMessage, playerId = 'PL-1' } = req.body;
        
        // 1. Dispatch through Orchestrator (handles Parsing + Engine Tick)
        const { bundle, dynamicModifiers, pointIdUsed } = await dispatchEvent(req.body);
        
        const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);
        const player = normalizePlayer(playerRepo.get(playerId));

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
        const chatHistory = chatMemoryRepo.getRecent(subjectId, 10).map(entry => ({
            role: entry.role,
            content: entry.content
        }));
        const {reply: stReply, sentMessages} = await sendToSillyTavern(bundle.prompt, textMessage, chatHistory);

        if (textMessage && String(textMessage).trim().length > 0) {
            chatMemoryRepo.append(subjectId, 'user', textMessage);
        }
        if (stReply && typeof stReply === 'object' && (stReply as any).speech) {
            chatMemoryRepo.append(subjectId, 'assistant', (stReply as any).speech);
        }
        recordMemoryEntry({
            subjectId,
            bundle,
            userText: textMessage,
            assistantText: typeof stReply === 'object' ? stReply.speech : '',
            infoTag: req.body?.presetId
        });
        maybeSummarizeChat(subjectId);

        res.json({
            success: true,
            tickResult: bundle.output.result,
            state: fullState,
            player,
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
    const sceneId = req.query.sceneId as string || 'lab';
    
    try {
        const uiState = subjectRepo.getUIState(subjectId, pointId);
        const scene = sceneRepo.get(sceneId);
        const player = normalizePlayer(playerRepo.get('PL-1'));

        let availableActions = uiState.availableActions || [];
        if (scene) {
            availableActions = (scene.availableActions || []).map(actionId => {
                const preset = presetRepo.getActionPreset(actionId);
                const costs = scene.actionCosts?.[actionId];
                return {
                    id: actionId,
                    label: preset?.label || actionId,
                    costs: costs && Object.keys(costs).length ? costs : null
                };
            });
        }

        res.json({ 
            success: true, 
            subject: uiState.subject,
            availablePoints: uiState.availablePoints,
            availableActions,
            scene: scene ? { id: scene.id, transitions: scene.transitions || [] } : null,
            player 
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/player/update', (req, res) => {
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
});

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

function recordMemoryEntry(opts: {
    subjectId: string;
    bundle: Awaited<ReturnType<typeof runGameTick>>;
    userText?: string;
    assistantText?: string;
    infoTag?: string;
}) {
    const parts: string[] = [];
    const actionLabel = opts.bundle.compiledAction.label;
    if (opts.userText && opts.userText.trim().length > 0) {
        parts.push(`Команда/реплика: ${summarizeCommand(opts.userText)}`);
    } else {
        parts.push(`Тактическое воздействие: ${actionLabel}`);
    }
    parts.push(`Тело ощущает: ${opts.bundle.diagnostics.reactionSummary || 'короткий отклик'}`);
    if (opts.assistantText && opts.assistantText.trim().length > 0) {
        parts.push(`Вербальная реакция: ${summarizeSpeech(opts.assistantText)}`);
    }

    const text = parts.join('. ');
    if (!text.trim()) return;

    memoryRepo.save({
        subjectId: opts.subjectId,
        text,
        embedding: buildEmbedding(text),
        tags: collectMemoryTags(opts.bundle),
        metadata: {
            actionId: opts.bundle.event.payload?.presetId,
            sceneId: opts.bundle.event.sceneId,
            userText: opts.userText || '',
            assistantText: opts.assistantText || '',
            infoTag: opts.infoTag || null,
            timestamp: opts.bundle.event.timestamp
        }
    });
}

function collectMemoryTags(bundle: Awaited<ReturnType<typeof runGameTick>>): string[] {
    const tags: string[] = [];
    const result = bundle.output.result;
    if (result.overload > 0.5) tags.push('overload');
    if (result.pleasure > 0.4) tags.push('pleasure');
    if (result.discomfort > 0.4) tags.push('pain');
    if (bundle.compiledAction.type === 'context') tags.push('context');
    if (Array.isArray((bundle.compiledAction as any).tags)) {
        tags.push(...((bundle.compiledAction as any).tags as string[]));
    }
    return tags;
}

function summarizeCommand(text: string): string {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('контекст')) return 'изменяет позу/ограничения';
    if (normalized.includes('удоб') || normalized.includes('комфорт')) return 'проверяет комфорт';
    if (normalized.includes('как себя') || normalized.includes('самочувств')) return 'интересуется самочувствием';
    if (normalized.includes('добрый') || normalized.includes('привет')) return 'поддерживает формальное приветствие';
    if (normalized.includes('будем') && normalized.includes('менять')) return 'предупреждает о грядущем воздействии';
    if (normalized.endsWith('?')) return 'задаёт уточняющий вопрос';
    return 'произносит короткую инструкцию';
}

function summarizeSpeech(text: string): string {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('понятно') || normalized.includes('продолжаем')) return 'послушно подтверждает изменения';
    if (normalized.includes('как обычно') || normalized.includes('в норме') || normalized.includes('стабиль')) return 'сухо сообщает о стабильности';
    if (normalized.includes('удоб') || normalized.includes('комфорт')) return 'оценивает комфорт без эмоций';
    if (normalized.includes('не') || normalized.includes('хватит')) return 'пытается возразить или обозначить границы';
    if (normalized.includes('не чувствую') || normalized.includes('привыкла')) return 'говорит устало, подчёркивая привычку к давлению';
    return 'отвечает коротко и сдержанно';
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});
