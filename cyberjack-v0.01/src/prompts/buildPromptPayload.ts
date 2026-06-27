import { SubjectCoreState, PromptPayload, TickOutput, NarratorPromptPayload } from '../domain/types';
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
    eventId: string = 'scene_lab_calibrator',
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
        ? `\n[Физическое состояние и влияние среды]: ${activeContextNames.join(', ')}`
        : '';

    const mappedPoints = pointStatesRow.map(row => ({
        label: row.label,
        localSensitivity: row.localSensitivity || row.local_sensitivity,
        localAttitude: row.localAttitude || row.local_attitude
    }));
    const relations = characterRelationRepo.listFor(ownerId);
    const stateSummary = buildStateSummary(core, mappedPoints);
    const eventsText = buildRecentEventsSummary(recentEvents, actorDetails.name);
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
    stateSummary.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*')) {
            diagnostics.push(trimmed);
        }
    });

    const targetQueryId = targetId || ownerId;
    const isObserver = ownerId !== targetQueryId;
    const stateSection = isObserver
        ? `[Текущее состояние]\nТы не являешься главной целью текущего действия. Твое состояние:\n${interpretationBlock.trim()}`
        : `[Текущее состояние]\n${interpretationBlock.trim()}`;
        
    const generatedProfile = ensureGeneratedProfile(ownerId);
    const stContext = await fetchSillyTavernContext(ownerId);
    const cfg = activeConfig.character;

    const fallbackPersona = `Тебя зовут ${actorDetails.name} (Кодовое имя ${ownerId}).\n${cfg.history || ''}`;

    const personaBlock =
        generatedProfile?.personaText ||
        (stContext?.personaText || fallbackPersona);

    let loreBlock = '';
    if (generatedProfile?.loreNotes?.length) {
        loreBlock = `[Записки из лора]\n${generatedProfile.loreNotes.join('\n\n')}`;
    } else if (stContext?.loreText) {
        loreBlock = `[Записки из лора]\n${stContext.loreText}`;
    }

    const includeMemory = activeConfig.stContext?.includeMemory ?? false;
    const memoryBlock =
        includeMemory && stContext?.memoryText ? `\n[Память]\n${stContext.memoryText}` : '';

    const recentSummaries = getRecentSummaries(ownerId, 5);
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

    const voiceInstructions =
        `\n- Говори от первого лица, оставаясь в рамках своего характера.\n- В своих репликах и интонациях реагируй на текущую сцену.\n- Если обращались к тебе напрямую — обязательно отреагируй на смысл слов, ответь на вопрос или дай понять, что услышал.\n- Если хочешь промолчать, проигнорировать, или слова не нужны — верни пустую строку ("speech": "").\n- Не описывай текстом свои действия — для этого есть другой слой системы, пиши только речь.`;    const describeAttitude = (value: number) => {
        if (value >= 90) return 'я испытываю к этому человеку глубокую привязанность и преданность';
        if (value >= 75) return 'я искренне тепло к нему отношусь и симпатизирую';
        if (value >= 60) return 'он мне приятен, я отношусь к нему с легкой симпатией';
        if (value >= 40) return 'мое отношение к нему совершенно нейтральное';
        if (value >= 25) return 'он вызывает у меня раздражение и некоторую неприязнь';
        if (value >= 10) return 'я испытываю к нему сильную антипатию и презрение';
        return 'я люто его ненавижу';
    };

    const describeOpenness = (value: number) => {
        if (value >= 90) return 'я абсолютно открыт(а) и готов(а) делиться всем';
        if (value >= 75) return 'я легко и охотно иду с ним на контакт';
        if (value >= 60) return 'я в целом не против пообщаться с ним';
        if (value >= 40) return 'я поддерживаю только формальный, сухой диалог';
        if (value >= 25) return 'я общаюсь с ним очень неохотно и сдержанно';
        if (value >= 10) return 'я стараюсь всячески избегать разговоров с ним';
        return 'я полностью игнорирую его и избегаю любых контактов';
    };

    const sceneCharactersData = sceneCharacterRepo.list(eventId);
    const mySceneChar = sceneCharactersData.find(sc => sc.character.id === ownerId || sc.character.subjectId === ownerId);

    const relationsSection = relations.length
        ? `[Персонажи сцены]\n${relations
            .map(rel => {
                const targetIdToFind = rel.target?.id || rel.toId;
                const theirSceneChar = sceneCharactersData.find(sc => sc.character.id === targetIdToFind || sc.character.subjectId === rel.toId);
                const isNearby = mySceneChar && theirSceneChar && mySceneChar.slotId === theirSceneChar.slotId;
                const presenceToken = rel.present
                    ? (isNearby ? 'этот человек рядом, в одной зоне' : 'человек в этой же комнате, но в отдалении')
                    : 'его сейчас нет поблизости';

                const name = rel.target?.name || rel.toId;
                
                // Углубляем "знакомство"
                const familiarityLabel = (rel.familiarityLevel && rel.familiarityLevel > 0.7) 
                    ? 'я хорошо его знаю и помню его повадки' 
                    : (rel.familiarityLevel && rel.familiarityLevel > 0.3)
                    ? 'мы немного знакомы'
                    : rel.knows ? 'мы общались, но я мало что о нем знаю' : 'я почти не представляю, чего от него ждать';
                    
                const access = rel.canInteract
                    ? 'у меня есть прямой доступ к нему'
                    : 'нас разделяют физические барьеры';
                    
                const tone = describeAttitude(rel.attitude);
                const opennessVal = typeof rel.openness === 'number' ? rel.openness : 50;
                const opennessLabel = describeOpenness(opennessVal);

                let result = `${name}: ${familiarityLabel}, ${presenceToken}, ${access}. По ощущениям: ${tone}. В плане общения: ${opennessLabel}.`;                if (rel.generalOpinion) {
                    result += ` Мое мнение о нем: ${rel.generalOpinion}`;
                }
                if (rel.recentMemories && rel.recentMemories.length > 0) {
                    result += ` Я помню, что: ${rel.recentMemories.join('; ')}.`;
                }

                return result;
              })
              .join('\n')}`
        : '';

    const aggregatedMemory = buildMemoryInsights(recentEvents as any); // using recent logs
    const vectorMemories = aggregatedMemory.length
        ? []
        : selectLongTermMemory(ownerId, structuredEvents, core, mappedPoints).slice(0, 2);

    const combinedMemories = [...aggregatedMemory, ...vectorMemories];
    const longTermSection = combinedMemories.length
        ? `\n[Долгосрочная память]\n${combinedMemories.map(entry => `- ${entry}`).join('\n')}`
        : '';

    const personaSection = `[Персона]\n${personaBlock}`;
    const instructionsSection = `[Инструкции]\n${cfg.formatInstructions}${voiceInstructions}`;
    const memorySection = memoryBlock ? memoryBlock.trim() : '';

    const narratorEventsText = buildRecentEventsSummary(recentEvents.slice(-1), actorDetails.name);

    const narratorPrompt: NarratorPromptPayload = {
        subjectId: targetQueryId,
        recentEventsText: narratorEventsText.trim(),
        stateText: '',
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
