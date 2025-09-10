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
    characterAI: {},
    system: {},
    ui: {},
    ai: {}
  }
}

// Экспорт для обратной совместимости
export { loadGameConfig as loadUniversalConfig }
export { loadGameConfig as loadDatabaseConfig }
export { loadGameConfig as loadUnifiedConfig }
