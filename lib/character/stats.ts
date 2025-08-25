import { CharacterStats, Character } from './types'

/**
 * Менеджер характеристик персонажей
 * Управляет валидацией, изменением и описанием характеристик
 */
export class StatsManager {
  private readonly MIN_STAT = 0
  private readonly MAX_STAT = 10

  /**
   * Валидирует характеристики персонажа
   */
  validateStats(stats: CharacterStats): boolean {
    try {
      // Проверяем физические характеристики
      this.validateStatCategory(stats.physical, 'physical')
      
      // Проверяем психологические характеристики
      this.validateStatCategory(stats.psychological, 'psychological')
      
      // Проверяем социальные характеристики
      this.validateStatCategory(stats.social, 'social')
      
      // Проверяем личностные характеристики
      this.validateStatCategory(stats.personality, 'personality')
      
      // Проверяем специальные характеристики
      this.validateStatCategory(stats.special, 'special')
      
      return true
    } catch (error) {
      console.error('Ошибка валидации характеристик:', error)
      return false
    }
  }

  /**
   * Валидирует категорию характеристик
   */
  private validateStatCategory(category: any, categoryName: string): void {
    for (const [statName, value] of Object.entries(category)) {
      if (typeof value !== 'number') {
        throw new Error(`Характеристика ${categoryName}.${statName} должна быть числом`)
      }
      
      if (value < this.MIN_STAT || value > this.MAX_STAT) {
        throw new Error(`Характеристика ${categoryName}.${statName} должна быть в диапазоне ${this.MIN_STAT}-${this.MAX_STAT}`)
      }
    }
  }

  /**
   * Обновляет характеристики персонажа
   */
  updateStats(character: Character, changes: Partial<CharacterStats>): void {
    // Применяем изменения к каждой категории
    if (changes.physical) {
      character.stats.physical = this.mergeStatCategory(
        character.stats.physical,
        changes.physical
      )
    }

    if (changes.psychological) {
      character.stats.psychological = this.mergeStatCategory(
        character.stats.psychological,
        changes.psychological
      )
    }

    if (changes.social) {
      character.stats.social = this.mergeStatCategory(
        character.stats.social,
        changes.social
      )
    }

    if (changes.personality) {
      character.stats.personality = this.mergeStatCategory(
        character.stats.personality,
        changes.personality
      )
    }

    if (changes.special) {
      character.stats.special = this.mergeStatCategory(
        character.stats.special,
        changes.special
      )
    }

    // Валидируем обновленные характеристики
    if (!this.validateStats(character.stats)) {
      throw new Error('Обновленные характеристики не прошли валидацию')
    }
  }

  /**
   * Объединяет категорию характеристик с изменениями
   */
  private mergeStatCategory(current: any, changes: any): any {
    const result = { ...current }
    
    for (const [statName, changeValue] of Object.entries(changes)) {
      if (typeof changeValue === 'number') {
        result[statName] = this.clampStatValue(changeValue)
      }
    }
    
    return result
  }

  /**
   * Ограничивает значение характеристики в диапазоне 0-10
   */
  clampStatValue(value: number): number {
    return Math.max(this.MIN_STAT, Math.min(this.MAX_STAT, value))
  }

  /**
   * Рассчитывает изменения характеристик на основе воздействия
   */
  calculateStatChanges(impact: any, currentStats: CharacterStats): Partial<CharacterStats> {
    const changes: Partial<CharacterStats> = {}

    // Анализируем воздействие и применяем изменения
    if (impact.threat > 0.3) {
      // Высокая угроза снижает эмоциональную стабильность и самооценку
      changes.psychological = {
        emotionalStability: this.clampStatValue(currentStats.psychological.emotionalStability - 0.5)
      }
      changes.personality = {
        selfEsteem: this.clampStatValue(currentStats.personality.selfEsteem - 0.3)
      }
    }

    if (impact.pleasure > 0.5) {
      // Высокое удовольствие повышает оптимизм и эмпатию
      changes.personality = {
        ...changes.personality,
        optimism: this.clampStatValue(currentStats.personality.optimism + 0.3)
      }
      changes.social = {
        empathy: this.clampStatValue(currentStats.social.empathy + 0.2)
      }
    }

    if (impact.pain > 0.4) {
      // Боль снижает выносливость и чувствительность
      changes.physical = {
        endurance: this.clampStatValue(currentStats.physical.endurance - 0.3),
        sensitivity: this.clampStatValue(currentStats.physical.sensitivity + 0.2)
      }
    }

    if (impact.fear > 0.6) {
      // Страх снижает адаптивность и общительность
      changes.psychological = {
        ...changes.psychological,
        adaptability: this.clampStatValue(currentStats.psychological.adaptability - 0.4)
      }
      changes.social = {
        ...changes.social,
        sociability: this.clampStatValue(currentStats.social.sociability - 0.3)
      }
    }

    if (impact.arousal > 0.7) {
      // Высокое возбуждение повышает сексуальную опытность
      changes.special = {
        sexualExperience: this.clampStatValue(currentStats.special.sexualExperience + 0.2)
      }
    }

    return changes
  }

