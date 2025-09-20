// lib/character/ai-service.ts

import { prisma } from '../db/client'
import { CharacterContext } from '../../types/game'
import { PromptSystem } from './prompt-system'
import { CharacterMemoryManager } from './memory-manager'
import { CharacterResponseManager } from './response-manager'
import { EnhancedMessageAnalyzer } from './enhanced-message-analyzer'
import { ActionMessageSystemManager } from './action-message-system'
import { ActivePosesSystem } from '../core/poses/active-poses-system'
import { serverLogger, LogCategory } from '../utils/server-logger'
import {
  CharacterAIService as ICharacterAIService,
  AIResponse,
  MessageAnalysis,
  PromptContext,
  CharacterAIConfig,
  CharacterAIMetrics,
  PoseCommand
} from '../../types/character-ai'

export class CharacterAIService implements ICharacterAIService {
  private openRouterApiKey: string
  private baseUrl: string
  private model: string
  private model2: string
  private config: CharacterAIConfig
  private promptSystem: PromptSystem
  private memoryManager: CharacterMemoryManager
  private responseManager: CharacterResponseManager
  private messageAnalyzer: EnhancedMessageAnalyzer
  private actionMessageSystem: ActionMessageSystemManager
  private activePosesSystem: ActivePosesSystem
  private metrics: CharacterAIMetrics
  // Кэши для оптимизации производительности
  private promptCache: Map<string, { prompt: string, timestamp: number, ttl: number }> = new Map()
  private contextCache: Map<string, { context: PromptContext, timestamp: number, ttl: number }> = new Map()
  private analysisCache: Map<string, { analysis: MessageAnalysis, timestamp: number, ttl: number }> = new Map()

  constructor(apiKey: string, baseUrl?: string, model?: string, model2?: string) {
    this.openRouterApiKey = apiKey
    this.baseUrl = baseUrl || 'https://openrouter.ai/api/v1'
    this.model = model || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324'
    this.model2 = model2 || process.env.OPENROUTER_MODEL_2 || 'google/gemini-2.5-flash-lite'

    this.config = {
      model: this.model,
      model2: this.model2,
      maxTokens: 500,
      temperature: 0.8,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
      maxMemoryItems: 1000,
      memoryRetentionDays: 30,
      responseQualityThreshold: 0.6,
      enableResponseAnalysis: true,
      enableMemoryManagement: true,
      enablePromptOptimization: true
    }

    this.promptSystem = new PromptSystem()
    this.memoryManager = new CharacterMemoryManager()
    this.responseManager = new CharacterResponseManager()

    try {
      console.log('🚀 Пытаемся инициализировать EnhancedMessageAnalyzer...')
      this.messageAnalyzer = new EnhancedMessageAnalyzer()
      console.log('✅ EnhancedMessageAnalyzer успешно инициализирован!')
      console.log('🔍 Проверяем методы анализатора:', {
        hasAnalyzeMessage: typeof this.messageAnalyzer.analyzeMessage === 'function',
        hasAnalyzePoseCommands: typeof (this.messageAnalyzer as any).analyzePoseCommands === 'function'
      })
    } catch (error) {
      console.error('❌ Ошибка при инициализации EnhancedMessageAnalyzer:', error)
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace')

      // Создаем fallback анализатор с базовой функциональностью
      this.messageAnalyzer = this.createFallbackAnalyzer()
      console.log('⚠️ Создан fallback анализатор для анализа сообщений')
    }

    this.actionMessageSystem = new ActionMessageSystemManager(this)
    this.activePosesSystem = new ActivePosesSystem()

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      averageQuality: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      mostUsedTemplates: [],
      errorRate: 0,
      lastUpdated: new Date()
    }

