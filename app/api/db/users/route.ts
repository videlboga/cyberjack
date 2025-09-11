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

// GET /api/db/users - Получить всех пользователей
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const username = searchParams.get('username');

    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (username) {
      query += ` AND username = $${paramIndex}`;
      params.push(username);
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
    console.error('Ошибка при получении users:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении пользователей' },
      { status: 500 }
    );
  }
}

// POST /api/db/users - Создать нового пользователя
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      username,
      role,
      status,
      account,
      characters,
      user_equipment,
      attributes,
      stats,
      assets,
      preferences,
      metadata
    } = body;

    // Валидация обязательных полей
    if (!id || !username) {
      return NextResponse.json(
        { success: false, error: 'Отсутствуют обязательные поля: id, username' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO users (
        id, username, role, status, account, characters, user_equipment,
        attributes, stats, assets, preferences, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      id,
      username,
      role || 'user',
      status || 'active',
      JSON.stringify(account || {}),
      JSON.stringify(characters || []),
      JSON.stringify(user_equipment || []),
      JSON.stringify(attributes || {}),
      JSON.stringify(stats || {}),
      JSON.stringify(assets || []),
      JSON.stringify(preferences || {}),
      JSON.stringify(metadata || {})
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Пользователь создан успешно'
    });

  } catch (error) {
    console.error('Ошибка при создании user:', error);

    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { success: false, error: 'Пользователь с таким ID или username уже существует' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка при создании пользователя' },
      { status: 500 }
    );
  }
}

// PUT /api/db/users - Обновить пользователя
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID пользователя обязателен' },
        { status: 400 }
      );
    }

    // Строим динамический запрос обновления
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'account' || key === 'characters' || key === 'user_equipment' ||
          key === 'attributes' || key === 'stats' || key === 'assets' ||
          key === 'preferences' || key === 'metadata') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else if (key === 'last_login') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value ? new Date(value) : null);
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
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Пользователь обновлен успешно'
    });

  } catch (error) {
    console.error('Ошибка при обновлении user:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении пользователя' },
      { status: 500 }
    );
  }
}

// DELETE /api/db/users - Удалить пользователя
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID пользователя обязателен' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Пользователь удален успешно'
    });

  } catch (error) {
    console.error('Ошибка при удалении user:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при удалении пользователя' },
      { status: 500 }
    );
  }
}
