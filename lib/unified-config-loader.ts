import type { GameConfig } from './unified-entities'

console.log('📦 unified-config-loader.ts загружен')

// Кэш отключен для отладки
// let configCache: GameConfig | null = null
// let cacheTimestamp = 0
// const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

// Загрузка унифицированной конфигурации версии 2
export async function loadUnifiedConfigV2(): Promise<GameConfig> {
  console.log('🚀 loadUnifiedConfigV2 вызвана')
  const now = Date.now()

  // Временно отключаем кэширование для отладки
  // if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
  //   console.log('📋 Используем кэшированную конфигурацию')
  //   return configCache
  // }

  try {
    console.log('🔄 Загружаем унифицированную конфигурацию v2...')
    console.log('⏰ Текущее время:', new Date().toISOString())

    // Загружаем реальные данные из JSON файлов
    console.log('📂 Загружаем данные из JSON файлов...')

    const [charactersData, usersData, equipmentData, gameUnifiedData] = await Promise.all([
      import('../data/characters-unified.json'),
      import('../data/users-unified.json'),
      import('../data/equipment-unified.json'),
      import('../data/game-config-unified.json').catch(() => null as any)
    ])

    const realCharacters = charactersData.default.characters || []
    const realUsers = usersData.default.users || []
    const realEquipment = equipmentData.default.equipment || []

    console.log('📊 Реальные данные загружены:', {
      characters: realCharacters.length,
      users: realUsers.length,
      equipment: realEquipment.length
    })

    // Попробуем получить Character AI конфигурацию из объединённого файла,
    // а если её нет — используем встроенную дефолтную
    let characterAIFromFile: any = (gameUnifiedData as any)?.default?.characterAI || null
    if (!characterAIFromFile) {
      try {
        const { characterAIConfig } = await import('./character/character-ai-config')
        characterAIFromFile = characterAIConfig
      } catch (_) {
        characterAIFromFile = { actions: {}, tools: {}, poses: {} }
      }
    }

    // Создаем базовую конфигурацию с объединенными данными
    const config: GameConfig = {
      characters: realCharacters.length > 0 ? realCharacters : [
        {
          id: "test_asset_1",
          name: "Тестовый Актив 1",
          archetype: "default",
          description: "Тестовый персонаж для проверки функциональности",
          attributes: {
            physical: { Выносливость: 0.8, Сила: 0.7 },
            mental: { Интеллект: 0.9, Харизма: 0.6 }
          },
          states: { "Настроение": 0.8, "Здоровье": 1.0 },
          skills: ["test_skill_1"],
          fetishes: ["test_fetish_1"],
          statusEffects: [],
          equippedItems: [],
          inventory: []
        }
      ], // Реальные или тестовые персонажи
      actions: {}, // (в проде используем characterAI.actions; общий actions пока не требуется)
      events: [
        {
          id: "test_event_1",
          title: "Тестовое событие",
          description: "Тестовое событие для проверки",
          type: "test",
          effects: []
        }
      ], // Тестовые события
      contracts: [
        {
          id: "test_contract_1",
          title: "Тестовый контракт",
          description: "Тестовый контракт для проверки",
          requirements: { skills: {} },
          rewards: { credits: 100 }
        }
      ], // Тестовые контракты
      equipment: realEquipment.length > 0 ? realEquipment : [
        {
          id: "test_equipment_1",
          name: "Тестовое оборудование",
          description: "Тестовое оборудование для проверки",
          type: "tool",
          category: "general",
          stats: { power: 50, energyConsumption: 10 },
          enabled: true,
          targetTalents: [],
          powerLevel: 50,
          maxPowerLevel: 100,
          mode: "standard",
          activeMode: "standard",
          energyConsumption: 10,
          lastUsed: Date.now(),
          cooldownTime: 5000
        }
      ], // Реальное или тестовое оборудование
      system: {}, // Заглушка для system
      storyScenes: {
        test_scene: {
          name: "Тестовая сцена",
          description: "Тестовая сюжетная сцена",
          value: 50,
          defaultValue: 50,
          minValue: 0,
          maxValue: 100,
          type: "numeric"
        }
      }, // Тестовые сюжетные сцены
      users: realUsers.length > 0 ? realUsers : [
        {
          id: "test_user_1",
          username: "testuser",
          role: "user",
          status: "active",
          created: "2024-01-01",
          lastLogin: "2024-01-01",
          account: { balance: 1000, currency: "credits", transactions: [] },
          characters: ["test_asset_1"],
          userEquipment: ["test_equipment_1"]
        }
      ], // Реальные или тестовые пользователи
      market: {}, // Заглушка для рынка
      assets: [], // Заглушка для активов
      characterAI: characterAIFromFile
    }

    console.log('✅ Конфигурация создана с объединенными данными')

    // Кэш отключен для отладки
    // configCache = config
    // cacheTimestamp = now

    console.log('🎯 Возвращаем конфигурацию')
    return config
  } catch (error) {
    console.error('❌ Ошибка загрузки конфигурации:', error)
    console.error('📋 Детали ошибки:', error instanceof Error ? error.stack : String(error))
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
