#!/usr/bin/env node

/**
 * Миграционный скрипт для actions
 * Переносит данные из actions-unified.json в таблицу actions
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

async function migrateActions() {
  console.log('🚀 Начинаем миграцию actions...');

  try {
    // Читаем данные из JSON файла
    const actionsPath = path.join(__dirname, '../data/actions-unified.json');
    const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));

    console.log('📖 Данные загружены из actions-unified.json');

    // Очищаем таблицу actions
    await pool.query('DELETE FROM actions');
    console.log('🧹 Таблица actions очищена');

    let totalActions = 0;
    let migratedActions = 0;

    // Проходим по всем категориям и их действиям
    for (const [categoryKey, categoryData] of Object.entries(actionsData.categories)) {
      console.log(`\n📁 Обрабатываем категорию: ${categoryData.title} (${categoryKey})`);

      if (categoryData.actions) {
        for (const [actionKey, actionData] of Object.entries(categoryData.actions)) {
          totalActions++;

          try {
            // Подготавливаем данные для вставки
            const actionRecord = {
              id: actionKey,
              name: actionData.title || actionKey,
              description: actionData.description || '',
              category: categoryKey,
              type: actionData.type || 'standard',
              cost: actionData.cost || 0,
              duration: actionData.duration || 60,
              risk_level: actionData.risk || 'low',
              effects: actionData.effects || {},
              requirements: actionData.requirements || {},
              enabled: actionData.enabled !== false
            };

            // Вставляем запись в БД
            const query = `
              INSERT INTO actions (
                id, name, description, category, type, cost, duration,
                risk_level, effects, requirements, enabled
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                type = EXCLUDED.type,
                cost = EXCLUDED.cost,
                duration = EXCLUDED.duration,
                risk_level = EXCLUDED.risk_level,
                effects = EXCLUDED.effects,
                requirements = EXCLUDED.requirements,
                enabled = EXCLUDED.enabled,
                updated_at = CURRENT_TIMESTAMP
            `;

            await pool.query(query, [
              actionRecord.id,
              actionRecord.name,
              actionRecord.description,
              actionRecord.category,
              actionRecord.type,
              actionRecord.cost,
              actionRecord.duration,
              actionRecord.risk_level,
              JSON.stringify(actionRecord.effects),
              JSON.stringify(actionRecord.requirements),
              actionRecord.enabled
            ]);

            migratedActions++;
            console.log(`  ✅ ${actionKey}: ${actionData.title}`);

          } catch (error) {
            console.error(`  ❌ Ошибка при миграции ${actionKey}:`, error.message);
          }
        }
      }
    }

    console.log(`\n📊 Результаты миграции actions:`);
    console.log(`  Всего действий: ${totalActions}`);
    console.log(`  Успешно мигрировано: ${migratedActions}`);
    console.log(`  Ошибок: ${totalActions - migratedActions}`);

    // Проверяем результат
    const result = await pool.query('SELECT COUNT(*) as count FROM actions');
    console.log(`  Записей в БД: ${result.rows[0].count}`);

    if (migratedActions === totalActions) {
      console.log('🎉 Миграция actions завершена успешно!');
    } else {
      console.log('⚠️  Миграция завершена с ошибками');
    }

  } catch (error) {
    console.error('💥 Критическая ошибка при миграции actions:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateActions();
  } catch (error) {
    console.error('💥 Миграция не удалась:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запускаем миграцию
if (require.main === module) {
  main();
}

module.exports = { migrateActions };
