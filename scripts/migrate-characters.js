#!/usr/bin/env node

// ===== МИГРАЦИЯ ПЕРСОНАЖЕЙ ИЗ JSON В БД =====
// Скрипт для переноса данных персонажей из characters-unified.json в PostgreSQL

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

// Конфигурация БД
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
}

const pool = new Pool(dbConfig)

// Путь к JSON файлу
const charactersJsonPath = path.join(process.cwd(), 'data', 'characters-unified.json')

async function migrateCharacters() {
  console.log('🚀 Начинаем миграцию персонажей...')

  try {
    // Проверяем подключение к БД
    await pool.query('SELECT 1')
    console.log('✅ Подключение к БД успешно')

    // Читаем JSON файл
    if (!fs.existsSync(charactersJsonPath)) {
      throw new Error(`Файл не найден: ${charactersJsonPath}`)
    }

    const jsonData = JSON.parse(fs.readFileSync(charactersJsonPath, 'utf8'))
    const characters = jsonData.characters || []

    console.log(`📊 Найдено персонажей для миграции: ${characters.length}`)

    if (characters.length === 0) {
      console.log('⚠️ Нет персонажей для миграции')
      return
    }

    // Начинаем транзакцию
    const client = await pool.connect()
    await client.query('BEGIN')

    try {
      let migratedCount = 0
      let skippedCount = 0
      let errorCount = 0

      for (const character of characters) {
        try {
          // Проверяем, существует ли персонаж
          const existing = await client.query(
            'SELECT id FROM characters WHERE id = $1',
            [character.id]
          )

          if (existing.rows.length > 0) {
            console.log(`⏭️ Персонаж ${character.id} уже существует, пропускаем`)
            skippedCount++
            continue
          }

          // Вставляем основную запись персонажа
          await client.query(`
            INSERT INTO characters (
              id, name, rank, status, location, source, archetype,
              description, avatar, price, specialization, emotional_state,
              communication_style, created_at, last_interaction,
              total_interactions, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `, [
            character.id,
            character.name,
            character.rank || 'F',
            character.status || 'available',
            character.location || 'talent_exchange',
            character.source || 'market',
            character.archetype,
            character.description,
            character.avatar,
            character.price || 0,
            character.specialization,
            character.emotionalState || 'neutral',
            character.communicationStyle || 'neutral',
            character.createdAt ? new Date(character.createdAt) : new Date(),
            character.lastInteraction ? new Date(character.lastInteraction) : new Date(),
            character.totalInteractions || 0,
            JSON.stringify(character.metadata || {})
          ])

          // Вставляем атрибуты
          if (character.attributes) {
            await insertAttributes(client, character.id, character.attributes)
          }

          // Вставляем состояния
          if (character.states) {
            await insertStates(client, character.id, character.states)
          }

          // Вставляем навыки
          if (character.skills) {
            await insertSkills(client, character.id, character.skills)
          }

          // Вставляем фетиши
          if (character.fetishes) {
            await insertFetishes(client, character.id, character.fetishes)
          }

          migratedCount++
          console.log(`✅ Мигрирован персонаж: ${character.name} (${character.id})`)

        } catch (error) {
          console.error(`❌ Ошибка миграции персонажа ${character.id}:`, error.message)
          errorCount++
        }
      }

      // Подтверждаем транзакцию
      await client.query('COMMIT')
      console.log('✅ Транзакция подтверждена')

      // Выводим статистику
      console.log('\n📊 Статистика миграции:')
      console.log(`   ✅ Успешно мигрировано: ${migratedCount}`)
      console.log(`   ⏭️ Пропущено (уже существуют): ${skippedCount}`)
      console.log(`   ❌ Ошибок: ${errorCount}`)
      console.log(`   📈 Всего обработано: ${migratedCount + skippedCount + errorCount}`)

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Вставка атрибутов персонажа
async function insertAttributes(client, characterId, attributes) {
  const values = []
  const params = []
  let paramIndex = 1

  for (const [category, attrs] of Object.entries(attributes)) {
    if (typeof attrs === 'object' && attrs !== null) {
      for (const [name, value] of Object.entries(attrs)) {
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
        params.push(characterId, category, name, value)
        paramIndex += 4
      }
    }
  }

  if (values.length > 0) {
    await client.query(`
      INSERT INTO character_attributes (character_id, category, attribute_name, value)
      VALUES ${values.join(', ')}
    `, params)
  }
}

// Вставка состояний персонажа
async function insertStates(client, characterId, states) {
  const values = []
  const params = []
  let paramIndex = 1

  for (const [name, value] of Object.entries(states)) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`)
    params.push(characterId, name, value)
    paramIndex += 3
  }

  if (values.length > 0) {
    await client.query(`
      INSERT INTO character_states (character_id, state_name, value)
      VALUES ${values.join(', ')}
    `, params)
  }
}

// Вставка навыков персонажа
async function insertSkills(client, characterId, skills) {
  const values = []
  const params = []
  let paramIndex = 1

  for (const [name, level] of Object.entries(skills)) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`)
    params.push(characterId, name, level)
    paramIndex += 3
  }

  if (values.length > 0) {
    await client.query(`
      INSERT INTO character_skills (character_id, skill_name, level)
      VALUES ${values.join(', ')}
    `, params)
  }
}

// Вставка фетишей персонажа
async function insertFetishes(client, characterId, fetishes) {
  const values = []
  const params = []
  let paramIndex = 1

  for (const [category, fetishList] of Object.entries(fetishes)) {
    if (Array.isArray(fetishList)) {
      for (const fetish of fetishList) {
        const name = typeof fetish === 'string' ? fetish : fetish.name
        const intensity = typeof fetish === 'object' ? (fetish.intensity || 0) : 0

        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
        params.push(characterId, name, category, intensity)
        paramIndex += 4
      }
    }
  }

  if (values.length > 0) {
    await client.query(`
      INSERT INTO character_fetishes (character_id, fetish_name, category, intensity)
      VALUES ${values.join(', ')}
    `, params)
  }
}

// Запуск миграции
if (require.main === module) {
  migrateCharacters()
    .then(() => {
      console.log('🎉 Миграция персонажей завершена успешно!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Миграция персонажей завершилась с ошибкой:', error)
      process.exit(1)
    })
}

module.exports = { migrateCharacters }
