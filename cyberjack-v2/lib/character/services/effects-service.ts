import { prisma } from '../../db/client'
import { CharacterMemoryManager } from '../memory-manager'
import { ActionMessageSystemManager } from '../action-message-system'
import { serverLogger, LogCategory } from '../../utils/server-logger'

interface EffectsServiceDeps {
  memoryManager: CharacterMemoryManager
  actionMessageSystem: ActionMessageSystemManager
}

export class CharacterEffectsService {
  constructor(private readonly deps: EffectsServiceDeps) {}

  async applyCharacteristicInfluence(characterId: string, influence: any): Promise<any> {
    try {
      serverLogger.debug(LogCategory.AI, 'Применяем влияние на характеристику', {
        characterId,
        characteristicName: influence.characteristicName,
        influence: influence.influence,
        confidence: influence.confidence,
        reason: influence.reason
      })

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
        const newValue = Math.max(0, Math.min(100, characteristic.currentValue + influence.influence))

        await prisma.characteristic.update({
          where: { id: characteristic.id },
          data: {
            currentValue: newValue,
            lastChanged: new Date()
          }
        })

        await this.deps.memoryManager.createCharacteristicChangeMemory(
          characterId,
          influence.characteristicName,
          characteristic.currentValue,
          newValue,
          influence.reason
        )

        return {
          name: influence.characteristicName,
          oldValue,
          newValue,
          change: influence.influence
        }
      }
    } catch (error) {
      serverLogger.error(LogCategory.AI, 'Ошибка при применении влияния на характеристику', {
        characterId,
        influence,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    return null
  }

  async executeActionTrigger(characterId: string, userId: string, trigger: any): Promise<void> {
    try {
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
        await this.deps.actionMessageSystem.registerAction(
          characterId,
          userId,
          action.name,
          trigger.intensity || 50,
          trigger.targetZone
        )
      }
    } catch (error) {
      serverLogger.error(LogCategory.AI, 'Ошибка при выполнении триггера действия', {
        characterId,
        trigger,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async applyMoodChange(characterId: string, moodChange: any): Promise<void> {
    try {
      await this.deps.memoryManager.createEmotionalMemory(
        characterId,
        moodChange.moodType,
        moodChange.trigger,
        Math.abs(moodChange.change)
      )
    } catch (error) {
      serverLogger.error(LogCategory.AI, 'Ошибка при применении изменения настроения', {
        characterId,
        moodChange,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
