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

// GET /api/db/equipment - Получить все оборудование
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const slot = searchParams.get('slot');
    const enabled = searchParams.get('enabled');
    const rarity = searchParams.get('rarity');

    let query = 'SELECT * FROM equipment WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (slot) {
      query += ` AND slot = $${paramIndex}`;
      params.push(slot);
      paramIndex++;
    }

    if (enabled !== null) {
      query += ` AND enabled = $${paramIndex}`;
      params.push(enabled === 'true');
      paramIndex++;
    }

    if (rarity) {
      query += ` AND rarity = $${paramIndex}`;
      params.push(rarity);
      paramIndex++;
    }

    query += ' ORDER BY type, name';

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Ошибка при получении equipment:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении оборудования' },
      { status: 500 }
    );
  }
}

// POST /api/db/equipment - Создать новое оборудование
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      name,
      type,
      slot,
      description,
      effects,
      removable,
      power_settings,
      modes,
      progressive_effects,
      requirements,
      cost,
      rarity,
      enabled
    } = body;

    // Валидация обязательных полей
    if (!id || !name || !type) {
      return NextResponse.json(
        { success: false, error: 'Отсутствуют обязательные поля: id, name, type' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO equipment (
        id, name, type, slot, description, effects, removable,
        power_settings, modes, progressive_effects, requirements,
        cost, rarity, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      id,
      name,
      type,
      slot || 'general',
      description || '',
      JSON.stringify(effects || {}),
      removable !== false,
      JSON.stringify(power_settings || {}),
      JSON.stringify(modes || []),
      JSON.stringify(progressive_effects || []),
      JSON.stringify(requirements || {}),
      cost || 0,
      rarity || 'common',
      enabled !== false
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Оборудование создано успешно'
    });

  } catch (error) {
    console.error('Ошибка при создании equipment:', error);

    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { success: false, error: 'Оборудование с таким ID уже существует' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка при создании оборудования' },
      { status: 500 }
    );
  }
}

// PUT /api/db/equipment - Обновить оборудование
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID оборудования обязателен' },
        { status: 400 }
      );
    }

    // Строим динамический запрос обновления
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'effects' || key === 'power_settings' || key === 'modes' ||
          key === 'progressive_effects' || key === 'requirements') {
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
      UPDATE equipment
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Оборудование не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Оборудование обновлено успешно'
    });

  } catch (error) {
    console.error('Ошибка при обновлении equipment:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении оборудования' },
      { status: 500 }
    );
  }
}

// DELETE /api/db/equipment - Удалить оборудование
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID оборудования обязателен' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM equipment WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Оборудование не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Оборудование удалено успешно'
    });

  } catch (error) {
    console.error('Ошибка при удалении equipment:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при удалении оборудования' },
      { status: 500 }
    );
  }
}
