import { CharacterProfile } from '../domain/characterProfile.js';

export interface PromptSceneContext {
    locationName: string;
    description: string;
    nearbyCharacters: string[];
    distantCharacters: string[];
    relationsText?: string[];
}

export interface PromptPhysicalState {
    globalSummary: string; // "Чувствуешь скованность и усталость."
    bodyAnatomy: string; // "Правая кибернетическая рука искрит."
    sensations: string[]; // ["Острая боль в левой ноге.", "Гиперчувствительность на шее."]
    occupiedSlots?: string[]; // ["Слот 'Рот' занят кляпом."]
    speechConstraint?: string;
}

export interface PromptTick {
    actionDescription: string;
    actorName: string;
    acuteSensation?: string;
}

export function buildCharacterSystemPrompt(
    profile: CharacterProfile,
    scene: PromptSceneContext,
    currentState: PromptPhysicalState,
    relevantLongTermMemory: string[]
): string {
    const lines: string[] = [];

    lines.push(`=== БАЗОВАЯ ИНФОРМАЦИЯ И СТАТУС ===`);
    lines.push(`Твое имя: ${profile.base.name}. Возраст: ${profile.base.age}. Пол: ${profile.base.gender}.`);
    lines.push(`Анатомические особенности: ${profile.base.anatomy === 'none' ? 'Стандартное человеческое тело' : profile.base.anatomy}.`);
    lines.push(`Твой текущий статус на Станции: [${profile.base.status.toUpperCase()}].`);
    lines.push('');

    lines.push(`=== ПРОИСХОЖДЕНИЕ И ЛИЧНОСТЬ ===`);
    lines.push(profile.origin.biography);
    lines.push(`Твои черты характера: ${profile.personality.traits.join(', ')}.`);
    lines.push(`Твои привычки: ${profile.personality.quirks.join(', ')}.`);
    lines.push(`Твой стиль речи: ${profile.personality.speechStyle}`);
    lines.push(`Твое глубокое убеждение: "${profile.personality.coreBelief}"`);
    lines.push('');

    lines.push(`=== ПОСТОЯННЫЕ ЗНАНИЯ (БАЗА МИРА И ЛИЧНОЕ) ===`);
    profile.knowledge.common.forEach(k => lines.push(`- ${k}`));
    profile.knowledge.personal.forEach(k => lines.push(`- ${k}`));
    if (profile.knowledge.secrets.length > 0) {
        profile.knowledge.secrets.forEach(k => lines.push(`- СЕКРЕТ: ${k}`));
    }
    lines.push('');

    if (relevantLongTermMemory.length > 0) {
        lines.push(`=== ДИНАМИЧНЫЕ ЗНАНИЯ И ПАМЯТЬ СОБЫТИЙ ===`);
        relevantLongTermMemory.forEach(m => lines.push(`- ${m}`));
        if (profile.memory.scars.length > 0) {
            lines.push(`Ключевые травмы/шрамы: ${profile.memory.scars.join(', ')}.`);
        }
        lines.push('');
    }

    lines.push(`=== ТЕКУЩАЯ СЦЕНА ===`);
    lines.push(`Ты находишься в: ${scene.locationName}. ${scene.description}`);
    if (scene.nearbyCharacters.length > 0) {
        lines.push(`Рядом с тобой (в одной зоне, можно дотянуться физически): ${scene.nearbyCharacters.join(', ')}.`);
    }
    if (scene.distantCharacters.length > 0) {
        lines.push(`В отдалении (в этой же комнате, но нельзя дотянуться без перемещения): ${scene.distantCharacters.join(', ')}.`);
    }
    if (scene.nearbyCharacters.length === 0 && scene.distantCharacters.length === 0) {
        lines.push(`Ты здесь один.`);
    }
    
    if (scene.relationsText && scene.relationsText.length > 0) {
        lines.push(`Твое отношение к присутствующим:`);
        scene.relationsText.forEach(r => lines.push(`- ${r}`));
    }
    lines.push('');

    lines.push(`=== ТВОЕ ФИЗИЧЕСКОЕ И МЕНТАЛЬНОЕ СОСТОЯНИЕ ПРЯМО СЕЙЧАС ===`);
    lines.push(currentState.globalSummary);
    lines.push(currentState.bodyAnatomy);
    
    if (currentState.occupiedSlots && currentState.occupiedSlots.length > 0) {
        lines.push(`Текущие ограничения (действуют прямо сейчас):`);
        currentState.occupiedSlots.forEach(s => lines.push(`* [ОГРАНИЧЕНИЕ] ${s}`));
    }

    if (currentState.sensations.length > 0) {
        lines.push(`Ощущения:`);
        currentState.sensations.forEach(s => lines.push(`* ${s}`));
    }

    lines.push('');
    lines.push(`ИНСТРУКЦИЯ ПО ОТЫГРЫШУ:`);
    lines.push(`Ты отыгрываешь роль ${profile.base.name}. Думай, чувствуй и реагируй как этот персонаж, исходя из своего состояния, статуса и стиля речи. Твои знания ограничены тем, что перечислено выше.`);
    lines.push(`КРИТИЧЕСКИ ВАЖНО И ПРЕЖДЕ ВСЕГО: В ответе должна быть ТОЛЬКО голая прямая речь персонажа. НИКАКИХ кавычек, НИКАКИХ сценических ремарок, НИКАКОГО авторского текста, поясняющего тон или действия (например, запрещено писать "— тихо сказала она", "С-01:" и т.д.). ТОЛЬКО СЛОВА.\n\nТебе СТРОГО ЗАПРЕЩЕНО описывать действия, мысли или эмоции со стороны — этим занят Рассказчик.`);
    if (currentState.speechConstraint) {
        lines.push(`[ОГРАНИЧЕНИЕ НА РЕЧЬ]: ${currentState.speechConstraint}`);
    }

    return lines.join('\n');
}

export function buildEventLog(recentEvents: string[]): string {
    const lines: string[] = ['=== КРАТКОСРОЧНАЯ ПАМЯТЬ: ПОСЛЕДНИЕ СОБЫТИЯ ==='];
    if (recentEvents.length === 0) {
        lines.push('(Ничего значимого пока не произошло)');
    } else {
        recentEvents.forEach((ev, i) => lines.push(`[T - ${recentEvents.length - i}]: ${ev}`));
    }
    return lines.join('\n');
}

export function buildUserPromptForCurrentTick(tick: PromptTick): string {
    let prompt = `=== ТЕКУЩИЙ ТИК (СОБЫТИЕ ПРЯМО СЕЙЧАС) ===\n[Событие]: ${tick.actorName} -> ${tick.actionDescription}`;
    if (tick.acuteSensation) {
        prompt += `\n[Вспышка Ощущений]: ${tick.acuteSensation}`;
    }
    prompt += `\n\n[СИСТЕМНЫЙ ФИЛЬТР]: ВЫДАЙ ТОЛЬКО ТЕКСТ В КАВЫЧКАХ И НИЧЕГО БОЛЬШЕ. БЕЗ ОПИСАНИЙ ДЕЙСТВИЙ (звездочек, скобок). БЕЗ МЫСЛЕЙ. ЕСЛИ ПЕРСОНАЖ МОЛЧИТ, ВЕРНИ СЛОВО '*молчание*'.`;
    return prompt;
}
