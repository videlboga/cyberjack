// lib/core/poses/pose-formula-system.ts

import { prisma } from '@/lib/db/client'
import {
  PoseFormulas,
  PoseCondition,
  PoseEffect,
  PoseModifier,
  PoseFormulaContext,
  PoseConditionResult,
  PoseEffectResult,
  PoseModifierResult,
  CharacterPoseStatus
} from '@/types/pose-formulas'
import { FormulaEngine } from '../formulas/formula-engine'

export class PoseFormulaSystem {
  private formulaEngine: FormulaEngine

  constructor() {
    this.formulaEngine = new FormulaEngine({})
  }

  // Проверка условий позы
  async checkPoseConditions(
    poseId: string,
    characterId: string,
    userId: string
  ): Promise<PoseConditionResult[]> {
    const pose = await prisma.poseDefinition.findUnique({
      where: { id: poseId },
      select: { requirements: true }
    })

    if (!pose) {
      throw new Error(`Pose ${poseId} not found`)
    }

    const requirements = (pose.requirements as any) || {}
    const conditions = requirements.conditions || []

    const context = await this.buildFormulaContext(characterId, userId, poseId)
    const results: PoseConditionResult[] = []

    for (const condition of conditions) {
      try {
        const result = await this.evaluateCondition(condition, context)
        results.push(result)
      } catch (error) {
        results.push({
          conditionId: condition.id,
          passed: false,
          actualValue: null,
          expectedValue: condition.value,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  // Применение эффектов позы
  async applyPoseEffects(
    poseId: string,
    characterId: string,
    userId: string
  ): Promise<PoseEffectResult[]> {
    const pose = await prisma.poseDefinition.findUnique({
      where: { id: poseId },
      select: { effects: true }
    })

    if (!pose) {
      throw new Error(`Pose ${poseId} not found`)
    }

    const effects = (pose.effects as any) || {}
    const effectsList = effects.effects || []

    const context = await this.buildFormulaContext(characterId, userId, poseId)
    const results: PoseEffectResult[] = []

    for (const effect of effectsList) {
      try {
        const result = await this.evaluateEffect(effect, context)
        results.push(result)
      } catch (error) {
        results.push({
          effectId: effect.id,
          target: effect.target,
          oldValue: null,
          newValue: null,
          change: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  // Применение модификаторов позы
  async applyPoseModifiers(
    poseId: string,
    actionId: string,
    characterId: string,
    userId: string
  ): Promise<PoseModifierResult[]> {
    const pose = await prisma.poseDefinition.findUnique({
      where: { id: poseId },
      select: { effects: true }
    })

    if (!pose) {
      throw new Error(`Pose ${poseId} not found`)
    }

    const effects = (pose.effects as any) || {}
    const modifiers = effects.modifiers || []

    const context = await this.buildFormulaContext(characterId, userId, poseId, actionId)
    const results: PoseModifierResult[] = []

    for (const modifier of modifiers) {
      try {
        const result = await this.evaluateModifier(modifier, context)
        results.push(result)
      } catch (error) {
        results.push({
          modifierId: modifier.id,
          target: modifier.target,
          originalValue: null,
          modifiedValue: null,
          multiplier: 1,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  // Получение активных поз персонажа
  async getActivePoses(characterId: string): Promise<CharacterPoseStatus[]> {
    // Здесь должна быть логика получения активных поз персонажа
    // Пока возвращаем пустой массив
    return []
  }

  // Активация позы для персонажа
  async activatePose(
    poseId: string,
    characterId: string,
    userId: string
  ): Promise<CharacterPoseStatus> {
    // Проверяем условия
    const conditionResults = await this.checkPoseConditions(poseId, characterId, userId)
    const allConditionsPassed = conditionResults.every(result => result.passed)

    if (!allConditionsPassed) {
      throw new Error('Pose conditions not met')
    }

    // Применяем эффекты при активации
    const effectResults = await this.applyPoseEffects(poseId, characterId, userId)

    const status: CharacterPoseStatus = {
      poseId,
      isActive: true,
      activatedAt: new Date(),
      duration: 0,
      conditionsPassed: conditionResults,
      effectsApplied: effectResults,
      modifiersApplied: []
    }

    // Здесь должна быть логика сохранения статуса позы в базе данных
    // Пока просто возвращаем статус

    return status
  }

  // Деактивация позы для персонажа
  async deactivatePose(
    poseId: string,
    characterId: string,
    userId: string
  ): Promise<CharacterPoseStatus> {
    // Здесь должна быть логика деактивации позы
    // Пока возвращаем базовый статус
    return {
      poseId,
      isActive: false,
      activatedAt: new Date(),
      duration: 0,
      conditionsPassed: [],
      effectsApplied: [],
      modifiersApplied: []
    }
  }

  // Построение контекста для формул
  private async buildFormulaContext(
    characterId: string,
    userId: string,
    poseId: string,
    actionId?: string
  ): Promise<PoseFormulaContext> {
    // Получаем данные персонажа
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        characteristics: {
          include: { definition: true }
        },
        anatomy: {
          include: { definition: true }
        }
      }
    })

    if (!character) {
      throw new Error(`Character ${characterId} not found`)
    }

    // Получаем данные пользователя (или создаем системного)
    let user: any
    if (userId === 'system') {
      // Создаем системного пользователя для автоматических операций
      user = {
        id: 'system',
        name: 'System',
        modifiers: {},
        credits: 0,
        equipment: []
      }
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          equipment: {
            include: { equipment: true }
          }
        }
      })

      if (!user) {
        throw new Error(`User ${userId} not found`)
      }
    }

    // Получаем данные позы
    const pose = await prisma.poseDefinition.findUnique({
      where: { id: poseId }
    })

    if (!pose) {
      throw new Error(`Pose ${poseId} not found`)
    }

    // Получаем данные действия (если указано)
    let action = null
    if (actionId) {
      action = await prisma.action.findUnique({
        where: { id: actionId }
      })
    }

    // Строим контекст
    const context: PoseFormulaContext = {
      character: {
        id: character.id,
        name: character.name,
        characteristics: this.buildCharacteristicsMap(character.characteristics),
        anatomy: this.buildAnatomyMap(character.anatomy),
        currentPoses: [], // TODO: получить активные позы
        timeInCurrentPose: 0 // TODO: вычислить время в текущей позе
      },
      user: {
        id: user.id,
        name: user.name,
        modifiers: (user.modifiers as any) || {},
        credits: user.credits,
        equipment: this.buildEquipmentMap(user.equipment)
      },
      pose: {
        id: pose.id,
        name: pose.name,
        category: pose.category,
        duration: 0, // TODO: вычислить длительность
        isActive: true
      },
      system: {
        gameTime: Date.now(), // TODO: получить игровое время
        realTime: Date.now(),
        timeMultiplier: 1
      },
      custom: {}
    }

    return context
  }

  // Оценка условия
  private async evaluateCondition(
    condition: PoseCondition,
    context: PoseFormulaContext
  ): Promise<PoseConditionResult> {
    let actualValue: any

    // Получаем значение из контекста
    if (condition.type === 'characteristic') {
      actualValue = context.character.characteristics[condition.target]
    } else if (condition.type === 'equipment') {
      actualValue = context.user.equipment[condition.target] || 0
    } else if (condition.type === 'custom') {
      // Выполняем формулу для получения значения
      // TODO: Реализовать выполнение формулы для условий
      actualValue = condition.value
    } else {
      actualValue = this.getContextValue(condition.target, context)
    }

    // Проверяем условие
    const passed = this.compareValues(actualValue, condition.operator, condition.value)

    return {
      conditionId: condition.id,
      passed,
      actualValue,
      expectedValue: condition.value
    }
  }

  // Оценка эффекта
  private async evaluateEffect(
    effect: PoseEffect,
    context: PoseFormulaContext
  ): Promise<PoseEffectResult> {
    const oldValue = this.getContextValue(effect.target, context)

    // Простое выполнение формулы (пока без полной интеграции с FormulaEngine)
    let newValue = oldValue
    try {
      // Простая замена переменных в формуле
      let formula = effect.formula
      formula = formula.replace(/character\.mood/g, context.character.characteristics.mood || 0)
      formula = formula.replace(/character\.energy/g, context.character.characteristics.energy || 0)
      formula = formula.replace(/pose\.duration/g, context.pose.duration || 0)

      // Простое вычисление (только для простых формул)
      if (formula.includes('+')) {
        const parts = formula.split('+')
        newValue = parts.reduce((sum, part) => sum + (parseFloat(part.trim()) || 0), 0)
      } else if (formula.includes('*')) {
        const parts = formula.split('*')
        newValue = parts.reduce((product, part) => product * (parseFloat(part.trim()) || 1), 1)
      } else {
        newValue = parseFloat(formula) || oldValue
      }
    } catch (error) {
      console.error('Ошибка выполнения формулы эффекта:', error)
      newValue = oldValue
    }

    const change = newValue - oldValue

    // TODO: Применить изменение к характеристике в базе данных

    return {
      effectId: effect.id,
      target: effect.target,
      oldValue,
      newValue,
      change,
      success: true
    }
  }

  // Оценка модификатора
  private async evaluateModifier(
    modifier: PoseModifier,
    context: PoseFormulaContext
  ): Promise<PoseModifierResult> {
    const originalValue = this.getContextValue(modifier.target, context)

    // Простое выполнение формулы модификатора
    let modifiedValue = originalValue
    try {
      // Простая замена переменных в формуле
      let formula = modifier.formula
      formula = formula.replace(/action\.intensity/g, context.action?.intensity || 0)
      formula = formula.replace(/action\.cost/g, context.action?.cost || 0)
      formula = formula.replace(/action\.duration/g, context.action?.duration || 0)

      // Простое вычисление (только для простых формул)
      if (formula.includes('*')) {
        const parts = formula.split('*')
        modifiedValue = parts.reduce((product, part) => product * (parseFloat(part.trim()) || 1), 1)
      } else if (formula.includes('+')) {
        const parts = formula.split('+')
        modifiedValue = parts.reduce((sum, part) => sum + (parseFloat(part.trim()) || 0), 0)
      } else {
        modifiedValue = parseFloat(formula) || originalValue
      }
    } catch (error) {
      console.error('Ошибка выполнения формулы модификатора:', error)
      modifiedValue = originalValue
    }

    const multiplier = originalValue > 0 ? modifiedValue / originalValue : 1

    return {
      modifierId: modifier.id,
      target: modifier.target,
      originalValue,
      modifiedValue,
      multiplier,
      success: true
    }
  }

  // Получение значения из контекста по пути
  private getContextValue(path: string, context: PoseFormulaContext): any {
    const parts = path.split('.')
    let value: any = context

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return undefined
      }
    }

    return value
  }

  // Сравнение значений
  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq': return actual === expected
      case 'ne': return actual !== expected
      case 'gt': return actual > expected
      case 'gte': return actual >= expected
      case 'lt': return actual < expected
      case 'lte': return actual <= expected
      case 'in': return Array.isArray(expected) && expected.includes(actual)
      case 'not_in': return Array.isArray(expected) && !expected.includes(actual)
      default: return false
    }
  }

  // Построение карты характеристик
  private buildCharacteristicsMap(characteristics: any[]): Record<string, number> {
    const map: Record<string, number> = {}
    for (const char of characteristics) {
      map[char.definition.name] = char.currentValue
    }
    return map
  }

  // Построение карты анатомии
  private buildAnatomyMap(anatomy: any[]): Record<string, number> {
    const map: Record<string, number> = {}
    for (const part of anatomy) {
      map[part.definition.name] = part.sensitivity
    }
    return map
  }

  // Построение карты оборудования
  private buildEquipmentMap(equipment: any[]): Record<string, number> {
    const map: Record<string, number> = {}
    for (const item of equipment) {
      map[item.equipment.name] = item.quantity
    }
    return map
  }
}
