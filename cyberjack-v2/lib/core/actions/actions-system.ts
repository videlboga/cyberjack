// lib/core/actions/actions-system.ts

import { prisma } from '@/lib/db/client'
import { CharacteristicsSystem } from '../characteristics/characteristics-system'
import { FormulaSystem } from '../formulas/formula-system'
import { PoseFormulaSystem } from '../poses/pose-formula-system'
import { ActivePosesSystem } from '../poses/active-poses-system'
import { SimpleEffectsSystem } from './simple-effects-system'
import { SimplePoseSystem } from '../poses/simple-pose-system'
import { TimeSystem } from '../time/time-system'
import { ActionEffect, ActionResult } from '@/types/database'
import { FormulaExecutionContext } from '../formulas/types/formula-context'
import { CharacterMemoryManager } from '../../character/memory-manager'
import { MemoryType } from '@/types/character-ai'
import { serverLogger, LogCategory } from '@/lib/utils/server-logger'
import { CharacterAIService } from '../../character/ai-service'
import { CharacteristicInterpreter } from '../../character/characteristic-interpreter'

export class ActionsSystem {
  private formulaSystem: FormulaSystem
  private characteristicsSystem: CharacteristicsSystem
  private poseFormulaSystem: PoseFormulaSystem
  private activePosesSystem: ActivePosesSystem
  private simpleEffectsSystem: SimpleEffectsSystem
  private simplePoseSystem: SimplePoseSystem
  private memoryManager: CharacterMemoryManager
  private aiService: CharacterAIService | null
  private characteristicInterpreter: CharacteristicInterpreter

