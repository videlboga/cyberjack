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

// GET /api/db/actions - Получить все действия
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const enabled = searchParams.get('enabled');

    let query = 'SELECT * FROM actions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

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

    query += ' ORDER BY category, name';

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Ошибка при получении actions:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении действий' },
      { status: 500 }
    );
  }
}

// POST /api/db/actions - Создать новое действие
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      name,
      description,
      category,
      type,
      cost,
      duration,
      risk_level,
      effects,
      requirements,
      enabled
    } = body;

    // Валидация обязательных полей
    if (!id || !name || !category || !type) {
      return NextResponse.json(
        { success: false, error: 'Отсутствуют обязательные поля: id, name, category, type' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO actions (
        id, name, description, category, type, cost, duration,
        risk_level, effects, requirements, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      name,
      description || '',
      category,
      type,
      cost || 0,
      duration || 60,
      risk_level || 'low',
      JSON.stringify(effects || {}),
      JSON.stringify(requirements || {}),
      enabled !== false
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Действие создано успешно'
    });

  } catch (error) {
    console.error('Ошибка при создании action:', error);

    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { success: false, error: 'Действие с таким ID уже существует' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка при создании действия' },
      { status: 500 }
    );
  }
}

// PUT /api/db/actions - Обновить действие
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID действия обязателен' },
        { status: 400 }
      );
    }

    // Строим динамический запрос обновления
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'effects' || key === 'requirements') {
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
      UPDATE actions
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Действие не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Действие обновлено успешно'
    });

  } catch (error) {
    console.error('Ошибка при обновлении action:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении действия' },
      { status: 500 }
    );
  }
}

// DELETE /api/db/actions - Удалить действие
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID действия обязателен' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM actions WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Действие не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Действие удалено успешно'
    });

  } catch (error) {
    console.error('Ошибка при удалении action:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при удалении действия' },
      { status: 500 }
    );
  }
}