    // Запускаем периодическую очистку кэша
    this.startCacheCleanup()
  }

  // Запуск периодической очистки кэша
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCache()
    }, 60000) // Очистка каждую минуту
  }

  // Очистка устаревших записей кэша
  private cleanupExpiredCache(): void {
    const now = Date.now()

    // Очистка кэша промптов
    for (const [key, value] of this.promptCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.promptCache.delete(key)
      }
    }

    // Очистка кэша контекста
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.contextCache.delete(key)
      }
    }

    // Очистка кэша анализа
    for (const [key, value] of this.analysisCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.analysisCache.delete(key)
      }
    }
  }

  // Получение промпта из кэша или создание нового
  private async getCachedPrompt(characterId: string, userId: string, context: Partial<PromptContext>): Promise<string> {
    const cacheKey = `${characterId}-${userId}-${JSON.stringify(context)}`
    const cached = this.promptCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      serverLogger.debug(LogCategory.AI, 'Используем кэшированный промпт', {
        characterId,
        userId,
        cacheKey,
        age: Date.now() - cached.timestamp
      })
      return cached.prompt
    }

    // Создаем новый промпт
    const fullContext = await this.getCharacterContextWithDynamicPrompts(characterId, userId, context)
    const prompt = await this.promptSystem.buildPrompt(fullContext)

    // Сохраняем в кэш (TTL 5 минут)
    this.promptCache.set(cacheKey, {
      prompt,
      timestamp: Date.now(),
      ttl: 300000 // 5 минут
    })

    serverLogger.debug(LogCategory.AI, 'Создан и закэширован новый промпт', {
      characterId,
      userId,
      promptLength: prompt.length
    })

    return prompt
  }

  // Получение анализа из кэша или создание нового
  private async getCachedAnalysis(userMessage: string, characterId: string, userId: string): Promise<MessageAnalysis> {
    const cacheKey = `${characterId}-${userId}-${userMessage.toLowerCase().slice(0, 100)}`
    const cached = this.analysisCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      serverLogger.debug(LogCategory.AI, 'Используем кэшированный анализ', {
        characterId,
        userId,
        cacheKey,
        age: Date.now() - cached.timestamp
      })
      return cached.analysis
    }

    // Создаем новый анализ
    const analysis = await this.messageAnalyzer.analyzeMessage(userMessage, characterId, userId)

    // Сохраняем в кэш (TTL 2 минуты)
    this.analysisCache.set(cacheKey, {
      analysis,
      timestamp: Date.now(),
      ttl: 120000 // 2 минуты
    })

    serverLogger.debug(LogCategory.AI, 'Создан и закэширован новый анализ', {
      characterId,
      userId,
      analysisKeys: Object.keys(analysis)
    })

    return analysis
  }

  // Создание fallback анализатора с базовой функциональностью
  private createFallbackAnalyzer(): any {
    return {
      analyzeMessage: async (userMessage: string, characterId: string, userId: string) => {
        console.log('🔄 Используем fallback анализ сообщения')

        // Базовый анализ без LLM
        const lowerMessage = userMessage.toLowerCase()

        // Простой анализ намерений
        let intent = 'statement'
        if (lowerMessage.includes('?')) intent = 'question'
        if (lowerMessage.includes('привет') || lowerMessage.includes('здравствуй')) intent = 'greeting'
        if (lowerMessage.includes('спасибо')) intent = 'compliment'

        // Простой анализ эмоций
        let emotion = 'neutral'
        if (lowerMessage.includes('хорошо') || lowerMessage.includes('отлично')) emotion = 'happy'
        if (lowerMessage.includes('плохо') || lowerMessage.includes('ужасно')) emotion = 'sad'
        if (lowerMessage.includes('злой') || lowerMessage.includes('сердитый')) emotion = 'angry'

        // Простой анализ тональности
        let sentiment = 'neutral'
        const positiveWords = ['хорошо', 'отлично', 'прекрасно', 'замечательно', 'спасибо']
        const negativeWords = ['плохо', 'ужасно', 'отвратительно', 'ненавижу']

        if (positiveWords.some(word => lowerMessage.includes(word))) sentiment = 'positive'
        if (negativeWords.some(word => lowerMessage.includes(word))) sentiment = 'negative'

        // Извлечение ключевых слов
        const keywords = userMessage.split(' ').filter(word =>
          word.length > 3 &&
          !['что', 'как', 'где', 'когда', 'почему', 'который', 'которая', 'которое'].includes(word.toLowerCase())
        ).slice(0, 5)

        // Простой анализ команд поз
        const poseCommands = []
        const poseKeywords = ['лечь', 'сесть', 'встать', 'встать на колени', 'раздеться', 'одеться']
        const foundPoseCommand = poseKeywords.find(keyword => lowerMessage.includes(keyword))
        if (foundPoseCommand) {
          poseCommands.push({
            command: foundPoseCommand,
            confidence: 0.8,
            reason: `Найдена команда позы: ${foundPoseCommand}`
          })
        }

        // Простой анализ фетиш-элементов
        const fetishElements = []
        const fetishKeywords = {
          'невинность': ['невинность', 'чистота', 'девственность'],
          'покорность': ['покорность', 'подчинение', 'послушание'],
          'чувствительность': ['чувствительность', 'нежность', 'мягкость']
        }

        for (const [fetishType, keywords] of Object.entries(fetishKeywords)) {
          const foundKeyword = keywords.find(keyword => lowerMessage.includes(keyword))
          if (foundKeyword) {
            fetishElements.push({
              type: fetishType,
              intensity: 0.6,
              confidence: 0.7
            })
          }
        }

        return {
          intent,
          emotion,
          keywords,
          sentiment,
          complexity: Math.min(10, Math.max(1, userMessage.split(' ').length / 5)),
          urgency: 5,
          requiresResponse: true,
          suggestedActions: [],
          poseCommands,
          characteristicInfluences: [],
          actionTriggers: [],
          fetishElements,
          moodChanges: []
        }
      }
    }
  }

  // Генерация ответа персонажа с анализом
  async generateResponse(
    characterId: string,
    userMessage: string,
    context: Partial<PromptContext>
  ): Promise<AIResponse> {
    const startTime = Date.now()
    this.metrics.totalRequests++

    try {
      // Получаем полный контекст с динамическими промптами (с кэшированием)
      const fullContext = await this.getCharacterContextWithDynamicPrompts(characterId, context.userId || '', context)

      // Анализируем сообщение пользователя с расширенным анализом (с кэшированием)
      serverLogger.info(LogCategory.AI, 'Начинаем анализ сообщения', {
        userMessage,
        characterId,
        userId: context.userId
      })

      console.log('🚀 Вызываем кэшированный анализ сообщения...', {
        userMessage,
        characterId,
        userId: context.userId || ''
      })

      const messageAnalysis = await this.getCachedAnalysis(
        userMessage,
        characterId,
        context.userId || ''
      )

      console.log('📊 Результат анализа от messageAnalyzer:', {
        poseCommandsCount: messageAnalysis.poseCommands.length,
        characteristicInfluencesCount: messageAnalysis.characteristicInfluences.length,
        actionTriggersCount: messageAnalysis.actionTriggers.length
      })

      serverLogger.debug(LogCategory.AI, 'Анализ сообщения завершен', {
        message: userMessage,
        characteristicInfluences: messageAnalysis.characteristicInfluences,
        poseCommands: messageAnalysis.poseCommands,
        actionTriggers: messageAnalysis.actionTriggers
      })

      // Обрабатываем результаты анализа сообщения
      serverLogger.info(LogCategory.AI, 'Вызываем processMessageAnalysis', {
        characterId,
        poseCommandsCount: messageAnalysis.poseCommands.length,
        characteristicInfluencesCount: messageAnalysis.characteristicInfluences.length
      })

      const characteristicChanges = await this.processMessageAnalysis(messageAnalysis, characterId, context.userId || '')

      serverLogger.info(LogCategory.AI, 'processMessageAnalysis завершена', {
        characterId,
        characteristicChangesCount: characteristicChanges.length
      })

      // Генерируем ответ через response manager
      const aiResponse = await this.responseManager.generateResponse(
        characterId,
        userMessage,
        fullContext
      )

      // Добавляем изменения характеристик в метаданные
      if (characteristicChanges.length > 0) {
        aiResponse.metadata = {
          ...aiResponse.metadata,
          characteristicChanges
        }
      }

      // Создаем воспоминание о взаимодействии (только один раз)
      if (this.config.enableMemoryManagement) {
        await this.memoryManager.createInteractionMemory(
          characterId,
          userMessage,
          aiResponse.message,
          fullContext.environment?.location || 'неизвестно'
        )
      }

      // Сохраняем ответ в чат
      await this.saveResponseToChat(characterId, userMessage, aiResponse.message, context.userId || '')

      // Обновляем метрики
      this.updateMetrics(aiResponse, Date.now() - startTime)

      return aiResponse
    } catch (error) {
      this.metrics.failedRequests++
      this.updateErrorRate()

      console.error('Ошибка при генерации ответа:', error)
      serverLogger.error(LogCategory.AI, 'Ошибка при генерации ответа', {
        characterId,
        userId: context.userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        stack: error instanceof Error ? error.stack : undefined
      })

      // Graceful degradation - возвращаем контекстный ответ вместо общей ошибки
      return this.generateFallbackResponse(userMessage, characterId, context, startTime)
    }
  }

  // Генерация fallback ответа при ошибках
  private generateFallbackResponse(
    userMessage: string,
    characterId: string,
    context: Partial<PromptContext>,
    startTime: number
  ): AIResponse {
    // Простой анализ сообщения для контекстного ответа
    const lowerMessage = userMessage.toLowerCase()
    let fallbackMessage = 'Поняла...'

    // Контекстные ответы в зависимости от содержания
    if (lowerMessage.includes('привет') || lowerMessage.includes('здравствуй')) {
      fallbackMessage = 'Привет...'
    } else if (lowerMessage.includes('?')) {
      fallbackMessage = 'Хм, интересный вопрос...'
    } else if (lowerMessage.includes('спасибо')) {
      fallbackMessage = 'Пожалуйста...'
    } else if (lowerMessage.includes('лечь') || lowerMessage.includes('сесть')) {
      fallbackMessage = 'Хорошо...'
    } else if (lowerMessage.includes('встать')) {
      fallbackMessage = 'Поняла, встаю...'
    } else if (lowerMessage.includes('раздеться')) {
      fallbackMessage = 'Хорошо...'
    } else if (lowerMessage.includes('одеться')) {
      fallbackMessage = 'Конечно...'
    } else if (lowerMessage.includes('хорошо') || lowerMessage.includes('отлично')) {
      fallbackMessage = 'Спасибо...'
    } else if (lowerMessage.includes('плохо') || lowerMessage.includes('ужасно')) {
      fallbackMessage = 'Извините...'
    }

    serverLogger.info(LogCategory.AI, 'Сгенерирован fallback ответ', {
      characterId,
      userId: context.userId,
      userMessage: userMessage.slice(0, 100),
      fallbackMessage
    })

    return {
      message: fallbackMessage,
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


  // Генерация ответа персонажа без анализа (для системных сообщений)
  async generateResponseWithoutAnalysis(
    characterId: string,
    userMessage: string,
    context: Partial<PromptContext>
  ): Promise<AIResponse> {
    const startTime = Date.now()
    this.metrics.totalRequests++

    try {
      // Получаем полный контекст с динамическими промптами
      const fullContext = await this.getCharacterContextWithDynamicPrompts(characterId, context.userId || '', context)

      // НЕ анализируем сообщение - это системное сообщение

      // Генерируем ответ через response manager
      const aiResponse = await this.responseManager.generateResponse(
        characterId,
        userMessage,
        fullContext
      )

      // Сохраняем ответ в чат
      await this.saveResponseToChat(characterId, userMessage, aiResponse.message, context.userId || '')

      // Обновляем метрики
      this.metrics.totalResponses++
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (this.metrics.totalResponses - 1) + aiResponse.metadata.responseTime) /
        this.metrics.totalResponses

      return aiResponse
    } catch (error) {
      this.metrics.errorRate = (this.metrics.errorRate * this.metrics.totalRequests + 1) / this.metrics.totalRequests
      console.error('Ошибка при генерации ответа:', error)

      return {
        message: 'Извините, произошла ошибка при генерации ответа.',
        characterId,
        timestamp: new Date(),
        metadata: {
          emotion: 'neutral',
          intent: 'error',
          keywords: [],
          sentiment: 'neutral',
          responseTime: Date.now() - startTime,
          quality: 0.1,
          confidence: 0.1,
          tokensUsed: 0,
          cost: 0
        }
      }
    }
  }

  // Получить боевую копию персонажа пользователя
  private async getCharacterCopy(characterId: string, userId: string) {
    const characterCopy = await prisma.characterCopy.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId
        }
      },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        },
        character: {
          include: {
            anatomy: {
              include: {
                definition: true
              }
            },
            poses: {
              include: {
                definition: true,
                angles: {
                  include: {
                    zones: {
                      include: {
                        anatomy: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!characterCopy) {
      throw new Error('Персональная копия персонажа не найдена')
    }

    return characterCopy
  }

  // Получить контекст персонажа
  async getCharacterContext(characterId: string, userId: string, gameContext?: any): Promise<PromptContext> {
    const characterCopy = await this.getCharacterCopy(characterId, userId)
    const baseCharacter = characterCopy.character
    const user = await this.getUser(userId)

    const characteristicNameMap = new Map<string, { name: string; category: string }>()

    for (const char of characterCopy.characteristics) {
      characteristicNameMap.set(char.characteristicDefId, {
        name: char.definition.name,
        category: char.definition.category
      })
    }

    const characteristics = characterCopy.characteristics.map(char => ({
      id: char.id,
      name: char.definition.name,
      category: char.definition.category,
      currentValue: char.currentValue,
      baseValue: char.baseValue,
      isRevealed: true,
      revealedValue: char.currentValue,
      accuracy: 100
    }))

    const memory = await this.memoryManager.getMemoryContext(characterId)

    let poseContext: any = undefined
    const copySettings = characterCopy.settings as Record<string, any> | null

    if (typeof copySettings?.currentPose === 'string') {
      const currentPoseId = copySettings.currentPose as string
      const userPose = await prisma.characterPose.findUnique({
        where: { id: currentPoseId },
        include: {
          definition: true,
          angles: {
            include: {
              zones: {
                include: {
                  anatomy: true
                }
              }
            }
          }
        }
      })

      if (userPose) {
        const currentAngleId = typeof copySettings?.currentAngle === 'string' ? (copySettings.currentAngle as string) : undefined
        const currentAngle = userPose.angles.find(angle => angle.id === currentAngleId) || userPose.angles[0]

        poseContext = {
          id: userPose.id,
          name: userPose.definition.name,
          category: userPose.definition.category,
          description: userPose.definition.description,
          currentAngle: currentAngle?.name || 'default',
          activeZones: currentAngle?.zones.map(zone => ({
            id: zone.id,
            name: zone.name,
            anatomyId: zone.anatomyDefId,
            anatomyName: zone.anatomy?.name,
            sensitivity: 50, // TODO: Добавить чувствительность в схему
            isActive: true
          })) || []
        }
      }
    }

    if (!poseContext) {
      serverLogger.debug(LogCategory.AI, 'Ищем активную позу персонажа', {
        characterId,
        totalPoses: baseCharacter.poses.length,
        activePoses: baseCharacter.poses.filter(pose => pose.isActive).length
      })

      let currentPose = baseCharacter.poses.find(pose => pose.isActive && pose.definition.name === 'Стоя')
      if (!currentPose) {
        currentPose = baseCharacter.poses.find(pose => pose.isActive)
      }
      if (currentPose) {
        serverLogger.debug(LogCategory.AI, 'Найдена активная поза', {
          characterId,
          poseId: currentPose.id,
          poseName: currentPose.definition.name,
          anglesCount: currentPose.angles.length
        })

        poseContext = {
          id: currentPose.id,
          name: currentPose.definition.name,
          category: currentPose.definition.category,
          description: currentPose.definition.description,
          currentAngle: currentPose.angles[0]?.name || 'default',
          activeZones: currentPose.angles[0]?.zones.map(zone => ({
            id: zone.id,
            name: zone.name,
            anatomyId: zone.anatomyDefId,
            anatomyName: zone.anatomy?.name,
            sensitivity: 50, // TODO: Добавить чувствительность в схему
            isActive: true
          })) || []
        }
      } else {
        serverLogger.warn(LogCategory.AI, 'Не найдена активная поза', {
          characterId,
          totalPoses: baseCharacter.poses.length,
          poses: baseCharacter.poses.map(p => ({ id: p.id, name: p.definition.name, isActive: p.isActive }))
        })
      }
    }

    const lastAction = await this.getLastAction(characterId, userId, characteristicNameMap)
    const sessionHistory = await this.getSessionHistory(characterId, userId)

    const environment = {
      timeOfDay: 'день',
      location: 'комната',
      atmosphere: 'интимная',
      temperature: 'комфортная',
      lighting: 'приглушенная',
      sounds: ['тишина'],
      smells: ['легкий аромат']
    }

    return {
      characterId,
      userId,
      message: '',
      character: {
        id: baseCharacter.id,
        name: baseCharacter.name,
        description: baseCharacter.description || undefined,
        age: baseCharacter.age || undefined,
        avatar: baseCharacter.avatar || undefined
      },
      characteristics,
      memory,
      currentPose: poseContext,
      lastAction,
      userModifiers: (user?.modifiers as Record<string, number>) || {},
      gameTime: Date.now(),
      sessionHistory,
      environment
    }
  }

  // Получить контекст персонажа с динамическими промптами
  async getCharacterContextWithDynamicPrompts(characterId: string, userId: string, gameContext?: any): Promise<PromptContext> {
    const context = await this.getCharacterContext(characterId, userId, gameContext)

    // Создаем динамические промпты на основе текущего состояния
    if (this.config.enablePromptOptimization) {
      try {
        // Анализируем характеристики для определения контекста
        const avgValue = context.characteristics.reduce((sum, char) => sum + char.currentValue, 0) / context.characteristics.length
        let characteristicContext: 'high' | 'low' | 'extreme' | 'normal' = 'normal'

        if (avgValue >= 80) {
          characteristicContext = 'high'
        } else if (avgValue <= 30) {
          characteristicContext = 'low'
        } else if (avgValue >= 90 || avgValue <= 10) {
          characteristicContext = 'extreme'
        }

        // Создаем динамические промпты
        await this.promptSystem.createCharacteristicPrompt(characterId, characteristicContext)
        await this.promptSystem.createPosePrompt(characterId)
        await this.promptSystem.createCombinedPrompt(characterId, 'interaction')
      } catch (error) {
        console.warn('Ошибка при создании динамических промптов:', error)
      }
    }

    return context
  }

  // Получить пользователя
  private async getUser(userId: string) {
    if (!userId) return null

    return await prisma.user.findUnique({
      where: { id: userId }
    })
  }


  // Вызов OpenRouter API
  private async callOpenRouter(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CyberJack v2.0'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          frequency_penalty: this.config.frequencyPenalty,
          presence_penalty: this.config.presencePenalty
        })
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter API')
      }

      return data.choices[0]?.message?.content || 'Извините, я не могу ответить сейчас.'
    } catch (error) {
      console.error('Ошибка при вызове OpenRouter API:', error)
      return 'Извините, произошла ошибка при генерации ответа.'
    }
  }

  // Получить стоимость запроса
  async getRequestCost(prompt: string): Promise<number> {
    // Примерная стоимость: 1 кредит за 100 токенов
    const estimatedTokens = Math.ceil(prompt.length / 4) // примерная оценка
    return Math.ceil(estimatedTokens / 100)
  }

  // Проверить доступность API
  async checkApiHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  // Получить доступные модели
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch models')
      }

      const data = await response.json()
      return data.data?.map((model: any) => model.id) || []
    } catch (error) {
      console.error('Ошибка при получении моделей:', error)
      return []
    }
  }

  // Установить модель
  setModel(modelId: string): void {
    this.model = modelId
  }

  // Получить текущую модель
  getCurrentModel(): string {
    return this.model
  }

  // Заглушка для интерфейса - реальная функция в EnhancedMessageAnalyzer
  async analyzeMessage(userMessage: string): Promise<MessageAnalysis> {
    // Эта функция не должна вызываться - используется this.messageAnalyzer.analyzeMessage()
    throw new Error('Эта функция не должна вызываться напрямую. Используйте this.messageAnalyzer.analyzeMessage()')
  }

  // УДАЛЕНА: Старая функция analyzeMessage - теперь используется EnhancedMessageAnalyzer
  /*
  async analyzeMessageOld(userMessage: string): Promise<MessageAnalysis> {
    const analysisPrompt = `
Проанализируй следующее сообщение пользователя и верни JSON с анализом:

Сообщение: "${userMessage}"

Верни JSON в формате:
{
  "intent": "основное намерение пользователя",
  "emotion": "эмоциональное состояние",
  "keywords": ["ключевые", "слова"],
  "sentiment": "positive|negative|neutral",
  "complexity": 1-10,
  "urgency": 1-10,
  "requiresResponse": true/false,
  "suggestedActions": ["действие1", "действие2"]
}
    `.trim()

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CyberJack v2.0'
        },
        body: JSON.stringify({
          model: this.model2,
          messages: [
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 300,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('No response from analysis API')
      }

      // Пытаемся распарсить JSON
      try {
        const parsed = JSON.parse(content)
        return {
          intent: parsed.intent || 'unknown',
          emotion: parsed.emotion || 'neutral',
          keywords: parsed.keywords || [],
          sentiment: parsed.sentiment || 'neutral',
          complexity: parsed.complexity || 5,
          urgency: parsed.urgency || 5,
          requiresResponse: parsed.requiresResponse !== false,
          suggestedActions: parsed.suggestedActions || [],
          poseCommands: [],
          characteristicInfluences: [],
          actionTriggers: [],
          fetishElements: [],
          moodChanges: []
        }
      } catch {
        // Если не удалось распарсить, попробуем найти JSON в markdown блоке
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1])
            return {
              intent: parsed.intent || 'unknown',
              emotion: parsed.emotion || 'neutral',
              keywords: parsed.keywords || [],
              sentiment: parsed.sentiment || 'neutral',
              complexity: parsed.complexity || 5,
              urgency: parsed.urgency || 5,
              requiresResponse: parsed.requiresResponse !== false,
              suggestedActions: parsed.suggestedActions || [],
              poseCommands: [],
              characteristicInfluences: [],
              actionTriggers: [],
              fetishElements: [],
              moodChanges: []
            }
          } catch {
            // Если и это не сработало, попробуем найти JSON без markdown
            const jsonMatch2 = content.match(/\{[\s\S]*\}/)
            if (jsonMatch2) {
              try {
                const parsed = JSON.parse(jsonMatch2[0])
                return {
                  intent: parsed.intent || 'unknown',
                  emotion: parsed.emotion || 'neutral',
                  keywords: parsed.keywords || [],
                  sentiment: parsed.sentiment || 'neutral',
                  complexity: parsed.complexity || 5,
                  urgency: parsed.urgency || 5,
                  requiresResponse: parsed.requiresResponse !== false,
                  suggestedActions: parsed.suggestedActions || [],
                  poseCommands: [],
                  characteristicInfluences: [],
                  actionTriggers: [],
                  fetishElements: [],
                  moodChanges: []
                }
              } catch {
                // Последняя попытка - вернуть дефолтные значения
              }
            }
          }
        }

        // Если ничего не сработало, возвращаем дефолтные значения
        return {
          intent: 'unknown',
          emotion: 'neutral',
          keywords: [],
          sentiment: 'neutral',
          complexity: 5,
          urgency: 5,
          requiresResponse: true,
          suggestedActions: [],
          poseCommands: [],
          characteristicInfluences: [],
          actionTriggers: [],
          fetishElements: [],
          moodChanges: []
        }
      }
    } catch (error) {
      console.error('Ошибка при анализе сообщения:', error)
      return {
        intent: 'unknown',
        emotion: 'neutral',
        keywords: [],
        sentiment: 'neutral',
        complexity: 5,
        urgency: 5,
        requiresResponse: true,
        suggestedActions: [],
        poseCommands: [],
        characteristicInfluences: [],
        actionTriggers: [],
        fetishElements: [],
        moodChanges: []
      }
    }
  }
  */

  // Получить память персонажа
  async getCharacterMemory(characterId: string, type?: any): Promise<any[]> {
    return await this.memoryManager.getMemory(characterId, type)
  }

  // Добавить воспоминание персонажа
  async addCharacterMemory(
    characterId: string,
    memory: Omit<any, 'id' | 'timestamp'>
  ): Promise<any> {
    return await this.memoryManager.addMemory(characterId, memory)
  }

  // Обновить промпты персонажа
  async updateCharacterPrompts(characterId: string, prompts: Record<string, any>): Promise<void> {
    await prisma.character.update({
      where: { id: characterId },
      data: { prompts }
    })
  }

  // Получить промпты персонажа
  async getCharacterPrompts(characterId: string): Promise<Record<string, any>> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { prompts: true }
    })

    return (character?.prompts as Record<string, any>) || {}
  }

  // Обновление метрик
  private updateMetrics(aiResponse: AIResponse, responseTime: number): void {
    this.metrics.successfulRequests++
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime) /
      this.metrics.successfulRequests
    this.metrics.averageQuality =
      (this.metrics.averageQuality * (this.metrics.successfulRequests - 1) + aiResponse.metadata.quality) /
      this.metrics.successfulRequests
    this.metrics.totalTokensUsed += aiResponse.metadata.tokensUsed
    this.metrics.totalCost += aiResponse.metadata.cost
    this.metrics.lastUpdated = new Date()
  }

  // Обновление процента ошибок
  private updateErrorRate(): void {
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests
  }

  // Получить метрики
  getMetrics(): CharacterAIMetrics {
    return { ...this.metrics }
  }

  // Сбросить метрики
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      averageQuality: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      mostUsedTemplates: [],
      errorRate: 0,
      lastUpdated: new Date()
    }
  }

  // Получить конфигурацию
  getConfig(): CharacterAIConfig {
    return { ...this.config }
  }

  // Обновить конфигурацию
  updateConfig(newConfig: Partial<CharacterAIConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Обработка результатов анализа сообщения
  private async processMessageAnalysis(
    analysis: MessageAnalysis,
    characterId: string,
    userId: string
  ): Promise<any[]> {
    const characteristicChanges: any[] = []

    try {
      serverLogger.info(LogCategory.AI, 'Начинаем обработку анализа сообщения', {
        characterId,
        poseCommandsCount: analysis.poseCommands.length,
        characteristicInfluencesCount: analysis.characteristicInfluences.length
      })

      // Обрабатываем команды поз - выполняем только команду с наивысшим confidence
      if (analysis.poseCommands.length > 0) {
        // Сортируем по confidence и берем только команды выше порога
        const validPoseCommands = analysis.poseCommands
          .filter(cmd => cmd.confidence > 0.5)
          .sort((a, b) => b.confidence - a.confidence)

        if (validPoseCommands.length > 0) {
          const bestPoseCommand = validPoseCommands[0]
          serverLogger.info(LogCategory.AI, 'Выполняем лучшую команду позы', {
            characterId,
            poseId: bestPoseCommand.poseId,
            poseKey: bestPoseCommand.poseKey,
            poseName: bestPoseCommand.poseName,
            confidence: bestPoseCommand.confidence,
            totalCommands: analysis.poseCommands.length,
            validCommands: validPoseCommands.length
          })
          await this.executePoseCommand(characterId, bestPoseCommand, userId)
        } else {
          serverLogger.info(LogCategory.AI, 'Нет команд поз выше порога', {
            characterId,
            totalCommands: analysis.poseCommands.length,
            threshold: 0.5
          })
        }
      }

      // Обрабатываем влияние на характеристики
      for (const influence of analysis.characteristicInfluences) {
        if (influence.confidence > 0.3) { // Понизили порог с 0.5 до 0.3
          const change = await this.applyCharacteristicInfluence(characterId, influence)
          if (change) {
            characteristicChanges.push(change)
          }
        }
      }

      // Обрабатываем триггеры действий
      for (const trigger of analysis.actionTriggers) {
        if (trigger.confidence > 0.6) {
          await this.executeActionTrigger(characterId, userId, trigger)
        }
      }

      // Обрабатываем изменения настроения
      for (const moodChange of analysis.moodChanges) {
        if (moodChange.confidence > 0.5) {
          await this.applyMoodChange(characterId, moodChange)
        }
      }

      // Создаем воспоминания о фетиш-элементах
      for (const fetish of analysis.fetishElements) {
        if (fetish.confidence > 0.4) {
          await this.memoryManager.createEmotionalMemory(
            characterId,
            fetish.type,
            `Фетиш-элемент: ${fetish.type}`,
            fetish.intensity
          )
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке анализа сообщения:', error)
    }

    return characteristicChanges
  }

  // Выполнение команды позы
  private async executePoseCommand(characterId: string, poseCommand: PoseCommand, userId: string): Promise<void> {
    try {
  // ...existing code...

      let characterPose = poseCommand.poseId
        ? await prisma.characterPose.findUnique({
            where: {
              characterId_poseDefId: {
                characterId,
                poseDefId: poseCommand.poseId
              }
            },
            include: {
              definition: true,
              angles: true
            }
          })
        : null

      let cachedPoses: any[] | null = null

  // ...existing code...
    } catch (error) {
      serverLogger.error(LogCategory.AI, 'Ошибка при выполнении команды позы', {
        characterId,
        poseCommand,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Применение влияния на характеристики
  private async applyCharacteristicInfluence(
    characterId: string,
    influence: any
  ): Promise<any> {
    try {
      console.log('🎯 Применяем влияние на характеристику:', {
        characterId,
        characteristicName: influence.characteristicName,
        influence: influence.influence,
        confidence: influence.confidence,
        reason: influence.reason
      })

      // Находим характеристику
      const characteristic = await prisma.characteristic.findFirst({
        where: {
          characterId,
          definition: {
            name: {
              contains: influence.characteristicName,
              mode: 'insensitive'
            }
          }
        },
        include: {
          definition: true
        }
      })

      if (characteristic) {
        const oldValue = characteristic.currentValue
        // Применяем изменение
        const newValue = Math.max(0, Math.min(100,
          characteristic.currentValue + influence.influence
        ))

        await prisma.characteristic.update({
          where: { id: characteristic.id },
          data: {
            currentValue: newValue,
            lastChanged: new Date()
          }
        })

        console.log('✅ Характеристика изменена:', {
          characteristicName: influence.characteristicName,
          oldValue,
          newValue,
          change: influence.influence
        })

        // Создаем воспоминание
        await this.memoryManager.createCharacteristicChangeMemory(
          characterId,
          influence.characteristicName,
          characteristic.currentValue,
          newValue,
          influence.reason
        )

        // Возвращаем информацию об изменении
        return {
          name: influence.characteristicName,
          oldValue,
          newValue,
          change: influence.influence
        }
      }
    } catch (error) {
      console.error('Ошибка при применении влияния на характеристику:', error)
    }
    return null
  }

  // Выполнение триггера действия
  private async executeActionTrigger(
    characterId: string,
    userId: string,
    trigger: any
  ): Promise<void> {
    try {
      // Находим действие
      const action = await prisma.action.findFirst({
        where: {
          name: {
            contains: trigger.actionName,
            mode: 'insensitive'
          },
          isActive: true
        }
      })

      if (action) {
        // Регистрируем действие в системе сообщений
        await this.actionMessageSystem.registerAction(
          characterId,
          userId,
          action.name,
          trigger.intensity || 50,
          trigger.targetZone
        )
      }
    } catch (error) {
      console.error('Ошибка при выполнении триггера действия:', error)
    }
  }

  // Применение изменения настроения
  private async applyMoodChange(characterId: string, moodChange: any): Promise<void> {
    try {
      // Создаем эмоциональное воспоминание
      await this.memoryManager.createEmotionalMemory(
        characterId,
        moodChange.moodType,
        moodChange.trigger,
        Math.abs(moodChange.change)
      )
    } catch (error) {
      console.error('Ошибка при применении изменения настроения:', error)
    }
  }

  // Методы для работы с системой действий-сообщений

  // Регистрация действия
  async registerAction(
    characterId: string,
    userId: string,
    actionName: string,
    intensity: number,
    targetZone?: string,
    effects: any[] = []
  ): Promise<void> {
    await this.actionMessageSystem.registerAction(
      characterId,
      userId,
      actionName,
      intensity,
      targetZone,
      effects
    )
  }

  // Получение истории действий
  async getActionHistory(
    characterId: string,
    userId: string,
    limit: number = 20
  ): Promise<any[]> {
    return await this.actionMessageSystem.getActionHistory(characterId, userId, limit)
  }

  // Получение статистики действий
  async getActionStats(characterId: string, userId: string): Promise<any> {
    return await this.actionMessageSystem.getActionStats(characterId, userId)
  }

  // Принудительная отправка сообщения о действиях
  async forceSendActionMessage(characterId: string, userId: string): Promise<void> {
    await this.actionMessageSystem.forceSendMessage(characterId, userId)
  }

  // Получение ожидающих действий
  getPendingActions(characterId: string, userId: string): any[] {
    return this.actionMessageSystem.getPendingActions(characterId, userId)
  }

  // Очистка ожидающих действий
  clearPendingActions(characterId: string, userId: string): void {
    this.actionMessageSystem.clearPendingActions(characterId, userId)
  }

  // Обновление конфигурации системы действий
  updateActionMessageConfig(config: Partial<any>): void {
    this.actionMessageSystem.updateConfig(config)
  }

  // Получение конфигурации системы действий
  getActionMessageConfig(): any {
    return this.actionMessageSystem.getConfig()
  }

  // Сохранение ответа в чат
  private async saveResponseToChat(
    characterId: string,
    userMessage: string,
    aiResponse: string,
    userId: string
  ): Promise<void> {
    try {
      // Получаем системного пользователя ИИ
      const aiSystemUser = await prisma.user.findFirst({
        where: { email: 'ai-system@cyberjack.local' }
      })

      if (!aiSystemUser) {
        throw new Error('Системный пользователь ИИ не найден')
      }

      // Проверяем, является ли сообщение системным (о действии)
      const isSystemMessage = userMessage.includes('К тебе было применено действие') ||
                              userMessage.includes('Это вызвало:') ||
                              userMessage.includes('Как ты реагируешь на это действие?')

      // Сохраняем сообщение пользователя только если это НЕ системное сообщение
      if (!isSystemMessage) {
        await prisma.chatMessage.create({
          data: {
            content: userMessage,
            senderId: userId,
            characterId,
            messageType: 'user',
            emotionalTone: 'neutral'
          }
        })
      }

      // Сохраняем ответ ИИ
      await prisma.chatMessage.create({
        data: {
          content: aiResponse,
          senderId: aiSystemUser.id, // Используем системного пользователя ИИ
          characterId,
          messageType: 'character',
          emotionalTone: 'positive' // Можно анализировать эмоциональный тон ответа
        }
      })

      serverLogger.info(LogCategory.AI, 'Ответ сохранен в чат', {
        characterId,
        userId,
        userMessageLength: userMessage.length,
        aiResponseLength: aiResponse.length,
        isSystemMessage
      })
    } catch (error) {
      serverLogger.error(LogCategory.AI, 'Ошибка при сохранении ответа в чат', {
        characterId,
        userId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      })
    }
  }

  private async getLastAction(
    characterId: string,
    userId: string,
    characteristicNameMap: Map<string, { name: string; category: string }>
  ): Promise<any> {
    try {
      const lastAction = await prisma.actionLog.findFirst({
        where: {
          characterId,
          userId
        },
        orderBy: {
          timestamp: 'desc'
        },
        include: {
          action: {
            select: {
              id: true,
              name: true,
              category: true,
              description: true
            }
          }
        }
      })

      if (!lastAction) return null

      let zoneData: any = null
      if (lastAction.zoneId) {
        try {
          const zone = await prisma.characterActiveZone.findUnique({
            where: { id: lastAction.zoneId },
            include: {
              anatomy: true
            }
          })

          if (zone) {
            zoneData = {
              id: zone.id,
              name: zone.name,
              anatomyId: zone.anatomyDefId,
              anatomyName: zone.anatomy?.name || null
            }
          }
        } catch (error) {
          console.warn('Не удалось получить информацию о зоне из ActionLog:', error)
        }
      }

      const effects = Array.isArray(lastAction.effects)
        ? (lastAction.effects as Array<{ characteristicId: string; change: number; permanent: boolean }>).map(effect => ({
            ...effect,
            characteristicName: characteristicNameMap.get(effect.characteristicId)?.name || null,
            characteristicCategory: characteristicNameMap.get(effect.characteristicId)?.category || null
          }))
        : []

      return {
        id: lastAction.id,
        actionId: lastAction.actionId,
        actionName: lastAction.action.name,
        actionCategory: lastAction.action.category,
        actionDescription: lastAction.action.description,
        intensity: lastAction.intensity,
        duration: lastAction.duration,
        timestamp: lastAction.timestamp,
        zone: zoneData,
        effects,
        success: lastAction.success
      }
    } catch (error) {
      console.error('Ошибка при получении последнего действия:', error)
      return null
    }
  }

  private async getSessionHistory(characterId: string, userId: string): Promise<any[]> {
    try {
      const recentMessages = await prisma.chatMessage.findMany({
        where: {
          characterId,
          senderId: userId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10, // Последние 10 сообщений
        select: {
          id: true,
          content: true,
          messageType: true,
          emotionalTone: true,
          createdAt: true
        }
      })

      // Преобразуем в нужный формат
      return recentMessages.reverse().map(msg => ({
        id: msg.id,
        content: msg.content,
        isUser: msg.messageType === 'user',
        timestamp: msg.createdAt,
        emotionalTone: msg.emotionalTone
      }))
    } catch (error) {
      console.error('Ошибка при получении истории сессии:', error)
      return []
    }
  }
}
