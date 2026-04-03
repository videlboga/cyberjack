import { SubjectCoreState, PromptPayload, TickOutput } from '../domain/types';
import { buildStateSummary } from './buildStateSummary';
import { buildRecentEventsSummary, EventRecord } from './buildRecentEventsSummary';
import { db } from '../infrastructure/db';
import { activeConfig } from './config';
import { fetchSillyTavernContext } from './sillyTavernContext';
import { getGeneratedProfile, setGeneratedProfile, StoredProfile } from '../orchestration/characterGenerator/profileStore';
import { generateCharacterContext } from '../orchestration/characterGenerator/generator';
import { composePromptSections } from '../orchestration/characterGenerator/promptComposer';
import { memoryRepo, chatSummaryRepo } from '../infrastructure/repositories';
import { buildEmbedding } from '../services/embeddingService';
import { memoryRepo } from '../infrastructure/repositories';
import { buildEmbedding } from '../services/embeddingService';

function ensureGeneratedProfile(subjectId: string): StoredProfile {
    const existing = getGeneratedProfile(subjectId);
    if (existing) {
        return existing;
    }

    const context = generateCharacterContext({ seed: subjectId });
    const narrative = context.narrative || {
        identityParagraphs: [],
        historyParagraphs: [],
        activationParagraphs: []
    };

    const identityBlocks = [...(narrative.identityParagraphs || [])];
    const historyBlocks = [...(narrative.historyParagraphs || [])];
    const activationBlocks = [...(narrative.activationParagraphs || [])];

    if (!identityBlocks.length && !historyBlocks.length && !activationBlocks.length) {
        identityBlocks.push(activeConfig.character.identity);
        historyBlocks.push(activeConfig.character.history);
    }

    const sections = composePromptSections(context, {
        identity: activeConfig.character.identity,
        history: activeConfig.character.history,
        instructions: activeConfig.character.formatInstructions,
        identityBlocks,
        historyBlocks,
        activationBlocks
    });

    const draftProfile = {
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
    };

    setGeneratedProfile(subjectId, draftProfile);
    const stored = getGeneratedProfile(subjectId);
    if (stored) {
        return stored;
    }
    return { subjectId, ...draftProfile, updatedAt: new Date().toISOString() };
}

/**
 * Builds the payload for LLM/SillyTavern, grabbing history right from the DB.
 */
