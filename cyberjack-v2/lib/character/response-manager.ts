// lib/character/response-manager.ts

import {
  ResponseManager,
  AIResponse,
  AIResponseMetadata,
  ResponseAnalysis,
  ValidationResult,
  PromptContext,
  ChatMessageMetadata
} from '@/types/character-ai'
import { serverLogger, LogCategory } from '@/lib/utils/server-logger'
import { CharacteristicInterpreter } from './characteristic-interpreter'
import { getGlobalSystemPromptShort } from './global-system-prompt'

export class CharacterResponseManager implements ResponseManager {
  private readonly MAX_RESPONSE_LENGTH = 500
  private readonly MIN_RESPONSE_LENGTH = 10
  private readonly QUALITY_THRESHOLD = 0.6
  private readonly CONFIDENCE_THRESHOLD = 0.7
  private readonly characteristicInterpreter: CharacteristicInterpreter

  constructor() {
    this.characteristicInterpreter = new CharacteristicInterpreter()
  }

  // Генерация ответа
  async generateResponse(
    characterId: string,
    userMessage: string,
    context: PromptContext
  ): Promise<AIResponse> {
    const startTime = Date.now()

    try {
      // Анализируем сообщение пользователя
      const messageAnalysis = await this.analyzeUserMessage(userMessage)

      // Генерируем базовый ответ (это будет заменено на вызов AI API)
      const rawResponse = await this.generateRawResponse(userMessage, context, messageAnalysis)

      // Анализируем ответ
      const responseAnalysis = await this.analyzeResponse(rawResponse, context)

      // Валидируем ответ
      const validation = await this.validateResponse(rawResponse, context)

      // Улучшаем ответ если нужно
      let finalResponse = rawResponse
      if (!validation.isValid || responseAnalysis.quality < this.QUALITY_THRESHOLD) {
        finalResponse = await this.enhanceResponse(rawResponse, context)
      }

      // Создаем метаданные
      const metadata: AIResponseMetadata = {
        emotion: responseAnalysis.emotion,
        intent: responseAnalysis.intent,
        keywords: responseAnalysis.keywords,
        sentiment: responseAnalysis.sentiment,
        responseTime: Date.now() - startTime,
        quality: responseAnalysis.quality,
        confidence: responseAnalysis.confidence,
        tokensUsed: this.estimateTokens(finalResponse),
        cost: this.calculateCost(finalResponse)
      }

      return {
        message: finalResponse,
        characterId,
        timestamp: new Date(),
        metadata
      }
    } catch (error) {
      console.error('Ошибка при генерации ответа:', error)

      // Возвращаем fallback ответ
      return {
        message: this.generateFallbackResponse(userMessage, context),
        characterId,
        timestamp: new Date(),
        metadata: {
          emotion: 'neutral',
          intent: 'fallback',
          keywords: [],
          sentiment: 'neutral',
          responseTime: Date.now() - startTime,
          quality: 0.3,
          confidence: 0.5,
          tokensUsed: 0,
          cost: 0
        }
      }
    }
  }

  // Анализ ответа
  async analyzeResponse(response: string, context: PromptContext): Promise<ResponseAnalysis> {
    const analysis: ResponseAnalysis = {
      emotion: 'neutral',
      intent: 'response',
      keywords: [],
      sentiment: 'neutral',
      quality: 0.5,
      confidence: 0.5,
      issues: [],
      suggestions: []
    }

    // Анализ эмоций
    analysis.emotion = this.detectEmotion(response)

    // Анализ намерения
    analysis.intent = this.detectIntent(response)

    // Извлечение ключевых слов
    analysis.keywords = this.extractKeywords(response)

    // Анализ тональности
    analysis.sentiment = this.analyzeSentiment(response)

    // Оценка качества
    analysis.quality = this.assessQuality(response, context)

    // Оценка уверенности
    analysis.confidence = this.assessConfidence(response, context)

    // Выявление проблем
    analysis.issues = this.identifyIssues(response, context)

    // Предложения по улучшению
    analysis.suggestions = this.generateSuggestions(response, context, analysis)

    return analysis
  }

