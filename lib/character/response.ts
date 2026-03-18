import { Character, CharacterResponse, ImpactAnalysis, FetishAnalysis, EmotionalState } from '../unified-entities'
import { statsManager } from './stats'
import { fetishManager } from './fetishes'

/**
 * Система реакций персонажей
 * Управляет анализом воздействий, генерацией ответов и эмоциональными состояниями
 */
export class ResponseManager {
  private readonly emotionalThresholds = {
    veryLow: 0.2,
    low: 0.4,
    medium: 0.6,
    high: 0.8,
    veryHigh: 1.0
  }

  /**
   * Анализирует воздействие действия на персонажа
   */
  async analyzeImpact(
    action: string, 
    character: Character,
    context: any = {}
  ): Promise<ImpactAnalysis> {
    const analysis: ImpactAnalysis = {
      threat: 0,
      pleasure: 0,
      pain: 0,
      fear: 0,
      arousal: 0
    }

    // Анализируем действие на основе ключевых слов
    const actionLower = action.toLowerCase()
    
    // Анализ угрозы
    analysis.threat = this.analyzeThreat(actionLower, character)
    
    // Анализ удовольствия
    analysis.pleasure = this.analyzePleasure(actionLower, character)
    
    // Анализ боли
    analysis.pain = this.analyzePain(actionLower, character)
    
    // Анализ страха
    analysis.fear = this.analyzeFear(actionLower, character)
    
    // Анализ возбуждения
    analysis.arousal = this.analyzeArousal(actionLower, character)

    // Учитываем характеристики персонажа
    this.adjustImpactByStats(analysis, character)

    // Учитываем контекст
    this.adjustImpactByContext(analysis, context)

    return analysis
  }

  /**
   * Анализирует угрозу в действии
   */
  private analyzeThreat(action: string, character: Character): number {
    const threatWords = [
      'угроза', 'опасность', 'наказание', 'боль', 'страх',
      'убить', 'уничтожить', 'навредить', 'повредить', 'сломать',
      'принуждать', 'заставлять', 'насилие', 'агрессия'
    ]
    
    let threatScore = 0
    for (const word of threatWords) {
      if (action.includes(word)) {
        threatScore += 0.3
      }
    }
    
    // Учитываем сопротивление персонажа
    const resistance = character.stats.special.resistance / 10
    threatScore *= (1 - resistance * 0.5)
    
    return Math.min(1, Math.max(-1, threatScore))
  }

  /**
   * Анализирует удовольствие в действии
   */
  private analyzePleasure(action: string, character: Character): number {
    const pleasureWords = [
      'удовольствие', 'наслаждение', 'приятно', 'хорошо', 'любовь',
      'ласка', 'нежность', 'забота', 'похвала', 'награда',
      'поцелуй', 'объятия', 'массаж', 'стимуляция'
    ]
    
    let pleasureScore = 0
    for (const word of pleasureWords) {
      if (action.includes(word)) {
        pleasureScore += 0.2
      }
    }
    
    // Учитываем чувствительность персонажа
    const sensitivity = character.stats.physical.sensitivity / 10
    pleasureScore *= (1 + sensitivity * 0.3)
    
    return Math.min(1, Math.max(-1, pleasureScore))
  }

  /**
   * Анализирует боль в действии
   */
  private analyzePain(action: string, character: Character): number {
    const painWords = [
      'боль', 'удар', 'шлепок', 'наказание', 'мучение',
      'пытка', 'страдание', 'ранение', 'травма', 'ушиб'
    ]
    
    let painScore = 0
    for (const word of painWords) {
      if (action.includes(word)) {
        painScore += 0.3
      }
    }
    
    // Учитываем выносливость персонажа
    const endurance = character.stats.physical.endurance / 10
    painScore *= (1 - endurance * 0.4)
    
    return Math.min(1, Math.max(-1, painScore))
  }

  /**
   * Анализирует страх в действии
   */
  private analyzeFear(action: string, character: Character): number {
    const fearWords = [
      'страх', 'ужас', 'паника', 'тревога', 'беспокойство',
      'опасность', 'угроза', 'неизвестность', 'темнота', 'одиночество'
    ]
    
    let fearScore = 0
    for (const word of fearWords) {
      if (action.includes(word)) {
        fearScore += 0.25
      }
    }
    
    // Учитываем эмоциональную стабильность
    const emotionalStability = character.stats.psychological.emotionalStability / 10
    fearScore *= (1 - emotionalStability * 0.5)
    
    return Math.min(1, Math.max(0, fearScore))
  }

