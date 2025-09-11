#!/usr/bin/env node

/**
 * Скрипт для исправления ограничения NOT NULL в таблице equipment
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

async function fixEquipmentConstraint() {
  console.log('🚀 Исправляем ограничение NOT NULL в таблице equipment...');

  try {
    // Убираем ограничение NOT NULL с поля category
    await pool.query('ALTER TABLE equipment ALTER COLUMN category DROP NOT NULL');
    console.log('✅ Ограничение NOT NULL убрано с поля category');

    // Проверяем структуру таблицы
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'equipment' AND column_name = 'category'
    `);

    console.log('\n📋 Поле category:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    console.log('\n🎉 Ограничение исправлено!');

  } catch (error) {
    console.error('💥 Ошибка при исправлении ограничения:', error);
    throw error;
  }
}

async function main() {
  try {
    await fixEquipmentConstraint();
  } catch (error) {
    console.error('💥 Исправление не удалось:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запускаем исправление
if (require.main === module) {
  main();
}

module.exports = { fixEquipmentConstraint };
