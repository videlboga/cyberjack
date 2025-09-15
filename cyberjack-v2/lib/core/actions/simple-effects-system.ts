/**
 * Простая система эффектов без сложных формул
 * Сохраняет всю функциональность: действия, позы, чат, зависимости, модификаторы
 */

export interface SimpleEffect {
  characteristicName: string
  change: number
  permanent: boolean
}

export interface SimpleActionEffects {
  [characteristicName: string]: {
    change: number
    permanent: boolean
  }
}

export interface SimplePoseEffects {
  // Самостоятельные эффекты позы каждую игровую минуту
  perMinute: SimpleActionEffects
  // Модификаторы к действиям
  actionModifiers: {
    [actionType: string]: number
  }
}

export class SimpleEffectsSystem {
  /**
   * Нормализует тип действия из базы данных в стандартные типы
   */
  private normalizeActionType(actionType: string): string {
    const type = actionType.toLowerCase()

    // Специализированные инструменты - болевые
    if (type.includes('специализированные')) {
      return 'pain'
    }

    // Ручные инструменты - физические
    if (type.includes('ручные')) {
      return 'physical'
    }

    // Дефолт - физическое действие
    return 'physical'
  }

  /**
   * Вычисляет эффекты действия на основе его типа и интенсивности
   */
  calculateActionEffects(
    actionType: string,
    intensity: number,
    durationSeconds: number = 5
  ): SimpleActionEffects {
    const baseMultiplier = intensity / 50 // Нормализуем к 50
    const durationMultiplier = durationSeconds / 5 // Нормализуем к 5 секундам

    const effects: SimpleActionEffects = {}

    // Нормализуем тип действия
    const normalizedType = this.normalizeActionType(actionType)

    switch (normalizedType) {
      case 'physical':
        effects['Энергия'] = {
          change: -1.5 * baseMultiplier * durationMultiplier,
          permanent: false
        }
        effects['Настроение'] = {
          change: 1 * baseMultiplier * durationMultiplier,
          permanent: false
        }
        break

      case 'pain':
        effects['Боль'] = {
          change: 4 * baseMultiplier * durationMultiplier,
          permanent: false
        }
        effects['Стресс'] = {
          change: 1.5 * baseMultiplier * durationMultiplier,
          permanent: false
        }
        effects['Покорность'] = {
          change: 0.8 * baseMultiplier * durationMultiplier,
          permanent: true
        }
        break

      default:
        // Дефолтные эффекты для неизвестных типов
        effects['Настроение'] = {
          change: 0.5 * baseMultiplier * durationMultiplier,
          permanent: false
        }
    }

    return effects
  }