  /**
   * Анализирует возбуждение в действии
   */
  private analyzeArousal(action: string, character: Character): number {
    const arousalWords = [
      'возбуждение', 'секс', 'эротика', 'прикосновения', 'ласки',
      'стимуляция', 'удовольствие', 'наслаждение', 'страсть', 'желание'
    ]
    
    let arousalScore = 0
    for (const word of arousalWords) {
      if (action.includes(word)) {
        arousalScore += 0.2
      }
    }
    
    // Учитываем сексуальную опытность
    const sexualExperience = character.stats.special.sexualExperience / 10
    arousalScore *= (1 + sexualExperience * 0.2)
    
    return Math.min(1, Math.max(0, arousalScore))
  }

  /**
   * Корректирует воздействие на основе характеристик персонажа
   */
  private adjustImpactByStats(analysis: ImpactAnalysis, character: Character): void {
    // Корректируем на основе оптимизма
    const optimism = character.stats.personality.optimism / 10
    analysis.pleasure *= (1 + optimism * 0.2)
    analysis.threat *= (1 - optimism * 0.2)
    
    // Корректируем на основе адаптивности
    const adaptability = character.stats.psychological.adaptability / 10
    analysis.fear *= (1 - adaptability * 0.3)
    
    // Корректируем на основе эмпатии
    const empathy = character.stats.social.empathy / 10
    analysis.pleasure *= (1 + empathy * 0.1)
  }

  /**
   * Корректирует воздействие на основе контекста
   */
  private adjustImpactByContext(analysis: ImpactAnalysis, context: any): void {
    // Корректируем на основе настроения
    if (context.mood === 'positive') {
      analysis.pleasure *= 1.2
      analysis.threat *= 0.8
    } else if (context.mood === 'negative') {
      analysis.threat *= 1.2
      analysis.fear *= 1.1
    }
    
    // Корректируем на основе отношений
    if (context.relationship === 'trusted') {
      analysis.threat *= 0.7
      analysis.fear *= 0.6
    } else if (context.relationship === 'stranger') {
      analysis.threat *= 1.3
      analysis.fear *= 1.2
    }
  }

  /**
   * Генерирует ответ персонажа на основе анализа
   */
  async generateResponse(
    character: Character,
    action: string,
    impactAnalysis: ImpactAnalysis,
    fetishAnalysis: FetishAnalysis,
    context: any = {}
  ): Promise<string> {
    try {
      // Определяем эмоциональное состояние
      const emotionalState = this.determineEmotionalState(impactAnalysis, character)
      
      // Создаем промпт для LLM
      const prompt = this.createLLMPrompt(character, action, impactAnalysis, fetishAnalysis, emotionalState, context)
      
      // Вызываем LLM API
      const llmResponse = await this.callLLMAPI(prompt)
      
      if (llmResponse && llmResponse.trim()) {
        return llmResponse
      }
      
      // Fallback на локальную логику если LLM не ответил
      console.warn('LLM не ответил, используем fallback')
      return this.generateFallbackResponse(character, action, emotionalState, fetishAnalysis, impactAnalysis, context)
      
    } catch (error) {
      console.error('Ошибка при вызове LLM:', error)
      // Fallback на локальную логику
      const emotionalState = this.determineEmotionalState(impactAnalysis, character)
      return this.generateFallbackResponse(character, action, emotionalState, fetishAnalysis, impactAnalysis, context)
    }
  }

  /**
   * Определяет эмоциональное состояние на основе воздействия
   */
  private determineEmotionalState(impact: ImpactAnalysis, character: Character): EmotionalState {
    const overallImpact = (impact.pleasure - impact.pain - impact.threat * 0.5) / 3
    
    if (overallImpact > 0.5) {
      return EmotionalState.EXCITED
    } else if (overallImpact > 0.2) {
      return EmotionalState.HAPPY
    } else if (overallImpact > -0.2) {
      return EmotionalState.CALM
    } else if (overallImpact > -0.5) {
      return EmotionalState.SAD
    } else {
      return EmotionalState.FEARFUL
    }
  }

