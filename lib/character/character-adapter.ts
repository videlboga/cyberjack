import { Character, CharacterStats } from '../unified-entities'

/**
 * Адаптер для совместимости Character с старым кодом Talent
 */
export class CharacterAdapter {
  /**
   * Преобразует Character в формат, совместимый со старым кодом Talent
   */
  static characterToLegacyFormat(character: any): any {
    // Проверяем, является ли character объектом типа Character с полем stats
    if (!character || !character.stats) {
      console.warn('Character or character.stats is undefined, returning default legacy format')
      return {
        id: character?.id || 'unknown',
        name: character?.name || 'Unknown',
        role: character?.archetype || 'Unknown',
        level: character?.level || 1,
        mood: 0,
        fear: 0,
        despair: 0,
        devotion: 0,
        strength: 0,
        empathy: 0,
        intelligence: 0,
        creativity: 0,
        status: 'available' as const,
        memories: [],
        experience: 0,
        maxExperience: 100,
        statusEffects: [],
        equippedItems: [],
        inventory: [],
        neuralPulses: 0,
        attributes: {
          strength: 0,
          empathy: 0,
          intelligence: 0,
          creativity: 0,
          temperament: 0,
          grit: 0,
          ego: 0
        },
        states: {
          mood: 0,
          fear: 0,
          despair: 0,
          devotion: 0,
          entitlement: 0,
          awareness: 0,
          routine: 0,
          compliance: 0,
          sensuality: 0,
          endurance: 0,
          sensory_overload: 0
        },
        skills: {
          maid: 1,
          cooking: 1,
          neural_hacking: 1,
          orgasm_control: 0,
          field: 1,
          etiquette: 0,
          logistics: 1,
          medical: 1,
          maintenance: 1,
          data: 1,
          dance: 1
        },
        affinities: {},
        stressors: {}
      }
    }

    return {
      id: character.id,
      name: character.name,
      role: character.archetype,
      level: 1, // Базовый уровень
      mood: this.getLegacyMood(character),
      fear: 0, // Базовое значение
      despair: 0, // Базовое значение
      devotion: 0, // Базовое значение
      strength: (character.stats.physical?.endurance || 0) * 10, // Нормализуем обратно к 0-100
      empathy: (character.stats.social?.empathy || 0) * 10,
      intelligence: (character.stats.psychological?.intelligence || 0) * 10,
      creativity: (character.stats.personality?.curiosity || 0) * 10,
      status: 'available' as const,
      memories: [], // Пустые воспоминания
      experience: 0,
      maxExperience: 100,
      statusEffects: [],
      equippedItems: [],
      inventory: [],
      neuralPulses: 0,
      
      // Старые атрибуты
      attributes: {
        strength: (character.stats.physical?.endurance || 0) * 10,
        empathy: (character.stats.social?.empathy || 0) * 10,
        intelligence: (character.stats.psychological?.intelligence || 0) * 10,
        creativity: (character.stats.personality?.curiosity || 0) * 10,
        temperament: (character.stats.personality?.optimism || 0) * 10,
        grit: (character.stats.physical?.endurance || 0) * 10,
        ego: (character.stats.personality?.selfEsteem || 0) * 10
      },
      
      // Старые состояния
      states: {
        mood: (character.stats.psychological?.emotionalStability || 0) * 10,
        fear: 0,
        despair: 0,
        devotion: 0,
        entitlement: 0,
        awareness: (character.stats.psychological?.adaptability || 0) * 10,
        routine: 0,
        compliance: (character.stats.special?.dependency || 0) * 10,
        sensuality: (character.stats.special?.sexualExperience || 0) * 10,
        endurance: (character.stats.physical?.endurance || 0) * 10,
        sensory_overload: 0
      },
      
      // Старые навыки (базовые значения)
      skills: {
        maid: 1,
        cooking: 1,
        neural_hacking: 1,
        orgasm_control: character.stats.special?.sexualExperience || 0,
        field: 1,
        etiquette: character.stats.social?.sociability || 0,
        logistics: 1,
        medical: 1,
        maintenance: 1,
        data: 1,
        dance: 1
      },
      
      // Преобразуем фетиши в affinities
      affinities: this.convertFetishesToAffinities(character),
      stressors: {}
    }
  }
  
  /**
   * Получает настроение в старом формате
   */
  private static getLegacyMood(character: any): number {
    if (!character || !character.stats) {
      return 0
    }
    
    const emotionalStability = character.stats.psychological?.emotionalStability || 0
    const optimism = character.stats.personality?.optimism || 0
    
    // Вычисляем настроение на основе эмоциональной стабильности и оптимизма
    return Math.round((emotionalStability + optimism) * 5) // 0-100
  }
  
