import { CharacterAIService } from './ai-service'
import { Character, CharacterResponse, EmotionalState } from './types'
import { CharacterAdapter } from './character-adapter'
import { 
  CharacterState, 
  CharacterInteraction, 
  PersonalWorkModeExtended,
  InteractionContext,
  InteractionResult,
  QuickAction,
  CharacterSaveData,
  CharacterWorkSettings,
  InteractionStats
} from './integration-types'

/**
 * Интеграционный сервис для режима "Личная работа" с AI-персонажами
 */
export class PersonalWorkIntegration {
  private aiService: CharacterAIService
  private settings: CharacterWorkSettings
  private quickActions: QuickAction[]
  private autoSaveInterval: NodeJS.Timeout | null = null

  constructor() {
    this.aiService = new CharacterAIService()
    this.settings = this.getDefaultSettings()
    this.quickActions = this.getDefaultQuickActions()
  }

  /**
   * Инициализация персонажа для режима "Личная работа"
   */
  async initializeCharacter(
    character: Character,
    existingState?: CharacterState
  ): Promise<CharacterState> {
    const characterState: CharacterState = existingState || {
      currentEmotionalState: EmotionalState.CALM,
      activeFetishes: [],
      lastInteraction: new Date(),
      interactionCount: 0,
      relationshipLevel: 50, // Базовый уровень отношений
      trustLevel: 30, // Базовый уровень доверия
      intimacyLevel: 20, // Базовый уровень близости
      lastSaveDate: new Date()
    }

    // Загружаем сохраненные данные, если есть
    const savedData = this.loadCharacterData(character.id)
    if (savedData) {
      return {
        ...characterState,
        ...savedData.characterState,
        lastSaveDate: new Date()
      }
    }

    return characterState
  }

  /**
   * Обработка взаимодействия с персонажем
   */
  async handleInteraction(
    character: Character,
    characterState: CharacterState,
    userAction: string,
    interactionType: string,
    context: Partial<InteractionContext> = {}
  ): Promise<InteractionResult> {
    try {
      // Создаем полный контекст взаимодействия
      const fullContext = this.buildInteractionContext(characterState, interactionType, context)
      
      // Обрабатываем взаимодействие через AI сервис
      const characterResponse = await this.aiService.analyzeInteraction(
        userAction,
        fullContext,
        character
      )

      // Создаем запись взаимодействия
      const interaction: CharacterInteraction = {
        id: this.generateInteractionId(),
        timestamp: new Date(),
        userAction,
        characterResponse,
        interactionType,
        context: fullContext,
        impactOnCharacter: {
          emotionalChange: this.calculateEmotionalChange(characterResponse),
          statChanges: characterResponse.statChanges,
          fetishActivations: characterResponse.fetishAnalysis.triggeredFetishes.map(f => f.id)
        }
      }

      // Обновляем состояние персонажа
      const updatedState = this.updateCharacterState(characterState, interaction)

      // Обновляем характеристики персонажа
      await this.aiService.updateStats(character, characterResponse.statChanges)

      // Обновляем фетиши
      await this.aiService.updateFetishes(character, userAction, characterResponse.response)

      // Добавляем в память
      await this.aiService.addMemory(character, {
        content: `Пользователь: ${userAction}`,
        type: 'interaction',
        emotionalImpact: characterResponse.impactAnalysis.pleasure - characterResponse.impactAnalysis.pain
      })

      // Вычисляем изменения отношений
      const relationshipChanges = this.calculateRelationshipChanges(interaction, characterState)

      const result: InteractionResult = {
        success: true,
        characterResponse,
        stateChanges: {
          emotionalState: this.determineEmotionalState(characterResponse),
          statChanges: characterResponse.statChanges,
          fetishActivations: interaction.impactOnCharacter.fetishActivations,
          relationshipChange: relationshipChanges.relationshipChange,
          trustChange: relationshipChanges.trustChange
        },
        uiUpdates: {
          showNotification: this.shouldShowNotification(interaction),
          notificationMessage: this.generateNotificationMessage(interaction),
          updateCharacterPanel: true,
          updateInteractionLog: true
        }
      }

      return result

    } catch (error) {
      console.error('Ошибка обработки взаимодействия:', error)
      return {
        success: false,
        characterResponse: {
          impactAnalysis: { threat: 0, pleasure: 0, pain: 0, fear: 0, arousal: 0 },
          fetishAnalysis: { triggeredFetishes: [], overallArousal: 0, dominantFetish: null },
          statChanges: {},
          response: 'Извините, произошла ошибка. Попробуйте еще раз.',
          emotionalState: 'calm',
          fetishInfluence: { modifiesResponse: false, responseModifier: '', overallArousal: 0, dominantFetish: null }
        },
        stateChanges: {
          emotionalState: EmotionalState.CALM,
          statChanges: {},
          fetishActivations: [],
          relationshipChange: 0,
          trustChange: 0
        },
        uiUpdates: {
          showNotification: true,
          notificationMessage: 'Произошла ошибка при обработке взаимодействия',
          updateCharacterPanel: false,
          updateInteractionLog: false
        },
        errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
      }
    }
  }

