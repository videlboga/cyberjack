import type {
  ActionsConfig,
  ContractsConfig,
  EventsConfig,
  MarketConfig,
  CharacterConfig,
  EquipmentConfig,
  SystemDefinitions,
  StoryScenesConfig,
  GameConfig
} from './types'

// Загрузка всех конфигураций
export async function loadGameConfig(): Promise<GameConfig> {
  try {
    const [
      actions,
      contracts,
      events,
      market,
      characters,
      equipment,
      system,
      scenes
    ] = await Promise.all([
      import('../data/actions-unified.json'),
      import('../data/contracts-unified.json'),
      import('../data/events-unified.json'),
      import('../data/market.json'),
      import('../data/characters-unified.json'),
      import('../data/equipment-unified.json'),
      import('../data/system-unified.json'),
      import('../data/story-scenes-unified.json')
    ])

    return {
      actions: actions.default as ActionsConfig,
      contracts: contracts.default as ContractsConfig,
      events: events.default as EventsConfig,
      market: market.default as MarketConfig,
      characters: characters.default as CharactersConfig,
      equipment: equipment.default as EquipmentConfig,
      system: system.default as SystemDefinitions,
      scenes: scenes.default as StoryScenesConfig
    }
  } catch (error) {
    console.error('Ошибка загрузки конфигурации:', error)
    throw new Error('Не удалось загрузить конфигурацию игры')
  }
}

// Валидация конфигурации
export function validateConfig(config: GameConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Проверка действий
  if (!config.actions?.categories) {
    errors.push('Отсутствует конфигурация действий')
  }

  // Проверка контрактов
  if (!config.contracts?.available) {
    errors.push('Отсутствует конфигурация контрактов')
  }

  // Проверка событий
  if (!config.events?.events && !config.events?.anomalies && !config.events?.crises && !config.events?.opportunities) {
    errors.push('Отсутствует конфигурация событий')
  }

  // Проверка рынка
  if (!config.market?.talentExchange && !config.market?.voidRescues && !config.market?.corporateContracts) {
    errors.push('Отсутствует конфигурация рынка')
  }

  // Проверка оборудования
  if (!config.equipment?.equipment) {
    errors.push('Отсутствует конфигурация оборудования')
  }

  // Проверка системных определений
  if (!config.system?.attributes || !config.system?.states || !config.system?.skills) {
    errors.push('Отсутствует конфигурация системных определений')
  }

  // Проверка сюжетных сцен
  if (!config.scenes?.storyPoints || !config.scenes?.scenes) {
    errors.push('Отсутствует конфигурация сюжетных сцен')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Утилиты для работы с конфигами
export function getActionById(config: GameConfig, categoryId: string, actionId: string) {
  return config.actions.categories[categoryId]?.actions[actionId]
}

export function getContractById(config: GameConfig, contractId: string) {
  return config.contracts.available.find(contract => contract.id === contractId)
}

export function getEventById(config: GameConfig, eventId: string) {
  return config.events.events.find(event => event.id === eventId)
}

export function getEquipmentById(config: GameConfig, equipmentId: string) {
  return config.equipment.equipment.find(equipment => equipment.id === equipmentId)
}

export function getMarketTalents(config: GameConfig, sectionId: string) {
  const section = config.market[sectionId as keyof MarketConfig]
  if (Array.isArray(section)) {
    return section.flatMap(s => s.talents || [])
  }
  return []
}

// Экспорт конфигурации
export function exportConfig(config: GameConfig, format: 'json' = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(config, null, 2)
  }
  throw new Error(`Неподдерживаемый формат экспорта: ${format}`)
}

// Сравнение конфигураций
export function compareConfigs(config1: GameConfig, config2: GameConfig): { differences: string[] } {
  const differences: string[] = []

  // Сравнение действий
  const actions1 = JSON.stringify(config1.actions)
  const actions2 = JSON.stringify(config2.actions)
  if (actions1 !== actions2) {
    differences.push('Конфигурации действий различаются')
  }

  // Сравнение контрактов
  const contracts1 = JSON.stringify(config1.contracts)
  const contracts2 = JSON.stringify(config2.contracts)
  if (contracts1 !== contracts2) {
    differences.push('Конфигурации контрактов различаются')
  }

  // Сравнение событий
  const events1 = JSON.stringify(config1.events)
  const events2 = JSON.stringify(config2.events)
  if (events1 !== events2) {
    differences.push('Конфигурации событий различаются')
  }

  // Сравнение рынка
  const market1 = JSON.stringify(config1.market)
  const market2 = JSON.stringify(config2.market)
  if (market1 !== market2) {
    differences.push('Конфигурации рынка различаются')
  }

  // Сравнение оборудования
  const equipment1 = JSON.stringify(config1.equipment)
  const equipment2 = JSON.stringify(config2.equipment)
  if (equipment1 !== equipment2) {
    differences.push('Конфигурации оборудования различаются')
  }

  // Сравнение системных определений
  const system1 = JSON.stringify(config1.system)
  const system2 = JSON.stringify(config2.system)
  if (system1 !== system2) {
    differences.push('Системные определения различаются')
  }

  // Сравнение сюжетных сцен
  const scenes1 = JSON.stringify(config1.scenes)
  const scenes2 = JSON.stringify(config2.scenes)
  if (scenes1 !== scenes2) {
    differences.push('Сюжетные сцены различаются')
  }

  return { differences }
}