export async function buildPromptPayload(
    subjectId: string,
    latestResult?: TickOutput,
    eventId: string = 'lab' // TODO: Pass actual scene instead of hardcoding
): Promise<PromptPayload & { systemPrompt: string }> {
    const subjectRow = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId) as any;
    if (!subjectRow) throw new Error(`Subject ${subjectId} not found for prompt building`);

    const core: SubjectCoreState = {
        sensitivity: subjectRow.sensitivity,
        capacity: subjectRow.capacity,
        openness: subjectRow.openness,
        plasticity: subjectRow.plasticity,
        attitude: subjectRow.attitude
    };

    const logs = db.prepare('SELECT * FROM event_logs WHERE subject_id = ? ORDER BY timestamp DESC LIMIT 3').all(subjectId) as any[];
    
    // Map to EventRecord
    const recentEvents: EventRecord[] = logs.map(log => {
        return {
            id: Number(log.id),
            timestamp: log.timestamp,
            action_type: log.action_type,
            action_payload: log.action_payload, // needs to remain string for buildRecentEventsSummary
            result_payload: log.result_payload  // needs to remain string
        } as EventRecord;
    }).reverse(); // Chronological order

    // Fetch active contexts
    const activeContextRow = db.prepare(`
        SELECT cp.label 
        FROM active_contexts ac
        JOIN context_presets cp ON ac.context_id = cp.id
        WHERE ac.event_id = ?
    `).all(eventId) as {label: string}[];

    // Fetch point states for body overload calculations
    const pointStatesRow = db.prepare(`
        SELECT p.label, sps.local_sensitivity, sps.local_attitude
        FROM subject_point_states sps
        JOIN point_presets p ON sps.point_id = p.id
        WHERE sps.subject_id = ?
    `).all(subjectId) as any[];
    
    const activeContextNames = activeContextRow.map(r => r.label);
    const contextText = activeContextNames.length > 0 
        ? `\n[Физическое состояние и влияние среды]: ${activeContextNames.join(', ')}`
        : '';

    const mappedPoints = pointStatesRow.map(row => ({
        label: row.label,
        localSensitivity: row.local_sensitivity,
        localAttitude: row.local_attitude
    }));

    const stateSummary = buildStateSummary(core, mappedPoints);
    const eventsText = buildRecentEventsSummary(recentEvents);
    const contextSummary = activeContextNames.length > 0 ? activeContextNames.join(', ') : undefined;
    const interpretationBlock = `${stateSummary}${contextText}`;

    const averageLocalAttitude = mappedPoints.length
        ? mappedPoints.reduce((acc, point) => acc + point.localAttitude, 0) / mappedPoints.length
        : core.attitude;

    const fallbackResult = (() => {
        for (let i = recentEvents.length - 1; i >= 0; i--) {
            try {
                return JSON.parse(recentEvents[i].result_payload || '{}');
            } catch {
                // ignore malformed log entries
            }
        }
        return undefined;
    })();

    const lastResult = latestResult?.result || fallbackResult || {};
    const engagement = Number(lastResult.engagement) || 0;
    const overload = Number(lastResult.overload) || 0;

    const structuredEvents = recentEvents.map(event => {
        let interpretation = event.action_type;
        try {
            const payload = JSON.parse(event.action_payload || '{}');
            interpretation = payload.actionLabel || payload.presetId || interpretation;
        } catch {
            // fall back to event type
        }
        return {
            type: event.action_type,
            interpretation
        };
    });

    const diagnostics: string[] = [];
    stateSummary.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*')) {
            diagnostics.push(trimmed);
        }
    });

    const generatedProfile = ensureGeneratedProfile(subjectId);
    const stContext = await fetchSillyTavernContext(subjectId);
    const cfg = activeConfig.character;
    const personaBlock =
        generatedProfile?.personaText ||
        (stContext?.personaText || `${cfg.identity}\n${cfg.history}`);

    let loreBlock = '';
    if (generatedProfile?.loreNotes?.length) {
        loreBlock = `[Записки из лора]\n${generatedProfile.loreNotes.join('\n\n')}`;
    } else if (stContext?.loreText) {
        loreBlock = `[Записки из лора]\n${stContext.loreText}`;
    }

    const includeMemory = activeConfig.stContext?.includeMemory ?? false;
    const memoryBlock =
        includeMemory && stContext?.memoryText ? `\n[Память]\n${stContext.memoryText}` : '';

    const recentSummaries = chatSummaryRepo.getRecent(subjectId, 3);
    const chatSummaryBlock = recentSummaries.length
        ? `\n[Конспект беседы]\n${recentSummaries
              .map(entry => {
                  const highlights = entry.important?.length ? ` (важно: ${entry.important.join(', ')})` : '';
                  return `• ${entry.summary}${highlights}`;
              })
              .join('\n')}`
        : '';

    const voiceInstructions = `\n- Говори от первого лица и реагируй так, будто воздействие происходит прямо сейчас.\n- Не пересказывай прошлые ответы, каждый раз формируй живую реплику.\n- Замечай тело: связки, позы, дискомфорт или облегчение. Если что-то неприятно, дай понять через интонацию.`;

    const characterProfile = `${personaBlock}${loreBlock ? `\n\n${loreBlock}` : ''}\n\n[Инструкции]: ${cfg.formatInstructions}${voiceInstructions}`;
    const longTermBlocks = selectLongTermMemory(subjectId, structuredEvents, core, mappedPoints);
    const longTermSection = longTermBlocks.length
        ? `\n[Долгосрочная память]\n${longTermBlocks.join('\n')}`
        : '';

    const systemPrompt = `${characterProfile}${memoryBlock}${chatSummaryBlock}${longTermSection}\n\n${interpretationBlock}\n\n${eventsText}`;

    const payload: PromptPayload = {
        subjectId,
        sceneId: eventId,
        currentStateSummary: {
            interpretation: interpretationBlock.trim(),
            attitude: core.attitude,
            localAttitude: averageLocalAttitude,
            engagement,
            overload
        },
        recentEvents: structuredEvents,
        diagnostics: diagnostics.length ? diagnostics : undefined,
        sceneContext: contextSummary,
        longTermMemory: longTermBlocks.length ? longTermBlocks : undefined
    };

    return {
        ...payload,
        systemPrompt
    };
}
function selectLongTermMemory(
    subjectId: string,
    events: Array<{ type: string; interpretation: string }>,
    core: SubjectCoreState,
    points: Array<{ label: string; localSensitivity: number; localAttitude: number }>
): string[] {
    const baseText = [
        activeConfig.character.identity,
        activeConfig.character.history,
        events.map(e => `${e.type}: ${e.interpretation}`).join('; '),
        `Attitude: ${core.attitude.toFixed(1)}, Openness: ${core.openness.toFixed(1)}`
    ].join('\n');
    const queryEmbedding = buildEmbedding(baseText);
    const tags: string[] = [];
    if (core.capacity < 30 || core.openness < 40) tags.push('overload');
    if (points.some(p => p.localAttitude < 30)) tags.push('pain');
    const records = memoryRepo.findRelevant(subjectId, queryEmbedding, 5, tags.length ? tags : undefined);
    return records.map(record => `- ${record.text}`);
}
