// lib/core/pricing/character-copy-pricing.ts

import { prisma } from '@/lib/db/client'
import { KnowledgeLevel } from '@prisma/client'

export interface CharacterCopyPricingResult {
  basePrice: number
  characteristicModifier: number
  knowledgeBonus: number
  finalPrice: number
  breakdown: {
    characteristics: {
      highValue: number
      lowValue: number
      extremeValue: number
      averageValue: number
    }
    knowledge: {
      knownCharacteristics: number
      totalCharacteristics: number
      knowledgeRatio: number
      bonusLevel: string
    }
  }
}

export interface CharacterCopyPricingConfig {
  // Модификаторы характеристик
  characteristicModifiers: {
    highValue: number      // +10% за характеристики > 70
    lowValue: number       // -5% за характеристики < 30
    extremeValue: number   // +20% за характеристики > 90
  }

  // Бонусы за знания (повышают цену продажи)
  knowledgeBonuses: {
    full: number           // +30% за полное знание (>80%)
    partial: number        // +15% за частичное знание (50-80%)
    basic: number          // +5% за базовое знание (20-50%)
    none: number           // 0% за отсутствие знаний (<20%)
  }
}

export class CharacterCopyPricingService {
  private static instance: CharacterCopyPricingService
  private config: CharacterCopyPricingConfig

  constructor() {
    this.config = {
      characteristicModifiers: {
        highValue: 0.1,      // +10%
        lowValue: -0.05,     // -5%
        extremeValue: 0.2    // +20%
      },
      knowledgeBonuses: {
        full: 0.3,           // +30%
        partial: 0.15,       // +15%
        basic: 0.05,         // +5%
        none: 0              // 0%
      }
    }
  }

  static getInstance(): CharacterCopyPricingService {
    if (!CharacterCopyPricingService.instance) {
      CharacterCopyPricingService.instance = new CharacterCopyPricingService()
    }
    return CharacterCopyPricingService.instance
  }

  /**
   * Рассчитать цену копии персонажа для пользователя
   */
  async calculateCopyPrice(
    characterId: string,
    userId: string
  ): Promise<CharacterCopyPricingResult> {
    try {
      // Получаем данные персонажа
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          characteristics: {
            include: {
              definition: true
            }
          }
        }
      })

      if (!character) {
        throw new Error('Персонаж не найден')
      }

      // Получаем знания пользователя о персонаже
      const userKnowledge = await prisma.characterKnowledge.findMany({
        where: {
          userId,
          characterId
        }
      })

      // Рассчитываем модификатор характеристик
      const characteristicModifier = this.calculateCharacteristicModifier(character.characteristics)

      // Рассчитываем бонус за знания
      const knowledgeBonus = this.calculateKnowledgeBonus(
        character.characteristics,
        userKnowledge
      )

      // Рассчитываем итоговую цену
      const basePrice = character.price
      const finalPrice = Math.round(
        basePrice * (1 + characteristicModifier) * (1 + knowledgeBonus)
      )

      // Формируем детальную разбивку
      const breakdown = this.generateBreakdown(
        character.characteristics,
        userKnowledge,
        characteristicModifier,
        knowledgeBonus
      )

      return {
        basePrice,
        characteristicModifier,
        knowledgeBonus,
        finalPrice,
        breakdown
      }
    } catch (error) {
      console.error('Ошибка при расчете цены копии персонажа:', error)
      throw error
    }
  }

  /**
   * Рассчитать модификатор на основе характеристик персонажа
   */
  private calculateCharacteristicModifier(characteristics: any[]): number {
    if (characteristics.length === 0) return 0

    let totalModifier = 0
    let processedCharacteristics = 0

    characteristics.forEach(char => {
      const value = char.currentValue
      let modifier = 0

      if (value > 90) {
        modifier = this.config.characteristicModifiers.extremeValue
      } else if (value > 70) {
        modifier = this.config.characteristicModifiers.highValue
      } else if (value < 30) {
        modifier = this.config.characteristicModifiers.lowValue
      }

      totalModifier += modifier
      processedCharacteristics++
    })

    // Возвращаем средний модификатор
    return processedCharacteristics > 0 ? totalModifier / processedCharacteristics : 0
  }

  /**
   * Рассчитать бонус на основе знаний пользователя
   */
  private calculateKnowledgeBonus(
    characteristics: any[],
    userKnowledge: any[]
  ): number {
    if (characteristics.length === 0) return 0

    // Подсчитываем количество известных характеристик
    const knownCharacteristics = userKnowledge.filter(knowledge =>
      knowledge.level !== KnowledgeLevel.UNKNOWN
    ).length

    const totalCharacteristics = characteristics.length
    const knowledgeRatio = knownCharacteristics / totalCharacteristics

    // Определяем уровень бонуса
    if (knowledgeRatio >= 0.8) {
      return this.config.knowledgeBonuses.full
    } else if (knowledgeRatio >= 0.5) {
      return this.config.knowledgeBonuses.partial
    } else if (knowledgeRatio >= 0.2) {
      return this.config.knowledgeBonuses.basic
    } else {
      return this.config.knowledgeBonuses.none
    }
  }

  /**
   * Сгенерировать детальную разбивку расчета
   */
  private generateBreakdown(
    characteristics: any[],
    userKnowledge: any[],
    characteristicModifier: number,
    knowledgeBonus: number
  ) {
    // Анализ характеристик
    const highValue = characteristics.filter(c => c.currentValue > 70).length
    const lowValue = characteristics.filter(c => c.currentValue < 30).length
    const extremeValue = characteristics.filter(c => c.currentValue > 90).length
    const averageValue = characteristics.reduce((sum, c) => sum + c.currentValue, 0) / characteristics.length

    // Анализ знаний
    const knownCharacteristics = userKnowledge.filter(k => k.level !== KnowledgeLevel.UNKNOWN).length
    const totalCharacteristics = characteristics.length
    const knowledgeRatio = totalCharacteristics > 0 ? knownCharacteristics / totalCharacteristics : 0

    let bonusLevel = 'none'
    if (knowledgeRatio >= 0.8) bonusLevel = 'full'
    else if (knowledgeRatio >= 0.5) bonusLevel = 'partial'
    else if (knowledgeRatio >= 0.2) bonusLevel = 'basic'

    return {
      characteristics: {
        highValue,
        lowValue,
        extremeValue,
        averageValue: Math.round(averageValue * 100) / 100
      },
      knowledge: {
        knownCharacteristics,
        totalCharacteristics,
        knowledgeRatio: Math.round(knowledgeRatio * 100) / 100,
        bonusLevel
      }
    }
  }

  /**
   * Обновить конфигурацию ценообразования
   */
  updateConfig(newConfig: Partial<CharacterCopyPricingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }

  /**
   * Получить текущую конфигурацию
   */
  getConfig(): CharacterCopyPricingConfig {
    return { ...this.config }
  }

  /**
   * Рассчитать цену для нескольких персонажей
   */
  async calculateMultipleCopyPrices(
    characterIds: string[],
    userId: string
  ): Promise<Record<string, CharacterCopyPricingResult>> {
    const results: Record<string, CharacterCopyPricingResult> = {}

    for (const characterId of characterIds) {
      try {
        results[characterId] = await this.calculateCopyPrice(characterId, userId)
      } catch (error) {
        console.error(`Ошибка при расчете цены для персонажа ${characterId}:`, error)
      }
    }

    return results
  }
}

// Экспорт синглтона
export const characterCopyPricingService = CharacterCopyPricingService.getInstance()
