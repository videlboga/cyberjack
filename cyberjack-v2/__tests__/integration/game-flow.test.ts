// __tests__/integration/game-flow.test.ts

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { CharacteristicsSystem } from '@/lib/core/characteristics/characteristics-system'
import { ActionsSystem } from '@/lib/core/actions/actions-system'
import { TimeSystem } from '@/lib/core/time/time-system'

const prisma = new PrismaClient()

describe('Game Flow Integration', () => {
  let characteristicsSystem: CharacteristicsSystem
  let actionsSystem: ActionsSystem
  let timeSystem: TimeSystem
  let testCharacterId: string
  let testActionId: string
  let testUserId: string
  let testZoneId: string

  beforeEach(async () => {
    characteristicsSystem = new CharacteristicsSystem()
    actionsSystem = new ActionsSystem()
    timeSystem = TimeSystem.getInstance()

    // Создаем тестового пользователя
    const user = await prisma.user.create({
      data: {
        email: 'integration@example.com',
        name: 'Integration Test User',
        role: 'USER',
        credits: 5000,
        modifiers: { experience: 1.5, efficiency: 1.3 }
      }
    })
    testUserId = user.id

    // Создаем тестового персонажа
    const character = await prisma.character.create({
      data: {
        name: 'Integration Test Character',
        description: 'Character for integration tests',
        age: 25,
        isActive: true,
        prompts: {
          personality: 'Test personality for integration',
          speech_style: 'Test speech style',
          reactions: 'Test reactions'
        }
      }
    })
    testCharacterId = character.id

    // Создаем определения характеристик
    const moodDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'mood',
        category: 'Emotional',
        description: 'Character mood',
        minValue: 0,
        maxValue: 100
      }
    })

    const arousalDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'arousal',
        category: 'Sexual',
        description: 'Character arousal',
        minValue: 0,
        maxValue: 100
      }
    })

    const energyDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'energy',
        category: 'Physical',
        description: 'Character energy',
        minValue: 0,
        maxValue: 100
      }
    })

    const submissionDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'submission',
        category: 'Psychological',
        description: 'Character submission level',
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
          currentValue: 60,
          baseValue: 60,
          recoveryRate: 1.2
        },
        {
          characterId: testCharacterId,
          characteristicDefId: arousalDef.id,
          currentValue: 20,
          baseValue: 20,
          recoveryRate: 0.8
        },
        {
          characterId: testCharacterId,
          characteristicDefId: energyDef.id,
          currentValue: 80,
          baseValue: 80,
          recoveryRate: 1.5
        },
        {
          characterId: testCharacterId,
          characteristicDefId: submissionDef.id,
          currentValue: 30,
          baseValue: 30,
          recoveryRate: 0.5
        }
      ]
    })

    // Создаем тестовое действие
    const action = await prisma.action.create({
      data: {
        name: 'Gentle Touch',
        category: 'Intimate',
        description: 'Gentle touching action',
        intensity: 40,
        formula: {
          factors: [
            { category: 'input', name: 'characteristic.mood', value: 0.1 },
            { category: 'input', name: 'characteristic.arousal', value: 0.15 },
            { category: 'input', name: 'characteristic.submission', value: 0.05 }
          ]
        },
        requirements: { energy: 10 }
      }
    })
    testActionId = action.id

    // Создаем тестовую зону
    const anatomyDef = await prisma.anatomyDefinition.create({
      data: {
        name: 'Chest',
        category: 'Primary',
        description: 'Chest area'
      }
    })

    const poseDef = await prisma.poseDefinition.create({
      data: {
        name: 'Standing',
        category: 'Basic',
        description: 'Standing pose',
        effects: { energy: -0.1 },
        requirements: { energy: 5 }
      }
    })

    const poseAngle = await prisma.poseAngle.create({
      data: {
        poseDefId: poseDef.id,
        name: 'Front',
        angle: 'front',
        media: { images: [], videos: [], gifs: [] }
      }
    })

    const zone = await prisma.activeZone.create({
      data: {
        angleId: poseAngle.id,
        anatomyDefId: anatomyDef.id,
        name: 'Chest Zone',
        x: 0.5,
        y: 0.3,
        width: 0.2,
        height: 0.15
      }
    })
    testZoneId = zone.id

    // Создаем анатомию персонажа
    await prisma.characterAnatomy.create({
      data: {
        characterId: testCharacterId,
        anatomyDefId: anatomyDef.id,
        hasPart: true,
        sensitivity: 70
      }
    })

    // Создаем знания пользователя о персонаже
    await prisma.characterKnowledge.createMany({
      data: [
        {
          userId: testUserId,
          characterId: testCharacterId,
          level: 'APPROXIMATE',
          lastRevealed: new Date()
        },
        {
          userId: testUserId,
          characterId: testCharacterId,
          characteristicDefId: moodDef.id,
          level: 'UNKNOWN'
        },
        {
          userId: testUserId,
          characterId: testCharacterId,
          characteristicDefId: arousalDef.id,
          level: 'UNKNOWN'
        }
      ]
    })
  })

  afterEach(async () => {
    // Очищаем тестовые данные
    await prisma.characterKnowledge.deleteMany({
      where: { userId: testUserId }
    })
    await prisma.characterAnatomy.deleteMany({
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

  describe('Complete action flow', () => {
    test('should execute action and update characteristics', async () => {
      // Получаем начальные значения
      const initialMood = await characteristicsSystem.getCurrentValue(testCharacterId, 'mood')
      const initialArousal = await characteristicsSystem.getCurrentValue(testCharacterId, 'arousal')
      const initialSubmission = await characteristicsSystem.getCurrentValue(testCharacterId, 'submission')

      // Выполняем действие
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        120 // 2 минуты
      )

      expect(result.success).toBe(true)
      expect(result.effects.length).toBeGreaterThan(0)

      // Проверяем изменения характеристик
      const newMood = await characteristicsSystem.getCurrentValue(testCharacterId, 'mood')
      const newArousal = await characteristicsSystem.getCurrentValue(testCharacterId, 'arousal')
      const newSubmission = await characteristicsSystem.getCurrentValue(testCharacterId, 'submission')

      expect(newMood).toBeGreaterThan(initialMood)
      expect(newArousal).toBeGreaterThan(initialArousal)
      expect(newSubmission).toBeGreaterThan(initialSubmission)
    })

    test('should reveal characteristics based on changes', async () => {
      // Выполняем действие с большим изменением
      await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        300 // 5 минут для значительного изменения
      )

      // Проверяем раскрытие характеристик
      const moodKnowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: (await prisma.characteristicDefinition.findFirst({ where: { name: 'mood' } }))!.id
          }
        }
      })

      const arousalKnowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: (await prisma.characteristicDefinition.findFirst({ where: { name: 'arousal' } }))!.id
          }
        }
      })

      expect(moodKnowledge?.level).not.toBe('UNKNOWN')
      expect(arousalKnowledge?.level).not.toBe('UNKNOWN')
    })

    test('should create action log with correct data', async () => {
      const duration = 180 // 3 минуты

      await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        duration
      )

      const logs = await prisma.actionLog.findMany({
        where: {
          actionId: testActionId,
          characterId: testCharacterId,
          userId: testUserId
        }
      })

      expect(logs.length).toBe(1)
      expect(logs[0].duration).toBe(duration)
      expect(logs[0].success).toBe(true)
      expect(logs[0].effects).toBeDefined()
    })
  })

  describe('Time system integration', () => {
    test('should advance time during action hold', async () => {
      const initialTime = timeSystem.getGameTime()

      timeSystem.startActionHold()

      // Симулируем время выполнения действия
      await new Promise(resolve => setTimeout(resolve, 100)) // 100ms реального времени
      timeSystem.update()

      timeSystem.stopActionHold()

      const finalTime = timeSystem.getGameTime()
      expect(finalTime).toBeGreaterThan(initialTime)
    })

    test('should trigger recovery after time advance', async () => {
      // Изменяем характеристику
      await characteristicsSystem.changeValue(testCharacterId, 'mood', 20)

      const changedMood = await characteristicsSystem.getCurrentValue(testCharacterId, 'mood')
      expect(changedMood).toBe(80) // 60 + 20

      // Продвигаем время для восстановления
      timeSystem.advanceTime(10) // 10 минут игрового времени

      // Характеристика должна начать восстанавливаться
      await characteristicsSystem.recoverToBase(testCharacterId, 'mood')

      const recoveredMood = await characteristicsSystem.getCurrentValue(testCharacterId, 'mood')
      expect(recoveredMood).toBeLessThan(changedMood)
    })
  })

  describe('Character state persistence', () => {
    test('should maintain character state across multiple actions', async () => {
      // Выполняем несколько действий подряд
      for (let i = 0; i < 3; i++) {
        await actionsSystem.executeActionWithHold(
          testCharacterId,
          testActionId,
          testUserId,
          testZoneId,
          60 // 1 минута каждое
        )
      }

      // Проверяем, что характеристики накопились
      const finalMood = await characteristicsSystem.getCurrentValue(testCharacterId, 'mood')
      const finalArousal = await characteristicsSystem.getCurrentValue(testCharacterId, 'arousal')

      expect(finalMood).toBeGreaterThan(60) // Начальное значение
      expect(finalArousal).toBeGreaterThan(20) // Начальное значение

      // Проверяем логи действий
      const logs = await prisma.actionLog.findMany({
        where: {
          characterId: testCharacterId,
          userId: testUserId
        }
      })

      expect(logs.length).toBe(3)
    })

    test('should handle character recovery over time', async () => {
      // Изменяем характеристики
      await characteristicsSystem.changeValue(testCharacterId, 'mood', -30)
      await characteristicsSystem.changeValue(testCharacterId, 'arousal', 40)

      const changedMood = await characteristicsSystem.getCurrentValue(testCharacterId, 'mood')
      const changedArousal = await characteristicsSystem.getCurrentValue(testCharacterId, 'arousal')

      // Продвигаем время и восстанавливаем
      timeSystem.advanceTime(20) // 20 минут

      await characteristicsSystem.recoverToBase(testCharacterId, 'mood')
      await characteristicsSystem.recoverToBase(testCharacterId, 'arousal')

      const recoveredMood = await characteristicsSystem.getCurrentValue(testCharacterId, 'mood')
      const recoveredArousal = await characteristicsSystem.getCurrentValue(testCharacterId, 'arousal')

      expect(recoveredMood).toBeGreaterThan(changedMood) // Восстановилось
      expect(recoveredArousal).toBeLessThan(changedArousal) // Восстановилось
    })
  })

  describe('User knowledge progression', () => {
    test('should progressively reveal character information', async () => {
      // Начальное состояние - неизвестные характеристики
      const initialMoodKnowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: (await prisma.characteristicDefinition.findFirst({ where: { name: 'mood' } }))!.id
          }
        }
      })

      expect(initialMoodKnowledge?.level).toBe('UNKNOWN')

      // Выполняем действие с небольшим изменением
      await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        60
      )

      // Проверяем, что знание обновилось
      const updatedMoodKnowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: (await prisma.characteristicDefinition.findFirst({ where: { name: 'mood' } }))!.id
          }
        }
      })

      expect(updatedMoodKnowledge?.level).not.toBe('UNKNOWN')
      expect(updatedMoodKnowledge?.value).toBeDefined()
      expect(updatedMoodKnowledge?.accuracy).toBeDefined()
    })
  })

  describe('Error handling and edge cases', () => {
    test('should handle concurrent actions gracefully', async () => {
      // Выполняем несколько действий одновременно
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          actionsSystem.executeActionWithHold(
            testCharacterId,
            testActionId,
            testUserId,
            testZoneId,
            30
          )
        )
      }

      const results = await Promise.all(promises)

      // Все действия должны выполниться успешно
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // Проверяем, что создались все логи
      const logs = await prisma.actionLog.findMany({
        where: {
          characterId: testCharacterId,
          userId: testUserId
        }
      })

      expect(logs.length).toBe(5)
    })

    test('should handle invalid zone gracefully', async () => {
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        'invalid-zone-id',
        60
      )

      // Действие должно выполниться даже с неверной зоной
      expect(result.success).toBe(true)
    })

    test('should handle zero duration action', async () => {
      const result = await actionsSystem.executeActionWithHold(
        testCharacterId,
        testActionId,
        testUserId,
        testZoneId,
        0
      )

      expect(result.success).toBe(true)
      expect(result.effects).toBeDefined()
    })
  })
})
