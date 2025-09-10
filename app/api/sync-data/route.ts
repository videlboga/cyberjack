// ===== ПРОСТОЙ SYNC API =====
// Синхронизация данных с базой данных

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Настройки подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
})

export async function POST(request: NextRequest) {
  try {
    const { configType, data } = await request.json()

    console.log(`🔥 ПРОСТОЙ SYNC API: Получен запрос ${configType}`)
    console.log(`📦 ПРОСТОЙ SYNC API: Данные:`, JSON.stringify(data, null, 2))

    switch (configType) {
      case 'characters':
        // Сохраняем персонажей в БД
        console.log('🔥 ПРОСТОЙ SYNC API: Сохраняем персонажей в БД')

        for (const character of data.characters) {
          // Проверяем, существует ли персонаж
          const existing = await pool.query('SELECT id FROM characters WHERE id = $1', [character.id])

          if (existing.rows.length > 0) {
            // Обновляем существующего
            await pool.query(`
              UPDATE characters
              SET name = $2, rank = $3, status = $4, location = $5, source = $6,
                  archetype = $7, description = $8, avatar = $9, price = $10,
                  specialization = $11, emotional_state = $12, communication_style = $13,
                  metadata = $14, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [
              character.id,
              character.name,
              character.rank || 'novice',
              character.status || 'available',
              character.location || 'station',
              character.source || 'admin',
              character.archetype || 'general',
              character.description || '',
              character.avatar || '',
              character.price || 0,
              character.specialization || '',
              character.emotional_state || 'neutral',
              character.communication_style || 'professional',
              JSON.stringify(character.metadata || {})
            ])
            console.log(`✅ Персонаж ${character.name} обновлен в БД`)
          } else {
            // Создаем нового
            await pool.query(`
              INSERT INTO characters (id, name, rank, status, location, source, archetype, description, avatar, price, specialization, emotional_state, communication_style, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
              character.id,
              character.name,
              character.rank || 'novice',
              character.status || 'available',
              character.location || 'station',
              character.source || 'admin',
              character.archetype || 'general',
              character.description || '',
              character.avatar || '',
              character.price || 0,
              character.specialization || '',
              character.emotional_state || 'neutral',
              character.communication_style || 'professional',
              JSON.stringify(character.metadata || {})
            ])
            console.log(`✅ Персонаж ${character.name} создан в БД`)
          }
        }

        return NextResponse.json({
          success: true,
          message: `Персонажи синхронизированы с БД`,
          count: data.characters.length
        })

      case 'users':
        // Сохраняем пользователей в БД
        console.log('🔥 ПРОСТОЙ SYNC API: Сохраняем пользователей в БД')

        for (const user of data.users) {
          // Проверяем, существует ли пользователь
          const existing = await pool.query('SELECT id FROM users WHERE id = $1', [user.id])

          if (existing.rows.length > 0) {
            // Обновляем существующего
            await pool.query(`
              UPDATE users
              SET username = $2, email = $3, characters = $4, user_equipment = $5,
                  preferences = $6, metadata = $7, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [
              user.id,
              user.username,
              user.email || '',
              JSON.stringify(user.characters || []),
              JSON.stringify(user.user_equipment || []),
              JSON.stringify(user.preferences || {}),
              JSON.stringify(user.metadata || {})
            ])
            console.log(`✅ Пользователь ${user.username} обновлен в БД`)
          } else {
            // Создаем нового
            await pool.query(`
              INSERT INTO users (id, username, email, characters, user_equipment, preferences, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              user.id,
              user.username,
              user.email || '',
              JSON.stringify(user.characters || []),
              JSON.stringify(user.user_equipment || []),
              JSON.stringify(user.preferences || {}),
              JSON.stringify(user.metadata || {})
            ])
            console.log(`✅ Пользователь ${user.username} создан в БД`)
          }
        }

        return NextResponse.json({
          success: true,
          message: `Пользователи синхронизированы с БД`,
          count: data.users.length
        })

      case 'equipment':
        // Сохраняем оборудование в БД
        console.log('🔥 ПРОСТОЙ SYNC API: Сохраняем оборудование в БД')

        for (const item of data.equipment) {
          // Проверяем, существует ли оборудование
          const existing = await pool.query('SELECT id FROM equipment WHERE id = $1', [item.id])

          if (existing.rows.length > 0) {
            // Обновляем существующее
            await pool.query(`
              UPDATE equipment
              SET name = $2, type = $3, category = $4, description = $5, cost = $6,
                  requirements = $7, effects = $8, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [
              item.id,
              item.name,
              item.type || 'general',
              item.category || 'general',
              item.description || '',
              item.cost || item.price || 0,
              JSON.stringify(item.requirements || {}),
              JSON.stringify(item.effects || {})
            ])
            console.log(`✅ Оборудование ${item.name} обновлено в БД`)
          } else {
            // Создаем новое
            await pool.query(`
              INSERT INTO equipment (id, name, type, category, description, cost, requirements, effects)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              item.id,
              item.name,
              item.type || 'general',
              item.category || 'general',
              item.description || '',
              item.cost || item.price || 0,
              JSON.stringify(item.requirements || {}),
              JSON.stringify(item.effects || {})
            ])
            console.log(`✅ Оборудование ${item.name} создано в БД`)
          }
        }

        return NextResponse.json({
          success: true,
          message: `Оборудование синхронизировано с БД`,
          count: data.equipment.length
        })

      case 'actions':
        // Сохраняем действия в БД
        console.log('🔥 ПРОСТОЙ SYNC API: Сохраняем действия в БД')

        for (const action of data.actions) {
          // Проверяем, существует ли действие
          const existing = await pool.query('SELECT id FROM actions WHERE id = $1', [action.id])

          if (existing.rows.length > 0) {
            // Обновляем существующее
            await pool.query(`
              UPDATE actions
              SET name = $2, category = $3, type = $4, description = $5, requirements = $6,
                  effects = $7, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [
              action.id,
              action.name,
              action.category || 'general',
              action.type || 'general',
              action.description || '',
              JSON.stringify(action.requirements || {}),
              JSON.stringify(action.effects || {})
            ])
            console.log(`✅ Действие ${action.name} обновлено в БД`)
          } else {
            // Создаем новое
            await pool.query(`
              INSERT INTO actions (id, name, category, type, description, requirements, effects)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              action.id,
              action.name,
              action.category || 'general',
              action.type || 'general',
              action.description || '',
              JSON.stringify(action.requirements || {}),
              JSON.stringify(action.effects || {})
            ])
            console.log(`✅ Действие ${action.name} создано в БД`)
          }
        }

        return NextResponse.json({
          success: true,
          message: `Действия синхронизированы с БД`,
          count: data.actions.length
        })

      case 'contracts':
        // Сохраняем контракты в БД
        console.log('🔥 ПРОСТОЙ SYNC API: Сохраняем контракты в БД')

        for (const contract of data.contracts) {
          // Проверяем, существует ли контракт
          const existing = await pool.query('SELECT id FROM contracts WHERE id = $1', [contract.id])

          if (existing.rows.length > 0) {
            // Обновляем существующий
            await pool.query(`
              UPDATE contracts
              SET title = $2, description = $3, requirements = $4, rewards = $5,
                  status = $6, metadata = $7, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [
              contract.id,
              contract.title,
              contract.description || '',
              JSON.stringify(contract.requirements || {}),
              JSON.stringify(contract.rewards || {}),
              contract.status || 'available',
              JSON.stringify(contract.metadata || {})
            ])
            console.log(`✅ Контракт ${contract.title} обновлен в БД`)
          } else {
            // Создаем новый
            await pool.query(`
              INSERT INTO contracts (id, title, description, requirements, rewards, status, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              contract.id,
              contract.title,
              contract.description || '',
              JSON.stringify(contract.requirements || {}),
              JSON.stringify(contract.rewards || {}),
              contract.status || 'available',
              JSON.stringify(contract.metadata || {})
            ])
            console.log(`✅ Контракт ${contract.title} создан в БД`)
          }
        }

        return NextResponse.json({
          success: true,
          message: `Контракты синхронизированы с БД`,
          count: data.contracts.length
        })

      case 'events':
        // Сохраняем события в БД
        console.log('🔥 ПРОСТОЙ SYNC API: Сохраняем события в БД')

        for (const event of data.events) {
          // Проверяем, существует ли событие
          const existing = await pool.query('SELECT id FROM events WHERE id = $1', [event.id])

          if (existing.rows.length > 0) {
            // Обновляем существующее
            await pool.query(`
              UPDATE events
              SET name = $2, type = $3, description = $4, probability = $5,
                  effects = $6, metadata = $7, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [
              event.id,
              event.name,
              event.type || 'anomaly',
              event.description || '',
              event.probability || 0.1,
              JSON.stringify(event.effects || {}),
              JSON.stringify(event.metadata || {})
            ])
            console.log(`✅ Событие ${event.name} обновлено в БД`)
          } else {
            // Создаем новое
            await pool.query(`
              INSERT INTO events (id, name, type, description, probability, effects, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              event.id,
              event.name,
              event.type || 'anomaly',
              event.description || '',
              event.probability || 0.1,
              JSON.stringify(event.effects || {}),
              JSON.stringify(event.metadata || {})
            ])
            console.log(`✅ Событие ${event.name} создано в БД`)
          }
        }

        return NextResponse.json({
          success: true,
          message: `События синхронизированы с БД`,
          count: data.events.length
        })

      case 'station':
      case 'characterAI':
      case 'system':
      case 'ui':
      case 'ai':
        // Эти типы не требуют синхронизации с БД
        console.log(`🔥 ПРОСТОЙ SYNC API: Пропускаем ${configType} (не требует синхронизации с БД)`)
        return NextResponse.json({
          success: true,
          message: `${configType} пропущен (не требует синхронизации с БД)`,
          count: 0
        })

      default:
        console.log(`🔥 ПРОСТОЙ SYNC API: Неподдерживаемый тип ${configType}, пропускаем`)
        return NextResponse.json({
          success: true,
          message: `${configType} пропущен (неподдерживаемый тип)`,
          count: 0
        })
    }
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}