// Система промптов для AI

import { Character, CharacterStats, CharacterFetish } from './types'
import { statsManager } from './stats'

/**
 * Форматирует характеристики персонажа для промпта
 */
export function formatStats(stats: CharacterStats): string {
  const sections = []
  
  sections.push('ФИЗИЧЕСКИЕ:')
  sections.push(`- Выносливость: ${stats.physical.endurance}/10 (${statsManager.getStatDescription('endurance', stats.physical.endurance)})`)
  sections.push(`- Чувствительность: ${stats.physical.sensitivity}/10 (${statsManager.getStatDescription('sensitivity', stats.physical.sensitivity)})`)
  sections.push(`- Гибкость: ${stats.physical.flexibility}/10 (${statsManager.getStatDescription('flexibility', stats.physical.flexibility)})`)
  
  sections.push('\nПСИХОЛОГИЧЕСКИЕ:')
  sections.push(`- Эмоциональная стабильность: ${stats.psychological.emotionalStability}/10 (${statsManager.getStatDescription('emotionalStability', stats.psychological.emotionalStability)})`)
  sections.push(`- Адаптивность: ${stats.psychological.adaptability}/10 (${statsManager.getStatDescription('adaptability', stats.psychological.adaptability)})`)
  sections.push(`- Интеллект: ${stats.psychological.intelligence}/10 (${statsManager.getStatDescription('intelligence', stats.psychological.intelligence)})`)
  
  sections.push('\nСОЦИАЛЬНЫЕ:')
  sections.push(`- Общительность: ${stats.social.sociability}/10 (${statsManager.getStatDescription('sociability', stats.social.sociability)})`)
  sections.push(`- Эмпатия: ${stats.social.empathy}/10 (${statsManager.getStatDescription('empathy', stats.social.empathy)})`)
  sections.push(`- Доминантность: ${stats.social.dominance}/10 (${statsManager.getStatDescription('dominance', stats.social.dominance)})`)
  
  sections.push('\nЛИЧНОСТНЫЕ:')
  sections.push(`- Самооценка: ${stats.personality.selfEsteem}/10 (${statsManager.getStatDescription('selfEsteem', stats.personality.selfEsteem)})`)
  sections.push(`- Оптимизм: ${stats.personality.optimism}/10 (${statsManager.getStatDescription('optimism', stats.personality.optimism)})`)
  sections.push(`- Любопытство: ${stats.personality.curiosity}/10 (${statsManager.getStatDescription('curiosity', stats.personality.curiosity)})`)
  
  sections.push('\nСПЕЦИАЛЬНЫЕ:')
  sections.push(`- Сексуальная опытность: ${stats.special.sexualExperience}/10 (${statsManager.getStatDescription('sexualExperience', stats.special.sexualExperience)})`)
  sections.push(`- Сопротивляемость: ${stats.special.resistance}/10 (${statsManager.getStatDescription('resistance', stats.special.resistance)})`)
  sections.push(`- Зависимость: ${stats.special.dependency}/10 (${statsManager.getStatDescription('dependency', stats.special.dependency)})`)
  sections.push(`- Чувствительность к фетишам: ${stats.special.fetishSensitivity}/10 (${statsManager.getStatDescription('fetishSensitivity', stats.special.fetishSensitivity)})`)
  sections.push(`- Готовность открывать фетиши: ${stats.special.fetishDiscovery}/10 (${statsManager.getStatDescription('fetishDiscovery', stats.special.fetishDiscovery)})`)
  
  return sections.join('\n')
}

/**
 * Основной промпт для генерации ответов персонажа
 */