  /**
   * Получает описание характеристики по значению
   */
  getStatDescription(statName: string, value: number): string {
    const descriptions = this.getStatDescriptions(statName)
    
    if (value <= 2) return descriptions.veryLow
    if (value <= 4) return descriptions.low
    if (value <= 6) return descriptions.medium
    if (value <= 8) return descriptions.high
    return descriptions.veryHigh
  }

  /**
   * Получает описания для конкретной характеристики
   */
  private getStatDescriptions(statName: string): any {
    const descriptions: { [key: string]: any } = {
      // Физические характеристики
      endurance: {
        veryLow: 'Очень низкая выносливость, быстро устает',
        low: 'Низкая выносливость, нуждается в отдыхе',
        medium: 'Средняя выносливость, может выдерживать нагрузки',
        high: 'Высокая выносливость, устойчив к усталости',
        veryHigh: 'Очень высокая выносливость, практически неутомим'
      },
      sensitivity: {
        veryLow: 'Очень низкая чувствительность, почти не реагирует',
        low: 'Низкая чувствительность, слабые реакции',
        medium: 'Средняя чувствительность, нормальные реакции',
        high: 'Высокая чувствительность, сильные реакции',
        veryHigh: 'Очень высокая чувствительность, гиперчувствительность'
      },
      flexibility: {
        veryLow: 'Очень низкая гибкость, скованность',
        low: 'Низкая гибкость, ограниченная подвижность',
        medium: 'Средняя гибкость, нормальная подвижность',
        high: 'Высокая гибкость, хорошая подвижность',
        veryHigh: 'Очень высокая гибкость, экстремальная подвижность'
      },

      // Психологические характеристики
      emotionalStability: {
        veryLow: 'Очень нестабилен эмоционально, частые перепады',
        low: 'Нестабилен эмоционально, легко расстраивается',
        medium: 'Средняя эмоциональная стабильность',
        high: 'Стабилен эмоционально, спокойный',
        veryHigh: 'Очень стабилен эмоционально, невозмутимый'
      },
      adaptability: {
        veryLow: 'Очень плохо адаптируется к изменениям',
        low: 'Плохо адаптируется к новым ситуациям',
        medium: 'Средняя адаптивность к изменениям',
        high: 'Хорошо адаптируется к новым ситуациям',
        veryHigh: 'Отлично адаптируется к любым изменениям'
      },
      intelligence: {
        veryLow: 'Очень низкий интеллект, простые мысли',
        low: 'Низкий интеллект, базовое понимание',
        medium: 'Средний интеллект, нормальное понимание',
        high: 'Высокий интеллект, глубокое понимание',
        veryHigh: 'Очень высокий интеллект, аналитическое мышление'
      },

      // Социальные характеристики
      sociability: {
        veryLow: 'Очень необщителен, избегает контактов',
        low: 'Необщителен, предпочитает одиночество',
        medium: 'Средняя общительность, нормальное общение',
        high: 'Общителен, легко находит общий язык',
        veryHigh: 'Очень общителен, душа компании'
      },
      empathy: {
        veryLow: 'Очень низкая эмпатия, не понимает чувства других',
        low: 'Низкая эмпатия, редко сопереживает',
        medium: 'Средняя эмпатия, понимает чувства других',
        high: 'Высокая эмпатия, легко сопереживает',
        veryHigh: 'Очень высокая эмпатия, глубоко чувствует других'
      },
      dominance: {
        veryLow: 'Очень подчиняемый, всегда уступает',
        low: 'Подчиняемый, редко проявляет инициативу',
        medium: 'Средняя доминантность, баланс',
        high: 'Доминантный, берет инициативу',
        veryHigh: 'Очень доминантный, всегда лидер'
      },

      // Личностные характеристики
      selfEsteem: {
        veryLow: 'Очень низкая самооценка, считает себя ничтожеством',
        low: 'Низкая самооценка, неуверен в себе',
        medium: 'Средняя самооценка, нормальная уверенность',
        high: 'Высокая самооценка, уверен в себе',
        veryHigh: 'Очень высокая самооценка, самоуверенность'
      },
      optimism: {
        veryLow: 'Очень пессимистичен, видит только плохое',
        low: 'Пессимистичен, редко надеется на лучшее',
        medium: 'Средний оптимизм, реалистичный взгляд',
        high: 'Оптимистичен, верит в лучшее',
        veryHigh: 'Очень оптимистичен, всегда видит возможности'
      },
      curiosity: {
        veryLow: 'Очень низкое любопытство, не интересуется ничем',
        low: 'Низкое любопытство, редко задает вопросы',
        medium: 'Среднее любопытство, нормальный интерес',
        high: 'Высокое любопытство, всегда хочет узнать больше',
        veryHigh: 'Очень высокое любопытство, исследует все'
      },

      // Специальные характеристики
      sexualExperience: {
        veryLow: 'Очень неопытен, ничего не знает',
        low: 'Неопытен, базовые знания',
        medium: 'Средний опыт, нормальные знания',
        high: 'Опытен, хорошие знания',
        veryHigh: 'Очень опытен, эксперт'
      },
      resistance: {
        veryLow: 'Очень низкое сопротивление, легко поддается',
        low: 'Низкое сопротивление, быстро сдается',
        medium: 'Среднее сопротивление, нормальная стойкость',
        high: 'Высокое сопротивление, стойкий',
        veryHigh: 'Очень высокое сопротивление, непоколебимый'
      },
      dependency: {
        veryLow: 'Очень независим, не нуждается в других',
        low: 'Независим, редко просит помощи',
        medium: 'Средняя зависимость, нормальная самостоятельность',
        high: 'Зависим, часто нуждается в поддержке',
        veryHigh: 'Очень зависим, не может без других'
      },
      fetishSensitivity: {
        veryLow: 'Очень низкая чувствительность к фетишам',
        low: 'Низкая чувствительность к фетишам',
        medium: 'Средняя чувствительность к фетишам',
        high: 'Высокая чувствительность к фетишам',
        veryHigh: 'Очень высокая чувствительность к фетишам'
      },
      fetishDiscovery: {
        veryLow: 'Очень низкая готовность открывать фетиши',
        low: 'Низкая готовность открывать фетиши',
        medium: 'Средняя готовность открывать фетиши',
        high: 'Высокая готовность открывать фетиши',
        veryHigh: 'Очень высокая готовность открывать фетиши'
      }
    }

    return descriptions[statName] || {
      veryLow: 'Очень низкое значение',
      low: 'Низкое значение',
      medium: 'Среднее значение',
      high: 'Высокое значение',
      veryHigh: 'Очень высокое значение'
    }
  }