  /**
   * Вычисляет эффекты позы (самостоятельные + модификаторы)
   */
  calculatePoseEffects(poseName: string): SimplePoseEffects {
    const effects: SimplePoseEffects = {
      perMinute: {},
      actionModifiers: {}
    }

    switch (poseName) {
      case 'Стоя':
        effects.perMinute = {
          'Энергия': { change: -0.5, permanent: false },
          'Усталость': { change: 0.3, permanent: false }
        }
        effects.actionModifiers = {
          physical: 1.0,
          emotional: 1.0,
          sexual: 0.8,
          pain: 1.2
        }
        break

      case 'На коленях':
        effects.perMinute = {
          'Покорность': { change: 0.2, permanent: true },
          'Усталость': { change: 0.5, permanent: false },
          'Стресс': { change: 0.3, permanent: false }
        }
        effects.actionModifiers = {
          physical: 0.9,
          emotional: 1.1,
          sexual: 1.3,
          pain: 1.4
        }
        break

      case 'На четвереньках':
        effects.perMinute = {
          'Покорность': { change: 0.3, permanent: true },
          'Унижение': { change: 0.2, permanent: true },
          'Усталость': { change: 0.7, permanent: false }
        }
        effects.actionModifiers = {
          physical: 0.8,
          emotional: 1.2,
          sexual: 1.5,
          pain: 1.6
        }
        break

      case 'Лёжа на животе':
        effects.perMinute = {
          'Покорность': { change: 0.1, permanent: true },
          'Усталость': { change: -0.2, permanent: false },
          'Стресс': { change: -0.1, permanent: false }
        }
        effects.actionModifiers = {
          physical: 1.1,
          emotional: 0.9,
          sexual: 1.2,
          pain: 1.3
        }
        break

      case 'Лёжа на спине':
        effects.perMinute = {
          'Покорность': { change: 0.1, permanent: true },
          'Усталость': { change: -0.3, permanent: false },
          'Стресс': { change: -0.2, permanent: false }
        }
        effects.actionModifiers = {
          physical: 1.0,
          emotional: 1.0,
          sexual: 1.4,
          pain: 1.1
        }
        break

      case 'Сидя':
        effects.perMinute = {
          'Усталость': { change: 0.1, permanent: false }
        }
        effects.actionModifiers = {
          physical: 1.0,
          emotional: 1.0,
          sexual: 1.0,
          pain: 1.0
        }
        break

      case 'Сидя на корточках':
        effects.perMinute = {
          'Покорность': { change: 0.15, permanent: true },
          'Усталость': { change: 0.4, permanent: false }
        }
        effects.actionModifiers = {
          physical: 0.9,
          emotional: 1.1,
          sexual: 1.2,
          pain: 1.3
        }
        break

      case 'Связанная':
        effects.perMinute = {
          'Покорность': { change: 0.4, permanent: true },
          'Унижение': { change: 0.3, permanent: true },
          'Страх': { change: 0.2, permanent: false },
          'Стресс': { change: 0.4, permanent: false }
        }
        effects.actionModifiers = {
          physical: 0.7,
          emotional: 1.3,
          sexual: 1.6,
          pain: 1.8
        }
        break

      case 'В позе молитвы':
        effects.perMinute = {
          'Покорность': { change: 0.5, permanent: true },
          'Унижение': { change: 0.4, permanent: true },
          'Стресс': { change: 0.5, permanent: false }
        }
        effects.actionModifiers = {
          physical: 0.6,
          emotional: 1.4,
          sexual: 1.7,
          pain: 2.0
        }
        break

      case 'В позе покорности':
        effects.perMinute = {
          'Покорность': { change: 0.6, permanent: true },
          'Унижение': { change: 0.5, permanent: true },
          'Стресс': { change: 0.6, permanent: false }
        }
        effects.actionModifiers = {
          physical: 0.5,
          emotional: 1.5,
          sexual: 1.8,
          pain: 2.2
        }
        break

      default:
        // Дефолтная поза
        effects.perMinute = {
          'Усталость': { change: 0.1, permanent: false }
        }
        effects.actionModifiers = {
          physical: 1.0,
          emotional: 1.0,
          sexual: 1.0,
          pain: 1.0
        }
    }

    return effects
  }

