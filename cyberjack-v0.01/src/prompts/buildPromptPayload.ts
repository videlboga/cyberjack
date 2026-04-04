import { SubjectCoreState, PromptPayload, TickOutput, NarratorPromptPayload } from '../domain/types';
import { buildStateSummary } from './buildStateSummary';
import { buildRecentEventsSummary, EventRecord } from './buildRecentEventsSummary';
import { db } from '../infrastructure/db';
import { activeConfig } from './config';
import { fetchSillyTavernContext } from './sillyTavernContext';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';
import { selectLongTermMemory, getRecentSummaries } from '../services/memoryLayer';
import { characterRelationRepo } from '../infrastructure/repositories';
import { buildMemoryInsights } from './buildMemoryInsights';

/**
 * Builds the payload for LLM/SillyTavern, grabbing history right from the DB.
 */
export async function buildPromptPayload(
    subjectId: string,
    latestResult?: TickOutput,
    eventId: string = 'lab', // TODO: Pass actual scene instead of hardcoding
    options?: { suppressTickIds?: string[] }
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

    const recentLogLimit = activeConfig.perception?.recentEventLimit ?? 10;
    let logs = db.prepare(
        'SELECT * FROM event_logs WHERE subject_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(subjectId, recentLogLimit) as any[];

    if (options?.suppressTickIds?.length) {
        const suppressSet = new Set(options.suppressTickIds);
        logs = logs.filter(log => {
            try {
                const payload = JSON.parse(log.action_payload || '{}');
                if (payload?.tickId && suppressSet.has(payload.tickId)) {
                    return false;
                }
            } catch {
                // ignore parsing errors
            }
            return true;
        });
    }
    
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
    const relations = characterRelationRepo.listFor(subjectId);

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
            interpretation =
                payload?.narrative || payload?.actionLabel || payload?.presetId || interpretation;
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

    const recentSummaries = getRecentSummaries(subjectId, 5);
    const intents = new Set<string>();
    const responses = new Set<string>();
    const extraStatements = new Set<string>();
    const highlightSet = new Set<string>();

    const summaryPieces: string[] = [];
    const seenSummaries = new Set<string>();
    for (const entry of recentSummaries) {
        const parts = entry.summary
            .split('\n')
            .map(p => p.trim())
            .filter(Boolean);
        parts.forEach(part => {
            if (!part) return;
            const normalized = part.toLowerCase();
            if (seenSummaries.has(normalized)) return;
            seenSummaries.add(normalized);
            summaryPieces.push(`• ${part}`);
        });
        (entry.important || []).forEach(label => {
            if (label) highlightSet.add(label);
        });
    }

    const chatSummaryBlock =
        summaryPieces.length > 0
            ? `\n[Конспект беседы]\n${summaryPieces.join('\n')}${
                  highlightSet.size ? `\n(важно: ${Array.from(highlightSet).join(', ')})` : ''
              }`
            : '';

    const voiceInstructions = `\n- Говори от первого лица и реагируй так, будто воздействие происходит прямо сейчас.\n- Не пересказывай прошлые ответы, каждый раз формируй живую реплику.\n- Замечай тело: связки, позы, дискомфорт или облегчение. Если что-то неприятно, дай понять через интонацию.`;

    const describeAttitude = (value: number) => {
        if (value >= 70) return 'я почти доверяю и могу немного расслабиться';
        if (value >= 50) return 'я держусь ровно и просто наблюдаю';
        if (value >= 30) return 'я напрягаюсь и заранее ищу пути отступления';
        return 'мне хочется держаться как можно дальше';
    };

    const relationsSection = relations.length
        ? `[Персонажи сцены]\n${relations
              .map(rel => {
                  const name = rel.target?.name || rel.toId;
                  const knowledge = rel.knows ? 'мы знакомы' : 'я почти не представляю, чего от него ждать';
                  const presence = rel.present
                      ? 'этот человек рядом'
                      : 'его сейчас нет поблизости';
                  const access = rel.canInteract
                      ? 'у меня есть прямой доступ'
                      : 'нас разделяют барьеры';
                  const tone = describeAttitude(rel.attitude);
                  return `${name}: ${knowledge}, ${presence}, ${access}. По ощущениям ${tone}.`;
              })
              .join('\n')}`
        : '';

    const aggregatedMemory = buildMemoryInsights(logs);
    const vectorMemories = aggregatedMemory.length
        ? []
        : selectLongTermMemory(subjectId, structuredEvents, core, mappedPoints).slice(0, 2);
    const combinedMemories = [...aggregatedMemory, ...vectorMemories];
    const longTermSection = combinedMemories.length
        ? `\n[Долгосрочная память]\n${combinedMemories.map(entry => `- ${entry}`).join('\n')}`
        : '';
    const personaSection = `[Персона]\n${personaBlock}`;
    const instructionsSection = `[Инструкции]\n${cfg.formatInstructions}${voiceInstructions}`;
    const memorySection = memoryBlock ? memoryBlock.trim() : '';
    const stateSection = `[Текущее состояние]\n${interpretationBlock.trim()}`;

    const narratorPrompt: NarratorPromptPayload = {
        subjectId,
        recentEventsText: eventsText.trim(),
        stateText: interpretationBlock.trim(),
        instructions: cfg.narratorFormatInstructions
    };

    const systemPrompt = [
        personaSection,
        loreBlock,
        instructionsSection,
        relationsSection,
        memorySection,
        chatSummaryBlock.trim(),
        longTermSection.trim(),
        stateSection,
        eventsText.trim()
    ]
        .filter(Boolean)
        .join('\n\n');

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
        relations,
        longTermMemory: combinedMemories.length ? combinedMemories : undefined,
        narratorPrompt
    };

    return {
        ...payload,
        systemPrompt
    };
}
