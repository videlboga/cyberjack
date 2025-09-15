// __tests__/unit/characteristics-system.test.ts

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { CharacteristicsSystem } from '@/lib/core/characteristics/characteristics-system'
import { KnowledgeLevel } from '@/types/database'

// Используем реальную базу данных для тестов
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
    }
  }
})

describe('CharacteristicsSystem', () => {
  let characteristicsSystem: CharacteristicsSystem
  let testCharacterId: string
  let testCharacteristicId: string
  let testUserId: string

  beforeEach(async () => {
    characteristicsSystem = new CharacteristicsSystem()

    // Создаем тестового пользователя
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'USER',
        credits: 1000
      }
    })
    testUserId = user.id

    // Создаем тестовое определение характеристики
    const characteristicDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'Test Characteristic',
        category: 'Test',
        description: 'Test characteristic for unit tests',
        minValue: 0,
        maxValue: 100
      }
    })
    testCharacteristicId = characteristicDef.id

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

    // Создаем характеристику для персонажа
    await prisma.characteristic.create({
      data: {
        characterId: testCharacterId,
        characteristicDefId: testCharacteristicId,
        currentValue: 50,
        baseValue: 50,
        recoveryRate: 1.0
      }
    })

    // Создаем знания пользователя о персонаже
    await prisma.characterKnowledge.create({
      data: {
        userId: testUserId,
        characterId: testCharacterId,
        characteristicDefId: testCharacteristicId,
        level: 'UNKNOWN'
      }
    })
  })

  afterEach(async () => {
    // Очищаем тестовые данные
    await prisma.characterKnowledge.deleteMany({
      where: { userId: testUserId }
    })
    await prisma.characteristic.deleteMany({
      where: { characterId: testCharacterId }
    })
    await prisma.character.deleteMany({
      where: { id: testCharacterId }
    })
    await prisma.characteristicDefinition.deleteMany({
      where: { id: testCharacteristicId }
    })
    await prisma.user.deleteMany({
      where: { id: testUserId }
    })
  })

  describe('getCurrentValue', () => {
    test('should return current value of characteristic', async () => {
      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(50)
    })

    test('should return 0 for non-existent characteristic', async () => {
      const value = await characteristicsSystem.getCurrentValue(testCharacterId, 'non-existent-id')
      expect(value).toBe(0)
    })
  })

  describe('changeValue', () => {
    test('should increase characteristic value', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 10)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(60)
    })

    test('should decrease characteristic value', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, -10)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(40)
    })

    test('should not exceed maximum value', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 100)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(100)
    })

    test('should not go below minimum value', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, -100)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(0)
    })

    test('should update lastChanged timestamp', async () => {
      const before = new Date()
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 10)
      const after = new Date()

      const characteristic = await prisma.characteristic.findUnique({
        where: {
          characterId_characteristicDefId: {
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        }
      })

      expect(characteristic?.lastChanged).toBeDefined()
      expect(characteristic?.lastChanged!.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(characteristic?.lastChanged!.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    test('should shift base value when permanent change', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 10, true)

      const characteristic = await prisma.characteristic.findUnique({
        where: {
          characterId_characteristicDefId: {
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        }
      })

      expect(characteristic?.currentValue).toBe(60)
      expect(characteristic?.baseValue).toBe(60)
    })

    test('should not shift base value when temporary change', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 10, false)

      const characteristic = await prisma.characteristic.findUnique({
        where: {
          characterId_characteristicDefId: {
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        }
      })

      expect(characteristic?.currentValue).toBe(60)
      expect(characteristic?.baseValue).toBe(50)
    })
  })

  describe('recoverToBase', () => {
    test('should recover to base value', async () => {
      // Изменяем значение
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 20)

      // Восстанавливаем
      await characteristicsSystem.recoverToBase(testCharacterId, testCharacteristicId)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(50) // базовое значение
    })

    test('should respect recovery rate', async () => {
      // Устанавливаем низкую скорость восстановления
      await prisma.characteristic.update({
        where: {
          characterId_characteristicDefId: {
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        },
        data: { recoveryRate: 0.5 }
      })

      // Изменяем значение
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 20)

      // Восстанавливаем
      await characteristicsSystem.recoverToBase(testCharacterId, testCharacteristicId)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(60) // 70 - 10 (половина от разности)
    })
  })

  describe('knowledge revelation', () => {
    test('should reveal characteristic on significant change (20%)', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 10) // 20% от 50

      const knowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        }
      })

      expect(knowledge?.level).toBe(KnowledgeLevel.APPROXIMATE)
    })

    test('should reveal characteristic on major change (40%)', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 20) // 40% от 50

      const knowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        }
      })

      expect(knowledge?.level).toBe(KnowledgeLevel.DETAILED)
    })

    test('should reveal characteristic on extreme change (60%)', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 30) // 60% от 50

      const knowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        }
      })

      expect(knowledge?.level).toBe(KnowledgeLevel.PRECISE)
    })

    test('should calculate revealed value with accuracy', async () => {
      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 20) // 40% от 50

      const knowledge = await prisma.characterKnowledge.findUnique({
        where: {
          userId_characterId_characteristicDefId: {
            userId: testUserId,
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        }
      })

      expect(knowledge?.value).toBeDefined()
      expect(knowledge?.accuracy).toBeDefined()
      expect(knowledge?.lastRevealed).toBeDefined()
    })
  })

  describe('edge cases', () => {
    test('should handle zero base value', async () => {
      // Устанавливаем базовое значение в 0
      await prisma.characteristic.update({
        where: {
          characterId_characteristicDefId: {
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        },
        data: { baseValue: 0, currentValue: 0 }
      })

      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, 10)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(10)
    })

    test('should handle maximum base value', async () => {
      // Устанавливаем базовое значение в 100
      await prisma.characteristic.update({
        where: {
          characterId_characteristicDefId: {
            characterId: testCharacterId,
            characteristicDefId: testCharacteristicId
          }
        },
        data: { baseValue: 100, currentValue: 100 }
      })

      await characteristicsSystem.changeValue(testCharacterId, testCharacteristicId, -10)

      const value = await characteristicsSystem.getCurrentValue(testCharacterId, testCharacteristicId)
      expect(value).toBe(90)
    })
  })
})
