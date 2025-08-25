import { Character, CharacterStats, CharacterFetishes, CharacterFetish, FetishCategory } from '../character/types'

/**
 * Миграция от старой системы Talent к новой системе Character AI
 */
export class TalentToCharacterMigration {
  /**
   * Мигрирует Talent в Character
   */
  static migrateTalentToCharacter(talent: any): Character {
    return {
      id: talent.id,
      name: talent.name,
      archetype: talent.role || 'default',
      description: talent.description || `Персонаж ${talent.name}`,
      
      // Мигрируем характеристики
      stats: this.migrateStats(talent),
      
      // Мигрируем фетиши
      fetishes: this.migrateFetishes(talent),
      
      // Метаданные
      createdAt: talent.createdAt || new Date().toISOString(),
      lastInteraction: talent.lastInteraction || new Date().toISOString(),
      totalInteractions: talent.totalInteractions || 0,
      communicationStyle: talent.communicationStyle || 'neutral',
      emotionalState: talent.emotionalState || 'neutral'
    }
  }
  
  /**
   * Мигрирует статистики из старой системы в новую
   */
  private static migrateStats(talent: any): CharacterStats {
    return {
      physical: {
        endurance: this.normalize(talent.states?.endurance || talent.attributes?.strength || 50),
        sensitivity: this.normalize(talent.states?.sensuality || 50),
        flexibility: this.normalize(talent.attributes?.strength || 50)
      },
      psychological: {
        emotionalStability: this.normalize(talent.states?.mood || 50),
        adaptability: this.normalize(talent.attributes?.empathy || 50),
        intelligence: this.normalize(talent.attributes?.intelligence || 50)
      },
      social: {
        sociability: this.normalize(talent.attributes?.empathy || 50),
        empathy: this.normalize(talent.attributes?.empathy || 50),
        dominance: this.normalize(talent.attributes?.ego || 50)
      },
      personality: {
        selfEsteem: this.normalize(talent.attributes?.ego || 50),
        optimism: this.normalize(talent.states?.mood || 50),
        curiosity: this.normalize(talent.attributes?.creativity || 50)
      },
      special: {
        sexualExperience: this.normalize(talent.states?.sensuality || 50),
        resistance: this.normalize(talent.states?.endurance || 50),
        dependency: this.normalize(talent.states?.compliance || 50),
        fetishSensitivity: this.normalize(talent.states?.sensuality || 50),
        fetishDiscovery: this.normalize(talent.attributes?.creativity || 50)
      }
    }
  }
  
  /**
   * Мигрирует фетиши из старой системы в новую
   */
  private static migrateFetishes(talent: any): CharacterFetishes {
    const primaryFetishes: CharacterFetish[] = []
    const secondaryFetishes: CharacterFetish[] = []
    const discoveredFetishes: CharacterFetish[] = []
    const hiddenFetishes: CharacterFetish[] = []
    
    // Мигрируем affinities как фетиши
    if (talent.affinities) {
      Object.entries(talent.affinities).forEach(([key, value]) => {
        const intensity = this.normalize(value as number)
        const fetish: CharacterFetish = {
          id: key,
          name: this.getFetishName(key),
          description: this.getFetishDescription(key),
          intensity,
          triggers: this.getFetishTriggers(key),
          reactions: this.getFetishReactions(key),
          category: this.getFetishCategory(key),
          isActive: intensity > 0.3,
          discoveredAt: intensity > 0.1 ? new Date().toISOString() : undefined
        }
        
        if (intensity > 0.7) {
          primaryFetishes.push(fetish)
        } else if (intensity > 0.4) {
          secondaryFetishes.push(fetish)
        } else if (intensity > 0.1) {
          discoveredFetishes.push(fetish)
        } else {
          hiddenFetishes.push(fetish)
        }
      })
    }
    
    return {
      primary: primaryFetishes,
      secondary: secondaryFetishes,
      discovered: discoveredFetishes,
      hidden: hiddenFetishes
    }
  }
  
  /**
   * Нормализует значение от 0-100 к 0-10
   */
  private static normalize(value: number): number {
    return Math.min(10, Math.max(0, value / 10))
  }
  
  /**
   * Получает название фетиша
   */
  private static getFetishName(key: string): string {
    const names: Record<string, string> = {
      submission: 'Подчинение',
      obedience: 'Послушание',
      humiliation: 'Унижение',
      bondage: 'Связывание',
      sensory: 'Сенсорные',
      roleplay: 'Ролевые игры',
      dominance: 'Доминирование',
      pain: 'Боль',
      pleasure: 'Удовольствие',
      control: 'Контроль',
      dependency: 'Зависимость'
    }
    return names[key] || key
  }
  
