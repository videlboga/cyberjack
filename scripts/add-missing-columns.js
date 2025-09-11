#!/usr/bin/env node

/**
 * Скрипт для добавления недостающих колонок в таблицы
 */

const { Pool } = require('pg');

// Настройки подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
});

async function addMissingColumns() {
  console.log('🚀 Добавляем недостающие колонки...');

  try {
    // Добавляем колонки для таблицы events
    console.log('\n📋 Обновляем таблицу events...');

    const eventsColumns = [
      'ALTER TABLE events ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 1',
      'ALTER TABLE events ADD COLUMN IF NOT EXISTS story_scenes JSONB',
      'ALTER TABLE events ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true',
      'ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    ];

    for (const column of eventsColumns) {
      try {
        await pool.query(column);
        console.log(`  ✅ ${column.split(' ')[5]} добавлена`);
      } catch (error) {
        console.log(`  ⚠️  ${column.split(' ')[5]} уже существует`);
      }
    }

    // Добавляем колонки для таблицы equipment
    console.log('\n📋 Обновляем таблицу equipment...');

    const equipmentColumns = [
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS slot VARCHAR(100)',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS effects JSONB',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS removable BOOLEAN DEFAULT true',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS power_settings JSONB',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS modes JSONB',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS progressive_effects JSONB',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS requirements JSONB',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS cost INTEGER DEFAULT 0',
      'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rarity VARCHAR(50) DEFAULT \'common\''
    ];

    for (const column of equipmentColumns) {
      try {
        await pool.query(column);
        console.log(`  ✅ ${column.split(' ')[5]} добавлена`);
      } catch (error) {
        console.log(`  ⚠️  ${column.split(' ')[5]} уже существует`);
      }
    }

    // Добавляем колонки для таблицы users
    console.log('\n📋 Обновляем таблицу users...');

    const usersColumns = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'active\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS account JSONB',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS characters JSONB',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS user_equipment JSONB',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS attributes JSONB',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS stats JSONB',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS assets JSONB',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    ];

    for (const column of usersColumns) {
      try {
        await pool.query(column);
        console.log(`  ✅ ${column.split(' ')[5]} добавлена`);
      } catch (error) {
        console.log(`  ⚠️  ${column.split(' ')[5]} уже существует`);
      }
    }

    console.log('\n🎉 Недостающие колонки добавлены!');

    // Проверяем финальную структуру таблиц
    console.log('\n🔍 Проверяем финальную структуру таблиц...');

    const tables = ['events', 'equipment', 'users'];
    for (const table of tables) {
      try {
        const result = await pool.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);

        console.log(`\n📋 Таблица ${table}:`);
        result.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

      } catch (error) {
        console.error(`  ❌ Ошибка при проверке таблицы ${table}:`, error.message);
      }
    }

  } catch (error) {
    console.error('💥 Критическая ошибка при добавлении колонок:', error);
    throw error;
  }
}

async function main() {
  try {
    await addMissingColumns();
  } catch (error) {
    console.error('💥 Добавление колонок не удалось:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запускаем добавление колонок
if (require.main === module) {
  main();
}

module.exports = { addMissingColumns };
