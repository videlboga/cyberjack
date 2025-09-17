// lib/character/action-message-system.ts

import { prisma } from '@/lib/db/client'
import { CharacterAIService } from './ai-service'
import {
  ActionMessageSystem,
  ActionMessageConfig,
  PendingAction,
  ActionHistoryItem,
  ActionMessageTemplate,
  ActionEffect
} from '@/types/character-ai'

export class ActionMessageSystemManager {
  private aiService: CharacterAIService
  private config: ActionMessageConfig
  private systems: Map<string, ActionMessageSystem> = new Map()

  constructor(aiService: CharacterAIService, config?: Partial<ActionMessageConfig>) {
    this.aiService = aiService
    this.config = {
      messageThreshold: 3, // Отправлять сообщение каждые 3 действия
      timeThreshold: 30, // Группировать действия в течение 30 секунд
      enableAutoMessages: true,
      messageTemplates: this.getDefaultTemplates(),
      ...config
    }
  }

  // Регистрация действия
  async registerAction(
    characterId: string,
    userId: string,
    actionName: string,
    intensity: number,
    targetZone?: string,
    effects: ActionEffect[] = []
  ): Promise<void> {
    const systemKey = `${characterId}-${userId}`
    let system = this.systems.get(systemKey)

    if (!system) {
      system = {
        actionCount: 0,
        messageThreshold: this.config.messageThreshold,
        lastActionTime: new Date(),
        pendingActions: [],
        actionHistory: []
      }
      this.systems.set(systemKey, system)
    }

    // Создаем новое действие
    const action: PendingAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actionName,
      characterId,
      userId,
      timestamp: new Date(),
      intensity,
      targetZone,
      effects
    }

    // Добавляем в ожидающие действия
    system.pendingActions.push(action)
    system.actionCount++
    system.lastActionTime = new Date()