  /**
   * Получает описание фетиша
   */
  private static getFetishDescription(key: string): string {
    const descriptions: Record<string, string> = {
      submission: 'Стремление к подчинению и послушанию',
      obedience: 'Желание выполнять команды и приказы',
      humiliation: 'Получение удовольствия от унижения',
      bondage: 'Интерес к связыванию и ограничению движений',
      sensory: 'Чувствительность к сенсорным воздействиям',
      roleplay: 'Увлечение ролевыми играми',
      dominance: 'Стремление к доминированию',
      pain: 'Получение удовольствия от боли',
      pleasure: 'Стремление к удовольствию',
      control: 'Желание контролировать или быть под контролем',
      dependency: 'Потребность в зависимости от других'
    }
    return descriptions[key] || `Фетиш связанный с ${key}`
  }
  
  /**
   * Получает триггеры фетиша
   */
  private static getFetishTriggers(key: string): string[] {
    const triggers: Record<string, string[]> = {
      submission: ['команды', 'доминирование', 'приказы'],
      obedience: ['требования', 'инструкции', 'правила'],
      humiliation: ['унижение', 'оскорбления', 'снижение статуса'],
      bondage: ['связывание', 'ограничения', 'лишение свободы'],
      sensory: ['прикосновения', 'звуки', 'запахи'],
      roleplay: ['смена ролей', 'театральность', 'фантазии'],
      dominance: ['контроль', 'власть', 'авторитет'],
      pain: ['физическая боль', 'дискомфорт', 'наказание'],
      pleasure: ['удовольствие', 'наслаждение', 'стимуляция'],
      control: ['управление', 'манипуляция', 'влияние'],
      dependency: ['зависимость', 'потребность', 'привязанность']
    }
    return triggers[key] || [key]
  }
  
  /**
   * Получает реакции фетиша
   */
  private static getFetishReactions(key: string): string[] {
    const reactions: Record<string, string[]> = {
      submission: ['покорность', 'послушание', 'смирение'],
      obedience: ['выполнение', 'следование', 'подчинение'],
      humiliation: ['стыд', 'смущение', 'возбуждение'],
      bondage: ['расслабление', 'доверие', 'возбуждение'],
      sensory: ['чувствительность', 'реакция', 'возбуждение'],
      roleplay: ['вовлеченность', 'творчество', 'возбуждение'],
      dominance: ['уверенность', 'сила', 'контроль'],
      pain: ['напряжение', 'реакция', 'возбуждение'],
      pleasure: ['удовольствие', 'расслабление', 'наслаждение'],
      control: ['фокус', 'концентрация', 'возбуждение'],
      dependency: ['привязанность', 'доверие', 'потребность']
    }
    return reactions[key] || ['реакция', 'возбуждение']
  }
  
  /**
   * Получает категорию фетиша
   */
  private static getFetishCategory(key: string): FetishCategory {
    const categories: Record<string, FetishCategory> = {
      submission: FetishCategory.DOMINATION,
      obedience: FetishCategory.DOMINATION,
      humiliation: FetishCategory.HUMILIATION,
      bondage: FetishCategory.PHYSICAL,
      sensory: FetishCategory.SENSORY,
      roleplay: FetishCategory.ROLEPLAY,
      dominance: FetishCategory.DOMINATION,
      pain: FetishCategory.PHYSICAL,
      pleasure: FetishCategory.PHYSICAL,
      control: FetishCategory.PSYCHOLOGICAL,
      dependency: FetishCategory.DEPENDENCY
    }
    return categories[key] || FetishCategory.PSYCHOLOGICAL
  }
}

/**
 * Миграция данных рынка
 */
export class MarketMigration {
  /**
   * Мигрирует данные рынка в новую структуру персонажей
   */
  static migrateMarketData(oldMarket: any): any {
    const characters: Character[] = []
    
    // Мигрируем talentExchange
    if (oldMarket.talentExchange) {
      oldMarket.talentExchange.forEach((talent: any) => {
        characters.push(TalentToCharacterMigration.migrateTalentToCharacter(talent))
      })
    }
    
    // Мигрируем voidRescues
    if (oldMarket.voidRescues) {
      oldMarket.voidRescues.forEach((rescue: any) => {
        characters.push(TalentToCharacterMigration.migrateTalentToCharacter(rescue))
      })
    }
    
    // Мигрируем corporateContracts
    if (oldMarket.corporateContracts) {
      oldMarket.corporateContracts.forEach((contract: any) => {
        characters.push(TalentToCharacterMigration.migrateTalentToCharacter(contract))
      })
    }
    
    return {
      characters,
      templates: {},
      config: {
        skillCategories: {},
        fetishCategories: {}
      }
    }
  }
}
