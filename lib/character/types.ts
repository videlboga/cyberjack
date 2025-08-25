// Основные типы данных для системы персонажей

export interface Character {
  id: string
  name: string
  archetype: string
  description: string
  
  // Системы
  stats: CharacterStats
  memory: CharacterMemory
  fetishes: CharacterFetishes
  emotionalState: string
  
  // Система промтов
  prompts: CharacterPrompts
  
  // Метаданные
  createdAt: string
  lastInteraction: string
  totalInteractions: number
  communicationStyle: string
}

export interface CharacterStats {
  // Физические характеристики (0-10)
  physical: {
    endurance: number      // Выносливость
    sensitivity: number    // Чувствительность
    flexibility: number    // Гибкость
  }
  
  // Психологические характеристики (0-10)
  psychological: {
    emotionalStability: number  // Эмоциональная стабильность
    adaptability: number        // Адаптивность
    intelligence: number        // Интеллект
  }
  
  // Социальные характеристики (0-10)
  social: {
    sociability: number     // Общительность
    empathy: number         // Эмпатия
    dominance: number       // Доминантность
  }
  
  // Личностные характеристики (0-10)
  personality: {
    selfEsteem: number      // Самооценка
    optimism: number        // Оптимизм
    curiosity: number       // Любопытство
  }
  
  // Специальные характеристики (0-10)
  special: {
    sexualExperience: number  // Сексуальная опытность
    resistance: number        // Сопротивляемость
    dependency: number        // Зависимость
    fetishSensitivity: number // Чувствительность к фетишам
    fetishDiscovery: number   // Готовность открывать новые фетиши
  }
}

export interface CharacterMemory {
  // Краткосрочная память (последние 20 взаимодействий)
  shortTerm: MemoryEntry[]
  
  // Долгосрочная память (важные события)
  longTerm: MemoryEntry[]
  
  // Саммари (каждые 10 взаимодействий)
  summaries: SummaryEntry[]
  
  // Эпизодические воспоминания
  episodic: EpisodicMemory[]
}

export interface MemoryEntry {
  id: string
  content: string
  type: MemoryType
  timestamp: string
  importance: number        // 0.0-1.0
  emotionalImpact: number   // -1.0 to 1.0
  tags: string[]
  context?: any
}

export enum MemoryType {
  INTERACTION = 'interaction',
  EVENT = 'event',
  EMOTION = 'emotion',
  PHYSICAL = 'physical',
  FETISH = 'fetish',
  TRAUMA = 'trauma',
  PLEASURE = 'pleasure'
}

export interface SummaryEntry {
  id: string
  content: string
  timestamp: string
  period: string           // Период, который суммируется
  interactionsCount: number
}

export interface EpisodicMemory {
  id: string
  content: string
  category: string
  subcategory: string
  emotionalWeight: number  // 0.1 - 1.0
  contextTags: string[]
  created_at: string
}

export interface CharacterFetishes {
  primary: CharacterFetish[]    // Основные фетиши
  secondary: CharacterFetish[]  // Дополнительные фетиши
  discovered: CharacterFetish[] // Открытые в процессе
  hidden: CharacterFetish[]     // Скрытые/потенциальные
}

export interface CharacterFetish {
  id: string
  name: string
  description: string
  intensity: number        // 0-10, сила фетиша
  triggers: string[]       // Что активирует фетиш
  reactions: string[]      // Типичные реакции
  category: FetishCategory
  isActive: boolean        // Активен ли фетиш
  discoveredAt?: string    // Когда был открыт
  lastTriggered?: string   // Последняя активация
}

export enum FetishCategory {
  DOMINATION = 'domination',      // Доминирование/подчинение
  HUMILIATION = 'humiliation',    // Унижение
  DEPENDENCY = 'dependency',      // Зависимость
  SENSORY = 'sensory',           // Сенсорные
  ROLEPLAY = 'roleplay',         // Ролевые игры
  PHYSICAL = 'physical',         // Физические
  PSYCHOLOGICAL = 'psychological', // Психологические
  SOCIAL = 'social'             // Социальные роли
}

export enum EmotionalState {
  EXCITED = 'excited',
  HAPPY = 'happy',
  CALM = 'calm',
  SAD = 'sad',
  FEARFUL = 'fearful',
  ANGRY = 'angry',
  SUBMISSIVE = 'submissive',
  DOMINANT = 'dominant'
}

