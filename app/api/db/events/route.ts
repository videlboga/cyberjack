import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Настройки подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
});

// GET /api/db/events - Получить все события
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const enabled = searchParams.get('enabled');

    let query = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (enabled !== null) {
      query += ` AND enabled = $${paramIndex}`;
      params.push(enabled === 'true');
      paramIndex++;
    }

    query += ' ORDER BY probability DESC, title';

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Ошибка при получении events:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении событий' },
      { status: 500 }
    );
  }
}

// POST /api/db/events - Создать новое событие
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      title,
      description,
      type,
      probability,
      effects,
      duration,
      story_scenes,
      conditions,
      enabled
    } = body;

    // Валидация обязательных полей
    if (!id || !title || !type) {
      return NextResponse.json(
        { success: false, error: 'Отсутствуют обязательные поля: id, title, type' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO events (
        id, title, description, type, probability, effects, duration,
        story_scenes, conditions, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      id,
      title,
      description || '',
      type,
      probability || 0.1,
      JSON.stringify(effects || {}),
      duration || 1,
      JSON.stringify(story_scenes || []),
      JSON.stringify(conditions || {}),
      enabled !== false
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Событие создано успешно'
    });

  } catch (error) {
    console.error('Ошибка при создании event:', error);

    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { success: false, error: 'Событие с таким ID уже существует' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка при создании события' },
      { status: 500 }
    );
  }
}

// PUT /api/db/events - Обновить событие
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID события обязателен' },
        { status: 400 }
      );
    }

    // Строим динамический запрос обновления
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'effects' || key === 'story_scenes' || key === 'conditions') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    });

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Нет данных для обновления' },
        { status: 400 }
      );
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE events
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Событие не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Событие обновлено успешно'
    });

  } catch (error) {
    console.error('Ошибка при обновлении event:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении события' },
      { status: 500 }
    );
  }
}

// DELETE /api/db/events - Удалить событие
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID события обязателен' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM events WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Событие не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Событие удалено успешно'
    });

  } catch (error) {
    console.error('Ошибка при удалении event:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при удалении события' },
      { status: 500 }
    );
  }
}