  /**
   * Получает краткое описание всех характеристик персонажа
   */
  getCharacterStatsSummary(character: Character): string {
    const stats = character.stats
    const summary = []

    // Физические характеристики
    summary.push('**Физические:**')
    summary.push(`- Выносливость: ${stats.physical.endurance}/10 (${this.getStatDescription('endurance', stats.physical.endurance)})`)
    summary.push(`- Чувствительность: ${stats.physical.sensitivity}/10 (${this.getStatDescription('sensitivity', stats.physical.sensitivity)})`)
    summary.push(`- Гибкость: ${stats.physical.flexibility}/10 (${this.getStatDescription('flexibility', stats.physical.flexibility)})`)

    // Психологические характеристики
    summary.push('\n**Психологические:**')
    summary.push(`- Эмоциональная стабильность: ${stats.psychological.emotionalStability}/10 (${this.getStatDescription('emotionalStability', stats.psychological.emotionalStability)})`)
    summary.push(`- Адаптивность: ${stats.psychological.adaptability}/10 (${this.getStatDescription('adaptability', stats.psychological.adaptability)})`)
    summary.push(`- Интеллект: ${stats.psychological.intelligence}/10 (${this.getStatDescription('intelligence', stats.psychological.intelligence)})`)

    // Социальные характеристики
    summary.push('\n**Социальные:**')
    summary.push(`- Общительность: ${stats.social.sociability}/10 (${this.getStatDescription('sociability', stats.social.sociability)})`)
    summary.push(`- Эмпатия: ${stats.social.empathy}/10 (${this.getStatDescription('empathy', stats.social.empathy)})`)
    summary.push(`- Доминантность: ${stats.social.dominance}/10 (${this.getStatDescription('dominance', stats.social.dominance)})`)

    // Личностные характеристики
    summary.push('\n**Личностные:**')
    summary.push(`- Самооценка: ${stats.personality.selfEsteem}/10 (${this.getStatDescription('selfEsteem', stats.personality.selfEsteem)})`)
    summary.push(`- Оптимизм: ${stats.personality.optimism}/10 (${this.getStatDescription('optimism', stats.personality.optimism)})`)
    summary.push(`- Любопытство: ${stats.personality.curiosity}/10 (${this.getStatDescription('curiosity', stats.personality.curiosity)})`)

    // Специальные характеристики
    summary.push('\n**Специальные:**')
    summary.push(`- Сексуальная опытность: ${stats.special.sexualExperience}/10 (${this.getStatDescription('sexualExperience', stats.special.sexualExperience)})`)
    summary.push(`- Сопротивляемость: ${stats.special.resistance}/10 (${this.getStatDescription('resistance', stats.special.resistance)})`)
    summary.push(`- Зависимость: ${stats.special.dependency}/10 (${this.getStatDescription('dependency', stats.special.dependency)})`)
    summary.push(`- Чувствительность к фетишам: ${stats.special.fetishSensitivity}/10 (${this.getStatDescription('fetishSensitivity', stats.special.fetishSensitivity)})`)
    summary.push(`- Готовность открывать фетиши: ${stats.special.fetishDiscovery}/10 (${this.getStatDescription('fetishDiscovery', stats.special.fetishDiscovery)})`)

    return summary.join('\n')
  }

