// Утилиты для миграции и оптимизации данных
import fs from 'fs'
import path from 'path'

// Типы для миграции
export interface MigrationResult {
  success: boolean
  message: string
  data?: any
  errors?: string[]
}

export interface CharacterData {
  id: string
  name: string
  rank: string
  avatar: string
  price: number
  specialization: string
  description: string
  status: string
  owner: string | null
  location: string
  attributes: Record<string, number>
  skills: Record<string, number>
  // traits удалены
  preferences?: any
  condition?: any
  history?: any
  metadata?: {
    source: 'market' | 'void' | 'corporate' | 'custom'
    createdAt: string
    lastModified: string
  }
}

// Объединение assets.json и market.json
export async function mergeCharacterData(): Promise<MigrationResult> {
  try {
    console.log('🔄 Начинаю объединение данных персонажей...')
    
    // Загружаем данные
    const assetsData = await import('../data/assets.json')
    const marketData = await import('../data/market.json')
    
    const mergedCharacters: CharacterData[] = []
    const errors: string[] = []
    
    // Обрабатываем assets
    if (assetsData.default?.assets) {
      assetsData.default.assets.forEach((asset: any) => {
        if (!asset.deleted) {
          mergedCharacters.push({
            id: asset.id,
            name: asset.name,
            rank: asset.rank,
            avatar: asset.avatar,
            price: asset.price,
            specialization: asset.specialization,
            description: asset.description,
            status: asset.status,
            owner: asset.owner,
            location: asset.location,
            attributes: asset.attributes,
            skills: asset.skills,
            // traits удалены
            preferences: asset.preferences,
            condition: asset.condition,
            history: asset.history,
            metadata: {
              source: 'custom',
              createdAt: asset.history?.created || new Date().toISOString(),
              lastModified: new Date().toISOString()
            }
          })
        }
      })
    }
    
    // Обрабатываем market data
    if (marketData.default?.talentExchange) {
      marketData.default.talentExchange.forEach((talent: any) => {
        if (!talent.deleted) {
          mergedCharacters.push({
            id: talent.id,
            name: talent.name,
            rank: talent.rank,
            avatar: talent.avatar,
            price: talent.price,
            specialization: talent.specialization,
            description: talent.description,
            status: 'available',
            owner: null,
            location: 'talent_exchange',
            attributes: talent.attributes,
            skills: talent.skills,
            metadata: {
              source: 'market',
              createdAt: new Date().toISOString(),
              lastModified: new Date().toISOString()
            }
          })
        }
      })
    }
    
    // Обрабатываем void rescues
    if (marketData.default?.voidRescues) {
      marketData.default.voidRescues.forEach((rescue: any) => {
        if (!rescue.deleted) {
          mergedCharacters.push({
            id: rescue.id,
            name: rescue.name || 'Сигнал из Тени',
            rank: 'Junior',
            avatar: rescue.avatar || '🌌',
            price: rescue.cost || 50,
            specialization: 'Выживание в Тени',
            description: rescue.description,
            status: 'available',
            owner: null,
            location: 'void_border',
            attributes: rescue.attributes,
            skills: rescue.skills,
            // traits удалены
            metadata: {
              source: 'void',
              createdAt: new Date().toISOString(),
              lastModified: new Date().toISOString()
            }
          })
        }
      })
    }
    
    // Создаем новую структуру
    const mergedData = {
      characters: mergedCharacters,
      templates: {
        market: marketData.default?.talentExchange || [],
        void: marketData.default?.voidRescues || [],
        corporate: marketData.default?.corporateContracts || [],
        neuralForge: marketData.default?.neuralForge || []
      },
      config: {
        priceRanges: marketData.default?.priceRanges || {},
        conditions: marketData.default?.conditions || [],
        risks: marketData.default?.risks || []
      }
    }
    
    console.log(`✅ Объединено ${mergedCharacters.length} персонажей`)
    console.log(`📊 Источники: ${new Set(mergedCharacters.map(c => c.metadata?.source)).size}`)
    
    return {
      success: true,
      message: `Успешно объединено ${mergedCharacters.length} персонажей`,
      data: mergedData,
      errors
    }
    
  } catch (error) {
    console.error('❌ Ошибка объединения данных:', error)
    return {
      success: false,
      message: 'Ошибка объединения данных персонажей',
      errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
    }
  }
}

// Объединение actions.json и actions-config.json
export async function mergeActionsData(): Promise<MigrationResult> {
  try {
    console.log('🔄 Начинаю объединение данных действий...')
    
    const actionsData = await import('../data/actions-unified.json')
    const actionsConfigData = await import('../data/actions-config.json')
    
    // Объединяем конфигурации
    const mergedConfig = {
      ...actionsConfigData.default,
      categories: {
        ...actionsConfigData.default.categories,
        ...actionsData.default.categories
      }
    }
    
    // Нормализуем структуру действий
    const normalizedActions: any[] = []
    
    Object.entries(mergedConfig.categories).forEach(([categoryKey, category]: [string, any]) => {
      if (category.actions) {
        Object.entries(category.actions).forEach(([actionKey, action]: [string, any]) => {
          if (!action.deleted) {
            normalizedActions.push({
              id: `${categoryKey}-${actionKey}`,
              category: categoryKey,
              title: action.title,
              description: action.description,
              cost: action.cost,
              risk: action.risk,
              effects: action.effects,
              riskEffects: action.riskEffects,
              probability: action.probability,
              outcomes: action.outcomes,
              memory: action.memory,
              metadata: {
                source: 'merged',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
              }
            })
          }
        })
      }
    })
    
    const mergedData = {
      actions: normalizedActions,
      categories: mergedConfig.categories,
      config: {
        settings: mergedConfig.settings || {},
        conditions: mergedConfig.conditions || [],
        risks: mergedConfig.risks || []
      }
    }
    
    console.log(`✅ Объединено ${normalizedActions.length} действий`)
    
    return {
      success: true,
      message: `Успешно объединено ${normalizedActions.length} действий`,
      data: mergedData
    }
    
  } catch (error) {
    console.error('❌ Ошибка объединения действий:', error)
    return {
      success: false,
      message: 'Ошибка объединения данных действий',
      errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
    }
  }
}

