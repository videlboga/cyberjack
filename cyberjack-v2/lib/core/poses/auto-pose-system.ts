// lib/core/poses/auto-pose-system.ts

import { prisma } from '@/lib/db/client'
import { PoseFormulaSystem } from './pose-formula-system'
import { ActivePosesSystem } from './active-poses-system'

export class AutoPoseSystem {
  private static instance: AutoPoseSystem
  private poseFormulaSystem: PoseFormulaSystem
  private activePosesSystem: ActivePosesSystem

  static getInstance(): AutoPoseSystem {
    if (!AutoPoseSystem.instance) {
      AutoPoseSystem.instance = new AutoPoseSystem()
    }
    return AutoPoseSystem.instance
  }

  constructor() {
    this.poseFormulaSystem = new PoseFormulaSystem()
    this.activePosesSystem = ActivePosesSystem.getInstance()
  }

  // Проверить и применить автоматические позы для всех персонажей
  async checkAndApplyAutoPoses(): Promise<void> {
    try {
      console.log('🤖 Проверка автоматических поз...')

      // Получить всех активных персонажей
      const characters = await prisma.character.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      })

      for (const character of characters) {
        await this.checkCharacterAutoPoses(character.id)
      }

      console.log('✅ Проверка автоматических поз завершена')
    } catch (error) {
      console.error('❌ Ошибка при проверке автоматических поз:', error)
    }
  }

  // Проверить автоматические позы для конкретного персонажа
  private async checkCharacterAutoPoses(characterId: string): Promise<void> {
    try {
      // Получить все позы персонажа
      const characterPoses = await prisma.characterPose.findMany({
        where: { characterId },
        include: {
          definition: {
            select: {
              id: true,
              name: true,
              category: true,
              requirements: true,
              effects: true
            }
          }
        }
      })

      for (const characterPose of characterPoses) {
        const pose = characterPose.definition
        const isCurrentlyActive = characterPose.isActive

        // Проверить условия позы
        const conditionsMet = await this.poseFormulaSystem.checkPoseConditions(
          pose.id,
          characterId,
          'system'
        )

        if (conditionsMet.length > 0 && conditionsMet.every(c => c.passed)) {
          // Условия выполнены - активировать позу если не активна
          if (!isCurrentlyActive) {
            await this.activatePose(characterId, pose.id, 'auto')
            console.log(`🤖 Автоматически активирована поза "${pose.name}" для персонажа ${characterId}`)
          }
        } else {
          // Условия не выполнены - деактивировать позу если активна
          if (isCurrentlyActive) {
            await this.deactivatePose(characterId, pose.id, 'auto')
            console.log(`🤖 Автоматически деактивирована поза "${pose.name}" для персонажа ${characterId}`)
          }
        }
      }
    } catch (error) {
      console.error(`❌ Ошибка при проверке автоматических поз для персонажа ${characterId}:`, error)
    }
  }

  // Активировать позу
  private async activatePose(characterId: string, poseId: string, reason: string): Promise<void> {
    try {
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

      // Логируем активацию
      console.log(`✅ Поза ${poseId} активирована для персонажа ${characterId} (причина: ${reason})`)
    } catch (error) {
      console.error(`❌ Ошибка активации позы ${poseId} для персонажа ${characterId}:`, error)
    }
  }

  // Деактивировать позу
  private async deactivatePose(characterId: string, poseId: string, reason: string): Promise<void> {
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

      // Логируем деактивацию
      console.log(`❌ Поза ${poseId} деактивирована для персонажа ${characterId} (причина: ${reason})`)
    } catch (error) {
      console.error(`❌ Ошибка деактивации позы ${poseId} для персонажа ${characterId}:`, error)
    }
  }

  // Получить статистику автоматических поз
  async getAutoPoseStats(): Promise<{
    totalCharacters: number
    totalPoses: number
    activePoses: number
    autoActivations: number
    autoDeactivations: number
  }> {
    try {
      const totalCharacters = await prisma.character.count({
        where: { isActive: true }
      })

      const totalPoses = await prisma.characterPose.count()

      const activePoses = await prisma.characterPose.count({
        where: { isActive: true }
      })

      // TODO: Добавить подсчет автоматических активаций/деактиваций в отдельную таблицу

      return {
        totalCharacters,
        totalPoses,
        activePoses,
        autoActivations: 0, // TODO: реализовать
        autoDeactivations: 0 // TODO: реализовать
      }
    } catch (error) {
      console.error('❌ Ошибка получения статистики автоматических поз:', error)
      return {
        totalCharacters: 0,
        totalPoses: 0,
        activePoses: 0,
        autoActivations: 0,
        autoDeactivations: 0
      }
    }
  }

  // Принудительно проверить позы для персонажа
  async forceCheckCharacterPoses(characterId: string): Promise<{
    checked: number
    activated: number
    deactivated: number
  }> {
    try {
      let activated = 0
      let deactivated = 0

      // Получить все позы персонажа
      const characterPoses = await prisma.characterPose.findMany({
        where: { characterId },
        include: {
          definition: {
            select: {
              id: true,
              name: true,
              requirements: true
            }
          }
        }
      })

      for (const characterPose of characterPoses) {
        const pose = characterPose.definition
        const isCurrentlyActive = characterPose.isActive

        // Проверить условия позы
        const conditionsMet = await this.poseFormulaSystem.checkPoseConditions(
          pose.id,
          characterId,
          'system'
        )

        if (conditionsMet.length > 0 && conditionsMet.every(c => c.passed)) {
          if (!isCurrentlyActive) {
            await this.activatePose(characterId, pose.id, 'force')
            activated++
          }
        } else {
          if (isCurrentlyActive) {
            await this.deactivatePose(characterId, pose.id, 'force')
            deactivated++
          }
        }
      }

      return {
        checked: characterPoses.length,
        activated,
        deactivated
      }
    } catch (error) {
      console.error(`❌ Ошибка принудительной проверки поз для персонажа ${characterId}:`, error)
      return {
        checked: 0,
        activated: 0,
        deactivated: 0
      }
    }
  }

  // Получить позы с автоматическими условиями
  async getAutoPoses(): Promise<Array<{
    poseId: string
    poseName: string
    characterId: string
    characterName: string
    isActive: boolean
    conditions: any[]
  }>> {
    try {
      const characterPoses = await prisma.characterPose.findMany({
        where: {
          character: { isActive: true }
        },
        include: {
          definition: {
            select: {
              id: true,
              name: true,
              requirements: true
            }
          },
          character: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      return characterPoses.map(cp => ({
        poseId: cp.definition.id,
        poseName: cp.definition.name,
        characterId: cp.character.id,
        characterName: cp.character.name,
        isActive: cp.isActive,
        conditions: cp.definition.requirements?.conditions || []
      }))
    } catch (error) {
      console.error('❌ Ошибка получения автоматических поз:', error)
      return []
    }
  }
}
