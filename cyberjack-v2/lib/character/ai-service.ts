// lib/character/ai-service.ts

import { prisma } from '@/lib/db/client'
import { CharacterContext } from '@/types/game'
import { PromptSystem } from './prompt-system'
import { CharacterMemoryManager } from './memory-manager'
import { CharacterResponseManager } from './response-manager'
import { EnhancedMessageAnalyzer } from './enhanced-message-analyzer'
import { ActionMessageSystemManager } from './action-message-system'
import { serverLogger, LogCategory } from '@/lib/utils/server-logger'
import {
  CharacterAIService as ICharacterAIService,
  AIResponse,
  MessageAnalysis,
  PromptContext,
  CharacterAIConfig,
  CharacterAIMetrics
} from '@/types/character-ai'

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
  private metrics: CharacterAIMetrics

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
    this.messageAnalyzer = new EnhancedMessageAnalyzer()
    this.actionMessageSystem = new ActionMessageSystemManager(this)

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

  // Генерация ответа персонажа
  async generateResponse(
    characterId: string,
    userMessage: string,
    context: Partial<PromptContext>
  ): Promise<AIResponse> {
    const startTime = Date.now()
    this.metrics.totalRequests++

    try {
      // Получаем полный контекст с динамическими промптами
      const fullContext = await this.getCharacterContextWithDynamicPrompts(characterId, context.userId || '', context)

      // Анализируем сообщение пользователя с расширенным анализом
      serverLogger.info(LogCategory.AI, 'Начинаем анализ сообщения', {
        userMessage,
        characterId,
        userId: context.userId
      })

      const messageAnalysis = await this.messageAnalyzer.analyzeMessage(
        userMessage,
        characterId,
        context.userId || ''
      )

      serverLogger.debug(LogCategory.AI, 'Анализ сообщения завершен', {
        message: userMessage,
        characteristicInfluences: messageAnalysis.characteristicInfluences,
        poseCommands: messageAnalysis.poseCommands,
        actionTriggers: messageAnalysis.actionTriggers
      })

      // Обрабатываем результаты анализа сообщения
      const characteristicChanges = await this.processMessageAnalysis(messageAnalysis, characterId, context.userId || '')

      // Создаем воспоминание о взаимодействии
      if (this.config.enableMemoryManagement) {
        await this.memoryManager.createInteractionMemory(
          characterId,
          userMessage,
          '', // Пока пустой ответ
          fullContext.environment?.location || 'неизвестно'
        )
      }

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

      // Обновляем воспоминание с ответом
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

      // Возвращаем fallback ответ
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

  // Получить персонажа
  private async getCharacter(characterId: string) {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        },
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
                zones: true
              }
            }
          }
        }
      }
    })

    if (!character) {
      throw new Error('Персонаж не найден')
    }

    return character
  }

  // Получить контекст персонажа
  async getCharacterContext(characterId: string, userId: string, gameContext?: any): Promise<PromptContext> {
    const character = await this.getCharacter(characterId)
    const user = await this.getUser(userId)

    // Получаем характеристики
    const characteristics = character.characteristics.map(char => ({
      id: char.id,
      name: char.definition.name,
      category: char.definition.category,
      currentValue: char.currentValue,
      baseValue: char.baseValue,
      isRevealed: true, // TODO: Реализовать систему раскрытия
      revealedValue: char.currentValue,
      accuracy: 100
    }))

    // Получаем память
    const memory = await this.memoryManager.getMemoryContext(characterId)

    // Получаем текущую позу из копии персонажа пользователя
    let poseContext: any = undefined
    if (userId) {
      const characterCopy = await prisma.characterCopy.findUnique({
        where: {
          userId_characterId: {
            userId,
            characterId
          }
        }
      })

      if (characterCopy?.settings?.currentPose) {
        // Получаем позу по ID из копии
        const userPose = await prisma.characterPose.findUnique({
          where: { id: characterCopy.settings.currentPose },
          include: {
            definition: {
              include: {
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
            },
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
          const currentAngleId = characterCopy.settings.currentAngle
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
    }

    // Если нет позы из копии, берем дефолтную активную позу
    if (!poseContext) {
      serverLogger.debug(LogCategory.AI, 'Ищем активную позу персонажа', {
        characterId,
        totalPoses: character.poses.length,
        activePoses: character.poses.filter(pose => pose.isActive).length
      })

      // Ищем позу "Стоя" как дефолтную, если не найдена - берем первую активную
      let currentPose = character.poses.find(pose => pose.isActive && pose.definition.name === 'Стоя')
      if (!currentPose) {
        currentPose = character.poses.find(pose => pose.isActive)
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
          totalPoses: character.poses.length,
          poses: character.poses.map(p => ({ id: p.id, name: p.definition.name, isActive: p.isActive }))
        })
      }
    }

    // Получаем последние действия из ActionLog
    const lastAction = await this.getLastAction(characterId, userId)

    // Получаем историю сессии
    const sessionHistory = await this.getSessionHistory(characterId, userId)

    // Создаем контекст окружения
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
        id: character.id,
        name: character.name,
        description: character.description,
        age: character.age,
        avatar: character.avatar
      },
      characteristics,
      memory,
      currentPose: poseContext,
      lastAction,
      userModifiers: user?.modifiers as Record<string, number> || {},
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

  // Анализ сообщения пользователя
  async analyzeMessage(userMessage: string): Promise<MessageAnalysis> {
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
          suggestedActions: parsed.suggestedActions || []
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
              suggestedActions: parsed.suggestedActions || []
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
                  suggestedActions: parsed.suggestedActions || []
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
          suggestedActions: []
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
        suggestedActions: []
      }
    }
  }

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
      // Обрабатываем команды поз
      for (const poseCommand of analysis.poseCommands) {
        if (poseCommand.confidence > 0.7) {
          await this.executePoseCommand(characterId, poseCommand)
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
  private async executePoseCommand(characterId: string, poseCommand: PoseCommand): Promise<void> {
    try {
      // Находим позу по имени
      const pose = await prisma.characterPose.findFirst({
        where: {
          characterId,
          definition: {
            name: {
              contains: poseCommand.poseName,
              mode: 'insensitive'
            }
          }
        },
        include: {
          definition: true
        }
      })

      if (pose) {
        // Активируем позу (здесь должна быть логика активации позы)
        console.log(`Активирована поза: ${pose.definition.name} для персонажа ${characterId}`)

        // Создаем воспоминание
        await this.memoryManager.addMemory(characterId, {
          type: 'POSE_CHANGE' as any,
          content: `Принята поза: ${pose.definition.name}`,
          importance: 6,
          tags: ['поза', poseCommand.poseName.toLowerCase()],
          emotionalWeight: 4,
          context: 'команда пользователя',
          isActive: true
        })
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды позы:', error)
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
          senderId: userId, // Используем userId как отправителя для ИИ-ответов
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

  private async getLastAction(characterId: string, userId: string): Promise<any> {
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

      return {
        id: lastAction.id,
        actionId: lastAction.actionId,
        actionName: lastAction.action.name,
        actionCategory: lastAction.action.category,
        actionDescription: lastAction.action.description,
        intensity: lastAction.intensity,
        duration: lastAction.duration,
        timestamp: lastAction.timestamp,
        effects: lastAction.effects,
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