  // Валидация ответа
  async validateResponse(response: string, context: PromptContext): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 1.0

    // Проверка длины
    if (response.length < this.MIN_RESPONSE_LENGTH) {
      errors.push('Ответ слишком короткий')
      score -= 0.3
    }

    if (response.length > this.MAX_RESPONSE_LENGTH) {
      warnings.push('Ответ слишком длинный')
      score -= 0.1
    }

    // Проверка на пустоту
    if (!response.trim()) {
      errors.push('Ответ пустой')
      score = 0
    }

    // Проверка на повторяющиеся символы
    if (this.hasRepeatingCharacters(response)) {
      warnings.push('Обнаружены повторяющиеся символы')
      score -= 0.1
    }

    // Проверка на недопустимые слова
    const inappropriateWords = this.checkInappropriateContent(response)
    if (inappropriateWords.length > 0) {
      errors.push(`Недопустимый контент: ${inappropriateWords.join(', ')}`)
      score -= 0.5
    }

    // Проверка на упоминание ИИ/игры
    if (this.mentionsAIOrGame(response)) {
      warnings.push('Ответ упоминает ИИ или игру')
      score -= 0.2
    }

    // Проверка соответствия контексту
    if (!this.matchesContext(response, context)) {
      warnings.push('Ответ не соответствует контексту')
      score -= 0.1
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    }
  }

  // Улучшение ответа
  async enhanceResponse(response: string, context: PromptContext): Promise<string> {
    let enhanced = response

    // Убираем лишние пробелы и переносы
    enhanced = enhanced.replace(/\s+/g, ' ').trim()

    // Убираем повторяющиеся символы
    enhanced = this.removeRepeatingCharacters(enhanced)

    // Убираем упоминания ИИ/игры
    enhanced = this.removeAIGameMentions(enhanced)

    // Улучшаем естественность
    enhanced = this.improveNaturalness(enhanced)

    // Обрезаем если слишком длинный
    if (enhanced.length > this.MAX_RESPONSE_LENGTH) {
      enhanced = this.truncateResponse(enhanced)
    }

    return enhanced
  }

  // Оценка качества ответа
  async getResponseQuality(response: string, context: PromptContext): Promise<number> {
    const analysis = await this.analyzeResponse(response, context)
    return analysis.quality
  }

  // Анализ сообщения пользователя
  private async analyzeUserMessage(message: string): Promise<ChatMessageMetadata> {
    return {
      emotion: this.detectEmotion(message),
      intent: this.detectIntent(message),
      keywords: this.extractKeywords(message),
      sentiment: this.analyzeSentiment(message),
      responseTime: 0,
      quality: 1.0
    }
  }

  // Генерация сырого ответа (заглушка для AI API)
  private async generateRawResponse(
    userMessage: string,
    context: PromptContext,
    messageAnalysis: ChatMessageMetadata
  ): Promise<string> {
    try {
      // Получаем API ключ из переменных окружения
      const apiKey = process.env.OPENROUTER_API_KEY
      const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
      const model = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324'

      if (!apiKey) {
        console.error('OpenRouter API key not configured')
        return this.generateFallbackResponse(userMessage, context)
      }

      // Строим промпт для AI
      const systemPrompt = this.buildSystemPrompt(context)
      const userPrompt = this.buildUserPrompt(userMessage, context)

      // Логируем системный промпт для отладки
      serverLogger.debug(LogCategory.AI, 'Системный промпт для AI', {
        systemPrompt,
        characterId: context.characterId,
        userId: context.userId
      })

      // Вызываем AI API
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'CyberJack v2'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 500,
          temperature: 0.8,
          top_p: 0.9
        })
      })

      if (!response.ok) {
        console.error('AI API error:', response.status, response.statusText)
        return this.generateFallbackResponse(userMessage, context)
      }

      const data = await response.json()
      const aiResponse = data.choices?.[0]?.message?.content

      if (!aiResponse) {
        console.error('No response from AI API')
        return this.generateFallbackResponse(userMessage, context)
      }

      return aiResponse.trim()
    } catch (error) {
      console.error('Error calling AI API:', error)
      return this.generateFallbackResponse(userMessage, context)
    }
  }

  private buildSystemPrompt(context: PromptContext): string {
    const character = context.character
    const environment = context.environment

    // Логируем начало построения промпта
    serverLogger.info(LogCategory.AI, 'Начинаем построение системного промпта', {
      characterId: context.characterId,
      characterName: character.name,
      userId: context.userId,
      characteristicsCount: context.characteristics?.length || 0,
      hasMemory: !!context.memory,
      hasCurrentPose: !!context.currentPose,
      hasLastAction: !!context.lastAction
    })

    // Создаем интерпретацию характеристик
    const characteristicSummary = this.characteristicInterpreter.createCharacteristicSummary(
      context.characteristics?.map(c => ({
        name: c.name,
        category: c.category || 'Неизвестно',
        description: c.description,
        currentValue: c.currentValue,
        baseValue: c.baseValue,
        recentChange: c.recentChange
      })) || []
    )

    // Получаем ощущения от изменений характеристик
    const characteristicSensations = this.characteristicInterpreter.interpretCharacteristicChangesAsSensations(
      context.characteristics?.map(c => ({
        name: c.name,
        category: c.category || 'Неизвестно',
        currentValue: c.currentValue,
        baseValue: c.baseValue,
        recentChange: c.recentChange
      })) || []
    )

    // Начинаем с глобального системного промпта
    let prompt = getGlobalSystemPromptShort() + '\n\n'

    prompt += `Ты ${character.name}, ${character.description || 'персонаж в игре'}.

Твое текущее состояние:
- Эмоциональное состояние: ${characteristicSummary.emotionalState}
- Общее настроение: ${characteristicSummary.overallMood}

${characteristicSummary.dominantTraits.length > 0 ? `
Топ-5 характеристик с максимальными значениями:
${characteristicSummary.dominantTraits.map(trait => `- ${trait.name}: ${trait.interpretation}`).join('\n')}
` : ''}

${characteristicSensations.length > 0 ? `
Ты чувствуешь изменения в своем состоянии:
${characteristicSensations.map(sensation => `- ${sensation}`).join('\n')}
` : ''}

${characteristicSummary.behaviorGuidance && characteristicSummary.behaviorGuidance !== 'Поведение в пределах нормы' ? `
Поведенческие особенности:
${characteristicSummary.behaviorGuidance}
` : ''}

Текущая локация: ${environment?.location || 'неизвестно'}
Время: ${environment?.timeOfDay || 'неизвестно'}`

    // Добавляем информацию о текущей позе
    if (context.currentPose) {
      prompt += `

Текущая поза: ${context.currentPose.name}
Ракурс: ${context.currentPose.currentAngle}
Описание позы: ${context.currentPose.description || 'Нет описания'}`
    }

    // Добавляем информацию о последнем действии
    if (context.lastAction) {
      prompt += `

Последнее действие: ${context.lastAction.actionName}
Интенсивность: ${context.lastAction.intensity}
Длительность: ${context.lastAction.duration} секунд
Время выполнения: ${new Date(context.lastAction.timestamp).toLocaleString('ru-RU')}`
    }

    // Добавляем информацию о памяти персонажа
    if (context.memory) {
      const recentMemories = context.memory.recent || []
      const shortTermMemories = context.memory.shortTerm || []
      const longTermMemories = context.memory.longTerm || []
      const contextualMemories = context.memory.contextual || []

      // Логируем информацию о памяти
      serverLogger.debug(LogCategory.AI, 'Обрабатываем память персонажа', {
        characterId: context.characterId,
        recentMemoriesCount: recentMemories.length,
        shortTermMemoriesCount: shortTermMemories.length,
        longTermMemoriesCount: longTermMemories.length,
        contextualMemoriesCount: contextualMemories.length,
        totalMemories: recentMemories.length + shortTermMemories.length + longTermMemories.length + contextualMemories.length
      })

      if (recentMemories.length > 0 || shortTermMemories.length > 0) {
        prompt += `

Память о последних событиях:`

        // Добавляем последние воспоминания (максимум 3)
        const allRecentMemories = [...recentMemories, ...shortTermMemories]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 3)

        allRecentMemories.forEach(memory => {
          prompt += `
- ${memory.content}`
        })

        // Логируем какие воспоминания добавлены в промпт
        serverLogger.debug(LogCategory.AI, 'Добавлены воспоминания в промпт', {
          characterId: context.characterId,
          memoriesAdded: allRecentMemories.map(m => ({
            content: m.content.substring(0, 100) + '...',
            timestamp: m.timestamp,
            type: m.type
          }))
        })
      }
    }

    // Добавляем историю сессии и контекст диалога
    if (context.sessionHistory && context.sessionHistory.length > 0) {
      prompt += `

Последние сообщения в чате:`
      context.sessionHistory.slice(-3).forEach(msg => {
        const speaker = msg.isUser ? 'Пользователь' : character.name
        prompt += `\n${speaker}: ${msg.content}`
      })
    }

    // Добавляем информацию о недавних изменениях характеристик (только если есть значительные изменения)
    if (characteristicSensations.length > 0) {
      prompt += `

Ты чувствуешь изменения в своем состоянии:`
      characteristicSensations.forEach(sensation => {
        prompt += `\n- ${sensation}`
      })
    }

    prompt += `

Твоя личность: Загадочная и интригующая

Отвечай кратко, естественно, в характере персонажа. Учитывай текущую позу и последние действия.`

    // Логируем финальный промпт
    serverLogger.info(LogCategory.AI, 'Системный промпт построен', {
      characterId: context.characterId,
      promptLength: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4),
      hasMemory: !!context.memory,
      hasCurrentPose: !!context.currentPose,
      hasLastAction: !!context.lastAction,
      hasSessionHistory: !!context.sessionHistory && context.sessionHistory.length > 0
    })

    return prompt
  }

  private buildUserPrompt(userMessage: string, context: PromptContext): string {
    return `Пользователь говорит: "${userMessage}"

Ответь как ${context.character.name}:`
  }

  // Fallback ответ
  private generateFallbackResponse(userMessage: string, context: PromptContext): string {
    const fallbacks = [
      "Извини, я не совсем понимаю...",
      "Можешь повторить?",
      "Я слушаю...",
      "Расскажи еще...",
      "Интересно..."
    ]

    return fallbacks[Math.floor(Math.random() * fallbacks.length)]
  }

  // Детекция эмоций
  private detectEmotion(text: string): string {
    const emotions = {
      happy: ['радость', 'счастье', 'веселье', 'улыбка', 'смех', 'рад', 'счастлив'],
      sad: ['грусть', 'печаль', 'тоска', 'грустно', 'печально', 'плач'],
      angry: ['злость', 'гнев', 'ярость', 'злой', 'сердитый', 'бешенство'],
      fear: ['страх', 'боязнь', 'испуг', 'боюсь', 'страшно', 'ужас'],
      surprise: ['удивление', 'шок', 'неожиданно', 'удивительно', 'внезапно'],
      love: ['любовь', 'люблю', 'обожаю', 'привязанность', 'нежность'],
      neutral: ['нормально', 'обычно', 'так себе', 'ничего особенного']
    }

    const lowerText = text.toLowerCase()

    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return emotion
      }
    }

    return 'neutral'
  }

  // Детекция намерения
  private detectIntent(text: string): string {
    const intents = {
      question: ['?', 'что', 'как', 'почему', 'когда', 'где', 'кто'],
      request: ['пожалуйста', 'можно', 'дай', 'покажи', 'сделай'],
      greeting: ['привет', 'здравствуй', 'добро пожаловать', 'hi', 'hello'],
      goodbye: ['пока', 'до свидания', 'увидимся', 'bye', 'goodbye'],
      compliment: ['красиво', 'хорошо', 'отлично', 'молодец', 'умница'],
      complaint: ['плохо', 'ужасно', 'не нравится', 'не люблю', 'ненавижу'],
      story: ['расскажи', 'история', 'было', 'случилось', 'произошло']
    }

    const lowerText = text.toLowerCase()

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return intent
      }
    }

    return 'statement'
  }

  // Извлечение ключевых слов
  private extractKeywords(text: string): string[] {
    // Простое извлечение ключевых слов
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)

    // Убираем стоп-слова
    const stopWords = ['это', 'что', 'как', 'где', 'когда', 'почему', 'кто', 'который', 'которая', 'которое']
    const keywords = words.filter(word => !stopWords.includes(word))

    // Возвращаем уникальные ключевые слова
    return [...new Set(keywords)].slice(0, 10)
  }

  // Анализ тональности
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['хорошо', 'отлично', 'прекрасно', 'замечательно', 'люблю', 'нравится', 'рад', 'счастлив']
    const negativeWords = ['плохо', 'ужасно', 'ненавижу', 'не нравится', 'грустно', 'злой', 'сердитый']

    const lowerText = text.toLowerCase()

    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  // Оценка качества
  private assessQuality(response: string, context: PromptContext): number {
    let quality = 0.5

    // Длина ответа
    if (response.length >= this.MIN_RESPONSE_LENGTH && response.length <= this.MAX_RESPONSE_LENGTH) {
      quality += 0.2
    }

    // Естественность
    if (this.isNatural(response)) {
      quality += 0.2
    }

    // Соответствие контексту
    if (this.matchesContext(response, context)) {
      quality += 0.1
    }

    // Отсутствие проблем
    if (!this.hasIssues(response)) {
      quality += 0.1
    }

    return Math.min(1.0, quality)
  }

  // Оценка уверенности
  private assessConfidence(response: string, context: PromptContext): number {
    let confidence = 0.5

    // Длина ответа
    if (response.length > 20) {
      confidence += 0.1
    }

    // Наличие ключевых слов
    const keywords = this.extractKeywords(response)
    if (keywords.length > 0) {
      confidence += 0.1
    }

    // Естественность
    if (this.isNatural(response)) {
      confidence += 0.2
    }

    // Отсутствие неопределенности
    if (!this.hasUncertainty(response)) {
      confidence += 0.1
    }

    return Math.min(1.0, confidence)
  }

  // Выявление проблем
  private identifyIssues(response: string, context: PromptContext): string[] {
    const issues: string[] = []

    if (response.length < this.MIN_RESPONSE_LENGTH) {
      issues.push('Слишком короткий ответ')
    }

    if (response.length > this.MAX_RESPONSE_LENGTH) {
      issues.push('Слишком длинный ответ')
    }

    if (this.hasRepeatingCharacters(response)) {
      issues.push('Повторяющиеся символы')
    }

    if (this.mentionsAIOrGame(response)) {
      issues.push('Упоминание ИИ или игры')
    }

    if (!this.matchesContext(response, context)) {
      issues.push('Не соответствует контексту')
    }

    return issues
  }

  // Генерация предложений
  private generateSuggestions(
    response: string,
    context: PromptContext,
    analysis: ResponseAnalysis
  ): string[] {
    const suggestions: string[] = []

    if (response.length < this.MIN_RESPONSE_LENGTH) {
      suggestions.push('Добавь больше деталей к ответу')
    }

    if (response.length > this.MAX_RESPONSE_LENGTH) {
      suggestions.push('Сократи ответ')
    }

    if (analysis.quality < this.QUALITY_THRESHOLD) {
      suggestions.push('Улучши качество ответа')
    }

    if (analysis.confidence < this.CONFIDENCE_THRESHOLD) {
      suggestions.push('Будь более уверенным в ответе')
    }

    if (this.mentionsAIOrGame(response)) {
      suggestions.push('Убери упоминания ИИ или игры')
    }

    return suggestions
  }

  // Проверка на повторяющиеся символы
  private hasRepeatingCharacters(text: string): boolean {
    return /(.)\1{3,}/.test(text)
  }

  // Удаление повторяющихся символов
  private removeRepeatingCharacters(text: string): string {
    return text.replace(/(.)\1{2,}/g, '$1$1')
  }

  // Проверка на недопустимый контент
  private checkInappropriateContent(text: string): string[] {
    const inappropriateWords = ['игра', 'ии', 'бот', 'программа', 'алгоритм']
    const foundWords: string[] = []

    const lowerText = text.toLowerCase()
    inappropriateWords.forEach(word => {
      if (lowerText.includes(word)) {
        foundWords.push(word)
      }
    })

    return foundWords
  }

  // Проверка на упоминание ИИ/игры
  private mentionsAIOrGame(text: string): boolean {
    const aiGameWords = ['игра', 'ии', 'бот', 'программа', 'алгоритм', 'искусственный интеллект']
    const lowerText = text.toLowerCase()
    return aiGameWords.some(word => lowerText.includes(word))
  }

  // Удаление упоминаний ИИ/игры
  private removeAIGameMentions(text: string): string {
    const aiGameWords = ['игра', 'ии', 'бот', 'программа', 'алгоритм', 'искусственный интеллект']
    let cleaned = text

    aiGameWords.forEach(word => {
      const regex = new RegExp(word, 'gi')
      cleaned = cleaned.replace(regex, '')
    })

    return cleaned.replace(/\s+/g, ' ').trim()
  }

  // Проверка соответствия контексту
  private matchesContext(response: string, context: PromptContext): boolean {
    // Простая проверка - есть ли ключевые слова из контекста в ответе
    const contextKeywords = [
      ...context.characteristics.map(c => c.name.toLowerCase()),
      ...context.memory.shortTerm.map(m => m.content.toLowerCase()),
      ...context.memory.longTerm.map(m => m.content.toLowerCase())
    ].flat()

    const responseLower = response.toLowerCase()
    return contextKeywords.some(keyword => responseLower.includes(keyword))
  }

  // Проверка естественности
  private isNatural(text: string): boolean {
    // Проверяем на наличие естественных слов и фраз
    const naturalPatterns = [
      /\b(да|нет|хорошо|понятно|конечно|возможно)\b/i,
      /\b(я|ты|мы|он|она|они)\b/i,
      /\b(это|то|вот|тут|там)\b/i
    ]

    return naturalPatterns.some(pattern => pattern.test(text))
  }

  // Проверка на наличие проблем
  private hasIssues(text: string): boolean {
    return this.hasRepeatingCharacters(text) ||
           this.mentionsAIOrGame(text) ||
           text.length < this.MIN_RESPONSE_LENGTH
  }

  // Проверка на неопределенность
  private hasUncertainty(text: string): boolean {
    const uncertaintyWords = ['возможно', 'может быть', 'наверное', 'кажется', 'думаю', 'не знаю']
    const lowerText = text.toLowerCase()
    return uncertaintyWords.some(word => lowerText.includes(word))
  }

  // Улучшение естественности
  private improveNaturalness(text: string): string {
    let improved = text

    // Добавляем естественные междометия
    if (!improved.match(/^(да|нет|хорошо|понятно|конечно)/i)) {
      const interjections = ['Хм...', 'Да...', 'Понятно...', 'Хорошо...']
      improved = interjections[Math.floor(Math.random() * interjections.length)] + ' ' + improved
    }

    return improved
  }

  // Обрезка ответа
  private truncateResponse(text: string): string {
    if (text.length <= this.MAX_RESPONSE_LENGTH) {
      return text
    }

    // Обрезаем до последнего полного предложения
    const truncated = text.substring(0, this.MAX_RESPONSE_LENGTH)
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    )

    if (lastSentenceEnd > this.MAX_RESPONSE_LENGTH * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1)
    }

    return truncated + '...'
  }

  // Оценка количества токенов
  private estimateTokens(text: string): number {
    // Примерная оценка: 1 токен ≈ 4 символа
    return Math.ceil(text.length / 4)
  }

  // Расчет стоимости
  private calculateCost(text: string): number {
    const tokens = this.estimateTokens(text)
    // Примерная стоимость: $0.0001 за токен
    return tokens * 0.0001
  }
}
