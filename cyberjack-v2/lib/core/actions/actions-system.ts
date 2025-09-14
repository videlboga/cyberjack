// lib/core/actions/actions-system.ts

import { prisma } from '@/lib/db/client'
import { CharacteristicsSystem } from '../characteristics/characteristics-system'
import { ActionEffect, ActionResult } from '@/types/database'

export class ActionsSystem {
  // Выполнить действие
  async executeAction(
    characterId: string,
    actionId: string,
    userId: string,
    zoneId?: string
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

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new Error('Пользователь не найден')
    }

    // Проверить требования действия
    const requirementsMet = await this.checkRequirements(action, character, user)
    if (!requirementsMet) {
      throw new Error('Требования действия не выполнены')
    }

    // Проверить кредиты пользователя
    if (user.credits < action.cost) {
      throw new Error('Недостаточно кредитов')
    }

    // Вычислить эффекты действия
    const effects = await this.calculateEffects(action, character, user, zoneId)

    // Применить эффекты
    for (const effect of effects) {
      await this.applyEffect(characterId, effect)
    }

    // Списать кредиты
    await this.deductCredits(userId, action.cost)

    // Создать запись о действии
    await this.logAction(characterId, actionId, userId, effects)

    return {
      success: true,
      effects,
      message: `Действие "${action.name}" выполнено`
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

  // Вычислить эффекты действия
  private async calculateEffects(
    action: any,
    character: any,
    user: any,
    zoneId?: string
  ): Promise<ActionEffect[]> {
    const effects: ActionEffect[] = []
    const actionEffects = action.effects as Record<string, any>

    for (const [characteristicId, effectData] of Object.entries(actionEffects)) {
      let baseChange = effectData.change || 0

      // Модификатор от интенсивности действия
      baseChange *= (action.intensity / 100)

      // Модификатор от пользователя
      const userModifier = user.modifiers[characteristicId] || 1
      baseChange *= userModifier

      // Модификатор от зоны (если есть)
      if (zoneId) {
        const zone = await this.getZone(zoneId)
        if (zone?.anatomy) {
          const anatomy = character.anatomy.find((a: any) => a.definition.id === zone.anatomy?.id)
          if (anatomy) {
            baseChange *= (anatomy.sensitivity / 100)
          }
        }
      }

      effects.push({
        characteristicId,
        change: baseChange,
        permanent: effectData.permanent || false
      })
    }

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

  // Применить эффект
  private async applyEffect(
    characterId: string,
    effect: ActionEffect
  ): Promise<void> {
    const characteristicsSystem = new CharacteristicsSystem()
    await characteristicsSystem.changeValue(
      characterId,
      effect.characteristicId,
      effect.change,
      effect.permanent
    )
  }

  // Списать кредиты
  private async deductCredits(userId: string, amount: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          decrement: amount
        }
      }
    })
  }

  // Записать действие в лог
  private async logAction(
    characterId: string,
    actionId: string,
    userId: string,
    effects: ActionEffect[]
  ): Promise<void> {
    // TODO: Создать таблицу для логов действий
    console.log('Action logged:', {
      characterId,
      actionId,
      userId,
      effects,
      timestamp: new Date()
    })
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

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new Error('Пользователь не найден')
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
    cost?: number
    duration?: number
    effects: Record<string, any>
    requirements: Record<string, any>
  }) {
    return await prisma.action.create({
      data: {
        name: actionData.name,
        category: actionData.category,
        description: actionData.description,
        intensity: actionData.intensity || 5,
        cost: actionData.cost || 10,
        duration: actionData.duration || 30,
        effects: actionData.effects || {},
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
      cost?: number
      duration?: number
      effects?: Record<string, any>
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
}
