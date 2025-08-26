// Единый загрузчик конфигураций Character AI
import type { 
  CharacterAIConfig, 
  Character, 
  InteractiveAction, 
  InteractiveTool, 
  Pose,
  PoseChangeCondition,
  QuickAction,
  InteractiveArea
} from '../unified-entities'

// Кэш для конфигураций
let configCache: CharacterAIConfig | null = null
let charactersCache: Character[] = []
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

// Загрузка конфигурации Character AI
export async function loadCharacterAIConfig(): Promise<CharacterAIConfig> {
  const now = Date.now()
  
  // Проверяем кэш
  if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('🤖 Используем кэшированную конфигурацию Character AI')
    return configCache
  }
  
  try {
    console.log('🔄 Загружаем конфигурацию Character AI...')
    
    // Загружаем данные персонажей
    const charactersData = await import('../../data/characters-unified.json')
    const characters = charactersData.characters || []
    
    // Создаем конфигурацию Character AI из данных персонажей
    const characterAIConfig: CharacterAIConfig = {
      actions: {},
      tools: {},
      poses: {},
      poseChangeConditions: {},
      quickActions: {},
      interactiveAreas: {},
      llmPrompts: {
        basePrompt: '',
        characteristicInterpretations: {},
        fetishResponses: {}
      }
    }
    
    // Извлекаем данные из персонажей
    characters.forEach(character => {
      if (character.characterAI) {
        // Действия
        if (character.characterAI.actions) {
          Object.assign(characterAIConfig.actions, character.characterAI.actions)
        }
        
        // Инструменты
        if (character.characterAI.tools) {
          Object.assign(characterAIConfig.tools, character.characterAI.tools)
        }
        
        // Позы
        if (character.characterAI.poses) {
          Object.assign(characterAIConfig.poses, character.characterAI.poses)
        }
        
        // Условия смены поз
        if (character.characterAI.poseChangeConditions) {
          Object.assign(characterAIConfig.poseChangeConditions, character.characterAI.poseChangeConditions)
        }
        
        // Быстрые действия
        if (character.characterAI.quickActions) {
          Object.assign(characterAIConfig.quickActions, character.characterAI.quickActions)
        }
        
        // Интерактивные области
        if (character.characterAI.interactiveAreas) {
          Object.assign(characterAIConfig.interactiveAreas, character.characterAI.interactiveAreas)
        }
        
        // LLM промты
        if (character.characterAI.llmPrompts) {
          if (character.characterAI.llmPrompts.basePrompt) {
            characterAIConfig.llmPrompts.basePrompt = character.characterAI.llmPrompts.basePrompt
          }
          if (character.characterAI.llmPrompts.characteristicInterpretations) {
            Object.assign(characterAIConfig.llmPrompts.characteristicInterpretations, 
              character.characterAI.llmPrompts.characteristicInterpretations)
          }
          if (character.characterAI.llmPrompts.fetishResponses) {
            Object.assign(characterAIConfig.llmPrompts.fetishResponses, 
              character.characterAI.llmPrompts.fetishResponses)
          }
        }
      }
    })
    
    // Кэшируем результат
    configCache = characterAIConfig
    charactersCache = characters
    cacheTimestamp = now
    
    console.log('✅ Конфигурация Character AI загружена:', {
      actions: Object.keys(characterAIConfig.actions).length,
      tools: Object.keys(characterAIConfig.tools).length,
      poses: Object.keys(characterAIConfig.poses).length,
      characters: characters.length
    })
    
    return characterAIConfig
  } catch (error) {
    console.error('❌ Ошибка загрузки конфигурации Character AI:', error)
    
    // Возвращаем пустую конфигурацию в случае ошибки
    return {
      actions: {},
      tools: {},
      poses: {},
      poseChangeConditions: {},
      quickActions: {},
      interactiveAreas: {},
      llmPrompts: {
        basePrompt: '',
        characteristicInterpretations: {},
        fetishResponses: {}
      }
    }
  }
}

// Загрузка персонажей
export async function loadCharacters(): Promise<Character[]> {
  const now = Date.now()
  
  // Проверяем кэш
  if (charactersCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
    return charactersCache
  }
  
  try {
    console.log('🔄 Загружаем персонажей...')
    
    const charactersData = await import('../../data/characters-unified.json')
    const characters = charactersData.characters || []
    
    // Кэшируем результат
    charactersCache = characters
    cacheTimestamp = now
    
    console.log('✅ Персонажи загружены:', characters.length)
    return characters
  } catch (error) {
    console.error('❌ Ошибка загрузки персонажей:', error)
    return []
  }
}

// Получение персонажа по ID
export async function getCharacterById(id: string): Promise<Character | null> {
  const characters = await loadCharacters()
  return characters.find(char => char.id === id) || null
}

// Получение персонажа по имени
export async function getCharacterByName(name: string): Promise<Character | null> {
  const characters = await loadCharacters()
  return characters.find(char => char.name === name) || null
}

// Получение статистики загрузки
export function getConfigStats() {
  return {
    configCache: !!configCache,
    charactersCache: charactersCache.length,
    cacheAge: Date.now() - cacheTimestamp,
    cacheValid: (Date.now() - cacheTimestamp) < CACHE_DURATION
  }
}

// Очистка кэша
export function clearCache() {
  configCache = null
  charactersCache = []
  cacheTimestamp = 0
  console.log('🧹 Кэш Character AI очищен')
}

// Получение конфигурации для конкретного персонажа
export async function getCharacterAIConfigForCharacter(characterId: string): Promise<CharacterAIConfig | null> {
  try {
    const character = await getCharacterById(characterId)
    if (!character || !character.characterAI) {
      return null
    }
    
    return character.characterAI
  } catch (error) {
    console.error('❌ Ошибка получения конфигурации для персонажа:', error)
    return null
  }
}