  constructor() {
    this.formulaSystem = new FormulaSystem()
    this.characteristicsSystem = new CharacteristicsSystem()
    this.poseFormulaSystem = new PoseFormulaSystem()
    this.activePosesSystem = ActivePosesSystem.getInstance()
    this.simpleEffectsSystem = new SimpleEffectsSystem()
    this.simplePoseSystem = new SimplePoseSystem()
    this.memoryManager = new CharacterMemoryManager()
    this.characteristicInterpreter = new CharacteristicInterpreter()

    // Инициализируем AI сервис с API ключом из переменных окружения
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.warn('⚠️ OPENROUTER_API_KEY не найден в переменных окружения. AI функции будут недоступны.')
      this.aiService = null as any
    } else {
      this.aiService = new CharacterAIService(apiKey)
    }
  }

  // Выполнить действие с холдом
  async executeActionWithHold(
    characterId: string,
    actionId: string,
    userId: string,
    zoneId: string | undefined,
    durationSeconds: number
  ): Promise<ActionResult> {
    const action = await prisma.action.findUnique({
      where: { id: actionId }
    })

    if (!action) {
      throw new Error('Действие не найдено')
    }

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
        }
      }
    })

    if (!character) {
      throw new Error('Персонаж не найден')
    }

    // Получаем данные пользователя (или создаем системного)
    let user: any
    if (userId === 'system') {
      // Создаем системного пользователя для автоматических операций
      user = {
        id: 'system',
        name: 'System',
        modifiers: {},
        credits: 1000
      }
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('Пользователь не найден')
      }
    }

    // Проверить требования действия
    const requirementsMet = await this.checkRequirements(action, character, user)
    if (!requirementsMet) {
      throw new Error('Требования действия не выполнены')
    }

    // Вычислить эффекты действия через формулу
    const effects = await this.calculateEffectsWithFormula(
      action,
      character,
      user,
      zoneId || '',
      durationSeconds
    )

    // Применить эффекты
    for (const effect of effects) {
      await this.characteristicsSystem.changeValue(
        characterId,
        effect.characteristicId,
        effect.change,
        effect.permanent || false
      )
    }

    // Создать запись о действии
    await this.logAction(
      actionId,
      characterId,
      userId,
      zoneId,
      durationSeconds,
      action.intensity,
      effects
    )

    return {
      success: true,
      effects,
      message: `Действие "${action.name}" выполнено за ${durationSeconds}с`
    }
  }

  // Проверить требования действия
  private async checkRequirements(
    action: any,
    character: any,
    user: any
  ): Promise<boolean> {
    const requirements = action.requirements as Record<string, any>

    for (const [requirementType, requirementData] of Object.entries(requirements)) {
      switch (requirementType) {
        case 'characteristics':
          for (const [charId, requirement] of Object.entries(requirementData as Record<string, any>)) {
            const characteristic = character.characteristics.find((c: any) => c.characteristicDefId === charId)
            if (!characteristic) return false

            if (!this.checkValueRequirement(characteristic.currentValue, requirement)) {
              return false
            }
          }
          break

        case 'anatomy':
          for (const [anatomyId, requirement] of Object.entries(requirementData as Record<string, any>)) {
            const anatomy = character.anatomy.find((a: any) => a.anatomyDefId === anatomyId)
            if (!anatomy || !anatomy.hasPart) return false

            if (requirement.sensitivity && anatomy.sensitivity < requirement.sensitivity) {
              return false
            }
          }
          break

        case 'credits':
          if (user.credits < requirementData) {
            return false
          }
          break
      }
    }

    return true
  }

  // Проверить требование к значению
  private checkValueRequirement(value: number, requirement: any): boolean {
    switch (requirement.operator) {
      case 'gte': return value >= requirement.value
      case 'lte': return value <= requirement.value
      case 'eq': return value === requirement.value
      case 'ne': return value !== requirement.value
      default: return true
    }
  }

  // Вычислить эффекты действия через формулу
  private async calculateEffectsWithFormula(
    action: any,
    character: any,
    user: any,
    zoneId: string,
    durationSeconds: number
  ): Promise<ActionEffect[]> {
    const effects: ActionEffect[] = []

    // Получить зону если указана
    const zone = zoneId ? await this.getZone(zoneId) : null

    // Применить модификаторы поз к действию
    const modifiedAction = await this.applyPoseModifiersToAction(action, character.id, user.id)

    // Создать контекст для формулы
    const context: FormulaExecutionContext = {
      character: {
        id: character.id,
        name: character.name,
        characteristics: this.formatCharacterCharacteristics(character.characteristics),
        anatomy: this.formatCharacterAnatomyForContext(character.anatomy)
      },
      user: {
        id: user.id,
        name: user.name,
        modifiers: user.modifiers || {},
        credits: user.credits || 0
      },
      action: {
        id: modifiedAction.id,
        name: modifiedAction.name,
        intensity: modifiedAction.intensity,
        cost: 0, // больше не используется
        duration: durationSeconds,
        category: modifiedAction.category,
        effects: modifiedAction.formula || {}
      },
      zone: zone ? {
        id: zone.id,
        name: zone.name,
        sensitivity: this.getZoneSensitivity(zone, character.anatomy),
        anatomy: {
          id: zone.anatomyDefId || '',
          name: zone.anatomy?.name || '',
          category: zone.anatomy?.category || ''
        },
        coordinates: {
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height
        }
      } : undefined,
      system: {
        gameTime: await this.getCurrentGameTime(user.id),
        realTime: Date.now(),
        isActionHolding: true,
        timeMultiplier: 1.0
      },
      custom: {}
    }

    // Выполнить формулу если она есть
    if (action.formula && Object.keys(action.formula).length > 0) {
      try {
        // Логируем формулу для отладки
        console.log('🔍 Формула действия:', JSON.stringify(action.formula, null, 2))

        // Проверяем, является ли это структурированной формулой или простыми эффектами
        if (action.formula.rootNode) {
          // Это новая структурированная формула
          console.log('📊 Обрабатываем структурированную формулу')

          const formulaResult = await this.formulaSystem.executeFormula(
            action.formula,
            context
          )
          console.log('📊 Результат формулы:', JSON.stringify(formulaResult, null, 2))

          // Преобразовать результат формулы в эффекты
          if (formulaResult.value && typeof formulaResult.value === 'object') {
            // Новая структурированная формула возвращает эффекты в value
            for (const [characteristicName, effectData] of Object.entries(formulaResult.value)) {
              if (typeof effectData === 'object' && effectData !== null && 'change' in effectData) {
                const effect = effectData as { change: any; permanent: any }

                // Вычисляем изменение (если это формула, нужно выполнить ее)
                let change = 0
                if (typeof effect.change === 'number') {
                  change = effect.change
                } else if (effect.change && typeof effect.change === 'object' && effect.change.value !== undefined) {
                  change = effect.change.value
                }

                // Находим ID характеристики по имени
                const characteristic = await this.characteristicsSystem.getCharacteristicByName(
                  character.id,
                  characteristicName
                )

                if (characteristic) {
                  // Применяем модификаторы интенсивности и пользователя
                  const intensityMultiplier = action.intensity / 50 // Нормализуем к 50
                  const userModifier = 1.0 // TODO: получить из user.modifiers
                  const finalChange = change * intensityMultiplier * userModifier * durationSeconds

                  effects.push({
                    characteristicId: characteristic.id,
                    change: finalChange,
                    permanent: effect.permanent?.value || false
                  })
                } else {
                  console.warn(`⚠️ Характеристика "${characteristicName}" не найдена для персонажа ${character.id}`)
                }
              }
            }
          } else if (formulaResult.factors) {
            // Старый формат через factors
            for (const factor of formulaResult.factors) {
              if (factor.category === 'input' && factor.name.includes('characteristic')) {
                // Извлекаем ID характеристики из имени фактора
                const charId = factor.name.split('.').pop() || 'mood'
                effects.push({
                  characteristicId: charId,
                  change: factor.value * durationSeconds, // умножаем на время холда
                  permanent: false
                })
              }
            }
          }
        } else {
          // Это простые эффекты (старый формат) - преобразуем на лету
          console.log('📊 Обрабатываем простые эффекты (старый формат)')

          for (const [characteristicName, effectData] of Object.entries(action.formula)) {
            if (typeof effectData === 'object' && effectData !== null && 'change' in effectData) {
              const effect = effectData as { change: number; permanent?: boolean }

              // Находим ID характеристики по имени
              const characteristic = await this.characteristicsSystem.getCharacteristicByName(
                character.id,
                characteristicName
              )

              if (characteristic) {
                // Применяем модификаторы интенсивности и пользователя
                const intensityMultiplier = action.intensity / 50 // Нормализуем к 50
                const userModifier = 1.0 // TODO: получить из user.modifiers
                const finalChange = effect.change * intensityMultiplier * userModifier * durationSeconds

                effects.push({
                  characteristicId: characteristic.id,
                  change: finalChange,
                  permanent: effect.permanent || false
                })
              } else {
                console.warn(`⚠️ Характеристика "${characteristicName}" не найдена для персонажа ${character.id}`)
              }
            }
          }
        }
      } catch (error) {
        console.error('Ошибка выполнения формулы:', error)
        // Fallback к простым эффектам если формула не работает
        return this.calculateSimpleEffects(action, character, user, zone, durationSeconds)
      }
    } else {
      // Если формулы нет, используем простые эффекты
      return this.calculateSimpleEffects(action, character, user, zone, durationSeconds)
    }

    return effects
  }

  // Простые эффекты (fallback)
  private calculateSimpleEffects(
    action: any,
    character: any,
    user: any,
    zone: any,
    durationSeconds: number
  ): ActionEffect[] {
    const effects: ActionEffect[] = []

    // Базовое изменение на основе интенсивности и времени
    const baseChange = (action.intensity / 100) * durationSeconds

    // Пример: повышаем настроение
    effects.push({
      characteristicId: 'mood',
      change: baseChange,
      permanent: false
    })

    return effects
  }

  // Получить зону
  private async getZone(zoneId: string) {
    return await prisma.activeZone.findUnique({
      where: { id: zoneId },
      include: {
        anatomy: true
      }
    })
  }

  // Форматировать характеристики персонажа для контекста
  private formatCharacterCharacteristics(characteristics: any[]): Record<string, number> {
    const formatted: Record<string, number> = {}

    characteristics.forEach(char => {
      const defId = char.characteristicDefId || char.definition?.id
      const defName = char.definition?.name
      if (defId && defName) {
        // Добавляем и по ID, и по имени для совместимости
        formatted[defId] = char.currentValue || 0
        formatted[defName] = char.currentValue || 0
      }
    })

    return formatted
  }

  // Форматировать анатомию персонажа для контекста (старый метод)
  private formatCharacterAnatomy(anatomy: any[]): Record<string, { hasPart: boolean; sensitivity: number }> {
    const formatted: Record<string, { hasPart: boolean; sensitivity: number }> = {}

    anatomy.forEach(part => {
      const defId = part.anatomyDefId || part.definition?.id
      if (defId) {
        formatted[defId] = {
          hasPart: part.hasPart || false,
          sensitivity: part.sensitivity || 0
        }
      }
    })

    return formatted
  }

  // Форматировать анатомию персонажа для контекста формул (новый метод)
  private formatCharacterAnatomyForContext(anatomy: any[]): Record<string, number> {
    const formatted: Record<string, number> = {}

    anatomy.forEach(part => {
      const defId = part.anatomyDefId || part.definition?.id
      if (defId) {
        formatted[defId] = part.sensitivity || 0
      }
    })

    return formatted
  }

  // Получить чувствительность зоны
  private getZoneSensitivity(zone: any, characterAnatomy: any[]): number {
    if (!zone.anatomyDefId) return 50 // средняя чувствительность по умолчанию

    const anatomy = characterAnatomy.find(a =>
      a.anatomyDefId === zone.anatomyDefId ||
      a.definition?.id === zone.anatomyDefId
    )

    return anatomy ? anatomy.sensitivity || 50 : 50
  }

  // Записать действие в лог
  private async logAction(
    actionId: string,
    characterId: string,
    userId: string,
    zoneId: string | undefined,
    duration: number,
    intensity: number,
    effects: ActionEffect[]
  ): Promise<void> {
    try {
      await prisma.actionLog.create({
        data: {
          actionId,
          characterId,
          userId,
          zoneId: zoneId || null,
          duration,
          intensity,
          effects: effects as any,
          success: true
        }
      })
    } catch (error) {
      console.error('Ошибка записи лога действия:', error)
    }
  }

  // Получить все действия
  async getAllActions() {
    return await prisma.action.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
  }

  // Получить действия по категории
  async getActionsByCategory(category: string) {
    return await prisma.action.findMany({
      where: {
        category,
        isActive: true
      },
      orderBy: { name: 'asc' }
    })
  }

  // Получить доступные действия для персонажа
  async getAvailableActions(characterId: string, userId: string) {
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
        }
      }
    })

    if (!character) {
      throw new Error('Персонаж не найден')
    }

    // Получаем данные пользователя (или создаем системного)
    let user: any
    if (userId === 'system') {
      // Создаем системного пользователя для автоматических операций
      user = {
        id: 'system',
        name: 'System',
        modifiers: {},
        credits: 1000
      }
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('Пользователь не найден')
      }
    }

    const allActions = await this.getAllActions()
    const availableActions = []

    for (const action of allActions) {
      try {
        const requirementsMet = await this.checkRequirements(action, character, user)
        if (requirementsMet) {
          availableActions.push(action)
        }
      } catch (error) {
        // Действие недоступно
        continue
      }
    }

    return availableActions
  }

  // Создать новое действие
  async createAction(actionData: {
    name: string
    category: string
    description?: string
    intensity?: number
    formula?: any
    requirements: Record<string, any>
  }) {
    return await prisma.action.create({
      data: {
        name: actionData.name,
        category: actionData.category,
        description: actionData.description,
        intensity: actionData.intensity || 5,
        formula: actionData.formula || {},
        requirements: actionData.requirements || {}
      }
    })
  }

  // Обновить действие
  async updateAction(
    actionId: string,
    updateData: {
      name?: string
      category?: string
      description?: string
      intensity?: number
      formula?: any
      requirements?: Record<string, any>
      isActive?: boolean
    }
  ) {
    return await prisma.action.update({
      where: { id: actionId },
      data: updateData
    })
  }

  // Удалить действие
  async deleteAction(actionId: string) {
    return await prisma.action.update({
      where: { id: actionId },
      data: { isActive: false }
    })
  }

  // Применить модификаторы поз к действию
  private async applyPoseModifiersToAction(
    action: any,
    characterId: string,
    userId: string
  ): Promise<any> {
    try {
      // Получить активные позы персонажа
      const activePoses = await this.activePosesSystem.getActivePoses(characterId)

      if (activePoses.length === 0) {
        return action // Нет активных поз, возвращаем оригинальное действие
      }

      let modifiedAction = { ...action }

      // Применить модификаторы от каждой активной позы
      for (const poseStatus of activePoses) {
        if (!poseStatus.isActive) continue

        try {
          const modifierResults = await this.poseFormulaSystem.applyPoseModifiers(
            poseStatus.poseId,
            action.id,
            characterId,
            userId
          )

          // Применить результаты модификаторов к действию
          for (const modifierResult of modifierResults) {
            if (!modifierResult.success) continue

            switch (modifierResult.target) {
              case 'intensity':
                if (modifierResult.modifierId.includes('intensity')) {
                  modifiedAction.intensity = Math.round(modifiedAction.intensity * modifierResult.multiplier)
                  console.log(`Модификатор интенсивности от позы ${poseStatus.poseId}: ${action.intensity} → ${modifiedAction.intensity}`)
                }
                break
              case 'cost':
                if (modifierResult.modifierId.includes('cost')) {
                  // У действий нет поля cost, но можно добавить в будущем
                  console.log(`Модификатор стоимости от позы ${poseStatus.poseId}: множитель ${modifierResult.multiplier}`)
                }
                break
              case 'duration':
                if (modifierResult.modifierId.includes('duration')) {
                  // Длительность модифицируется в контексте выполнения
                  console.log(`Модификатор длительности от позы ${poseStatus.poseId}: множитель ${modifierResult.multiplier}`)
                }
                break
              case 'effect':
                if (modifierResult.modifierId.includes('effect')) {
                  // Эффект модифицируется через формулу
                  console.log(`Модификатор эффекта от позы ${poseStatus.poseId}: множитель ${modifierResult.multiplier}`)
                }
                break
            }
          }
        } catch (error) {
          console.error(`Ошибка применения модификаторов позы ${poseStatus.poseId}:`, error)
        }
      }

      return modifiedAction
    } catch (error) {
      console.error('Ошибка применения модификаторов поз:', error)
      return action // Возвращаем оригинальное действие в случае ошибки
    }
  }

  // Получить модифицированные действия для персонажа
  async getModifiedActionsForCharacter(characterId: string, userId: string) {
    try {
      const availableActions = await this.getAvailableActions(characterId, userId)
      const modifiedActions = []

      for (const action of availableActions) {
        const modifiedAction = await this.applyPoseModifiersToAction(action, characterId, userId)
        modifiedActions.push(modifiedAction)
      }

      return modifiedActions
    } catch (error) {
      console.error('Ошибка получения модифицированных действий:', error)
      return []
    }
  }

  // Простое выполнение действия без сложных формул
  async executeSimpleAction(
    characterId: string,
    actionId: string,
    userId: string,
    intensity: number,
    durationSeconds: number = 5,
    zoneId?: string
  ): Promise<ActionResult> {
    try {
      serverLogger.info(LogCategory.ACTIONS, 'Выполняем простое действие', {
        actionId,
        characterId,
        userId,
        intensity,
        durationSeconds
      })

      // Получаем действие
      const action = await prisma.action.findUnique({
        where: { id: actionId }
      })

      if (!action) {
        throw new Error('Действие не найдено')
      }

      // Получаем персонажа с характеристиками
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          characteristics: {
            include: {
              definition: true
            }
          }
        }
      })

      if (!character) {
        throw new Error('Персонаж не найден')
      }

      // Получаем пользователя
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('Пользователь не найден')
      }

      // Вычисляем базовые эффекты действия
      let effects = this.simpleEffectsSystem.calculateActionEffects(
        action.category || 'physical',
        intensity,
        durationSeconds
      )

      // Применяем модификаторы пользователя
      effects = this.simpleEffectsSystem.applyUserModifiers(effects, user.modifiers)

      // Применяем модификаторы позы (пока без позы)
      // TODO: Добавить получение текущей позы персонажа
      // if (character.currentPose) {
      //   effects = this.simplePoseSystem.applyPoseToAction(
      //     effects,
      //     action.category || 'physical',
      //     character.currentPose.name
      //   )
      // }

      // Применяем зависимости
      const characterCharacteristics = this.formatCharacterCharacteristics(character.characteristics)
      effects = this.simpleEffectsSystem.applyDependencies(effects, characterCharacteristics)

      // Применяем эффекты к характеристикам
      const appliedEffects: ActionEffect[] = []
      for (const [characteristicName, effect] of Object.entries(effects)) {
        // Находим характеристику напрямую
        const characteristic = character.characteristics.find(
          char => char.definition?.name === characteristicName
        )

        if (characteristic) {
          const finalChange = effect.change * durationSeconds
          await this.characteristicsSystem.changeValue(
            characterId,
            characteristic.characteristicDefId,
            finalChange
          )

          appliedEffects.push({
            characteristicId: characteristic.characteristicDefId,
            change: finalChange,
            permanent: effect.permanent
          })

          serverLogger.debug(LogCategory.CHARACTERISTICS, 'Характеристика изменена', {
            characteristicName,
            change: finalChange,
            characterId
          })
        } else {
          serverLogger.warn(LogCategory.CHARACTERISTICS, 'Характеристика не найдена', {
            characteristicName,
            characterId
          })
        }
      }

      // Создаем запись в ActionLog
      await this.logAction(actionId, characterId, userId, zoneId, durationSeconds, intensity, appliedEffects)

      // Получаем информацию об анатомической зоне, если указана
      let anatomyInfo = ''
      if (zoneId) {
        try {
          const zone = await prisma.characterActiveZone.findUnique({
            where: { id: zoneId },
            include: { anatomy: true }
          })
          if (zone?.anatomy) {
            anatomyInfo = ` к ${zone.anatomy.name}`
          }
        } catch (error) {
          console.warn('Не удалось получить информацию о зоне:', error)
        }
      }

      // Создаем воспоминание о действии в системе памяти персонажа
      try {
        await this.memoryManager.addMemory(characterId, {
          type: MemoryType.ACTION,
          content: `Выполнено действие: "${action.name}"${anatomyInfo} (интенсивность: ${intensity}, длительность: ${durationSeconds}с)`,
          importance: Math.min(10, intensity / 10 + 3),
          tags: ['действие', action.category?.toLowerCase() || 'простое', action.name.toLowerCase()],
          emotionalWeight: intensity / 20,
          context: `Действие выполнено пользователем${anatomyInfo ? ` к ${anatomyInfo}` : ''}`,
          isActive: true
        })

        // Создаем воспоминания об изменениях характеристик
        for (const effect of appliedEffects) {
          const characteristic = character.characteristics.find(
            char => char.characteristicDefId === effect.characteristicId
          )

          if (characteristic) {
            await this.memoryManager.createCharacteristicChangeMemory(
              characterId,
              characteristic.definition.name,
              characteristic.currentValue - effect.change,
              characteristic.currentValue,
              `Действие "${action.name}" (интенсивность: ${intensity})`
            )
          }
        }
      } catch (error) {
        console.error('Ошибка при создании воспоминаний:', error)
      }

      // Проверяем, нужно ли отправить ИИ-запрос
      await this.checkAndTriggerAIResponse(characterId, action, appliedEffects, userId, zoneId)

      return {
        success: true,
        effects: appliedEffects,
        message: `Действие "${action.name}" выполнено за ${durationSeconds}с`
      }
    } catch (error) {
      console.error('❌ Ошибка выполнения простого действия:', error)
      return {
        success: false,
        effects: [],
        message: `Ошибка выполнения действия: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      }
    }
  }

  // Проверка и запуск ИИ-ответа при применении действий
  private async checkAndTriggerAIResponse(
    characterId: string,
    action: any,
    effects: ActionEffect[],
    userId: string,
    zoneId?: string
  ): Promise<void> {
    try {
      // Проверяем, доступен ли AI сервис
      if (!this.aiService) {
        serverLogger.warn(LogCategory.AI, 'AI сервис недоступен, пропускаем ИИ-запрос', {
          characterId,
          actionId: action.id,
          actionName: action.name
        })
        return
      }

      serverLogger.info(LogCategory.AI, 'Начинаем проверку ИИ-триггера', {
        characterId,
        actionId: action.id,
        actionName: action.name,
        effectsCount: effects.length,
        zoneId
      })

      // Получаем количество применений этого действия к персонажу
      const actionCount = await this.getActionApplicationCount(characterId, action.id)

      serverLogger.debug(LogCategory.AI, 'Проверяем необходимость ИИ-запроса', {
        characterId,
        actionId: action.id,
        actionName: action.name,
        actionCount,
        effectsCount: effects.length
      })

      // Проверяем, нужно ли отправить ИИ-запрос (2-е, 5-е и далее каждое 5-е для тестирования)
      const shouldTriggerAI = actionCount === 2 || actionCount >= 5 && actionCount % 5 === 0

      serverLogger.debug(LogCategory.AI, 'Результат проверки триггера', {
        characterId,
        actionId: action.id,
        actionCount,
        shouldTriggerAI
      })

      if (shouldTriggerAI) {
        serverLogger.info(LogCategory.AI, 'Запускаем автоматический ИИ-запрос после действия', {
          characterId,
          actionId: action.id,
          actionName: action.name,
          actionCount,
          effectsCount: effects.length
        })

        // Создаем сообщение для ИИ с информацией о действии
        const actionMessage = await this.createActionMessage(action, effects, actionCount, zoneId)

        // Отправляем запрос в ИИ-систему
        await this.aiService.generateResponse(characterId, actionMessage, {
          userId
        })
      }
    } catch (error) {
      serverLogger.error(LogCategory.AI, 'Ошибка при запуске автоматического ИИ-запроса', {
        characterId,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      })
    }
  }

  // Получение количества применений действия к персонажу
  private async getActionApplicationCount(characterId: string, actionId: string): Promise<number> {
    const count = await prisma.actionLog.count({
      where: {
        characterId,
        actionId
      }
    })

    serverLogger.debug(LogCategory.ACTIONS, 'Подсчет применений действия', {
      characterId,
      actionId,
      count
    })

    return count
  }

  // Создание сообщения для ИИ о действии
  private async createActionMessage(action: any, effects: ActionEffect[], actionCount: number, zoneId?: string): Promise<string> {
    // Получаем информацию об анатомической зоне
    let anatomyInfo = ''
    if (zoneId) {
      try {
        const zone = await prisma.characterActiveZone.findUnique({
          where: { id: zoneId },
          include: { anatomy: true }
        })
        if (zone?.anatomy) {
          anatomyInfo = ` к ${zone.anatomy.name}`
        }
      } catch (error) {
        console.warn('Не удалось получить информацию о зоне для ИИ-сообщения:', error)
      }
    }

    // Интерпретируем изменения характеристик в ощущения персонажа
    const sensations = this.characteristicInterpreter.interpretCharacteristicChanges(
      effects.map(effect => ({
        characteristicId: effect.characteristicId,
        change: effect.change,
        permanent: effect.permanent
      }))
    )

    return `К тебе было применено действие "${action.name}"${anatomyInfo} (${actionCount}-й раз). ${sensations} Как ты реагируешь на это действие?`
  }

  // Получить текущее игровое время пользователя
  private async getCurrentGameTime(userId: string): Promise<number> {
    const timeSystem = TimeSystem.getInstance()
    return await timeSystem.getGameTime(userId)
  }
}
