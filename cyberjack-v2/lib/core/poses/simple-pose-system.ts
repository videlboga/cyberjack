/**
 * Простая система поз с эффектами каждую игровую минуту
 */

import { SimpleEffectsSystem, SimpleActionEffects } from '../actions/simple-effects-system'
import { prisma } from '../../db/client'

export class SimplePoseSystem {
  private effectsSystem: SimpleEffectsSystem

  constructor() {
    this.effectsSystem = new SimpleEffectsSystem()
  }

  /**
   * Применяет эффекты текущей позы каждую игровую минуту
   */
  async applyPoseEffects(characterId: string): Promise<void> {
    try {
      // Получаем текущую позу персонажа
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          currentPose: true,
          characteristics: {
            include: {
              definition: true
            }
          }
        }
      })

      if (!character || !character.currentPose) {
        console.log(`⚠️ Персонаж ${characterId} не найден или не имеет активной позы`)
        return
      }

      // Вычисляем эффекты позы
      const poseEffects = this.effectsSystem.calculatePoseEffects(character.currentPose.name)

      // Применяем эффекты каждую минуту
      await this.applyEffectsToCharacter(characterId, poseEffects.perMinute)

      console.log(`✅ Применены эффекты позы "${character.currentPose.name}" к персонажу ${characterId}`)
    } catch (error) {
      console.error('❌ Ошибка применения эффектов позы:', error)
    }
  }

  /**
   * Применяет эффекты к характеристикам персонажа
   */
  private async applyEffectsToCharacter(
    characterId: string,
    effects: SimpleActionEffects
  ): Promise<void> {
    for (const [characteristicName, effect] of Object.entries(effects)) {
      try {
        // Находим характеристику по имени
        const characteristic = await prisma.characteristic.findFirst({
          where: {
            characterId: characterId,
            definition: {
              name: characteristicName
            }
          },
          include: {
            definition: true
          }
        })

        if (!characteristic) {
          console.log(`⚠️ Характеристика "${characteristicName}" не найдена для персонажа ${characterId}`)
          continue
        }

        // Вычисляем новое значение
        let newValue = characteristic.currentValue + effect.change

        // Ограничиваем значения в пределах 0-100
        newValue = Math.max(0, Math.min(100, newValue))

        // Обновляем характеристику
        await prisma.characteristic.update({
          where: { id: characteristic.id },
          data: {
            currentValue: newValue,
            // Если эффект постоянный, обновляем базовое значение
            ...(effect.permanent && {
              baseValue: newValue
            })
          }
        })

        console.log(`📊 ${characteristicName}: ${characteristic.currentValue} → ${newValue} (${effect.change > 0 ? '+' : ''}${effect.change})`)
      } catch (error) {
        console.error(`❌ Ошибка обновления характеристики "${characteristicName}":`, error)
      }
    }
  }

  /**
   * Получает модификаторы позы для действий
   */
  getPoseActionModifiers(poseName: string): Record<string, number> {
    const poseEffects = this.effectsSystem.calculatePoseEffects(poseName)
    return poseEffects.actionModifiers
  }

  /**
   * Применяет эффекты позы к действию
   */
  applyPoseToAction(
    actionEffects: SimpleActionEffects,
    actionType: string,
    poseName: string
  ): SimpleActionEffects {
    const poseEffects = this.effectsSystem.calculatePoseEffects(poseName)
    return this.effectsSystem.applyPoseModifiers(actionEffects, actionType, poseEffects)
  }
}
