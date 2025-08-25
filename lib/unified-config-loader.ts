// Унифицированный загрузчик конфигураций для оптимизированной системы
import { GameConfig, Character, Action, Event, Contract, Equipment, StoryScene, User } from './unified-entities'

// Кэш для загруженных конфигураций
let configCache: UnifiedGameConfig | null = null
let lastLoadTime: number = 0
const CACHE_DURATION = 0 // Отключаем кэш для dev

// Загрузка унифицированной конфигурации
export async function loadUnifiedConfig(): Promise<GameConfig> {
  const now = Date.now()
  
  // Проверяем кэш (отключен для dev)
  if (configCache && (now - lastLoadTime) < CACHE_DURATION) {
    console.log('📦 Используем кэшированную конфигурацию')
    return configCache
  }
  
  // Принудительно очищаем кэш для dev
  configCache = null
  
  try {
    console.log('🔄 Загружаем унифицированную конфигурацию...')
    
    // Загружаем все файлы параллельно
    const [
      charactersData,
      actionsData,
      eventsData,
      contractsData,
      equipmentData,
      systemData,
      storyScenesData,
      usersData,
      characterAIData
    ] = await Promise.all([
      import('../data/characters-unified.json').catch(() => ({ default: { characters: [], templates: {}, config: {} } })),
      import('../data/actions-unified.json').catch(() => ({ default: { actions: [], categories: {}, config: {} } })),
      import('../data/events-unified.json').catch(() => ({ default: { events: [], config: {} } })),
      import('../data/contracts-unified.json').catch(() => ({ default: { contracts: [], config: {} } })),
      import('../data/equipment-unified.json').catch(() => ({ default: { equipment: [], config: {} } })),
      import('../data/system-unified.json').catch(() => ({ default: { attributes: [], states: [], fetishes: [] } })),
      import('../data/story-scenes-unified.json').catch(() => ({ default: { scenes: [], config: {} } })),
      import('../data/users-unified.json').catch(() => ({ default: { users: [], config: {} } })),
      import('../data/game-config-unified.json').catch(() => ({ default: {} }))
    ])
    
    const config: UnifiedGameConfig = {
      characters: charactersData.default,
      actions: actionsData.default,
      events: eventsData.default,
      contracts: contractsData.default,
      equipment: equipmentData.default,
      system: systemData.default,
      storyScenes: storyScenesData.default,
      users: usersData.default,
      characterAI: characterAIData.default.characterAI || { actions: {}, tools: {}, poses: {}, llmPrompts: { basePrompt: "", characteristicInterpretations: {}, fetishResponses: {} } }
    }
    
    // Валидируем конфигурацию
    const validation = validateUnifiedConfig(config)
    if (!validation.isValid) {
      console.warn('⚠️ Предупреждения валидации:', validation.warnings)
    }
    
    // Кэшируем результат
    configCache = config
    lastLoadTime = now
    
    console.log('✅ Унифицированная конфигурация загружена')
    
    // Подсчитываем общее количество действий из всех категорий
    const totalActions = Object.values(config.actions.categories || {}).reduce((total, category) => {
      return total + Object.keys(category.actions || {}).length
    }, 0)
    
    console.log(`📊 Статистика: ${config.characters.characters.length} персонажей, ${totalActions} действий`)
    
    return config
    
  } catch (error) {
    console.error('❌ Ошибка загрузки унифицированной конфигурации:', error)
    throw new Error('Не удалось загрузить унифицированную конфигурацию')
  }
}

// Валидация унифицированной конфигурации
export function validateUnifiedConfig(config: UnifiedGameConfig): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = []
  
  // Проверяем обязательные секции
  if (!config.characters) warnings.push('Отсутствует секция characters')
  if (!config.actions) warnings.push('Отсутствует секция actions')
  if (!config.events) warnings.push('Отсутствует секция events')
  if (!config.contracts) warnings.push('Отсутствует секция contracts')
  if (!config.equipment) warnings.push('Отсутствует секция equipment')
  if (!config.system) warnings.push('Отсутствует секция system')
  if (!config.storyScenes) warnings.push('Отсутствует секция storyScenes')
  if (!config.users) warnings.push('Отсутствует секция users')
  
  // Проверяем персонажей
  if (config.characters?.characters) {
    const characterIds = config.characters.characters.map(c => c.id)
    const uniqueIds = new Set(characterIds)
    if (uniqueIds.size !== characterIds.length) {
      warnings.push('Обнаружены дублирующиеся ID персонажей')
    }
    
    // Проверяем обязательные поля персонажей
    config.characters.characters.forEach((char, index) => {
      if (!char.name) warnings.push(`Персонаж ${index}: отсутствует имя`)
      if (!char.attributes) warnings.push(`Персонаж ${char.name}: отсутствуют атрибуты`)
      if (!char.states) warnings.push(`Персонаж ${char.name}: отсутствуют состояния`)
      if (!char.fetishes) warnings.push(`Персонаж ${char.name}: отсутствуют фетиши`)
    })
  }
  
  // Проверяем действия
  if (config.actions?.categories) {
    const actionIds: string[] = []
    for (const [categoryKey, category] of Object.entries(config.actions.categories)) {
      for (const actionId of Object.keys(category.actions || {})) {
        actionIds.push(actionId)
      }
    }
    const uniqueIds = new Set(actionIds)
    if (uniqueIds.size !== actionIds.length) {
      warnings.push('Обнаружены дублирующиеся ID действий')
    }
  }
  
  // Проверяем события
  if (config.events?.events) {
    const eventIds = config.events.events.map(e => e.id)
    const uniqueIds = new Set(eventIds)
    if (uniqueIds.size !== eventIds.length) {
      warnings.push('Обнаружены дублирующиеся ID событий')
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  }
}

