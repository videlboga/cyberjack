import type { GameConfig } from './unified-entities'

// Кэш для конфигураций
let configCache: GameConfig | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

// Загрузка унифицированной конфигурации версии 2
export async function loadUnifiedConfigV2(): Promise<GameConfig> {
  const now = Date.now()
  
  // Проверяем кэш
  if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('📋 Используем кэшированную конфигурацию')
    return configCache
  }
  
  try {
    console.log('🔄 Загружаем унифицированную конфигурацию v2...')
    
    // Загружаем все файлы параллельно с обработкой ошибок
    const [
      charactersData,
      actionsData,
      eventsData,
      contractsData,
      equipmentData,
      systemData,
      storyScenesData,
      usersData,
      characterAIData,
      marketData,
      assetsData
    ] = await Promise.all([
      import('../data/characters-unified.json').catch(() => ({ 
        default: { characters: [], templates: {}, config: {} } 
      })),
      import('../data/actions-unified.json').catch(() => ({ 
        default: { actions: [], categories: {}, config: {} } 
      })),
      import('../data/events-unified.json').catch(() => ({ 
        default: { events: [], config: {} } 
      })),
      import('../data/contracts-unified.json').catch(() => ({ 
        default: { contracts: [], config: {} } 
      })),
      import('../data/equipment-unified.json').catch(() => ({ 
        default: { equipment: [], config: {} } 
      })),
      import('../data/system-unified.json').catch(() => ({ 
        default: { attributes: [], states: [], fetishes: [] } 
      })),
      import('../data/story-scenes-unified.json').catch(() => ({ 
        default: { scenes: [], config: {} } 
      })),
      import('../data/users-unified.json').catch(() => ({ 
        default: { users: [], config: {} } 
      })),
      import('../data/game-config-unified.json').catch(() => ({ 
        default: {} 
      })),
      import('../data/market.json').catch(() => ({ 
        default: { talentExchange: [], voidRescues: [], corporateContracts: [] } 
      })),
      import('../data/assets-from-characters.json').catch(() => ({ 
        default: [] 
      }))
    ])
    
    const config: GameConfig = {
      characters: charactersData.default,
      actions: actionsData.default,
      events: eventsData.default,
      contracts: contractsData.default,
      equipment: equipmentData.default,
      system: systemData.default,
      storyScenes: storyScenesData.default,
      users: usersData.default,
      market: marketData.default,
      assets: assetsData.default,
      characterAI: characterAIData.default.characterAI || { 
        actions: {}, 
        tools: {}, 
        poses: {}, 
        llmPrompts: { 
          basePrompt: "", 
          characteristicInterpretations: {}, 
          fetishResponses: {} 
        } 
      }
    }
    
    // Валидируем конфигурацию
    const validation = validateUnifiedConfig(config)
    if (!validation.isValid) {
      console.warn('⚠️ Проблемы с конфигурацией:', validation.errors)
    } else {
      console.log('✅ Конфигурация загружена успешно')
    }
    
    // Обновляем кэш
    configCache = config
    cacheTimestamp = now
    
    return config
  } catch (error) {
    console.error('❌ Ошибка загрузки конфигурации:', error)
    throw new Error('Не удалось загрузить конфигурацию игры')
  }
}

// Валидация конфигурации
function validateUnifiedConfig(config: GameConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Проверяем обязательные поля
  if (!config.characters) errors.push('Отсутствует characters')
  if (!config.actions) errors.push('Отсутствует actions')
  if (!config.events) errors.push('Отсутствует events')
  if (!config.contracts) errors.push('Отсутствует contracts')
  if (!config.equipment) errors.push('Отсутствует equipment')
  if (!config.system) errors.push('Отсутствует system')
  if (!config.storyScenes) errors.push('Отсутствует storyScenes')
  if (!config.users) errors.push('Отсутствует users')
  if (!config.market) errors.push('Отсутствует market')
  if (!config.assets) errors.push('Отсутствует assets')
  if (!config.characterAI) errors.push('Отсутствует characterAI')
  
  // Проверяем структуру данных
  if (config.characters && !Array.isArray(config.characters.characters)) {
    errors.push('characters.characters должен быть массивом')
  }
  
  if (config.actions && !config.actions.categories) {
    errors.push('actions.categories отсутствует')
  }
  
  if (config.equipment && !Array.isArray(config.equipment.equipment)) {
    errors.push('equipment.equipment должен быть массивом')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Получение статистики конфигурации
export function getConfigStats(config: GameConfig): Record<string, number> {
  return {
    characters: config.characters?.characters?.length || 0,
    actions: Object.keys(config.actions?.categories || {}).length,
    events: config.events?.events?.length || 0,
    contracts: config.contracts?.contracts?.length || 0,
    equipment: config.equipment?.equipment?.length || 0,
    system: {
      attributes: config.system?.attributes?.length || 0,
      states: config.system?.states?.length || 0,
      fetishes: config.system?.fetishes?.length || 0
    },
    storyScenes: config.storyScenes?.scenes?.length || 0,
    users: config.users?.users?.length || 0,
    market: {
      talentExchange: config.market?.talentExchange?.length || 0,
      voidRescues: config.market?.voidRescues?.length || 0,
      corporateContracts: config.market?.corporateContracts?.length || 0
    },
    assets: config.assets?.length || 0,
    characterAI: {
      poses: Object.keys(config.characterAI?.poses || {}).length,
      actions: Object.keys(config.characterAI?.actions || {}).length,
      tools: Object.keys(config.characterAI?.tools || {}).length
    }
  }
}

// Очистка кэша
export function clearConfigCache(): void {
  configCache = null
  cacheTimestamp = 0
  console.log('🗑️ Кэш конфигурации очищен')
}

// Проверка состояния кэша
export function getCacheStatus(): { hasCache: boolean; age: number } {
  const now = Date.now()
  return {
    hasCache: configCache !== null,
    age: configCache ? now - cacheTimestamp : 0
  }
}