  /**
   * Обработка сообщения в чате с персонажем
   */
  async processMessage(params: {
    talentId: string
    message: string
    context: any
    interactionType?: string
    selectedTool?: string
    equipment?: any[]
  }): Promise<{
    message: string
    changes?: any
    emotionalState?: string
    fetishActivations?: string[]
  }> {
    const { talentId, message, context, interactionType, selectedTool, equipment } = params
    try {
      // Проверяем, что context существует
      if (!context) {
        console.warn('Context is undefined in processMessage')
        context = {
          name: 'Персонаж',
          role: 'Специалист',
          effectiveStats: {},
          mentalState: {},
          fetishes: [],
          statusEffects: [],
          recentMemories: [],
          fetishPreferences: {},
          fetishSensitivity: 5
        }
      }

      // Создаем персонажа на основе talentId используя адаптер
      const talent = {
        id: talentId,
        name: context.name || 'Персонаж',
        role: context.role || 'Специалист',
        attributes: context.effectiveStats || {
          strength: 50,
          empathy: 50,
          intelligence: 50,
          creativity: 50,
          temperament: 50,
          grit: 50,
          ego: 50
        },
        states: context.mentalState || {
          mood: 50,
          fear: 0,
          despair: 0,
          devotion: 50,
          entitlement: 30,
          awareness: 70,
          routine: 50,
          compliance: 60,
          sensuality: 50,
          endurance: 70,
          sensory_overload: 40
        },
        affinities: context.fetishes || {}
      }
      
      const character = CharacterAdapter.talentToCharacter(talent)

      // Создаем состояние персонажа
      const characterState: CharacterState = {
        currentEmotionalState: EmotionalState.CALM,
        activeFetishes: context.fetishes || [],
        lastInteraction: new Date(),
        interactionCount: 0,
        relationshipLevel: 50,
        trustLevel: 30,
        intimacyLevel: 20,
        lastSaveDate: new Date()
      }

      // Создаем контекст взаимодействия
      const interactionContext: Partial<InteractionContext> = {
        interactionType: interactionType || 'chat',
        selectedTool,
        equipment: equipment || [],
        currentTime: new Date(),
        timeOfDay: this.getTimeOfDay(),
        characterMood: context.mentalState?.mood || 50,
        characterAnxiety: context.mentalState?.anxiety || 20,
        characterEngagement: context.mentalState?.engagement || 70,
        activeStatusEffects: context.statusEffects || [],
        recentMemories: context.recentMemories || [],
        fetishPreferences: context.fetishPreferences || {},
        fetishSensitivity: context.fetishSensitivity || 5
      }

      // Обрабатываем взаимодействие
      const result = await this.handleInteraction(
        character,
        characterState,
        message,
        interactionType || 'chat',
        interactionContext
      )

      // Вычисляем эмоциональные изменения на основе ответа персонажа
      const emotionalChange = this.calculateEmotionalChange(result.characterResponse)
      
      // Обновляем Talent на основе изменений в Character
      CharacterAdapter.updateTalentFromCharacter(talent, character)
      
      return {
        message: result.characterResponse.response,
        changes: {
          emotionalChange: emotionalChange,
          statChanges: result.characterResponse.statChanges,
          fetishActivations: result.stateChanges.fetishActivations,
          updatedTalent: talent // Возвращаем обновленный Talent
        },
        emotionalState: result.characterResponse.emotionalState,
        fetishActivations: result.stateChanges.fetishActivations
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error)
      
      // Fallback ответ с проверкой context
      const safeContext = context || {}
      return {
        message: `Понимаю вас, ${safeContext.name || 'персонаж'}. Ваши текущие показатели: интеллект ${safeContext.effectiveStats?.intelligence || 5}, креативность ${safeContext.effectiveStats?.creativity || 5}. Как могу помочь?`,
        changes: {},
        emotionalState: 'спокойный',
        fetishActivations: []
      }
    }
  }

