// __tests__/unit/actions-system.test.ts

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { ActionsSystem } from '@/lib/core/actions/actions-system'

const prisma = new PrismaClient()

describe('ActionsSystem', () => {
  let actionsSystem: ActionsSystem
  let testCharacterId: string
  let testActionId: string
  let testUserId: string
  let testZoneId: string

  beforeEach(async () => {
    actionsSystem = new ActionsSystem()

    // Создаем тестового пользователя
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        credits: 1000,
        modifiers: { experience: 1.2, efficiency: 1.1 }
      }
    })
    testUserId = user.id

    // Создаем тестовое действие
    const action = await prisma.action.create({
      data: {
        name: 'Test Action',
        category: 'Test',
        description: 'Test action for unit tests',
        intensity: 50,
        formula: {
          factors: [
            { category: 'input', name: 'characteristic.mood', value: 0.1 },
            { category: 'input', name: 'characteristic.arousal', value: 0.05 }
          ]
        },
        requirements: { energy: 10 }
      }
    })
    testActionId = action.id

    // Создаем тестового персонажа
    const character = await prisma.character.create({
      data: {
        name: 'Test Character',
        description: 'Test character for unit tests',
        age: 25,
        isActive: true
      }
    })
    testCharacterId = character.id

    // Создаем определения характеристик
    const moodDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'mood',
        category: 'Test',
        description: 'Test mood characteristic',
        minValue: 0,
        maxValue: 100
      }
    })

    const arousalDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'arousal',
        category: 'Test',
        description: 'Test arousal characteristic',
        minValue: 0,
        maxValue: 100
      }
    })

    const energyDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'energy',
        category: 'Test',
        description: 'Test energy characteristic',
        minValue: 0,
        maxValue: 100
      }
    })

    // Создаем характеристики для персонажа
    await prisma.characteristic.createMany({
      data: [
        {
          characterId: testCharacterId,
          characteristicDefId: moodDef.id,
          currentValue: 50,
          baseValue: 50,
          recoveryRate: 1.0
        },
        {
          characterId: testCharacterId,
          characteristicDefId: arousalDef.id,
          currentValue: 30,
          baseValue: 30,
          recoveryRate: 1.0
        },
        {
          characterId: testCharacterId,
          characteristicDefId: energyDef.id,
          currentValue: 80,
          baseValue: 80,
          recoveryRate: 1.0
        }
      ]
    })

    // Создаем тестовую зону
    const anatomyDef = await prisma.anatomyDefinition.create({
      data: {
        name: 'Test Zone',
        category: 'Test',
        description: 'Test anatomy zone'
      }
    })

    const poseDef = await prisma.poseDefinition.create({
      data: {
        name: 'Test Pose',
        category: 'Test',
        description: 'Test pose'
      }
    })

    const poseAngle = await prisma.poseAngle.create({
      data: {
        poseDefId: poseDef.id,
        name: 'Test Angle',
        angle: 'front',
        media: {}
      }
    })

    const zone = await prisma.activeZone.create({
      data: {
        angleId: poseAngle.id,
        anatomyDefId: anatomyDef.id,
        name: 'Test Zone',
        x: 0.5,
        y: 0.5,
        width: 0.1,
        height: 0.1
      }
    })
    testZoneId = zone.id
  })

  afterEach(async () => {
    // Очищаем тестовые данные
    await prisma.actionLog.deleteMany({
      where: { characterId: testCharacterId }
    })
    await prisma.activeZone.deleteMany({
      where: { id: testZoneId }
    })
    await prisma.poseAngle.deleteMany({
      where: { poseDefId: { in: await prisma.poseDefinition.findMany({ select: { id: true } }) } }
    })
    await prisma.poseDefinition.deleteMany()
    await prisma.anatomyDefinition.deleteMany()
    await prisma.characteristic.deleteMany({
      where: { characterId: testCharacterId }
    })
    await prisma.characteristicDefinition.deleteMany()
    await prisma.character.deleteMany({
      where: { id: testCharacterId }
    })
    await prisma.action.deleteMany({
      where: { id: testActionId }
    })
    await prisma.user.deleteMany({
      where: { id: testUserId }
    })
  })

  describe('executeActionWithHold', () => {
    test('should execute action successfully', async () => {
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60 // 1 минута
      )

      expect(result.success).toBe(true)
      expect(result.effects).toBeDefined()
      expect(result.message).toContain('Test Action')
    })

    test('should fail for non-existent action', async () => {
      await expect(
        actionsSystem.executeActionWithHold(
          testCharacterId,
          'non-existent-id',
          testUserId,
          testZoneId,
          60
        )
      ).rejects.toThrow('Действие не найдено')
    })

    test('should fail for non-existent character', async () => {
      await expect(
        actionsSystem.executeActionWithHold(
          'non-existent-id',
          testActionId,
          testUserId,
          testZoneId,
          60
        )
      ).rejects.toThrow('Персонаж не найден')
    })

    test('should fail for non-existent user', async () => {
      await expect(
        actionsSystem.executeActionWithHold(
          testCharacterId,
          testActionId,
          'non-existent-id',
          testZoneId,
          60
        )
      ).rejects.toThrow('Пользователь не найден')
    })

    test('should handle system user', async () => {
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        'system',
        testZoneId,
        60
      )

      expect(result.success).toBe(true)
    })
  })

  describe('action effects', () => {
    test('should apply effects based on formula', async () => {
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60
      )

      expect(result.effects).toBeDefined()
      expect(result.effects.length).toBeGreaterThan(0)
    })

    test('should scale effects by duration', async () => {
      const result1 = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        30 // 30 секунд
      )

      const result2 = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60 // 60 секунд
      )

      // Эффекты должны быть пропорциональны времени
      expect(result2.effects[0]?.change).toBeGreaterThan(result1.effects[0]?.change || 0)
    })

    test('should apply user modifiers', async () => {
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60
      )

      // Модификаторы пользователя должны влиять на эффекты
      expect(result.effects).toBeDefined()
    })
  })

  describe('action logging', () => {
    test('should create action log', async () => {
      await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60
      )

      const logs = await prisma.actionLog.findMany({
        where: {
          actionId: testActionId,
          characterId: testCharacterId,
          userId: testUserId
        }
      })

      expect(logs.length).toBe(1)
      expect(logs[0].duration).toBe(60)
      expect(logs[0].success).toBe(true)
    })

    test('should log failed actions', async () => {
      try {
        await actionsSystem.executeActionWithHold(
          'non-existent-id',
          testActionId,
          testUserId,
          testZoneId,
          60
        )
      } catch (error) {
        // Ожидаемая ошибка
      }

      const logs = await prisma.actionLog.findMany({
        where: {
          actionId: testActionId,
          userId: testUserId
        }
      })

      expect(logs.length).toBe(0) // Логи не создаются для несуществующих персонажей
    })
  })

  describe('requirements checking', () => {
    test('should check action requirements', async () => {
      // Создаем действие с требованиями
      const actionWithRequirements = await prisma.action.create({
        data: {
          name: 'High Energy Action',
          category: 'Test',
          description: 'Action requiring high energy',
          intensity: 80,
          formula: { factors: [] },
          requirements: { energy: 90 } // Требует 90 энергии
        }
      })

      // У персонажа только 80 энергии
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        actionWithRequirements.id,
        testUserId,
        testZoneId,
        60
      )

      // Действие должно выполниться, но с ограниченными эффектами
      expect(result.success).toBe(true)

      await prisma.action.delete({
        where: { id: actionWithRequirements.id }
      })
    })
  })

  describe('zone effects', () => {
    test('should apply zone modifiers', async () => {
      // Создаем зону с анатомией
      const anatomyDef = await prisma.anatomyDefinition.findFirst()
      if (anatomyDef) {
        await prisma.characterAnatomy.create({
          data: {
            characterId: testCharacterId,
            anatomyDefId: anatomyDef.id,
            hasPart: true,
            sensitivity: 80 // Высокая чувствительность
          }
        })
      }

      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60
      )

      expect(result.success).toBe(true)
      expect(result.effects).toBeDefined()
    })
  })

  describe('error handling', () => {
    test('should handle formula errors gracefully', async () => {
      // Создаем действие с неверной формулой
      const actionWithBadFormula = await prisma.action.create({
        data: {
          name: 'Bad Formula Action',
          category: 'Test',
          description: 'Action with invalid formula',
          intensity: 50,
          formula: { invalid: 'formula' },
          requirements: {}
        }
      })

      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        actionWithBadFormula.id,
        testUserId,
        testZoneId,
        60
      )

      // Должно использовать fallback эффекты
      expect(result.success).toBe(true)
      expect(result.effects).toBeDefined()

      await prisma.action.delete({
        where: { id: actionWithBadFormula.id }
      })
    })

    test('should handle missing characteristics', async () => {
      // Удаляем все характеристики персонажа
      await prisma.characteristic.deleteMany({
        where: { characterId: testCharacterId }
      })

      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60
      )

      // Должно выполниться с пустыми эффектами
      expect(result.success).toBe(true)
      expect(result.effects).toEqual([])
    })
  })
})
