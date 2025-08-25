import type {
  ActionsConfig,
  ContractsConfig,
  EventsConfig,
  MarketConfig,
  EquipmentConfig,
  SystemDefinitions,
  AssetsConfig,
  UsersConfig,
  GameConfig
} from './types'

// Универсальная функция для загрузки конфигураций
export async function loadConfigsForEnvironment(environment: 'dev' | 'prod'): Promise<GameConfig> {
  try {
    console.log(`🔄 Загружаем конфигурации для ${environment} режима...`)
    
    // Загружаем базовые конфигурации из файлов
    const [
      actions,
      contracts,
      events,
      market,
      equipment,
      system,
      assets,
      users
    ] = await Promise.all([
      import('../data/actions-unified.json'),
      import('../data/contracts-unified.json'),
      import('../data/events-unified.json'),
      import('../data/market.json'),
      import('../data/equipment-unified.json'),
      import('../data/system-unified.json'),
      import('../data/assets.json'),
      import('../data/users-unified.json')
    ])

    const baseConfig = {
      actions: actions.default as ActionsConfig,
      contracts: contracts.default as ContractsConfig,
      events: events.default as EventsConfig,
      market: market.default as MarketConfig,
      equipment: equipment.default as EquipmentConfig,
      system: system.default as SystemDefinitions,
      assets: assets.default as AssetsConfig,
      users: users.default as UsersConfig
    }

    // Универсальная загрузка из localStorage для всех режимов
    console.log('🔍 Проверяем localStorage для всех конфигураций...')
    
    const configTypes = ['actions', 'contracts', 'events', 'market', 'equipment', 'system', 'assets', 'users'] as const
    
    for (const configType of configTypes) {
      const savedData = localStorage.getItem(`config_${configType}`)
      console.log(`🔍 localStorage для ${configType}:`, savedData ? 'есть данные' : 'нет данных')
      
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData)
          console.log(`📦 Загружена сохраненная конфигурация ${configType} из localStorage:`, parsedData)
          
          // Проверяем, есть ли удаленные элементы
          if (parsedData.users && Array.isArray(parsedData.users)) {
            const deletedUsers = parsedData.users.filter((user: any) => user.deleted)
            console.log(`🗑️ Найдено ${deletedUsers.length} удаленных пользователей:`, deletedUsers)
          }
          
          if (parsedData.assets && Array.isArray(parsedData.assets)) {
            const deletedAssets = parsedData.assets.filter((asset: any) => asset.deleted)
            console.log(`🗑️ Найдено ${deletedAssets.length} удаленных активов:`, deletedAssets)
          }
          
          baseConfig[configType] = parsedData
        } catch (error) {
          console.error(`❌ Ошибка парсинга сохраненной конфигурации ${configType}:`, error)
        }
      }
    }
    
    // Специальная обработка для пользователей - синхронизируем с prod режимом
    const allUsers = localStorage.getItem('allUsers')
    console.log('🔍 Проверяем allUsers в localStorage:', allUsers ? 'есть данные' : 'нет данных')
    
    if (allUsers) {
      try {
        const prodUsers = JSON.parse(allUsers)
        console.log('👥 Найдены пользователи из prod режима:', prodUsers.length)
        console.log('👥 Список пользователей:', prodUsers.map((u: any) => u.username))
        
        // Преобразуем пользователей из prod формата в dev формат
        const devUsers = prodUsers.map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email || `${user.username}@nexus.com`,
          role: user.role || 'user',
          status: user.status || 'active',
          created: user.created,
          lastLogin: user.lastLogin,
          account: user.account,
          assets: user.assets || [],
          equipment: user.equipment || [],
          settings: user.settings || {}
        }))
        
        console.log('🔄 Преобразованные пользователи для dev:', devUsers.map((u: any) => u.username))
        
        // Обновляем конфигурацию пользователей
        baseConfig.users = {
          users: devUsers,
          userRoles: {
            admin: { name: 'Администратор', permissions: ['all'] },
            user: { name: 'Пользователь', permissions: ['basic'] },
            moderator: { name: 'Модератор', permissions: ['moderate'] }
          }
        }
        
        console.log('✅ Пользователи синхронизированы с prod режимом')
        console.log('📋 Итоговая конфигурация users:', baseConfig.users)
      } catch (error) {
        console.error('❌ Ошибка синхронизации пользователей:', error)
      }
    } else {
      console.log('⚠️ allUsers не найден в localStorage')
    }
    
    console.log('📋 Итоговая конфигурация после загрузки из localStorage:', baseConfig)
    return baseConfig
  } catch (error) {
    console.error('Ошибка загрузки конфигурации:', error)
    throw new Error(`Не удалось загрузить конфигурацию для ${environment}`)
  }
}

// Функция для сохранения конфигурации в localStorage
export async function saveConfigToFile(configType: string, data: any): Promise<void> {
  try {
    const dataStr = JSON.stringify(data, null, 2)
    localStorage.setItem(`config_${configType}`, dataStr)
    console.log(`✅ Конфигурация ${configType} сохранена в localStorage`)
  } catch (error) {
    console.error(`❌ Ошибка сохранения конфигурации ${configType}:`, error)
    throw error
  }
}

// Функция для инициализации единого источника истины
export function initializeUnifiedDataSource(): void {
  console.log('🚀 Инициализация единого источника истины...')
  
  // Проверяем, есть ли уже данные в localStorage
  const hasExistingData = ['config_users', 'config_assets', 'config_market', 'config_actions'].some(
    key => localStorage.getItem(key)
  )
  
  if (hasExistingData) {
    console.log('✅ Данные уже существуют в localStorage')
    return
  }
  
  console.log('📝 Инициализируем localStorage из JSON файлов...')
  
  // Здесь можно добавить логику для инициализации данных из JSON файлов
  // если localStorage пустой
}

// Функция для валидации консистентности между dev и prod
export function validateConfigConsistency(devConfig: GameConfig, prodConfig: GameConfig): {
  isConsistent: boolean
  differences: string[]
} {
  const differences: string[] = []
  
  // Проверяем основные конфигурации
  const configsToCheck = ['actions', 'contracts', 'events', 'market', 'equipment'] as const
  
  for (const configKey of configsToCheck) {
    const devData = JSON.stringify(devConfig[configKey], null, 2)
    const prodData = JSON.stringify(prodConfig[configKey], null, 2)
    
    if (devData !== prodData) {
      differences.push(`Конфигурация ${configKey} отличается между dev и prod`)
    }
  }
  
  return {
    isConsistent: differences.length === 0,
    differences
  }
}

// Функция для экспорта конфигураций в JSON файлы
export function exportConfigToFile(config: GameConfig, configType: keyof GameConfig): string {
  const configData = config[configType]
  return JSON.stringify(configData, null, 2)
}

// Функция для получения статистики конфигурации
export function getConfigStats(config: GameConfig): Record<string, number> {
  return {
    actions: Object.keys(config.actions?.categories || {}).length,
    contracts: config.contracts?.available?.length || 0,
    events: (config.events?.anomalies?.length || 0) + 
            (config.events?.crises?.length || 0) + 
            (config.events?.opportunities?.length || 0),
    market: (config.market?.talentExchange?.length || 0) + 
            (config.market?.voidRescues?.length || 0) + 
            (config.market?.corporateContracts?.length || 0),
    equipment: config.equipment?.equipment?.length || 0,
    scenes: config.scenes?.scenes?.length || 0
  }
}
