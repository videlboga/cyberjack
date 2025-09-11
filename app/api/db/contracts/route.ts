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

// GET /api/db/contracts - Получить все контракты
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const client = searchParams.get('client');

    let query = 'SELECT * FROM contracts WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (client) {
      query += ` AND client = $${paramIndex}`;
      params.push(client);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Ошибка при получении contracts:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении контрактов' },
      { status: 500 }
    );
  }
}

// POST /api/db/contracts - Создать новый контракт
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      client,
      title,
      description,
      requirements,
      reward,
      deadline,
      kpi,
      assigned_talents,
      status,
      story_scenes
    } = body;

    // Валидация обязательных полей
    if (!id || !client || !title) {
      return NextResponse.json(
        { success: false, error: 'Отсутствуют обязательные поля: id, client, title' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO contracts (
        id, client, title, description, requirements, reward, deadline,
        kpi, assigned_talents, status, story_scenes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      client,
      title,
      description || '',
      JSON.stringify(requirements || {}),
      reward || 0,
      deadline || 7,
      JSON.stringify(kpi || []),
      JSON.stringify(assigned_talents || []),
      status || 'available',
      JSON.stringify(story_scenes || [])
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Контракт создан успешно'
    });

  } catch (error) {
    console.error('Ошибка при создании contract:', error);

    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { success: false, error: 'Контракт с таким ID уже существует' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка при создании контракта' },
      { status: 500 }
    );
  }
}

// PUT /api/db/contracts - Обновить контракт
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID контракта обязателен' },
        { status: 400 }
      );
    }

    // Строим динамический запрос обновления
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'requirements' || key === 'kpi' || key === 'assigned_talents' || key === 'story_scenes') {
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
      UPDATE contracts
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Контракт не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Контракт обновлен успешно'
    });

  } catch (error) {
    console.error('Ошибка при обновлении contract:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении контракта' },
      { status: 500 }
    );
  }
}

// DELETE /api/db/contracts - Удалить контракт
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID контракта обязателен' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM contracts WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Контракт не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Контракт удален успешно'
    });

  } catch (error) {
    console.error('Ошибка при удалении contract:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при удалении контракта' },
      { status: 500 }
    );
  }
}