  /**
   * Вычисляет эффекты чата на основе тональности
   */
  calculateChatEffects(emotionalTone: string, intensity: number = 50): SimpleActionEffects {
    const baseMultiplier = intensity / 50
    const effects: SimpleActionEffects = {}

    switch (emotionalTone) {
      case 'positive':
        effects['Настроение'] = { change: 2 * baseMultiplier, permanent: false }
        effects['Доверие'] = { change: 1 * baseMultiplier, permanent: false }
        effects['Стресс'] = { change: -1 * baseMultiplier, permanent: false }
        break

      case 'negative':
        effects['Настроение'] = { change: -2 * baseMultiplier, permanent: false }
        effects['Стресс'] = { change: 2 * baseMultiplier, permanent: false }
        effects['Страх'] = { change: 1 * baseMultiplier, permanent: false }
        break

      case 'dominant':
        effects['Покорность'] = { change: 1.5 * baseMultiplier, permanent: true }
        effects['Страх'] = { change: 1 * baseMultiplier, permanent: false }
        effects['Стресс'] = { change: 1 * baseMultiplier, permanent: false }
        break

      case 'submissive':
        effects['Покорность'] = { change: 0.5 * baseMultiplier, permanent: true }
        effects['Доверие'] = { change: 0.8 * baseMultiplier, permanent: false }
        break

      case 'sexual':
        effects['Возбуждение'] = { change: 3 * baseMultiplier, permanent: false }
        effects['Чувствительность'] = { change: 1 * baseMultiplier, permanent: false }
        break

      case 'humiliating':
        effects['Унижение'] = { change: 2 * baseMultiplier, permanent: true }
        effects['Стыд'] = { change: 1.5 * baseMultiplier, permanent: false }
        effects['Стресс'] = { change: 1 * baseMultiplier, permanent: false }
        break

      default:
        effects['Настроение'] = { change: 0.5 * baseMultiplier, permanent: false }
    }

    return effects
  }

  /**
   * Применяет модификаторы пользователя к эффектам
   */
  applyUserModifiers(
    effects: SimpleActionEffects,
    userModifiers: any = {}
  ): SimpleActionEffects {
    const modifiedEffects: SimpleActionEffects = {}

    for (const [characteristicName, effect] of Object.entries(effects)) {
      let modifier = 1.0

      // Применяем общий модификатор
      if (userModifiers.general) {
        modifier *= userModifiers.general
      }

      // Применяем специфичные модификаторы
      if (userModifiers[characteristicName.toLowerCase()]) {
        modifier *= userModifiers[characteristicName.toLowerCase()]
      }

      modifiedEffects[characteristicName] = {
        change: effect.change * modifier,
        permanent: effect.permanent
      }
    }

    return modifiedEffects
  }

  /**
   * Применяет модификаторы позы к эффектам действия
   */
  applyPoseModifiers(
    effects: SimpleActionEffects,
    actionType: string,
    poseEffects: SimplePoseEffects
  ): SimpleActionEffects {
    const modifiedEffects: SimpleActionEffects = {}
    const poseModifier = poseEffects.actionModifiers[actionType] || 1.0

    for (const [characteristicName, effect] of Object.entries(effects)) {
      modifiedEffects[characteristicName] = {
        change: effect.change * poseModifier,
        permanent: effect.permanent
      }
    }

    return modifiedEffects
  }

  /**
   * Проверяет зависимости и применяет условные эффекты
   */
  applyDependencies(
    effects: SimpleActionEffects,
    characterCharacteristics: Record<string, number>
  ): SimpleActionEffects {
    const finalEffects: SimpleActionEffects = { ...effects }

    // Примеры зависимостей
    // Если энергия > 70, то эффекты физических действий усиливаются
    if (characterCharacteristics['Энергия'] > 70) {
      for (const [charName, effect] of Object.entries(finalEffects)) {
        if (['Энергия', 'Выносливость'].includes(charName)) {
          finalEffects[charName] = {
            ...effect,
            change: effect.change * 1.2
          }
        }
      }
    }

    // Если стресс > 80, то все негативные эффекты усиливаются
    if (characterCharacteristics['Стресс'] > 80) {
      for (const [charName, effect] of Object.entries(finalEffects)) {
        if (['Стресс', 'Страх', 'Боль'].includes(charName) && effect.change > 0) {
          finalEffects[charName] = {
            ...effect,
            change: effect.change * 1.3
          }
        }
      }
    }

    // Если покорность > 60, то эффекты доминирования усиливаются
    if (characterCharacteristics['Покорность'] > 60) {
      for (const [charName, effect] of Object.entries(finalEffects)) {
        if (['Покорность', 'Унижение', 'Страх'].includes(charName) && effect.change > 0) {
          finalEffects[charName] = {
            ...effect,
            change: effect.change * 1.4
          }
        }
      }
    }

    return finalEffects
  }
}