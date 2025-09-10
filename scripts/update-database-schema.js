#!/usr/bin/env node

/**
 * Скрипт для обновления схемы базы данных
 * Применяет исправления к существующей схеме БД
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Настройки подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
});

async function updateDatabaseSchema() {
  console.log('🚀 Начинаем обновление схемы базы данных...');

  try {
    // Читаем обновленную схему
    const schemaPath = path.join(__dirname, '../database-schema-updated.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📖 Обновленная схема загружена');

    // Разбиваем SQL на отдельные команды
    const commands = schemaSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 Найдено ${commands.length} команд для выполнения`);

    let successCount = 0;
    let errorCount = 0;

    for (const command of commands) {
      try {
        // Пропускаем комментарии и пустые строки
        if (command.startsWith('--') || command.length === 0) {
          continue;
        }

        await pool.query(command);
        successCount++;

        // Выводим прогресс для важных команд
        if (command.includes('CREATE TABLE') || command.includes('CREATE INDEX') || command.includes('CREATE TRIGGER')) {
          const tableName = command.match(/CREATE (?:TABLE|INDEX|TRIGGER)\s+(\w+)/i)?.[1];
          if (tableName) {
            console.log(`  ✅ ${tableName}`);
          }
        }

      } catch (error) {
        // Игнорируем ошибки "уже существует" для таблиц и индексов
        if (error.code === '42P07' || error.code === '42710') {
          console.log(`  ⚠️  ${command.split(' ')[2]} уже существует, пропускаем`);
          successCount++;
        } else {
          console.error(`  ❌ Ошибка при выполнении команды:`, error.message);
          errorCount++;
        }
      }
    }

    console.log(`\n📊 Результаты обновления схемы:`);
    console.log(`  Успешно выполнено: ${successCount} команд`);
    console.log(`  Ошибок: ${errorCount} команд`);

    if (errorCount === 0) {
      console.log('🎉 Схема базы данных обновлена успешно!');
    } else {
      console.log('⚠️  Схема обновлена с предупреждениями');
    }

    // Проверяем структуру таблиц
    console.log('\n🔍 Проверяем структуру таблиц...');

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
    console.error('💥 Критическая ошибка при обновлении схемы:', error);
    throw error;
  }
}

async function main() {
  try {
    await updateDatabaseSchema();
  } catch (error) {
    console.error('💥 Обновление схемы не удалось:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запускаем обновление
if (require.main === module) {
  main();
}

module.exports = { updateDatabaseSchema };