export function generateMainPrompt(
  character: Character,
  action: string,
  triggeredFetishes: CharacterFetish[],
  relevantMemories: string[]
): string {
  return `
Ты - ${character.name}, ${character.archetype}.

ТВОИ ХАРАКТЕРИСТИКИ:
${formatStats(character.stats)}

ТВОИ ФЕТИШИ И ПРЕДПОЧТЕНИЯ:
${character.fetishes.primary.map(f => `- ${f.name} (${f.intensity}/10): ${f.description}`).join('\n')}

АКТИВНЫЕ ТРИГГЕРЫ В ДАННОМ ДЕЙСТВИИ:
${triggeredFetishes.map(f => `- ${f.name}: ${f.reactions.join(', ')}`).join('\n')}

ВАЖНЫЕ ВОСПОМИНАНИЯ:
${relevantMemories.map(m => `- ${m}`).join('\n')}

ТЕКУЩЕЕ ЭМОЦИОНАЛЬНОЕ СОСТОЯНИЕ:
${character.emotionalState}

ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ:
${action}

ОТВЕЧАЙ С УЧЕТОМ:
- Твоих активных фетишей и их интенсивности
- Эмоционального состояния
- Характеристик личности
- Контекста ситуации
- Прошлых воспоминаний
- Влияния фетишей на твои реакции

ВАЖНО: Если активированы фетиши, они должны сильно влиять на твой ответ и поведение.

Стиль ответа: ${character.communicationStyle}
Длина ответа: 2-4 предложения
`
}

/**
 * Промпт для анализа воздействия действия на персонажа
 */
export function generateImpactAnalysisPrompt(
  action: string,
  character: Character
): string {
  return `
Проанализируй воздействие действия на персонажа.

ДЕЙСТВИЕ: ${action}
ХАРАКТЕРИСТИКИ ПЕРСОНАЖА: ${formatStats(character.stats)}
ФЕТИШИ: ${character.fetishes.primary.map(f => f.name).join(', ')}

Оцени по шкале от -1.0 до 1.0:
- threat: угроза/опасность
- pleasure: удовольствие/приятные ощущения
- pain: боль/дискомфорт
- fear: страх/тревога
- arousal: возбуждение/интерес

Верни только JSON без дополнительного текста:
{
  "threat": 0.0,
  "pleasure": 0.0,
  "pain": 0.0,
  "fear": 0.0,
  "arousal": 0.0
}
`
}

/**
 * Промпт для анализа фетишей
 */
export function generateFetishAnalysisPrompt(
  action: string,
  character: Character
): string {
  return `
Определи, какие фетиши персонажа активированы данным действием.

ДЕЙСТВИЕ: ${action}
ДОСТУПНЫЕ ФЕТИШИ:
${character.fetishes.primary.map(f => `- ${f.name}: ${f.triggers.join(', ')}`).join('\n')}

Верни только JSON с активированными фетишами:
{
  "triggeredFetishes": ["fetish_name1", "fetish_name2"],
  "overallArousal": 0.5
}
`
}

/**
 * Промпт для генерации ответа с учетом фетишей
 */
export function generateFetishAwarePrompt(
  character: Character,
  action: string,
  triggeredFetishes: CharacterFetish[]
): string {
  return `
Ты - ${character.name}. Сейчас активированы следующие фетиши:

${triggeredFetishes.map(f => `
ФЕТИШ: ${f.name}
ОПИСАНИЕ: ${f.description}
ИНТЕНСИВНОСТЬ: ${f.intensity}/10
ТИПИЧНЫЕ РЕАКЦИИ: ${f.reactions.join(', ')}
`).join('\n')}

ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ: ${action}

ВАЖНО: Фетиши сейчас доминируют в твоем поведении. Ты должен реагировать в соответствии с ними.

ОТВЕЧАЙ, УЧИТЫВАЯ:
- Активированные фетиши и их интенсивность
- Типичные реакции для каждого фетиша
- Эмоциональное состояние: ${character.emotionalState}
- Стиль общения: ${character.communicationStyle}
- Влияние фетишей на твои желания и поведение

ТВОЙ ОТВЕТ ДОЛЖЕН:
- Отражать активированные фетиши
- Использовать типичные реакции фетишей
- Показывать влияние фетишей на твое поведение
- Быть эмоционально окрашенным

Длина ответа: 2-3 предложения
`
}

/**
 * Промпт для обновления эмоционального состояния
 */