    // Проверяем, нужно ли отправить сообщение
    await this.checkAndSendMessage(systemKey, system)
  }

  // Проверка и отправка сообщения
  private async checkAndSendMessage(systemKey: string, system: ActionMessageSystem): Promise<void> {
    if (!this.config.enableAutoMessages) return

    const shouldSendMessage = this.shouldSendMessage(system)

    if (shouldSendMessage) {
      await this.sendActionMessage(systemKey, system)
    }
  }

  // Определение необходимости отправки сообщения
  private shouldSendMessage(system: ActionMessageSystem): boolean {
    const now = new Date()
    const timeSinceLastAction = (now.getTime() - system.lastActionTime.getTime()) / 1000

    // Проверяем по количеству действий
    if (system.pendingActions.length >= system.messageThreshold) {
      return true
    }

    // Проверяем по времени (если прошло достаточно времени с последнего действия)
    if (timeSinceLastAction >= this.config.timeThreshold && system.pendingActions.length > 0) {
      return true
    }

    // Проверяем специальные условия
    for (const action of system.pendingActions) {
      if (this.hasSpecialTrigger(action)) {
        return true
      }
    }

    return false
  }

  // Проверка специальных триггеров
  private hasSpecialTrigger(action: PendingAction): boolean {
    const specialActions = ['удар', 'поцелуй', 'объятие', 'наказание', 'похвала']
    const highIntensityThreshold = 70

    // Высокая интенсивность
    if (action.intensity >= highIntensityThreshold) {
      return true
    }

    // Специальные действия
    if (specialActions.some(special => action.actionName.toLowerCase().includes(special))) {
      return true
    }

    // Действия с сильными эффектами
    if (action.effects.some(effect => Math.abs(effect.change) >= 20)) {
      return true
    }

    return false
  }

  // Отправка сообщения о действиях
  private async sendActionMessage(systemKey: string, system: ActionMessageSystem): Promise<void> {
    if (system.pendingActions.length === 0) return

    const [characterId, userId] = systemKey.split('-')

    // Выбираем подходящий шаблон
    const template = this.selectMessageTemplate(system.pendingActions)

    // Генерируем сообщение
    const message = this.generateActionMessage(template, system.pendingActions)

    // Отправляем через AI сервис (без анализа, так как это системное сообщение)
    try {
      const aiResponse = await this.aiService.generateResponseWithoutAnalysis(
        characterId,
        message,
        {
          userId,
          context: {
            actionCount: system.pendingActions.length,
            lastAction: system.pendingActions[system.pendingActions.length - 1],
            allActions: system.pendingActions
          }
        }
      )

      // Сохраняем в историю
      await this.saveActionHistory(system, aiResponse.message)

      // Очищаем ожидающие действия
      system.pendingActions = []

    } catch (error) {
      console.error('Ошибка при отправке сообщения о действиях:', error)
    }
  }

  // Выбор шаблона сообщения
  private selectMessageTemplate(actions: PendingAction[]): ActionMessageTemplate {
    // Анализируем действия
    const actionNames = actions.map(a => a.actionName.toLowerCase())
    const avgIntensity = actions.reduce((sum, a) => sum + a.intensity, 0) / actions.length
    const hasHighIntensity = actions.some(a => a.intensity >= 70)

    // Выбираем подходящий шаблон
    if (hasHighIntensity) {
      return this.config.messageTemplates.find(t => t.trigger === 'high_intensity') || this.config.messageTemplates[0]
    }

    if (actionNames.some(name => name.includes('поцелуй') || name.includes('объятие'))) {
      return this.config.messageTemplates.find(t => t.trigger === 'affection') || this.config.messageTemplates[0]
    }

    if (actionNames.some(name => name.includes('удар') || name.includes('наказание'))) {
      return this.config.messageTemplates.find(t => t.trigger === 'punishment') || this.config.messageTemplates[0]
    }

    return this.config.messageTemplates[0] // Базовый шаблон
  }

  // Генерация сообщения о действиях
  private generateActionMessage(template: ActionMessageTemplate, actions: PendingAction[]): string {
    let message = template.template

    // Заменяем переменные
    const variables = {
      actionCount: actions.length,
      lastAction: actions[actions.length - 1]?.actionName || 'действие',
      allActions: actions.map(a => a.actionName).join(', '),
      avgIntensity: Math.round(actions.reduce((sum, a) => sum + a.intensity, 0) / actions.length),
      totalEffects: actions.reduce((sum, a) => sum + a.effects.length, 0),
      timeSpan: this.calculateTimeSpan(actions)
    }

    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
    }

    return message
  }

  // Расчет временного промежутка
  private calculateTimeSpan(actions: PendingAction[]): string {
    if (actions.length <= 1) return 'мгновение'

    const firstTime = actions[0].timestamp instanceof Date ? actions[0].timestamp.getTime() : new Date(actions[0].timestamp).getTime()
    const lastTime = actions[actions.length - 1].timestamp instanceof Date ? actions[actions.length - 1].timestamp.getTime() : new Date(actions[actions.length - 1].timestamp).getTime()
    const spanSeconds = (lastTime - firstTime) / 1000

    if (spanSeconds < 10) return 'несколько секунд'
    if (spanSeconds < 60) return `${Math.round(spanSeconds)} секунд`
    if (spanSeconds < 300) return `${Math.round(spanSeconds / 60)} минут`
    return 'длительное время'
  }

  // Сохранение истории действий
  private async saveActionHistory(system: ActionMessageSystem, aiReaction: string): Promise<void> {
    for (const action of system.pendingActions) {
      const historyItem: ActionHistoryItem = {
        ...action,
        aiReaction,
        messageSent: true
      }

      system.actionHistory.push(historyItem)

      // Ограничиваем размер истории
      if (system.actionHistory.length > 100) {
        system.actionHistory = system.actionHistory.slice(-100)
      }
    }
  }

  // Получение истории действий
  async getActionHistory(characterId: string, userId: string, limit: number = 20): Promise<ActionHistoryItem[]> {
    const systemKey = `${characterId}-${userId}`
    const system = this.systems.get(systemKey)

    if (!system) return []

    return system.actionHistory.slice(-limit)
  }

  // Получение статистики действий
  async getActionStats(characterId: string, userId: string): Promise<{
    totalActions: number
    recentActions: number
    avgIntensity: number
    mostCommonAction: string
    lastActionTime: Date | null
  }> {
    const systemKey = `${characterId}-${userId}`
    const system = this.systems.get(systemKey)

    if (!system) {
      return {
        totalActions: 0,
        recentActions: 0,
        avgIntensity: 0,
        mostCommonAction: '',
        lastActionTime: null
      }
    }

    const recentActions = system.actionHistory.filter(
      action => (Date.now() - (action.timestamp instanceof Date ? action.timestamp.getTime() : new Date(action.timestamp).getTime())) < 24 * 60 * 60 * 1000 // Последние 24 часа
    )

    const avgIntensity = system.actionHistory.length > 0
      ? system.actionHistory.reduce((sum, action) => sum + action.intensity, 0) / system.actionHistory.length
      : 0

    const actionCounts: Record<string, number> = {}
    system.actionHistory.forEach(action => {
      actionCounts[action.actionName] = (actionCounts[action.actionName] || 0) + 1
    })

    const mostCommonAction = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || ''

    return {
      totalActions: system.actionHistory.length,
      recentActions: recentActions.length,
      avgIntensity: Math.round(avgIntensity),
      mostCommonAction,
      lastActionTime: system.lastActionTime
    }
  }

  // Обновление конфигурации
  updateConfig(newConfig: Partial<ActionMessageConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Получение конфигурации
  getConfig(): ActionMessageConfig {
    return { ...this.config }
  }

  // Очистка старых данных
  async cleanupOldData(daysOld: number = 7): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    for (const [systemKey, system] of this.systems.entries()) {
      system.actionHistory = system.actionHistory.filter(
        action => action.timestamp > cutoffDate
      )

      system.pendingActions = system.pendingActions.filter(
        action => action.timestamp > cutoffDate
      )
    }
  }

  // Стандартные шаблоны сообщений
  private getDefaultTemplates(): ActionMessageTemplate[] {
    return [
      {
        id: 'general_actions',
        name: 'Общие действия',
        trigger: 'action_count',
        condition: 'actions.length >= 3',
        template: 'Выполнено {{actionCount}} действий: {{allActions}}. Средняя интенсивность: {{avgIntensity}}%.',
        variables: ['actionCount', 'allActions', 'avgIntensity'],
        priority: 100
      },
      {
        id: 'high_intensity',
        name: 'Высокая интенсивность',
        trigger: 'high_intensity',
        condition: 'intensity >= 70',
        template: 'Выполнено интенсивное действие "{{lastAction}}" с силой {{avgIntensity}}%.',
        variables: ['lastAction', 'avgIntensity'],
        priority: 200
      },
      {
        id: 'affection_actions',
        name: 'Действия нежности',
        trigger: 'affection',
        condition: 'action.includes("поцелуй") || action.includes("объятие")',
        template: 'Проявлена нежность: {{allActions}}. Время: {{timeSpan}}.',
        variables: ['allActions', 'timeSpan'],
        priority: 150
      },
      {
        id: 'punishment_actions',
        name: 'Действия наказания',
        trigger: 'punishment',
        condition: 'action.includes("удар") || action.includes("наказание")',
        template: 'Применено наказание: {{lastAction}} с интенсивностью {{avgIntensity}}%.',
        variables: ['lastAction', 'avgIntensity'],
        priority: 150
      },
      {
        id: 'time_based',
        name: 'По времени',
        trigger: 'time_elapsed',
        condition: 'timeSinceLastAction >= 30',
        template: 'За {{timeSpan}} выполнено {{actionCount}} действий: {{allActions}}.',
        variables: ['timeSpan', 'actionCount', 'allActions'],
        priority: 50
      }
    ]
  }

  // Принудительная отправка сообщения
  async forceSendMessage(characterId: string, userId: string): Promise<void> {
    const systemKey = `${characterId}-${userId}`
    const system = this.systems.get(systemKey)

    if (system && system.pendingActions.length > 0) {
      await this.sendActionMessage(systemKey, system)
    }
  }

  // Получение ожидающих действий
  getPendingActions(characterId: string, userId: string): PendingAction[] {
    const systemKey = `${characterId}-${userId}`
    const system = this.systems.get(systemKey)

    return system?.pendingActions || []
  }

  // Очистка ожидающих действий
  clearPendingActions(characterId: string, userId: string): void {
    const systemKey = `${characterId}-${userId}`
    const system = this.systems.get(systemKey)

    if (system) {
      system.pendingActions = []
    }
  }
}