  /**
   * Преобразует фетиши в старый формат affinities
   */
  private static convertFetishesToAffinities(character: any): { [key: string]: number } {
    const affinities: { [key: string]: number } = {}
    
    if (!character || !character.fetishes) {
      return affinities
    }
    
    // Обрабатываем все фетиши
    const allFetishes = [
      ...(character.fetishes.primary || []),
      ...(character.fetishes.secondary || []),
      ...(character.fetishes.discovered || []),
      ...(character.fetishes.hidden || [])
    ]
    
    allFetishes.forEach(fetish => {
      // Преобразуем интенсивность фетиша в affinity (0-100)
      affinities[fetish.id] = Math.round(fetish.intensity * 10)
    })
    
    return affinities
  }
  
  /**
   * Получает эффективные характеристики персонажа
   */
  static getEffectiveStats(character: any): any {
    // Проверяем, является ли character объектом с полями attributes и states
    if (!character) {
      console.warn('Character is undefined, returning default stats')
      return this.getDefaultStats()
    }

    // Если у персонажа есть поле stats (новая система)
    if (character.stats) {
      return {
        // Физические характеристики
        endurance: (character.stats.physical?.endurance || 0) * 10,
        sensitivity: (character.stats.physical?.sensitivity || 0) * 10,
        flexibility: (character.stats.physical?.flexibility || 0) * 10,
        
        // Психологические характеристики
        emotionalStability: (character.stats.psychological?.emotionalStability || 0) * 10,
        adaptability: (character.stats.psychological?.adaptability || 0) * 10,
        intelligence: (character.stats.psychological?.intelligence || 0) * 10,
        
        // Социальные характеристики
        sociability: (character.stats.social?.sociability || 0) * 10,
        empathy: (character.stats.social?.empathy || 0) * 10,
        dominance: (character.stats.social?.dominance || 0) * 10,
        
        // Личностные характеристики
        selfEsteem: (character.stats.personality?.selfEsteem || 0) * 10,
        optimism: (character.stats.personality?.optimism || 0) * 10,
        curiosity: (character.stats.personality?.curiosity || 0) * 10,
        
        // Специальные характеристики
        sexualExperience: (character.stats.special?.sexualExperience || 0) * 10,
        resistance: (character.stats.special?.resistance || 0) * 10,
        dependency: (character.stats.special?.dependency || 0) * 10,
        fetishSensitivity: (character.stats.special?.fetishSensitivity || 0) * 10,
        fetishDiscovery: (character.stats.special?.fetishDiscovery || 0) * 10
      }
    }

    // Если у персонажа есть поля attributes и states (текущая система)
    if (character.attributes && character.states) {
      return {
        // Физические характеристики
        endurance: character.attributes.endurance || 0,
        sensitivity: character.attributes.sensitivity || 0,
        flexibility: character.attributes.flexibility || 0,
        
        // Психологические характеристики
        emotionalStability: character.attributes.emotionalStability || 0,
        adaptability: character.attributes.adaptability || 0,
        intelligence: character.attributes.intelligence || 0,
        
        // Социальные характеристики
        sociability: character.attributes.sociability || 0,
        empathy: character.attributes.empathy || 0,
        dominance: character.attributes.dominance || 0,
        
        // Личностные характеристики
        selfEsteem: character.attributes.selfEsteem || 0,
        optimism: character.attributes.optimism || 0,
        curiosity: character.attributes.curiosity || 0,
        
        // Специальные характеристики
        sexualExperience: character.attributes.sexualExperience || 0,
        resistance: character.attributes.resistance || 0,
        dependency: character.attributes.dependency || 0,
        fetishSensitivity: 50, // Дефолтное значение
        fetishDiscovery: 50    // Дефолтное значение
      }
    }

    // Если ничего не подходит, возвращаем дефолтные характеристики
    console.warn('Character structure not recognized, returning default stats')
    return this.getDefaultStats()
  }

  /**
   * Возвращает дефолтные характеристики
   */
  private static getDefaultStats(): any {
    return {
      // Физические характеристики
      endurance: 50,
      sensitivity: 50,
      flexibility: 50,
      
      // Психологические характеристики
      emotionalStability: 50,
      adaptability: 50,
      intelligence: 50,
      
      // Социальные характеристики
      sociability: 50,
      empathy: 50,
      dominance: 50,
      
      // Личностные характеристики
      selfEsteem: 50,
      optimism: 50,
      curiosity: 50,
      
      // Специальные характеристики
      sexualExperience: 50,
      resistance: 50,
      dependency: 50,
      fetishSensitivity: 50,
      fetishDiscovery: 50
    }
  }
  
  /**
   * Генерирует контекст персонажа для AI
   */
  static generateCharacterContext(character: Character): any {
    const effectiveStats = this.getEffectiveStats(character)
    
    return {
      characterId: character.id,
      characterName: character.name,
      characterRole: character.archetype,
      effectiveStats,
      fetishes: character.fetishes,
      emotionalState: character.emotionalState,
      communicationStyle: character.communicationStyle
    }
  }
}