export interface CharacterResponse {
  // Анализ воздействия
  impactAnalysis: {
    threat: number          // Угроза (-1.0 to 1.0)
    pleasure: number        // Удовольствие (-1.0 to 1.0)
    pain: number           // Боль (-1.0 to 1.0)
    fear: number           // Страх (0.0 to 1.0)
    arousal: number        // Возбуждение (0.0 to 1.0)
  }
  
  // Анализ фетишей
  fetishAnalysis: {
    triggeredFetishes: CharacterFetish[]
    overallArousal: number      // Общее возбуждение от фетишей
    dominantFetish?: CharacterFetish  // Самый активный фетиш
  }
  
  // Изменения характеристик
  statChanges: Partial<CharacterStats>
  
  // Генерируемый ответ
  response: string
  
  // Эмоциональное состояние
  emotionalState: string
  
  // Влияние на ответ
  fetishInfluence: {
    modifiesResponse: boolean
    responseModifier: string    // Дополнительный контекст для AI
  }
}

export interface FetishAnalysis {
  triggeredFetishes: CharacterFetish[]
  overallArousal: number
  dominantFetish?: CharacterFetish
}

export interface FetishInfluence {
  modifiesResponse: boolean
  responseModifier: string
}

export interface CharacterPrompts {
  base: string                    // Базовый промт
  characteristicInterpretations: CharacteristicInterpretations  // Интерпретации характеристик
  situational: SituationalPrompt[]  // Ситуативные промты с условиями
}

export interface CharacteristicInterpretations {
  physical: Record<string, string>      // Интерпретации физических характеристик
  psychological: Record<string, string> // Интерпретации психологических характеристик
  social: Record<string, string>        // Интерпретации социальных характеристик
  personality: Record<string, string>   // Интерпретации личностных характеристик
  special: Record<string, string>       // Интерпретации специальных характеристик
}

export interface SituationalPrompt {
  id: string
  name: string
  description: string
  conditions: PromptCondition[]
  prompt: string
  priority: number  // Приоритет (1-10, где 10 - высший)
  isActive: boolean
}

export interface PromptCondition {
  type: 'parameter_combination' | 'user_action' | 'multiple'
  parameters?: {
    stat?: string
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'between'
    value: number | [number, number]
  }[]
  userActions?: string[]
  multipleConditions?: {
    logic: 'AND' | 'OR'
    conditions: PromptCondition[]
  }
  emotionalState?: string[]
  fetishTriggers?: string[]
}

// Утилиты для работы с типами
export function createEmptyCharacter(id: string, name: string, archetype: string): Character {
  return {
    id,
    name,
    archetype,
    description: '',
    stats: {
      physical: {
        endurance: 5,
        sensitivity: 5,
        flexibility: 5
      },
      psychological: {
        emotionalStability: 5,
        adaptability: 5,
        intelligence: 5
      },
      social: {
        sociability: 5,
        empathy: 5,
        dominance: 5
      },
      personality: {
        selfEsteem: 5,
        optimism: 5,
        curiosity: 5
      },
      special: {
        sexualExperience: 2,
        resistance: 5,
        dependency: 5,
        fetishSensitivity: 5,
        fetishDiscovery: 5
      }
    },
    memory: {
      shortTerm: [],
      longTerm: [],
      summaries: [],
      episodic: []
    },
    fetishes: {
      primary: [],
      secondary: [],
      discovered: [],
      hidden: []
    },
    prompts: {
      base: '',
      characteristicInterpretations: {
        physical: {},
        psychological: {},
        social: {},
        personality: {},
        special: {}
      },
      situational: []
    },
    emotionalState: 'спокойный',
    communicationStyle: 'нейтральный',
    createdAt: new Date().toISOString(),
    lastInteraction: new Date().toISOString(),
    totalInteractions: 0
  }
}

export function createMemoryEntry(
  content: string, 
  type: MemoryType, 
  importance: number = 0.5,
  emotionalImpact: number = 0.0
): MemoryEntry {
  return {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    type,
    timestamp: new Date().toISOString(),
    importance,
    emotionalImpact,
    tags: []
  }
}
