// personal-characteristics-system.ts
// Система персональных характеристик для копий персонажей

import { prisma } from '../../db/client'
import { KnowledgeLevel } from '@prisma/client'

export class PersonalCharacteristicsSystem {
  // Получить персональные характеристики копии персонажа
  async getCopyCharacteristics(characterCopyId: string) {
    return await prisma.characterCopyCharacteristic.findMany({
      where: { characterCopyId },
      include: {
        definition: true
      }
    })
  }

  // Получить характеристику по имени для копии
  async getCharacteristicByName(characterCopyId: string, characteristicName: string): Promise<{ id: string; name: string } | null> {
    const characteristic = await prisma.characterCopyCharacteristic.findFirst({
      where: {
        characterCopyId,
        definition: {
          name: characteristicName
        }
      },
      include: {
        definition: true
      }
    })

    if (!characteristic) {
      return null
    }

    return {
      id: characteristic.characteristicDefId,
      name: characteristic.definition.name
    }
  }

  // Изменить значение персональной характеристики
  async changeValue(
    characterCopyId: string,
    characteristicId: string,
    change: number,
    permanent: boolean = false,
    userId?: string
  ): Promise<void> {
    const characteristic = await prisma.characterCopyCharacteristic.findUnique({
      where: {
        characterCopyId_characteristicDefId: {
          characterCopyId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) {
      return
    }

    const oldValue = characteristic.currentValue
    const newValue = Math.max(0, Math.min(100, characteristic.currentValue + change))

    await prisma.characterCopyCharacteristic.update({
      where: {
        characterCopyId_characteristicDefId: {
          characterCopyId,
          characteristicDefId: characteristicId
        }
      },
      data: {
        currentValue: newValue,
        lastChanged: new Date(),
        timeInAlteredState: permanent ? 0 : characteristic.timeInAlteredState + 1
      }
    })

    // Если постоянное изменение, сдвигаем базовое значение
    if (permanent) {
      await this.shiftBaseValue(characterCopyId, characteristicId, change)
    }

    // Проверить раскрытие характеристики
    if (userId) {
      await this.checkReveal(characterCopyId, characteristicId, newValue, userId)
    }
  }

  // Восстановление к базовому значению
  async recoverToBase(characterCopyId: string, characteristicId: string): Promise<void> {
    const characteristic = await prisma.characterCopyCharacteristic.findUnique({
      where: {
        characterCopyId_characteristicDefId: {
          characterCopyId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    await prisma.characterCopyCharacteristic.update({
      where: {
        characterCopyId_characteristicDefId: {
          characterCopyId,
          characteristicDefId: characteristicId
        }
      },
      data: {
        currentValue: characteristic.baseValue,
        lastChanged: new Date(),
        timeInAlteredState: 0
      }
    })
  }

  // Сдвиг базового значения
  private async shiftBaseValue(characterCopyId: string, characteristicId: string, change: number): Promise<void> {
    const characteristic = await prisma.characterCopyCharacteristic.findUnique({
      where: {
        characterCopyId_characteristicDefId: {
          characterCopyId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const newBaseValue = Math.max(0, Math.min(100, characteristic.baseValue + change))

    await prisma.characterCopyCharacteristic.update({
      where: {
        characterCopyId_characteristicDefId: {
          characterCopyId,
          characteristicDefId: characteristicId
        }
      },
      data: {
        baseValue: newBaseValue
      }
    })
  }

  // Проверка раскрытия характеристики
  private async checkReveal(
    characterCopyId: string,
    characteristicId: string,
    newValue: number,
    userId: string
  ): Promise<void> {
    const characteristic = await prisma.characterCopyCharacteristic.findUnique({
      where: {
        characterCopyId_characteristicDefId: {
          characterCopyId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) {
      return
    }

    const changePercent = Math.abs(newValue - characteristic.baseValue) / characteristic.baseValue * 100
    let newLevel: KnowledgeLevel = KnowledgeLevel.UNKNOWN

    if (changePercent >= 60) {
      newLevel = KnowledgeLevel.PRECISE
    } else if (changePercent >= 40) {
      newLevel = KnowledgeLevel.DETAILED
    } else if (changePercent >= 20) {
      newLevel = KnowledgeLevel.APPROXIMATE
    }

    // Получаем characterId из копии для создания знаний
    const characterCopy = await prisma.characterCopy.findUnique({
      where: { id: characterCopyId }
    })

    if (!characterCopy) {
      return
    }

    // Проверяем текущие знания пользователя
    const existingKnowledge = await prisma.characterKnowledge.findUnique({
      where: {
        userId_characterId_characteristicDefId: {
          userId,
          characterId: characterCopy.characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    // Логируем только если уровень знаний изменился и это значимое изменение
    if ((!existingKnowledge || existingKnowledge.level !== newLevel) && newLevel !== KnowledgeLevel.UNKNOWN) {
      const revealedValue = this.calculateRevealedValue(newValue, newLevel)
      const accuracy = this.getAccuracy(newLevel)

      console.log(`🔍 [PERSONAL-REVEAL] Новое раскрытие!`, {
        characteristic: characteristic.definition?.name || 'Unknown',
        oldLevel: existingKnowledge?.level || 'UNKNOWN',
        newLevel,
        changePercent: changePercent.toFixed(1) + '%',
        revealedValue: Math.round(revealedValue),
        accuracy: accuracy + '%'
      })

      await prisma.characterKnowledge.upsert({
        where: {
          userId_characterId_characteristicDefId: {
            userId,
            characterId: characterCopy.characterId,
            characteristicDefId: characteristicId
          }
        },
        update: {
          level: newLevel,
          value: revealedValue,
          accuracy: accuracy,
          lastRevealed: new Date()
        },
        create: {
          userId,
          characterId: characterCopy.characterId,
          characteristicDefId: characteristicId,
          level: newLevel,
          value: revealedValue,
          accuracy: accuracy,
          lastRevealed: new Date()
        }
      })
    } else if (!existingKnowledge && newLevel === KnowledgeLevel.UNKNOWN) {
      // Создаем запись UNKNOWN без логирования
      await prisma.characterKnowledge.create({
        data: {
          userId,
          characterId: characterCopy.characterId,
          characteristicDefId: characteristicId,
          level: newLevel,
          value: 0,
          accuracy: 100,
          lastRevealed: new Date()
        }
      })
    }
  }

  // Вычислить раскрытое значение
  private calculateRevealedValue(actualValue: number, level: KnowledgeLevel): number {
    switch (level) {
      case KnowledgeLevel.PRECISE:
        return actualValue
      case KnowledgeLevel.DETAILED:
        return actualValue + (Math.random() - 0.5) * actualValue * 0.3 // ±15%
      case KnowledgeLevel.APPROXIMATE:
        return actualValue + (Math.random() - 0.5) * actualValue * 0.6 // ±30%
      default:
        return 0
    }
  }

  // Получить точность для уровня
  private getAccuracy(level: KnowledgeLevel): number {
    switch (level) {
      case KnowledgeLevel.PRECISE:
        return 0
      case KnowledgeLevel.DETAILED:
        return 15
      case KnowledgeLevel.APPROXIMATE:
        return 30
      default:
        return 100
    }
  }

  // Получить все персональные характеристики копии персонажа
  async getCharacterCopyCharacteristics(characterCopyId: string) {
    return await prisma.characterCopyCharacteristic.findMany({
      where: { characterCopyId },
      include: {
        definition: true
      }
    })
  }

  // Создать персональные характеристики для новой копии
  async createCharacteristicsForCopy(characterCopyId: string, characterId: string): Promise<void> {
    // Получаем характеристики оригинального персонажа
    const originalCharacteristics = await prisma.characteristic.findMany({
      where: { characterId },
      include: {
        definition: true
      }
    })

    // Создаем персональные характеристики на основе оригинальных
    const characteristicsToCreate = originalCharacteristics.map(char => ({
      characterCopyId,
      characteristicDefId: char.characteristicDefId,
      currentValue: char.currentValue,
      baseValue: char.baseValue,
      recoveryRate: char.recoveryRate,
      lastChanged: char.lastChanged,
      timeInAlteredState: char.timeInAlteredState
    }))

    if (characteristicsToCreate.length > 0) {
      await prisma.characterCopyCharacteristic.createMany({
        data: characteristicsToCreate
      })
    }
  }
}
