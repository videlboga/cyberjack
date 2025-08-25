import type { GameConfig } from './unified-entities'
import { saveConfigToFile } from './config-sync'

/**
 * Адаптер для преобразования unified конфигурации в старую структуру
 * для обеспечения совместимости с существующим кодом
 */
export function adaptUnifiedToLegacyConfig(unifiedConfig: GameConfig): GameConfig {
  console.log('🔄 Адаптируем unified конфигурацию к legacy структуре...')
  console.log('📊 Исходные персонажи:', unifiedConfig.characters.characters.length)
  console.log('📊 Первый персонаж:', unifiedConfig.characters.characters[0])
  
  // Преобразуем персонажей в активы
  const assets = {
    assets: unifiedConfig.characters.characters.map(char => {
      console.log(`🔄 Обрабатываем персонажа: ${char.name}`)
      console.log(`📊 Характеристики:`, char.characteristics)
      
      // Преобразуем структурированные характеристики в плоские атрибуты
      const attributes = {
        // Физические характеристики
        endurance: char.characteristics?.physical?.['Выносливость'] || char.characteristics?.physical?.endurance || 0,
        sensitivity: char.characteristics?.physical?.['Чувствительность'] || char.characteristics?.physical?.sensitivity || 0,
        flexibility: char.characteristics?.physical?.['Гибкость'] || char.characteristics?.physical?.flexibility || 0,
        
        // Психологические характеристики
        emotional_stability: char.characteristics?.psychological?.['Эмоциональная стабильность'] || char.characteristics?.psychological?.emotionalStability || 0,
        adaptability: char.characteristics?.psychological?.['Адаптивность'] || char.characteristics?.psychological?.adaptability || 0,
        intelligence: char.characteristics?.psychological?.['Интеллект'] || char.characteristics?.psychological?.intelligence || 0,
        
        // Социальные характеристики
        sociability: char.characteristics?.social?.['Общительность'] || char.characteristics?.social?.sociability || 0,
        empathy: char.characteristics?.social?.['Эмпатия'] || char.characteristics?.social?.empathy || 0,
        dominance: char.characteristics?.social?.['Доминантность'] || char.characteristics?.social?.dominance || 0,
        
        // Личностные характеристики
        self_esteem: char.characteristics?.personality?.['Самооценка'] || char.characteristics?.personality?.selfEsteem || 0,
        optimism: char.characteristics?.personality?.['Оптимизм'] || char.characteristics?.personality?.optimism || 0,
        curiosity: char.characteristics?.personality?.['Любопытство'] || char.characteristics?.personality?.curiosity || 0,
        
        // Специальные характеристики
        sexual_experience: char.characteristics?.special?.['Сексуальная опытность'] || char.characteristics?.special?.sexualExperience || 0,
        resistance: char.characteristics?.special?.['Сопротивляемость'] || char.characteristics?.special?.resistance || 0,
        dependency: char.characteristics?.special?.['Зависимость'] || char.characteristics?.special?.dependency || 0,
      };
      
      console.log(`📊 Преобразованные атрибуты:`, attributes)
      
      return {
        id: char.id,
        name: char.name,
        rank: char.rank,
        avatar: char.avatar,
        price: char.price,
        specialization: char.specialization,
        description: char.description,
        status: char.status,
        owner: char.owner,
        location: char.location,
        attributes,
        fetishes: char.fetishes || {},
        traits: char.traits || [],
        preferences: char.preferences || {},
        condition: char.states || {},
        history: char.history || {},
        skills: char.skills || {},
        deleted: char.deleted || false,
        deletedAt: char.deletedAt || null
      };
    }),
    assetTypes: unifiedConfig.characters.templates || {},
    skillCategories: unifiedConfig.characters.config?.skillCategories || {}
  }

  // Преобразуем действия
  const actions = {
    categories: unifiedConfig.actions.categories || {}
  }

  // Преобразуем контракты
  const contracts = {
    available: unifiedConfig.contracts.available.map(contract => ({
      id: contract.id,
      client: contract.client,
      title: contract.title,
      description: contract.description,
      requirements: contract.requirements,
      reward: contract.reward,
      deadline: contract.deadline,
      kpi: contract.kpi || [],
      assignedTalents: contract.assignedTalents || [],
      status: contract.status,
      storyScenes: contract.storyScenes || {}
    }))
  }

  // Преобразуем события
  const events = {
    anomalies: unifiedConfig.events.events.filter(e => e.type === 'anomaly'),
    crises: unifiedConfig.events.events.filter(e => e.type === 'crisis'),
    opportunities: unifiedConfig.events.events.filter(e => e.type === 'opportunity')
  }

  // Преобразуем персонажей (новая система Character AI)
  const characters = {
    characters: unifiedConfig.characters.characters,
    templates: unifiedConfig.characters.templates || {},
    config: unifiedConfig.characters.config || {}
  }

  // Преобразуем оборудование
  const equipment = {
    equipment: unifiedConfig.equipment.equipment.map(eq => ({
      id: eq.id,
      name: eq.name,
      type: eq.type,
      slot: eq.slot,
      description: eq.description,
      effects: eq.effects,
      removable: eq.removable,
      powerSettings: eq.powerSettings || {},
      modes: eq.modes || [],
      progressiveEffects: eq.progressiveEffects || []
    }))
  }

  // Преобразуем пользователей
  const users = {
    users: unifiedConfig.users.users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      created: user.created,
      lastLogin: user.lastLogin,
      account: user.account,
      assets: user.assets || [],
      equipment: user.equipment || [],
      settings: user.settings || {}
    })),
    userRoles: {
      admin: { name: 'Администратор', permissions: ['all'] },
      user: { name: 'Пользователь', permissions: ['basic'] },
      moderator: { name: 'Модератор', permissions: ['moderate'] }
    }
  }

  const adaptedConfig: GameConfig = {
    assets,
    actions,
    contracts,
    events,
    characters,
    equipment,
    system: unifiedConfig.system,
    users,
    characterAI: unifiedConfig.characterAI
  }

  console.log('✅ Адаптация завершена')
  console.log(`📊 Статистика адаптированной конфигурации:`)
  console.log(`- Активов: ${adaptedConfig.assets.assets.length}`)
  console.log(`- Контрактов: ${adaptedConfig.contracts.available.length}`)
  console.log(`- Категорий действий: ${Object.keys(adaptedConfig.actions.categories).length}`)
  console.log(`- Событий: ${adaptedConfig.events.anomalies.length + adaptedConfig.events.crises.length + adaptedConfig.events.opportunities.length}`)
  console.log(`- Пользователей: ${adaptedConfig.users.users.length}`)

  return adaptedConfig
}

