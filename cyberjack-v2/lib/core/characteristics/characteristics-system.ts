// lib/core/characteristics/characteristics-system.ts

import { prisma } from '@/lib/db/client'
import { KnowledgeLevel } from '@/types/database'

export class CharacteristicsSystem {
  // Получить текущее значение характеристики
  async getCurrentValue(characterId: string, characteristicId: string): Promise<number> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })
    return characteristic?.currentValue || 0
  }

  // Изменить значение характеристики
  async changeValue(
    characterId: string,
    characteristicId: string,
    change: number,
    permanent: boolean = false
  ): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const newValue = Math.max(0, Math.min(100, characteristic.currentValue + change))

    await prisma.characteristic.update({
      where: {
        characterId_characteristicDefId: {
          characterId,
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
      await this.shiftBaseValue(characterId, characteristicId, change)
    }

    // Проверить раскрытие характеристики
    await this.checkReveal(characterId, characteristicId, newValue)
  }

  // Восстановление к базовому значению
  async recoverToBase(characterId: string, characteristicId: string): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const difference = characteristic.baseValue - characteristic.currentValue
    const recoveryAmount = Math.sign(difference) * Math.min(
      Math.abs(difference),
      characteristic.recoveryRate
    )

    if (recoveryAmount !== 0) {
      await prisma.characteristic.update({
        where: {
          characterId_characteristicDefId: {
            characterId,
            characteristicDefId: characteristicId
          }
        },
        data: {
          currentValue: characteristic.currentValue + recoveryAmount,
          lastRecovery: new Date()
        }
      })
    }
  }

  // Сдвиг базового значения
  private async shiftBaseValue(
    characterId: string,
    characteristicId: string,
    change: number
  ): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const newBaseValue = Math.max(0, Math.min(100, characteristic.baseValue + change))

    await prisma.characteristic.update({
      where: {
        characterId_characteristicDefId: {
          characterId,
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
    characterId: string,
    characteristicId: string,
    newValue: number
  ): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const changePercent = Math.abs(newValue - characteristic.baseValue) / characteristic.baseValue * 100
    let newLevel: KnowledgeLevel = KnowledgeLevel.UNKNOWN

    if (changePercent >= 60) {
      newLevel = KnowledgeLevel.PRECISE
    } else if (changePercent >= 40) {
      newLevel = KnowledgeLevel.DETAILED
    } else if (changePercent >= 20) {
      newLevel = KnowledgeLevel.APPROXIMATE
    }

    // Обновить знания всех пользователей
    await prisma.characterKnowledge.updateMany({
      where: {
        characterId,
        characteristicDefId: characteristicId,
        level: {
          not: newLevel
        }
      },
      data: {
        level: newLevel,
        value: this.calculateRevealedValue(newValue, newLevel),
        accuracy: this.getAccuracy(newLevel),
        lastRevealed: new Date()
      }
    })
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

  // Получить все характеристики персонажа
  async getCharacterCharacteristics(characterId: string) {
    return await prisma.characteristic.findMany({
      where: { characterId },
      include: {
        definition: true
      }
    })
  }

  // Создать характеристику для персонажа
  async createCharacteristic(
    characterId: string,
    characteristicDefId: string,
    currentValue: number,
    baseValue: number,
    recoveryRate: number = 1.0
  ) {
    return await prisma.characteristic.create({
      data: {
        characterId,
        characteristicDefId,
        currentValue,
        baseValue,
        recoveryRate
      },
      include: {
        definition: true
      }
    })
  }

  // Обновить настройки восстановления
  async updateRecoverySettings(
    characterId: string,
    characteristicId: string,
    recoveryRate: number,
    shiftThreshold: number,
    shiftRate: number
  ) {
    return await prisma.characteristic.update({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      },
      data: {
        recoveryRate,
        shiftThreshold,
        shiftRate
      }
    })
  }

  // Проверить сдвиг базового значения
  async checkBaseShift(characterId: string, characteristicId: string): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    // Если время в измененном состоянии превышает порог
    if (characteristic.timeInAlteredState >= characteristic.shiftThreshold) {
      const shiftAmount = characteristic.shiftRate * Math.sign(characteristic.currentValue - characteristic.baseValue)

      if (Math.abs(shiftAmount) > 0.01) {
        await this.shiftBaseValue(characterId, characteristicId, shiftAmount)

        // Сбросить время в измененном состоянии
        await prisma.characteristic.update({
          where: {
            characterId_characteristicDefId: {
              characterId,
              characteristicDefId: characteristicId
            }
          },
          data: {
            timeInAlteredState: 0
          }
        })
      }
    }
  }
}