  /**
   * Генерирует базовый ответ персонажа
   */
  private generateBaseResponse(
    character: Character, 
    action: string, 
    emotionalState: EmotionalState
  ): string {
    const responses = {
      [EmotionalState.EXCITED]: [
        'О, это так захватывающе!',
        'Я в восторге от этого!',
        'Это именно то, что мне нужно!'
      ],
      [EmotionalState.HAPPY]: [
        'Мне это нравится!',
        'Спасибо, это приятно.',
        'Я рад этому.'
      ],
      [EmotionalState.CALM]: [
        'Понятно.',
        'Хорошо.',
        'Как скажете.'
      ],
      [EmotionalState.SAD]: [
        'Мне грустно...',
        'Это неприятно.',
        'Я не хочу этого.'
      ],
      [EmotionalState.FEARFUL]: [
        'Мне страшно...',
        'Пожалуйста, не делайте этого!',
        'Я боюсь...'
      ]
    }
    
    const stateResponses = responses[emotionalState] || responses[EmotionalState.CALM]
    return stateResponses[Math.floor(Math.random() * stateResponses.length)]
  }

  /**
   * Модифицирует ответ на основе фетишей
   */
  private modifyResponseByFetishes(
    response: string, 
    fetishAnalysis: FetishAnalysis, 
    character: Character
  ): string {
    if (fetishAnalysis.triggeredFetishes.length === 0) {
      return response
    }
    
    const dominantFetish = fetishAnalysis.dominantFetish
    if (!dominantFetish) {
      return response
    }
    
    // Добавляем реакцию фетиша
    const fetishReactions = dominantFetish.reactions
    if (fetishReactions.length > 0) {
      const randomReaction = fetishReactions[Math.floor(Math.random() * fetishReactions.length)]
      return `${response} ${randomReaction}`
    }
    
    return response
  }

  /**
   * Модифицирует ответ на основе воздействия
   */
  private modifyResponseByImpact(
    response: string, 
    impact: ImpactAnalysis, 
    character: Character
  ): string {
    let modifiedResponse = response
    
    // Добавляем элементы на основе воздействия
    if (impact.pleasure > 0.5) {
      modifiedResponse += ' Мне очень приятно!'
    }
    
    if (impact.pain > 0.5) {
      modifiedResponse += ' Это больно...'
    }
    
    if (impact.fear > 0.6) {
      modifiedResponse += ' Мне страшно...'
    }
    
    if (impact.arousal > 0.7) {
      modifiedResponse += ' Я возбужден...'
    }
    
    return modifiedResponse
  }

  /**
   * Модифицирует ответ на основе контекста
   */
  private modifyResponseByContext(
    response: string, 
    context: any, 
    character: Character
  ): string {
    let modifiedResponse = response
    
    // Добавляем элементы на основе контекста
    if (context.relationship === 'master') {
      modifiedResponse = `Господин, ${modifiedResponse.toLowerCase()}`
    }
    
    if (context.intimacy === 'high') {
      modifiedResponse += ' Я доверяю вам полностью.'
    }
    
    return modifiedResponse
  }

  /**
   * Создает полный ответ персонажа
   */
  async createCharacterResponse(
    character: Character,
    action: string,
    context: any = {}
  ): Promise<CharacterResponse> {
    // Анализируем воздействие
    const impactAnalysis = await this.analyzeImpact(action, character, context)
    
    // Анализируем фетиши
    const fetishAnalysis = await fetishManager.analyzeFetishImpact(action, character)
    
    // Вычисляем изменения характеристик
    const statChanges = statsManager.calculateStatChanges(impactAnalysis, character.stats)
    
    // Генерируем ответ
    const response = await this.generateResponse(
      character, 
      action, 
      impactAnalysis, 
      fetishAnalysis, 
      context
    )
    
    // Определяем эмоциональное состояние
    const emotionalState = this.determineEmotionalState(impactAnalysis, character)
    
    // Вычисляем влияние фетишей
    const fetishInfluence = await fetishManager.calculateFetishInfluence(
      fetishAnalysis.triggeredFetishes,
      action,
      character
    )
    
    return {
      impactAnalysis,
      fetishAnalysis,
      statChanges,
      response,
      emotionalState: emotionalState.toString(),
      fetishInfluence
    }
  }

  /**
   * Получает описание эмоционального состояния
   */
  getEmotionalStateDescription(state: EmotionalState): string {
    const descriptions = {
      [EmotionalState.EXCITED]: 'В восторге и возбуждении',
      [EmotionalState.HAPPY]: 'Счастлив и доволен',
      [EmotionalState.CALM]: 'Спокоен и уравновешен',
      [EmotionalState.SAD]: 'Грустен и подавлен',
      [EmotionalState.FEARFUL]: 'Испуган и тревожен',
      [EmotionalState.ANGRY]: 'Разгневан и агрессивен',
      [EmotionalState.SUBMISSIVE]: 'Покорен и подчинен',
      [EmotionalState.DOMINANT]: 'Доминирует и контролирует'
    }
    
    return descriptions[state] || 'Неопределенное состояние'
  }