  /**
   * Выполнение быстрого действия
   */
  async executeQuickAction(
    character: Character,
    characterState: CharacterState,
    actionId: string,
    interactionType: string
  ): Promise<InteractionResult> {
    const quickAction = this.quickActions.find(a => a.id === actionId)
    if (!quickAction) {
      throw new Error(`Быстрое действие "${actionId}" не найдено`)
    }

    // Проверяем уровень доверия
    if (characterState.trustLevel < quickAction.requiresTrust) {
      return {
        success: false,
        characterResponse: {
          impactAnalysis: { threat: 0, pleasure: 0, pain: 0, fear: 0, arousal: 0 },
          fetishAnalysis: { triggeredFetishes: [], overallArousal: 0, dominantFetish: null },
          statChanges: {},
          response: 'Мне нужно больше доверия для этого действия.',
          emotionalState: 'calm',
          fetishInfluence: { modifiesResponse: false, responseModifier: '', overallArousal: 0, dominantFetish: null }
        },
        stateChanges: {
          emotionalState: EmotionalState.CALM,
          statChanges: {},
          fetishActivations: [],
          relationshipChange: 0,
          trustChange: 0
        },
        uiUpdates: {
          showNotification: true,
          notificationMessage: 'Недостаточно доверия для этого действия',
          updateCharacterPanel: false,
          updateInteractionLog: false
        }
      }
    }

    return await this.handleInteraction(
      character,
      characterState,
      quickAction.action,
      interactionType
    )
  }

  /**
   * Сохранение данных персонажа
   */
  saveCharacterData(character: Character, characterState: CharacterState, interactionHistory: CharacterInteraction[]): void {
    // Проверяем доступность localStorage (не доступен на сервере)
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    const saveData: CharacterSaveData = {
      character,
      characterState: {
        ...characterState,
        lastSaveDate: new Date()
      },
      interactionHistory: interactionHistory.slice(-this.settings.interactions.responseDelay), // Сохраняем последние N взаимодействий
      lastSaveDate: new Date(),
      version: '1.0',
      metadata: this.generateMetadata(interactionHistory, characterState)
    }

    localStorage.setItem(`character_${character.id}`, JSON.stringify(saveData))
  }

  /**
   * Загрузка данных персонажа
   */
  loadCharacterData(characterId: string): CharacterSaveData | null {
    // Проверяем доступность localStorage (не доступен на сервере)
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }

    const savedData = localStorage.getItem(`character_${characterId}`)
    if (savedData) {
      try {
        const data = JSON.parse(savedData)
        // Восстанавливаем даты
        data.characterState.lastInteraction = new Date(data.characterState.lastInteraction)
        data.characterState.lastSaveDate = new Date(data.characterState.lastSaveDate)
        data.lastSaveDate = new Date(data.lastSaveDate)
        data.interactionHistory.forEach((interaction: any) => {
          interaction.timestamp = new Date(interaction.timestamp)
        })
        return data
      } catch (error) {
        console.error('Ошибка загрузки данных персонажа:', error)
        return null
      }
    }
    return null
  }

  /**
   * Получение статистики взаимодействий
   */
  getInteractionStats(interactionHistory: CharacterInteraction[], characterState: CharacterState): InteractionStats {
    const totalInteractions = interactionHistory.length
    const interactionsByType: { [key: string]: number } = {}
    let totalResponseTime = 0

    interactionHistory.forEach(interaction => {
      interactionsByType[interaction.interactionType] = (interactionsByType[interaction.interactionType] || 0) + 1
      // Здесь можно добавить расчет времени ответа, если оно сохраняется
    })

    const emotionalStateDistribution = this.calculateEmotionalDistribution(interactionHistory)
    const mostActiveFetishes = this.calculateMostActiveFetishes(interactionHistory)

    return {
      totalInteractions,
      interactionsByType,
      averageResponseTime: totalInteractions > 0 ? totalResponseTime / totalInteractions : 0,
      emotionalStateDistribution,
      mostActiveFetishes,
      relationshipProgress: {
        trustLevel: characterState.trustLevel,
        intimacyLevel: characterState.intimacyLevel,
        relationshipLevel: characterState.relationshipLevel
      },
      recentTrends: this.calculateRecentTrends(interactionHistory)
    }
  }

  /**
   * Получение доступных быстрых действий
   */
  getAvailableQuickActions(characterState: CharacterState): QuickAction[] {
    return this.quickActions.filter(action => 
      characterState.trustLevel >= action.requiresTrust
    )
  }

  /**
   * Обновление настроек
   */
  updateSettings(newSettings: Partial<CharacterWorkSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    
    // Проверяем доступность localStorage (не доступен на сервере)
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('character_work_settings', JSON.stringify(this.settings))
    }
  }

  // Приватные методы

  private getDefaultSettings(): CharacterWorkSettings {
    // Проверяем доступность localStorage (не доступен на сервере)
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('character_work_settings')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (error) {
          console.error('Ошибка загрузки настроек:', error)
        }
      }
    }

    return {
      interactions: {
        enabledTypes: ['personal-learning', 'coaching-session', 'therapy', 'creative-work', 'meditation'],
        defaultResponseStyle: 'friendly',
        autoRespond: false,
        responseDelay: 1000
      },
      fetishes: {
        autoActivate: true,
        showTriggers: true,
        intensityModifier: 1.0,
        discoveryEnabled: true
      },
      emotions: {
        emotionalMemory: true,
        moodInfluence: 0.5,
        stressResponse: 'calm'
      },
      relationships: {
        trustBuilding: true,
        intimacyProgression: true,
        boundaryRespect: true
      }
    }
  }

  private getDefaultQuickActions(): QuickAction[] {
    return [
      {
        id: 'greet',
        name: 'Поприветствовать',
        description: 'Дружеское приветствие',
        icon: '👋',
        action: 'Привет! Как дела?',
        category: 'social',
        requiresTrust: 0,
        cooldown: 0
      },
      {
        id: 'praise',
        name: 'Похвалить',
        description: 'Похвалить персонажа',
        icon: '🌟',
        action: 'Ты молодец! Ты хорошо справляешься.',
        category: 'social',
        requiresTrust: 20,
        cooldown: 30000
      },
      {
        id: 'comfort',
        name: 'Утешить',
        description: 'Утешить персонажа',
        icon: '🤗',
        action: 'Не волнуйся, все будет хорошо.',
        category: 'personal',
        requiresTrust: 40,
        cooldown: 60000
      },
      {
        id: 'command',
        name: 'Приказать',
        description: 'Дать приказ',
        icon: '⚡',
        action: 'Выполни это задание немедленно!',
        category: 'professional',
        requiresTrust: 60,
        cooldown: 120000
      },
      {
        id: 'intimate',
        name: 'Интимное',
        description: 'Интимное взаимодействие',
        icon: '💕',
        action: 'Ты мне очень нравишься...',
        category: 'intimate',
        requiresTrust: 80,
        cooldown: 300000
      }
    ]
  }

  private buildInteractionContext(
    characterState: CharacterState,
    interactionType: string,
    additionalContext: Partial<InteractionContext>
  ): InteractionContext {
    return {
      workMode: {
        currentTask: additionalContext.workMode?.currentTask || 'general',
        selectedTool: additionalContext.workMode?.selectedTool || null,
        equipmentActive: additionalContext.workMode?.equipmentActive || false,
        sessionDuration: additionalContext.workMode?.sessionDuration || 0
      },
      character: {
        currentEmotionalState: characterState.currentEmotionalState,
        activeFetishes: characterState.activeFetishes,
        relationshipLevel: characterState.relationshipLevel,
        trustLevel: characterState.trustLevel,
        lastInteractionType: additionalContext.character?.lastInteractionType || null
      },
      user: {
        mood: additionalContext.user?.mood || 'neutral',
        relationship: additionalContext.user?.relationship || 'acquaintance',
        intimacy: additionalContext.user?.intimacy || 'low',
        previousActions: additionalContext.user?.previousActions || []
      },
      environment: {
        timeOfDay: this.getTimeOfDay(),
        location: additionalContext.environment?.location || 'station',
        privacy: additionalContext.environment?.privacy || 'private',
        stressLevel: additionalContext.environment?.stressLevel || 0
      }
    }
  }

  private updateCharacterState(characterState: CharacterState, interaction: CharacterInteraction): CharacterState {
    return {
      ...characterState,
      currentEmotionalState: this.determineEmotionalState(interaction.characterResponse),
      activeFetishes: interaction.impactOnCharacter.fetishActivations,
      lastInteraction: interaction.timestamp,
      interactionCount: characterState.interactionCount + 1
    }
  }

  private calculateEmotionalChange(characterResponse: CharacterResponse): number {
    const impact = characterResponse.impactAnalysis
    return impact.pleasure - impact.pain - impact.threat * 0.5
  }

  private determineEmotionalState(characterResponse: CharacterResponse): EmotionalState {
    const overallImpact = this.calculateEmotionalChange(characterResponse)
    
    if (overallImpact > 0.5) return EmotionalState.EXCITED
    if (overallImpact > 0.2) return EmotionalState.HAPPY
    if (overallImpact > -0.2) return EmotionalState.CALM
    if (overallImpact > -0.5) return EmotionalState.SAD
    return EmotionalState.FEARFUL
  }

  private calculateRelationshipChanges(interaction: CharacterInteraction, characterState: CharacterState) {
    const emotionalChange = interaction.impactOnCharacter.emotionalChange
    const fetishActivations = interaction.impactOnCharacter.fetishActivations.length
    
    // Базовые изменения
    let relationshipChange = emotionalChange * 2
    let trustChange = emotionalChange * 1.5
    
    // Бонус за активацию фетишей
    if (fetishActivations > 0) {
      relationshipChange += fetishActivations * 5
      trustChange += fetishActivations * 3
    }
    
    // Ограничиваем изменения
    relationshipChange = Math.max(-10, Math.min(10, relationshipChange))
    trustChange = Math.max(-8, Math.min(8, trustChange))
    
    return { relationshipChange, trustChange }
  }

  private shouldShowNotification(interaction: CharacterInteraction): boolean {
    const fetishActivations = interaction.impactOnCharacter.fetishActivations.length
    const emotionalChange = Math.abs(interaction.impactOnCharacter.emotionalChange)
    
    return fetishActivations > 0 || emotionalChange > 0.3
  }

  private generateNotificationMessage(interaction: CharacterInteraction): string {
    const fetishActivations = interaction.impactOnCharacter.fetishActivations.length
    const emotionalChange = interaction.impactOnCharacter.emotionalChange
    
    if (fetishActivations > 0) {
      return `Активированы фетиши: ${fetishActivations}`
    }
    
    if (emotionalChange > 0.3) {
      return 'Персонаж стал более позитивным'
    } else if (emotionalChange < -0.3) {
      return 'Персонаж расстроен'
    }
    
    return 'Взаимодействие завершено'
  }

  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 18) return 'afternoon'
    if (hour >= 18 && hour < 22) return 'evening'
    return 'night'
  }

  private generateMetadata(interactionHistory: CharacterInteraction[], characterState: CharacterState) {
    const totalInteractions = interactionHistory.length
    const emotionalStates = interactionHistory.map(i => i.characterResponse.emotionalState)
    const mostCommonEmotionalState = emotionalStates.sort((a, b) => 
      emotionalStates.filter(v => v === a).length - emotionalStates.filter(v => v === b).length
    ).pop() || 'calm'
    
    const fetishActivations = interactionHistory.flatMap(i => i.impactOnCharacter.fetishActivations)
    const fetishCounts = fetishActivations.reduce((acc, fetishId) => {
      acc[fetishId] = (acc[fetishId] || 0) + 1
      return acc
    }, {} as { [key: string]: number })
    
    const mostActiveFetishes = Object.entries(fetishCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([fetishId]) => fetishId)
    
    return {
      totalInteractions,
      averageEmotionalState: mostCommonEmotionalState,
      mostActiveFetishes,
      relationshipProgress: characterState.relationshipLevel
    }
  }

  private calculateEmotionalDistribution(interactionHistory: CharacterInteraction[]) {
    const distribution: { [key in EmotionalState]: number } = {
      [EmotionalState.EXCITED]: 0,
      [EmotionalState.HAPPY]: 0,
      [EmotionalState.CALM]: 0,
      [EmotionalState.SAD]: 0,
      [EmotionalState.FEARFUL]: 0,
      [EmotionalState.ANGRY]: 0,
      [EmotionalState.SUBMISSIVE]: 0,
      [EmotionalState.DOMINANT]: 0
    }
    
    interactionHistory.forEach(interaction => {
      const state = interaction.characterResponse.emotionalState as EmotionalState
      if (distribution[state] !== undefined) {
        distribution[state]++
      }
    })
    
    return distribution
  }

  private calculateMostActiveFetishes(interactionHistory: CharacterInteraction[]) {
    const fetishCounts: { [key: string]: number } = {}
    
    interactionHistory.forEach(interaction => {
      interaction.impactOnCharacter.fetishActivations.forEach(fetishId => {
        fetishCounts[fetishId] = (fetishCounts[fetishId] || 0) + 1
      })
    })
    
    return Object.entries(fetishCounts)
      .map(([fetishId, count]) => ({ fetishId, activationCount: count }))
      .sort((a, b) => b.activationCount - a.activationCount)
      .slice(0, 5)
  }

  private calculateRecentTrends(interactionHistory: CharacterInteraction[]) {
    const recentInteractions = interactionHistory.slice(-10)
    
    if (recentInteractions.length === 0) {
      return {
        emotionalStability: 0,
        fetishActivity: 0,
        responseQuality: 0
      }
    }
    
    const emotionalChanges = recentInteractions.map(i => Math.abs(i.impactOnCharacter.emotionalChange))
    const emotionalStability = 1 - (emotionalChanges.reduce((a, b) => a + b, 0) / emotionalChanges.length)
    
    const fetishActivity = recentInteractions.filter(i => i.impactOnCharacter.fetishActivations.length > 0).length / recentInteractions.length
    
    const responseQuality = recentInteractions.filter(i => i.characterResponse.response.length > 10).length / recentInteractions.length
    
    return {
      emotionalStability,
      fetishActivity,
      responseQuality
    }
  }
}

// Экспортируем экземпляр для использования
export const personalWorkIntegration = new PersonalWorkIntegration()