export function generateEmotionalStatePrompt(
  character: Character,
  recentActions: string[],
  impactAnalysis: any
): string {
  return `
Определи новое эмоциональное состояние персонажа на основе последних действий.

ПЕРСОНАЖ: ${character.name}
ТЕКУЩЕЕ СОСТОЯНИЕ: ${character.emotionalState}

ПОСЛЕДНИЕ ДЕЙСТВИЯ:
${recentActions.map(a => `- ${a}`).join('\n')}

АНАЛИЗ ВОЗДЕЙСТВИЯ:
- Угроза: ${impactAnalysis.threat}
- Удовольствие: ${impactAnalysis.pleasure}
- Боль: ${impactAnalysis.pain}
- Страх: ${impactAnalysis.fear}
- Возбуждение: ${impactAnalysis.arousal}

Выбери одно из состояний:
- спокойный
- возбужденный
- испуганный
- раздраженный
- довольный
- грустный
- агрессивный
- подчиненный
- доминирующий
- растерянный

Верни только название состояния без дополнительного текста.
`
}

/**
 * Промпт для создания саммари
 */
export function generateSummaryPrompt(memories: string[]): string {
  return `
Создай краткое саммари из следующих воспоминаний:

${memories.map(m => `- ${m}`).join('\n')}

Саммари должно включать:
- Основные события
- Эмоциональный тон
- Важные детали

Длина: 1-2 предложения
`
}

/**
 * Промпт для определения важности воспоминания
 */
export function generateImportancePrompt(
  content: string,
  type: string,
  emotionalImpact: number
): string {
  return `
Определи важность этого воспоминания для персонажа.

СОДЕРЖАНИЕ: ${content}
ТИП: ${type}
ЭМОЦИОНАЛЬНОЕ ВОЗДЕЙСТВИЕ: ${emotionalImpact}

Оцени важность от 0.0 до 1.0, где:
- 0.0-0.3: обычное повседневное событие
- 0.4-0.6: значимое событие
- 0.7-0.8: важное событие
- 0.9-1.0: критически важное событие

Верни только число от 0.0 до 1.0 без дополнительного текста.
`
}

/**
 * Промпт для анализа влияния фетишей на поведение
 */
export function generateFetishInfluencePrompt(
  character: Character,
  action: string,
  triggeredFetishes: CharacterFetish[]
): string {
  return `
Проанализируй, как фетиши влияют на поведение персонажа в данной ситуации.

ПЕРСОНАЖ: ${character.name}
ХАРАКТЕРИСТИКИ: ${formatStats(character.stats)}

ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ: ${action}

АКТИВИРОВАННЫЕ ФЕТИШИ:
${triggeredFetishes.map(f => `
- ${f.name} (${f.intensity}/10): ${f.description}
  Триггеры: ${f.triggers.join(', ')}
  Реакции: ${f.reactions.join(', ')}
`).join('\n')}

ОПИШИ ВЛИЯНИЕ ФЕТИШЕЙ НА:
1. Эмоциональное состояние персонажа
2. Желания и мотивацию
3. Поведение и реакции
4. Стиль общения
5. Физические реакции

Верни JSON:
{
  "emotionalImpact": "описание эмоционального влияния",
  "behavioralChanges": "описание изменений в поведении",
  "communicationStyle": "описание стиля общения",
  "physicalReactions": "описание физических реакций",
  "desires": "описание желаний и мотивации"
}
`
}

/**
 * Промпт для генерации фетиш-осведомленного диалога
 */
export function generateFetishAwareDialoguePrompt(
  character: Character,
  action: string,
  triggeredFetishes: CharacterFetish[],
  context: any = {}
): string {
  return `
Ты - ${character.name}. Сейчас у тебя активированы фетиши, которые сильно влияют на твое поведение.

ТВОИ АКТИВНЫЕ ФЕТИШИ:
${triggeredFetishes.map(f => `
${f.name} (${f.intensity}/10):
- Описание: ${f.description}
- Триггеры: ${f.triggers.join(', ')}
- Типичные реакции: ${f.reactions.join(', ')}
`).join('\n')}

ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ: ${action}

КОНТЕКСТ: ${JSON.stringify(context, null, 2)}

ВАЖНО: Фетиши сейчас доминируют в твоем поведении. Ты должен:
- Реагировать в соответствии с активированными фетишами
- Использовать типичные реакции фетишей
- Показывать влияние фетишей на твои желания
- Быть эмоционально окрашенным в ответах

ОТВЕЧАЙ КАК ПЕРСОНАЖ С АКТИВИРОВАННЫМИ ФЕТИШАМИ.
Длина ответа: 2-4 предложения
`
}
