
import { readFileSync, writeFileSync } from 'fs';

let content = `import { SubjectCoreState, PromptPayload, TickOutput, NarratorPromptPayload } from '../domain/types';
import { buildStateSummary } from './buildStateSummary';
import { buildRecentEventsSummary, EventRecord } from './buildRecentEventsSummary';
import { activeConfig } from './config';
import { fetchSillyTavernContext } from './sillyTavernContext';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';
import { selectLongTermMemory, getRecentSummaries } from '../services/memoryLayer';
import { characterRelationRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { buildMemoryInsights } from './buildMemoryInsights';

export async function buildPromptPayload(
    ownerId: string, // Whose generation this is
    targetId: string, // Who received the primary action
    actorDetails: { name: string, core: SubjectCoreState },
    recentEventsIn: EventRecord[],
    pointStatesRow: any[],
    activeContextNames: string[],
    latestResult?: TickOutput,
    eventId: string = 'lab',
    options?: { suppressTickIds?: string[]; initiatorId?: string }
): Promise<PromptPayload & { systemPrompt: string }> {

    const core: SubjectCoreState = actorDetails.core;
    
    let recentEvents = [...recentEventsIn];
    if (options?.suppressTickIds?.length) {
        const suppressSet = new Set(options.suppressTickIds);
        recentEvents = recentEvents.filter(log => {
            try {
                const payload = JSON.parse(log.action_payload || '{}');
                if (payload?.tickId && suppressSet.has(payload.tickId)) {
                    return false;
                }
            } catch {
            }
            return true;
        });
    }
    
    const contextText = activeContextNames.length > 0
        ? \`\\n[Физическое состояние и влияние среды]: \${activeContextNames.join(', ')}\`
        : '';

    const mappedPoints = pointStatesRow.map(row => ({
        label: row.label,
        localSensitivity: row.localSensitivity || row.local_sensitivity,
        localAttitude: row.localAttitude || row.local_attitude
    }));
    const relations = characterRelationRepo.listFor(ownerId);
    const stateSummary = buildStateSummary(core, mappedPoints);
    const eventsText = buildRecentEventsSummary(recentEvents);
    const contextSummary = activeContextNames.length > 0 ? activeContextNames.join(', ') : undefined;
    const interpretationBlock = \`\${stateSummary}\${contextText}\`;

    const averageLocalAttitude = mappedPoints.length
        ? mappedPoints.reduce((acc, point) => acc + point.localAttitude, 0) / mappedPoints.length
        : core.attitude;

    const fallbackResult = (() => {
        for (let i = recentEvents.length - 1; i >= 0; i--) {
            try {
                return JSON.parse(recentEvents[i].result_payload || '{}');
            } catch {
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
        }
        return {
            type: event.action_type,
            interpretation
        };
    });

    const diagnostics: string[] = [];
    stateSummary.split('\\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*')) {
            diagnostics.push(trimmed);
        }
    });

    const targetQueryId = targetId || ownerId;
    const isObserver = ownerId !== targetQueryId;
    const stateSection = isObserver
        ? \`[Статус: Наблюдатель]\\nЖертва воздействия: \${actorDetails.name}. Ты только наблюдаешь со стороны.\`
        : \`[Текущее состояние]\\n\${interpretationBlock.trim()}\`;
        
    const generatedProfile = ensureGeneratedProfile(ownerId);
    const stContext = await fetchSillyTavernContext(ownerId);
    const cfg = activeConfig.character;

    const fallbackHistory = isObserver
        ? "Ты находишься в стерильной камере рядом с калибровочным столом. Ты видишь, как Калибратор испытывает другого синтетика. Ты просто сторонний наблюдатель."
        : cfg.history;

    const fallbackPersona = \`Тебя зовут \${actorDetails.name} (Кодовое имя \${ownerId}).\\n\${fallbackHistory}\`;

    const personaBlock =
        generatedProfile?.personaText ||
        (stContext?.personaText || fallbackPersona);

    let loreBlock = '';
    if (generatedProfile?.loreNotes?.length) {
        loreBlock = \`[Записки из лора]\\n\${generatedProfile.loreNotes.join('\\n\\n')}\`;
    } else if (stContext?.loreText) {
        loreBlock = \`[Записки из лора]\\n\${stContext.loreText}\`;
    }

    const includeMemory = activeConfig.stContext?.includeMemory ?? false;
    const memoryBlock =
        includeMemory && stContext?.memoryText ? \`\\n[Память]\\n\${stContext.memoryText}\` : '';

    const recentSummaries = getRecentSummaries(ownerId, 5);
    const highlightSet = new Set<string>();
    const summaryPieces: string[] = [];
    const seenSummaries = new Set<string>();

    for (const entry of recentSummaries) {
        const parts = entry.summary
            .split('\\n')
            .map(p => p.trim())
            .filter(Boolean);
        parts.forEach(part => {
            if (!part) return;
            const normalized = part.toLowerCase();
            if (seenSummaries.has(normalized)) return;
            seenSummaries.add(normalized);
            summaryPieces.push(\`• \${part}\`);
        });
        (entry.important || []).forEach(label => {
            if (label) highlightSet.add(label);
        });
    }

    const chatSummaryBlock =
        summaryPieces.length > 0
            ? \`\\n[Конспект беседы]\\n\${summaryPieces.join('\\n')}\${
                  highlightSet.size ? \`\\n(важно: \${Array.from(highlightSet).join(', ')})\` : ''
              }\`
            : '';

    const voiceInstructions = isObserver
        ? \`\\n- Говори от первого лица.\\n- Ты — НАБЛЮДАТЕЛЬ (зритель). Это воздействие применяют НЕ к тебе.\\n- Комментируй происходящее со стороны, обращайся к калибратору или к жертве, оценивай их действия.\`
        : \`\\n- Говори от первого лица и реагируй так, будто воздействие происходит прямо сейчас.\\n- Не пересказывай прошлые ответы, каждый раз формируй живую реплику.\\n- Замечай тело: связки, позы, дискомфорт или облегчение. Если что-то неприятно, дай понять через интонацию.\`;

    const describeAttitude = (value: number) => {
        if (value >= 70) return 'я почти доверяю и могу немного расслабиться';
        if (value >= 50) return 'я держусь ровно и просто наблюдаю';
        if (value >= 30) return 'я напрягаюсь и заранее ищу пути отступления';
        return 'мне хочется держаться как можно дальше';
    };

    const sceneCharactersData = sceneCharacterRepo.list(eventId);
    const mySceneChar = sceneCharactersData.find(sc => sc.character.id === ownerId || sc.character.subjectId === ownerId);

    const relationsSection = relations.length
        ? \`[Персонажи сцены]\\n\${relations
              .map(rel => {
                  const targetIdToFind = rel.target?.id || rel.toId;
                  const theirSceneChar = sceneCharactersData.find(sc => sc.character.id === targetIdToFind || sc.character.subjectId === rel.toId);
                  
                  const isNearby = mySceneChar && theirSceneChar && mySceneChar.slotId === theirSceneChar.slotId;
                  const presenceToken = rel.present
                      ? (isNearby ? 'этот человек рядом, в одной зоне' : 'человек в этой же комнате, но в отдалении')
                      : 'его сейчас нет поблизости';

                  const name = rel.target?.name || rel.toId;
                  const knowledge = rel.knows ? 'мы знакомы' : 'я почти не представляю, чего от него ждать';
                  const access = rel.canInteract
                      ? 'у меня есть прямой доступ'
                      : 'нас разделяют барьеры';
                  const tone = describeAttitude(rel.attitude);

                  return \`\${name}: \${knowledge}, \${presenceToken}, \${access}. По ощущениям \${tone}.\`;
              })
              .join('\\n')}\`
        : '';

    const aggregatedMemory = buildMemoryInsights(recentEvents as any); // using recent logs
    const vectorMemories = aggregatedMemory.length
        ? []
        : selectLongTermMemory(ownerId, structuredEvents, core, mappedPoints).slice(0, 2);

    const combinedMemories = [...aggregatedMemory, ...vectorMemories];
    const longTermSection = combinedMemories.length
        ? \`\\n[Долгосрочная память]\\n\${combinedMemories.map(entry => \`- \${entry}\`).join('\\n')}\`
        : '';

    const personaSection = \`[Персона]\\n\${personaBlock}\`;
    const instructionsSection = \`[Инструкции]\\n\${cfg.formatInstructions}\${voiceInstructions}\`;
    const memorySection = memoryBlock ? memoryBlock.trim() : '';

    const narratorPrompt: NarratorPromptPayload = {
        subjectId: targetQueryId,
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
        .join('\\n\\n');

    const payload: PromptPayload = {
        subjectId: ownerId,
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
`;

writeFileSync('src/prompts/buildPromptPayload.ts', content);