// Объединение events.json и events-config.json
export async function mergeEventsData(): Promise<MigrationResult> {
  try {
    console.log('🔄 Начинаю объединение данных событий...')
    
    const eventsData = await import('../data/events.json')
    const eventsConfigData = await import('../data/events-config.json')
    
    const mergedEvents = [
      ...(eventsData.default?.events || []),
      ...(eventsData.default?.anomalies || []),
      ...(eventsData.default?.crises || [])
    ]
    
    const mergedData = {
      events: mergedEvents,
      config: {
        ...eventsConfigData.default,
        settings: eventsConfigData.default?.settings || {},
        conditions: eventsConfigData.default?.conditions || [],
        risks: eventsConfigData.default?.risks || []
      }
    }
    
    console.log(`✅ Объединено ${mergedEvents.length} событий`)
    
    return {
      success: true,
      message: `Успешно объединено ${mergedEvents.length} событий`,
      data: mergedData
    }
    
  } catch (error) {
    console.error('❌ Ошибка объединения событий:', error)
    return {
      success: false,
      message: 'Ошибка объединения данных событий',
      errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
    }
  }
}

// Валидация объединенных данных
export function validateMergedData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Проверяем обязательные поля
  if (!data.characters || !data.characters.characters || !Array.isArray(data.characters.characters)) {
    errors.push('Отсутствует массив characters')
  }
  
  if (!data.actions || !data.actions.categories || typeof data.actions.categories !== 'object') {
    errors.push('Отсутствует объект categories в actions')
  }
  
  if (!data.events || !data.events.events || !Array.isArray(data.events.events)) {
    errors.push('Отсутствует массив events')
  }
  
  // Проверяем уникальность ID
  const characterIds = data.characters?.characters?.map((c: any) => c.id) || []
  
  // Собираем ID действий из категорий
  const actionIds: string[] = []
  if (data.actions?.categories) {
    for (const [categoryKey, category] of Object.entries(data.actions.categories)) {
      for (const actionId of Object.keys((category as any).actions || {})) {
        actionIds.push(`${categoryKey}-${actionId}`)
      }
    }
  }
  
  const eventIds = data.events?.events?.map((e: any) => e.id) || []
  
  if (new Set(characterIds).size !== characterIds.length) {
    errors.push('Дублирующиеся ID персонажей')
  }
  
  if (new Set(actionIds).size !== actionIds.length) {
    errors.push('Дублирующиеся ID действий')
  }
  
  if (new Set(eventIds).size !== eventIds.length) {
    errors.push('Дублирующиеся ID событий')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Сохранение объединенных данных
export async function saveMergedData(data: any, filename: string): Promise<MigrationResult> {
  try {
    const dataPath = path.join(process.cwd(), 'data', filename)
    await fs.promises.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8')
    
    return {
      success: true,
      message: `Данные сохранены в ${filename}`
    }
  } catch (error) {
    return {
      success: false,
      message: `Ошибка сохранения в ${filename}`,
      errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
    }
  }
}

// Полная миграция всех данных
export async function performFullMigration(): Promise<MigrationResult> {
  try {
    console.log('🚀 Начинаю полную миграцию данных...')
    
    const results = {
      characters: await mergeCharacterData(),
      actions: await mergeActionsData(),
      events: await mergeEventsData()
    }
    
    // Проверяем успешность всех операций
    const failedOperations = Object.entries(results).filter(([key, result]) => !result.success)
    
    if (failedOperations.length > 0) {
      return {
        success: false,
        message: 'Некоторые операции миграции завершились с ошибками',
        errors: failedOperations.map(([key, result]) => `${key}: ${result.message}`)
      }
    }
    
    // Объединяем все данные
    const mergedData = {
      characters: results.characters.data,
      actions: results.actions.data,
      events: results.events.data,
      system: await import('../data/system-unified.json').then(m => m.default),
      equipment: await import('../data/equipment-unified.json').then(m => m.default),
      contracts: await import('../data/contracts-unified.json').then(m => m.default),
      storyScenes: await import('../data/story-scenes-unified.json').then(m => m.default),
      users: await import('../data/users-unified.json').then(m => m.default)
    }
    
    // Валидируем объединенные данные
    const validation = validateMergedData(mergedData)
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Ошибка валидации объединенных данных',
        errors: validation.errors
      }
    }
    
    console.log('✅ Миграция завершена успешно')
    
    return {
      success: true,
      message: 'Полная миграция данных завершена успешно',
      data: mergedData
    }
    
  } catch (error) {
    console.error('❌ Ошибка полной миграции:', error)
    return {
      success: false,
      message: 'Ошибка полной миграции данных',
      errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
    }
  }
}
