// ===== ЕДИНСТВЕННЫЙ ПРОСТОЙ ЗАГРУЗЧИК ИЗ БД =====
// Никаких кэшей, никаких feature flags, никаких абстракций - только БД

import { Pool } from 'pg'

// Настройки подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
})


// Единственная функция загрузки
export async function loadGameConfig() {
  console.log('🔥 ПРОСТОЙ ЗАГРУЗЧИК: Загружаем данные из БД')

  // Загружаем все данные параллельно
  const [
    charactersResult,
    actionsResult,
    toolsResult,
    contractsResult,
    eventsResult,
    equipmentResult,
    usersResult,
    storyScenesResult,
    conditionsResult,
    stationEntitiesResult
  ] = await Promise.all([
    pool.query('SELECT * FROM characters ORDER BY name'),
    pool.query('SELECT * FROM actions WHERE enabled = true ORDER BY category, name'),
    pool.query('SELECT * FROM tools WHERE enabled = true ORDER BY category, name'),
    pool.query('SELECT * FROM contracts WHERE status = \'available\' ORDER BY created_at DESC'),
    pool.query('SELECT * FROM events ORDER BY type, probability DESC'),
    pool.query('SELECT * FROM equipment WHERE enabled = true ORDER BY category, name'),
    pool.query('SELECT * FROM users ORDER BY created_at DESC'),
    pool.query('SELECT * FROM story_scenes ORDER BY type, title'),
    pool.query('SELECT * FROM conditions ORDER BY type, name'),
    pool.query('SELECT * FROM station_entities WHERE status = \'active\' ORDER BY type, name')
  ])

  // Обрабатываем пользователей
  const users = usersResult.rows.map(user => ({
    ...user,
    characters: user.characters || [],
    user_equipment: user.user_equipment || []
  }))

  console.log('🔥 ПРОСТОЙ ЗАГРУЗЧИК: Пользователи обработаны:', {
    count: users.length,
    firstUser: users[0] ? {
      id: users[0].id,
      username: users[0].username,
      characters: users[0].characters,
      user_equipment: users[0].user_equipment
    } : null
  })

    // Загружаем Character AI данные
    console.log('🔥 ПРОСТОЙ ЗАГРУЗЧИК: Загружаем Character AI данные')

    // Загружаем индивидуальные позы персонажей из character_ai_config
    const characterAIConfigs = await pool.query(`
      SELECT id, config_type, config_data
      FROM character_ai_config
      WHERE config_type = 'poses'
    `)

    // Создаем мапу поз по персонажам
    const characterPoses: { [characterId: string]: any } = {}
    characterAIConfigs.rows.forEach(row => {
      // Убираем суффикс '_poses' из ID для получения characterId
      const characterId = row.id.replace('_poses', '')
      // config_data содержит позы напрямую, оборачиваем их в poses
      const configData = row.config_data || {}
      const { updated_at, ...poses } = configData
      characterPoses[characterId] = { poses }
    })

    // Загружаем действия и инструменты из базы данных
    console.log('🔥 ПРОСТОЙ ЗАГРУЗЧИК: Загружаем действия и инструменты из БД...')

    // Группируем действия по категориям
    const actionsByCategory = actionsResult.rows.reduce((acc, action) => {
      if (!acc[action.category]) {
        acc[action.category] = []
      }
      acc[action.category].push(action)
      return acc
    }, {} as { [key: string]: any[] })

    // Группируем инструменты по категориям
    const toolsByCategory = toolsResult.rows.reduce((acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = []
      }
      acc[tool.category].push(tool)
      return acc
    }, {} as { [key: string]: any[] })

    console.log('🔥 ПРОСТОЙ ЗАГРУЗЧИК: Данные из БД загружены:', {
      actionsCount: actionsResult.rows.length,
      actionsCategoriesCount: Object.keys(actionsByCategory).length,
      toolsCount: toolsResult.rows.length,
      toolsCategoriesCount: Object.keys(toolsByCategory).length
    })

    const characterAI = {
      poses: characterPoses, // Индивидуальные позы для каждого персонажа
      actions: actionsByCategory, // Действия из базы данных
      tools: toolsByCategory, // Инструменты из базы данных
      poseChangeConditions: {}, // TODO: добавить загрузку условий смены поз
      emotions: {}, // TODO: добавить загрузку эмоций
      fetishes: {}, // TODO: добавить загрузку фетишей
      settings: {}, // TODO: добавить загрузку настроек
      llmPrompts: {
        basePrompt: "Ты покорный персонаж в BDSM игре",
        characteristicInterpretations: {},
        fetishResponses: {}
      }
    }

  console.log('🔥 ПРОСТОЙ ЗАГРУЗЧИК: Character AI данные загружены:', {
    charactersWithPoses: Object.keys(characterAI.poses).length,
    actionsCategoriesCount: Object.keys(characterAI.actions).length,
    toolsCategoriesCount: Object.keys(characterAI.tools).length,
    characterPosesDetails: Object.keys(characterAI.poses).map(charId => ({
      characterId: charId,
      posesCount: characterAI.poses[charId] ? Object.keys(characterAI.poses[charId]).length : 0
    })),
    actionsCategories: Object.keys(characterAI.actions),
    toolsCategories: Object.keys(characterAI.tools)
  })

  return {
    characters: charactersResult.rows,
    actions: {
      categories: actionsResult.rows.reduce((acc, action) => {
        if (!acc[action.category]) acc[action.category] = []
        acc[action.category].push(action)
        return acc
      }, {})
    },
    contracts: contractsResult.rows,
    events: {
      anomalies: eventsResult.rows.filter(e => e.type === 'anomaly'),
      crises: eventsResult.rows.filter(e => e.type === 'crisis'),
      opportunities: eventsResult.rows.filter(e => e.type === 'opportunity')
    },
    equipment: equipmentResult.rows,
    users: users,
    storyScenes: storyScenesResult.rows,
    conditions: conditionsResult.rows,
    station: {
      stationEntities: stationEntitiesResult.rows.reduce((acc, entity) => {
        acc[entity.id] = entity
        return acc
      }, {})
    },
    characterAI: characterAI,
    system: {},
    ui: {},
    ai: {}
  }
}

// Экспорт для обратной совместимости
export { loadGameConfig as loadUniversalConfig }
export { loadGameConfig as loadDatabaseConfig }
export { loadGameConfig as loadUnifiedConfig }
