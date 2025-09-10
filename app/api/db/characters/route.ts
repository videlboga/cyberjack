// ===== ПРОСТОЙ API ДЛЯ ПЕРСОНАЖЕЙ =====
// Прямые запросы к БД без репозиториев

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

// GET /api/db/characters - Получить всех персонажей
export async function GET(request: NextRequest) {
  try {
    console.log('🔥 ПРОСТОЙ API ПЕРСОНАЖЕЙ: Загружаем данные из БД')

    const characters = await pool.query(`
      SELECT * FROM characters
      ORDER BY created_at DESC
    `)

    console.log('🔥 ПРОСТОЙ API ПЕРСОНАЖЕЙ: Загружено персонажей:', characters.rows.length)

    return NextResponse.json({
      success: true,
      data: characters.rows,
      meta: {
        count: characters.rows.length
      }
    })
  } catch (error) {
    console.error('❌ Ошибка загрузки персонажей:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}

// POST /api/db/characters - Создать нового персонажа
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔥 ПРОСТОЙ API ПЕРСОНАЖЕЙ: Создаем персонажа:', body.name)

    const result = await pool.query(`
      INSERT INTO characters (id, name, rank, status, location, source, archetype, description, avatar, price, specialization, emotional_state, communication_style, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      body.id,
      body.name,
      body.rank || 'novice',
      body.status || 'available',
      body.location || 'station',
      body.source || 'admin',
      body.archetype || 'general',
      body.description || '',
      body.avatar || '',
      body.price || 0,
      body.specialization || '',
      body.emotional_state || 'neutral',
      body.communication_style || 'professional',
      JSON.stringify(body.metadata || {})
    ])

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Персонаж создан успешно'
    })
  } catch (error) {
    console.error('❌ Ошибка создания персонажа:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}

// PUT /api/db/characters - Обновить персонажа
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID персонажа обязателен'
      }, { status: 400 })
    }

    console.log('🔥 ПРОСТОЙ API ПЕРСОНАЖЕЙ: Обновляем персонажа:', id)

    // Строим динамический запрос обновления
    const fields = []
    const values = []
    let paramIndex = 1

    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'metadata') {
        fields.push(`${key} = $${paramIndex}`)
        values.push(JSON.stringify(value))
      } else {
        fields.push(`${key} = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    })

    if (fields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Нет данных для обновления'
      }, { status: 400 })
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const query = `
      UPDATE characters
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Персонаж не найден'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Персонаж обновлен успешно'
    })
  } catch (error) {
    console.error('❌ Ошибка обновления персонажа:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}

// DELETE /api/db/characters - Удалить персонажа
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID персонажа обязателен'
      }, { status: 400 })
    }

    console.log('🔥 ПРОСТОЙ API ПЕРСОНАЖЕЙ: Удаляем персонажа:', id)

    const result = await pool.query('DELETE FROM characters WHERE id = $1 RETURNING *', [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Персонаж не найден'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Персонаж удален успешно'
    })
  } catch (error) {
    console.error('❌ Ошибка удаления персонажа:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}