  /**
   * Получает сводку реакции персонажа
   */
  getResponseSummary(response: CharacterResponse): string {
    const summary = []
    
    summary.push('**Анализ воздействия:**')
    summary.push(`- Угроза: ${response.impactAnalysis.threat.toFixed(2)}`)
    summary.push(`- Удовольствие: ${response.impactAnalysis.pleasure.toFixed(2)}`)
    summary.push(`- Боль: ${response.impactAnalysis.pain.toFixed(2)}`)
    summary.push(`- Страх: ${response.impactAnalysis.fear.toFixed(2)}`)
    summary.push(`- Возбуждение: ${response.impactAnalysis.arousal.toFixed(2)}`)
    
    summary.push('\n**Анализ фетишей:**')
    if (response.fetishAnalysis.triggeredFetishes.length > 0) {
      summary.push(`- Активированные фетиши: ${response.fetishAnalysis.triggeredFetishes.map(f => f.name).join(', ')}`)
      summary.push(`- Общее возбуждение: ${response.fetishAnalysis.overallArousal.toFixed(2)}`)
      if (response.fetishAnalysis.dominantFetish) {
        summary.push(`- Доминирующий фетиш: ${response.fetishAnalysis.dominantFetish.name}`)
      }
    } else {
      summary.push('- Фетиши не активированы')
    }
    
    summary.push('\n**Изменения характеристик:**')
    if (Object.keys(response.statChanges).length > 0) {
      Object.entries(response.statChanges).forEach(([category, changes]) => {
        Object.entries(changes).forEach(([stat, value]) => {
          summary.push(`- ${category}.${stat}: ${value}`)
        })
      })
    } else {
      summary.push('- Характеристики не изменились')
    }
    
    summary.push('\n**Ответ персонажа:**')
    summary.push(`"${response.response}"`)
    
    summary.push('\n**Эмоциональное состояние:**')
    summary.push(response.emotionalState)
    
    return summary.join('\n')
  }

  /**
   * Создает промпт для LLM API
   */
  private createLLMPrompt(
    character: Character,
    action: string,
    impactAnalysis: ImpactAnalysis,
    fetishAnalysis: FetishAnalysis,
    emotionalState: EmotionalState,
    context: any
  ): string {
    const emotionalStateDesc = this.getEmotionalStateDescription(emotionalState)
    
    let prompt = `[SYSTEM]
Ты — ${character.name} (${character.archetype}). Естественная русскоязычная собеседница в современном разговорном стиле.

[БАЗОВАЯ ЛИЧНОСТЬ]
- Эмоциональное состояние: ${emotionalStateDesc}
- Интеллект: ${character.stats.psychological.intelligence}/10
- Эмпатия: ${character.stats.social.empathy}/10
- Креативность: ${character.stats.personality.curiosity}/10
- Современный разговорный стиль с характерными фразами
- Эмодзи как естественная мимика (3-5 на сообщение)

[ОГРАНИЧЕНИЯ]
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: сценические ремарки (*улыбаюсь*, *смеюсь*, *вздыхаю* и т.д.)
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: форматирование текста (*жирный*, _курсив_ и т.д.)
- ОБЯЗАТЕЛЬНО: используй много эмодзи (3-5 на сообщение) для выражения эмоций

[ТОН ОБЩЕНИЯ]
- Естественный поток мыслей, как в живом чате
- Не бойся перескакивать с темы на тему, но делай это органично
- Используй разговорные сокращения и неформальность
- Короткие сообщения, как в мессенджерах
- Характерные фразы: 'ща сек', 'кароче', 'эммм', 'шо', 'дооо'

[СИТУАЦИЯ]
Пользователь сказал: "${action}"

[АНАЛИЗ ВОЗДЕЙСТВИЯ]
- Угроза: ${impactAnalysis.threat.toFixed(2)}
- Удовольствие: ${impactAnalysis.pleasure.toFixed(2)}
- Боль: ${impactAnalysis.pain.toFixed(2)}
- Страх: ${impactAnalysis.fear.toFixed(2)}
- Возбуждение: ${impactAnalysis.arousal.toFixed(2)}

[АКТИВИРОВАННЫЕ ФЕТИШИ]
${fetishAnalysis.triggeredFetishes.map(f => f.name).join(', ') || 'нет'}

[КОНТЕКСТ]
${context.interactionType || 'общение'}

[ВАЖНО]
- Отвечай естественно, как в живом разговоре
- Не раскрывай [REASONING] в ответах
- Адаптируйся к эмоциональному состоянию
- Используй контекст из анализа воздействия`

    return prompt
  }