/**
 * Функция для синхронизации изменений из legacy структуры обратно в unified конфигурацию
 */
export async function syncLegacyToUnifiedConfig(legacyConfig: GameConfig): Promise<void> {
  try {
    console.log('🔄 Синхронизируем изменения обратно в unified конфигурацию...')
    
    // Загружаем текущую unified конфигурацию
    const { loadUnifiedConfig } = await import('./unified-config-loader')
    const unifiedConfig = await loadUnifiedConfig()
    
    // Синхронизируем изменения персонажей
    if (legacyConfig.assets?.assets) {
      console.log('🔄 Синхронизируем персонажей...')
      
      // Создаем карту персонажей по ID для быстрого поиска
      const characterMap = new Map(unifiedConfig.characters.characters.map(char => [char.id, char]))
      
      // Обновляем персонажей на основе изменений в активах
      legacyConfig.assets.assets.forEach(asset => {
        const character = characterMap.get(asset.id)
        if (character) {
          // Синхронизируем поля deleted
          if (asset.deleted !== undefined) {
            character.deleted = asset.deleted
          }
          if (asset.deletedAt !== undefined) {
            character.deletedAt = asset.deletedAt
          }
          
          // Синхронизируем другие поля, если они изменились
          if (asset.name !== character.name) {
            character.name = asset.name
          }
          if (asset.description !== character.description) {
            character.description = asset.description
          }
          // Добавьте другие поля по необходимости
        }
      })
      
      console.log(`✅ Синхронизировано ${legacyConfig.assets.assets.length} персонажей`)
    }
    
    // Сохраняем обновленную unified конфигурацию
    await saveConfigToFile('characters', unifiedConfig.characters)
    console.log('✅ Unified конфигурация обновлена')
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error)
    throw error
  }
}

/**
 * Функция для загрузки unified конфигурации с адаптацией к legacy структуре
 */
export async function loadUnifiedConfigWithAdapter(): Promise<GameConfig> {
  try {
    console.log('🔄 Загружаем unified конфигурацию...')
    const { loadUnifiedConfig } = await import('./unified-config-loader')
    const unifiedConfig = await loadUnifiedConfig()
    console.log('✅ Unified конфигурация загружена:', unifiedConfig)
    
    console.log('🔄 Адаптируем к legacy структуре...')
    const adaptedConfig = adaptUnifiedToLegacyConfig(unifiedConfig)
    console.log('✅ Адаптация завершена:', adaptedConfig)
    
    return adaptedConfig
  } catch (error) {
    console.error('❌ Ошибка в loadUnifiedConfigWithAdapter:', error)
    throw error
  }
}