  /**
   * Создает базовые характеристики для архетипа
   */
  createBaseStats(archetype: string): CharacterStats {
    // Базовые характеристики для разных архетипов
    const archetypeStats: { [key: string]: CharacterStats } = {
      'feminine_student': {
        physical: {
          endurance: 4,
          sensitivity: 8,
          flexibility: 7
        },
        psychological: {
          emotionalStability: 5,
          adaptability: 6,
          intelligence: 7
        },
        social: {
          sociability: 6,
          empathy: 7,
          dominance: 2
        },
        personality: {
          selfEsteem: 4,
          optimism: 5,
          curiosity: 7
        },
        special: {
          sexualExperience: 2,
          resistance: 3,
          dependency: 7,
          fetishSensitivity: 8,
          fetishDiscovery: 6
        }
      },
      'dominant_master': {
        physical: {
          endurance: 8,
          sensitivity: 5,
          flexibility: 6
        },
        psychological: {
          emotionalStability: 8,
          adaptability: 7,
          intelligence: 8
        },
        social: {
          sociability: 7,
          empathy: 4,
          dominance: 9
        },
        personality: {
          selfEsteem: 8,
          optimism: 6,
          curiosity: 5
        },
        special: {
          sexualExperience: 8,
          resistance: 8,
          dependency: 2,
          fetishSensitivity: 6,
          fetishDiscovery: 4
        }
      },
      'innocent_victim': {
        physical: {
          endurance: 3,
          sensitivity: 9,
          flexibility: 5
        },
        psychological: {
          emotionalStability: 3,
          adaptability: 4,
          intelligence: 6
        },
        social: {
          sociability: 4,
          empathy: 8,
          dominance: 1
        },
        personality: {
          selfEsteem: 2,
          optimism: 3,
          curiosity: 6
        },
        special: {
          sexualExperience: 1,
          resistance: 2,
          dependency: 9,
          fetishSensitivity: 9,
          fetishDiscovery: 8
        }
      }
    }

    return archetypeStats[archetype] || archetypeStats['feminine_student']
  }
}

// Экспортируем экземпляр для использования
export const statsManager = new StatsManager()