// Утилиты для работы с персонажами
export function getCharactersBySource(config: UnifiedGameConfig, source: string): Character[] {
  return config.characters.characters.filter(char => char.metadata.source === source)
}

export function getCharactersByRank(config: UnifiedGameConfig, rank: string): Character[] {
  return config.characters.characters.filter(char => char.rank === rank)
}

export function getCharactersByStatus(config: UnifiedGameConfig, status: string): Character[] {
  return config.characters.characters.filter(char => char.status === status)
}

export function getCharacterById(config: UnifiedGameConfig, id: string): Character | undefined {
  return config.characters.characters.find(char => char.id === id)
}

// Утилиты для работы с действиями
export function getActionsByCategory(config: UnifiedGameConfig, category: string): Action[] {
  const categoryData = config.actions.categories?.[category]
  if (!categoryData?.actions) return []
  
  return Object.entries(categoryData.actions).map(([actionId, action]) => ({
    id: actionId,
    category: category,
    ...action
  }))
}

export function getActionById(config: UnifiedGameConfig, id: string): Action | undefined {
  for (const [categoryKey, category] of Object.entries(config.actions.categories || {})) {
    if (category.actions?.[id]) {
      return {
        id: id,
        category: categoryKey,
        ...category.actions[id]
      }
    }
  }
  return undefined
}

// Утилиты для работы с событиями
export function getEventsByType(config: UnifiedGameConfig, type: string): Event[] {
  return config.events.events.filter(event => event.type === type)
}

export function getEventById(config: UnifiedGameConfig, id: string): Event | undefined {
  return config.events.events.find(event => event.id === id)
}

// Утилиты для работы с контрактами
export function getContractsByClient(config: UnifiedGameConfig, client: string): Contract[] {
  return config.contracts.contracts.filter(contract => contract.client === client)
}

export function getContractById(config: UnifiedGameConfig, id: string): Contract | undefined {
  return config.contracts.contracts.find(contract => contract.id === id)
}

// Утилиты для работы с оборудованием
export function getEquipmentByType(config: UnifiedGameConfig, type: string): Equipment[] {
  return config.equipment.equipment.filter(item => item.type === type)
}

export function getEquipmentById(config: UnifiedGameConfig, id: string): Equipment | undefined {
  return config.equipment.equipment.find(item => item.id === id)
}

// Утилиты для работы с пользователями
export function getUsersByRole(config: UnifiedGameConfig, role: string): User[] {
  return config.users.users.filter(user => user.role === role)
}

export function getUserById(config: UnifiedGameConfig, id: string): User | undefined {
  return config.users.users.find(user => user.id === id)
}

// Утилиты для поиска
export function searchCharacters(config: UnifiedGameConfig, query: string): Character[] {
  const lowerQuery = query.toLowerCase()
  return config.characters.characters.filter(char => 
    char.name.toLowerCase().includes(lowerQuery) ||
    char.specialization.toLowerCase().includes(lowerQuery) ||
    char.description.toLowerCase().includes(lowerQuery)
  )
}

export function searchActions(config: UnifiedGameConfig, query: string): Action[] {
  const lowerQuery = query.toLowerCase()
  const results: Action[] = []
  
  for (const [categoryKey, category] of Object.entries(config.actions.categories || {})) {
    for (const [actionId, action] of Object.entries(category.actions || {})) {
      if (
        action.title?.toLowerCase().includes(lowerQuery) ||
        action.description?.toLowerCase().includes(lowerQuery) ||
        categoryKey.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: actionId,
          category: categoryKey,
          ...action
        })
      }
    }
  }
  
  return results
}

