// lib/core/poses/active-poses-system.ts

import { prisma } from '@/lib/db/client'
import { CharacterPoseStatus } from '@/types/pose-formulas'

export class ActivePosesSystem {
  private static instance: ActivePosesSystem

  static getInstance(): ActivePosesSystem {
    if (!ActivePosesSystem.instance) {
      ActivePosesSystem.instance = new ActivePosesSystem()
    }
    return ActivePosesSystem.instance
  }

  // Получить активные позы персонажа
  async getActivePoses(characterId: string): Promise<CharacterPoseStatus[]> {
    try {
      // Пока используем простую реализацию - получаем все позы персонажа
      // В будущем здесь будет отдельная таблица для отслеживания активных поз
      const characterPoses = await prisma.characterPose.findMany({
        where: {
          characterId,
          isActive: true
        },
        include: {
          definition: {
            select: {
              id: true,
              name: true,
              category: true,
              effects: true,
              requirements: true
            }
          }
        }
      })

      return characterPoses.map(pose => ({
        poseId: pose.definition.id,
        isActive: pose.isActive,
        activatedAt: new Date(), // TODO: добавить поле в схему
        duration: 0, // TODO: вычислить реальную длительность
        conditionsPassed: [],
        effectsApplied: [],
        modifiersApplied: []
      }))
    } catch (error) {
      console.error('Error getting active poses:', error)
      return []
    }
  }

  // Активировать позу для персонажа
  async activatePose(
    characterId: string,
    poseId: string,
    userId: string
  ): Promise<CharacterPoseStatus | null> {
    try {
      // Проверяем, что поза существует
      const pose = await prisma.poseDefinition.findUnique({
        where: { id: poseId }
      })

      if (!pose) {
        throw new Error(`Pose ${poseId} not found`)
      }

      // Проверяем, что у персонажа есть эта поза
      const characterPose = await prisma.characterPose.findUnique({
        where: {
          characterId_poseDefId: {
            characterId,
            poseDefId: poseId
          }
        }
      })

      if (!characterPose) {
        throw new Error(`Character ${characterId} does not have pose ${poseId}`)
      }

      // Активируем позу
      await prisma.characterPose.update({
        where: {
          characterId_poseDefId: {
            characterId,
            poseDefId: poseId
          }
        },
        data: {
          isActive: true
        }
      })

      // TODO: Сохранить время активации в отдельной таблице
      const status: CharacterPoseStatus = {
        poseId,
        isActive: true,
        activatedAt: new Date(),
        duration: 0,
        conditionsPassed: [],
        effectsApplied: [],
        modifiersApplied: []
      }

      return status
    } catch (error) {
      console.error('Error activating pose:', error)
      return null
    }
  }

  // Деактивировать позу для персонажа
  async deactivatePose(
    characterId: string,
    poseId: string
  ): Promise<boolean> {
    try {
      await prisma.characterPose.update({
        where: {
          characterId_poseDefId: {
            characterId,
            poseDefId: poseId
          }
        },
        data: {
          isActive: false
        }
      })

      return true
    } catch (error) {
      console.error('Error deactivating pose:', error)
      return false
    }
  }

  // Получить все активные позы всех персонажей
  async getAllActivePoses(): Promise<Array<{
    characterId: string
    poses: CharacterPoseStatus[]
  }>> {
    try {
      const characters = await prisma.character.findMany({
        where: { isActive: true },
        select: { id: true }
      })

      const result = []
      for (const character of characters) {
        const activePoses = await this.getActivePoses(character.id)
        if (activePoses.length > 0) {
          result.push({
            characterId: character.id,
            poses: activePoses
          })
        }
      }

      return result
    } catch (error) {
      console.error('Error getting all active poses:', error)
      return []
    }
  }

  // Проверить, активна ли поза у персонажа
  async isPoseActive(characterId: string, poseId: string): Promise<boolean> {
    try {
      const characterPose = await prisma.characterPose.findUnique({
        where: {
          characterId_poseDefId: {
            characterId,
            poseDefId: poseId
          }
        },
        select: { isActive: true }
      })

      return characterPose?.isActive || false
    } catch (error) {
      console.error('Error checking pose status:', error)
      return false
    }
  }

  // Получить время активации позы (в минутах игрового времени)
  async getPoseActivationTime(characterId: string, poseId: string): Promise<number> {
    try {
      // TODO: Реализовать получение реального времени активации
      // Пока возвращаем 0
      return 0
    } catch (error) {
      console.error('Error getting pose activation time:', error)
      return 0
    }
  }

  // Обновить длительность позы
  async updatePoseDuration(characterId: string, poseId: string, duration: number): Promise<void> {
    try {
      // TODO: Реализовать обновление длительности в базе данных
      console.log(`Updating pose ${poseId} duration for character ${characterId}: ${duration} minutes`)
    } catch (error) {
      console.error('Error updating pose duration:', error)
    }
  }
}
