// ===== СИСТЕМА FEATURE FLAGS =====
// Управление переключением между JSON файлами и базой данных

export interface FeatureFlags {
  useDatabase: boolean
  useDatabaseForCharacters: boolean
  useDatabaseForActions: boolean
  useDatabaseForContracts: boolean
  useDatabaseForEvents: boolean
  useDatabaseForEquipment: boolean
  useDatabaseForUsers: boolean
  useDatabaseForStoryScenes: boolean
  useDatabaseForConditions: boolean
  useDatabaseForStationEntities: boolean
  useDatabaseForCharacterAI: boolean
}

// Получение feature flags из переменных окружения
export function getFeatureFlags(): FeatureFlags {
  // Загружаем переменные окружения
  if (typeof process !== 'undefined' && process.env) {
    require('dotenv').config({ path: '.env' })
  }

  const useDatabase = process.env.USE_DATABASE === 'true'

  return {
    useDatabase,
    useDatabaseForCharacters: process.env.USE_DATABASE_CHARACTERS === 'true' || useDatabase,
    useDatabaseForActions: process.env.USE_DATABASE_ACTIONS === 'true' || useDatabase,
    useDatabaseForContracts: process.env.USE_DATABASE_CONTRACTS === 'true' || useDatabase,
    useDatabaseForEvents: process.env.USE_DATABASE_EVENTS === 'true' || useDatabase,
    useDatabaseForEquipment: process.env.USE_DATABASE_EQUIPMENT === 'true' || useDatabase,
    useDatabaseForUsers: process.env.USE_DATABASE_USERS === 'true' || useDatabase,
    useDatabaseForStoryScenes: process.env.USE_DATABASE_STORY_SCENES === 'true' || useDatabase,
    useDatabaseForConditions: process.env.USE_DATABASE_CONDITIONS === 'true' || useDatabase,
    useDatabaseForStationEntities: process.env.USE_DATABASE_STATION_ENTITIES === 'true' || useDatabase,
    useDatabaseForCharacterAI: process.env.USE_DATABASE_CHARACTER_AI === 'true' || useDatabase
  }
}

// Проверка, нужно ли использовать БД для конкретного типа данных
export function shouldUseDatabase(dataType: keyof Omit<FeatureFlags, 'useDatabase'>): boolean {
  const flags = getFeatureFlags()
  return flags[dataType]
}

// Получение всех активных feature flags
export function getActiveFeatureFlags(): string[] {
  const flags = getFeatureFlags()
  const active: string[] = []

  if (flags.useDatabase) active.push('useDatabase')
  if (flags.useDatabaseForCharacters) active.push('useDatabaseForCharacters')
  if (flags.useDatabaseForActions) active.push('useDatabaseForActions')
  if (flags.useDatabaseForContracts) active.push('useDatabaseForContracts')
  if (flags.useDatabaseForEvents) active.push('useDatabaseForEvents')
  if (flags.useDatabaseForEquipment) active.push('useDatabaseForEquipment')
  if (flags.useDatabaseForUsers) active.push('useDatabaseForUsers')
  if (flags.useDatabaseForStoryScenes) active.push('useDatabaseForStoryScenes')
  if (flags.useDatabaseForConditions) active.push('useDatabaseForConditions')
  if (flags.useDatabaseForStationEntities) active.push('useDatabaseForStationEntities')
  if (flags.useDatabaseForCharacterAI) active.push('useDatabaseForCharacterAI')

  return active
}

// Логирование текущих feature flags
export function logFeatureFlags(): void {
  const flags = getFeatureFlags()
  const active = getActiveFeatureFlags()

  console.log('🚩 Feature Flags Status:')
  console.log('='.repeat(50))
  console.log(`📊 Общее использование БД: ${flags.useDatabase ? '✅' : '❌'}`)
  console.log(`👥 Персонажи: ${flags.useDatabaseForCharacters ? '✅' : '❌'}`)
  console.log(`⚡ Действия: ${flags.useDatabaseForActions ? '✅' : '❌'}`)
  console.log(`📋 Контракты: ${flags.useDatabaseForContracts ? '✅' : '❌'}`)
  console.log(`🎭 События: ${flags.useDatabaseForEvents ? '✅' : '❌'}`)
  console.log(`🔧 Оборудование: ${flags.useDatabaseForEquipment ? '✅' : '❌'}`)
  console.log(`👤 Пользователи: ${flags.useDatabaseForUsers ? '✅' : '❌'}`)
  console.log(`📖 Сюжетные сцены: ${flags.useDatabaseForStoryScenes ? '✅' : '❌'}`)
  console.log(`🔍 Условия: ${flags.useDatabaseForConditions ? '✅' : '❌'}`)
  console.log(`🏢 Сущности станции: ${flags.useDatabaseForStationEntities ? '✅' : '❌'}`)
  console.log(`🤖 ИИ персонажей: ${flags.useDatabaseForCharacterAI ? '✅' : '❌'}`)
  console.log('='.repeat(50))
  console.log(`🎯 Активные флаги: ${active.length > 0 ? active.join(', ') : 'нет'}`)
  console.log('='.repeat(50))
}

// Проверка совместимости feature flags
export function validateFeatureFlags(): { valid: boolean; errors: string[] } {
  const flags = getFeatureFlags()
  const errors: string[] = []

  // Проверяем, что если общий флаг выключен, то и все остальные тоже
  if (!flags.useDatabase) {
    const individualFlags = [
      'useDatabaseForCharacters',
      'useDatabaseForActions',
      'useDatabaseForContracts',
      'useDatabaseForEvents',
      'useDatabaseForEquipment',
      'useDatabaseForUsers',
      'useDatabaseForStoryScenes',
      'useDatabaseForConditions',
      'useDatabaseForStationEntities',
      'useDatabaseForCharacterAI'
    ]

    for (const flag of individualFlags) {
      if (flags[flag as keyof FeatureFlags]) {
        errors.push(`Флаг ${flag} включен, но общий флаг useDatabase выключен`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