export function searchEvents(config: UnifiedGameConfig, query: string): Event[] {
  const lowerQuery = query.toLowerCase()
  return config.events.events.filter(event => 
    event.title.toLowerCase().includes(lowerQuery) ||
    event.description.toLowerCase().includes(lowerQuery) ||
    event.type.toLowerCase().includes(lowerQuery)
  )
}

// Утилиты для статистики
export function getConfigStats(config: UnifiedGameConfig) {
  return {
    characters: {
      total: config.characters.characters.length,
      bySource: config.characters.characters.reduce((acc, char) => {
        const source = char.metadata.source
        acc[source] = (acc[source] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byRank: config.characters.characters.reduce((acc, char) => {
        acc[char.rank] = (acc[char.rank] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byStatus: config.characters.characters.reduce((acc, char) => {
        acc[char.status] = (acc[char.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    },
    actions: {
      total: (() => {
        let total = 0
        for (const category of Object.values(config.actions.categories || {})) {
          total += Object.keys(category.actions || {}).length
        }
        return total
      })(),
      byCategory: (() => {
        const byCategory: Record<string, number> = {}
        for (const [categoryKey, category] of Object.entries(config.actions.categories || {})) {
          byCategory[categoryKey] = Object.keys(category.actions || {}).length
        }
        return byCategory
      })()
    },
    events: {
      total: config.events.events.length,
      byType: config.events.events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    },
    contracts: {
      total: config.contracts.contracts.length
    },
    equipment: {
      total: config.equipment.equipment.length
    },
    storyScenes: {
      total: config.storyScenes.scenes.length
    },
    users: {
      total: config.users.users.length
    }
  }
}

// Очистка кэша
export function clearConfigCache() {
  configCache = null
  lastLoadTime = 0
  console.log('🗑️ Кэш конфигурации очищен')
}

// Экспорт конфигурации
export function exportConfig(config: UnifiedGameConfig): string {
  return JSON.stringify(config, null, 2)
}

// Сравнение конфигураций
export function compareConfigs(config1: UnifiedGameConfig, config2: UnifiedGameConfig): {
  characters: { added: number; removed: number; modified: number }
  actions: { added: number; removed: number; modified: number }
  events: { added: number; removed: number; modified: number }
} {
  const result = {
    characters: { added: 0, removed: 0, modified: 0 },
    actions: { added: 0, removed: 0, modified: 0 },
    events: { added: 0, removed: 0, modified: 0 }
  }
  
  // Сравниваем персонажей
  const chars1 = new Map(config1.characters.characters.map(c => [c.id, c]))
  const chars2 = new Map(config2.characters.characters.map(c => [c.id, c]))
  
  for (const [id, char] of chars1) {
    if (!chars2.has(id)) {
      result.characters.removed++
    } else if (JSON.stringify(char) !== JSON.stringify(chars2.get(id))) {
      result.characters.modified++
    }
  }
  
  for (const [id] of chars2) {
    if (!chars1.has(id)) {
      result.characters.added++
    }
  }
  
  // Сравниваем действия
  const actions1 = new Map()
  const actions2 = new Map()
  
  // Собираем действия из категорий для config1
  for (const [categoryKey, category] of Object.entries(config1.actions.categories || {})) {
    for (const [actionId, action] of Object.entries(category.actions || {})) {
      actions1.set(`${categoryKey}-${actionId}`, { id: `${categoryKey}-${actionId}`, category: categoryKey, ...action })
    }
  }
  
  // Собираем действия из категорий для config2
  for (const [categoryKey, category] of Object.entries(config2.actions.categories || {})) {
    for (const [actionId, action] of Object.entries(category.actions || {})) {
      actions2.set(`${categoryKey}-${actionId}`, { id: `${categoryKey}-${actionId}`, category: categoryKey, ...action })
    }
  }
  
  for (const [id, action] of actions1) {
    if (!actions2.has(id)) {
      result.actions.removed++
    } else if (JSON.stringify(action) !== JSON.stringify(actions2.get(id))) {
      result.actions.modified++
    }
  }
  
  for (const [id] of actions2) {
    if (!actions1.has(id)) {
      result.actions.added++
    }
  }
  
  // Сравниваем события
  const events1 = new Map(config1.events.events.map(e => [e.id, e]))
  const events2 = new Map(config2.events.events.map(e => [e.id, e]))
  
  for (const [id, event] of events1) {
    if (!events2.has(id)) {
      result.events.removed++
    } else if (JSON.stringify(event) !== JSON.stringify(events2.get(id))) {
      result.events.modified++
    }
  }
  
  for (const [id] of events2) {
    if (!events1.has(id)) {
      result.events.added++
    }
  }
  
  return result
}