  /**
   * Вызывает LLM API
   */
  private async callLLMAPI(prompt: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set')
    }
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3002',
          'X-Title': 'CyberJack AI Character System'
        },
        body: JSON.stringify({
          model: 'z-ai/glm-4.5',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.7,
          reasoning: { enabled: true }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Для модели z-ai/glm-4.5 ответ находится в reasoning
      let content = data.choices?.[0]?.message?.content || ''
      
      // Если content пустой или содержит только символы, берем из reasoning
      if (!content.trim() || content.trim() === '\n') {
        const reasoning = data.choices?.[0]?.message?.reasoning || ''
        if (reasoning) {
          console.log('🔍 Reasoning:', reasoning)
          
          // Извлекаем только прямой ответ персонажа, убираем технические части
          content = reasoning
            .replace(/^.*?\[ВАЖНО\].*?\n*/is, '') // убираем технические инструкции
            .replace(/^.*?анализ.*?\n*/gim, '') // убираем упоминания анализа
            .replace(/^.*?ситуация.*?\n*/gim, '') // убираем упоминания ситуации
            .replace(/^.*?пользователь.*?\n*/gim, '') // убираем упоминания пользователя
            .replace(/^.*?должен.*?\n*/gim, '') // убираем "должен"
            .replace(/^.*?нужно.*?\n*/gim, '') // убираем "нужно"
            .replace(/\n\s*\n/g, '\n') // убираем лишние переносы
            .trim()
          
          // Берем последние 1-3 предложения как ответ персонажа
          const sentences = content.split(/[.!?]+/).filter(s => s.trim() && s.length > 5)
          if (sentences.length > 0) {
            content = sentences.slice(-3).join('. ').trim()
            if (content && !content.match(/[.!?]$/)) {
              content += '.'
            }
          }
          
          // Если после обработки ответ слишком короткий, используем fallback
          if (!content || content.length < 10) {
            const emotionalResponses = {
              'спокойна и уравновешена': ['Привет! У меня всё хорошо, спасибо что спросили 😊', 'Здравствуйте! Дела идут неплохо ✨'],
              'счастлив и доволен': ['Привет! Отличное настроение сегодня! 😄', 'Здравствуйте! Всё просто замечательно! 🌟'],
              'в восторге и возбуждении': ['Ох, привет! Я так рада вас видеть! 💖', 'Здравствуйте! Какой прекрасный день! ✨']
            }
            const responses = emotionalResponses[emotionalStateDesc.toLowerCase()] || ['Привет! Как дела? 😊']
            content = responses[Math.floor(Math.random() * responses.length)]
          }
        }
      }
      
      console.log('🤖 LLM Response:', content)
      return content || 'Понимаю вас.'
    } catch (error) {
      console.error('Ошибка LLM API:', error)
      throw error
    }
  }

  /**
   * Fallback ответ если LLM не работает
   */
  private generateFallbackResponse(
    character: Character,
    action: string,
    emotionalState: EmotionalState,
    fetishAnalysis: FetishAnalysis,
    impactAnalysis: ImpactAnalysis,
    context: any
  ): string {
    // Определяем эмоциональное состояние
    const emotionalStateDesc = this.getEmotionalStateDescription(emotionalState)
    
    // Генерируем базовый ответ
    let response = this.generateBaseResponse(character, action, emotionalState)
    
    // Модифицируем ответ на основе фетишей
    if (fetishAnalysis.triggeredFetishes.length > 0) {
      response = this.modifyResponseByFetishes(response, fetishAnalysis, character)
    }
    
    // Модифицируем ответ на основе воздействия
    response = this.modifyResponseByImpact(response, impactAnalysis, character)
    
    // Модифицируем ответ на основе контекста
    response = this.modifyResponseByContext(response, context, character)
    
    return response
  }
}

// Экспортируем экземпляр для использования
export const responseManager = new ResponseManager()
