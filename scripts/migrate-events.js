#!/usr/bin/env node

/**
 * Миграционный скрипт для events
 * Переносит данные из events-unified.json в таблицу events
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

async function migrateEvents() {
  console.log('🚀 Начинаем миграцию events...');

  try {
    // Читаем данные из JSON файла
    const eventsPath = path.join(__dirname, '../data/events-unified.json');
    const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));

    console.log('📖 Данные загружены из events-unified.json');

    // Очищаем таблицу events
    await pool.query('DELETE FROM events');
    console.log('🧹 Таблица events очищена');

    let totalEvents = 0;
    let migratedEvents = 0;

    // Проходим по всем событиям
    if (eventsData.events && Array.isArray(eventsData.events)) {
      for (const eventData of eventsData.events) {
        totalEvents++;

        try {
          // Подготавливаем данные для вставки
          const eventRecord = {
            id: eventData.id,
            title: eventData.title || 'Untitled Event',
            description: eventData.description || '',
            type: eventData.type || 'random',
            probability: eventData.probability || 0.1,
            effects: eventData.effects || {},
            duration: eventData.duration || 1,
            story_scenes: eventData.storyScenes || [],
            conditions: eventData.conditions || {},
            enabled: eventData.enabled !== false
          };

          // Вставляем запись в БД
          const query = `
            INSERT INTO events (
              id, title, description, type, probability, effects, duration,
              story_scenes, conditions, enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              type = EXCLUDED.type,
              probability = EXCLUDED.probability,
              effects = EXCLUDED.effects,
              duration = EXCLUDED.duration,
              story_scenes = EXCLUDED.story_scenes,
              conditions = EXCLUDED.conditions,
              enabled = EXCLUDED.enabled,
              updated_at = CURRENT_TIMESTAMP
          `;

          await pool.query(query, [
            eventRecord.id,
            eventRecord.title,
            eventRecord.description,
            eventRecord.type,
            eventRecord.probability,
            JSON.stringify(eventRecord.effects),
            eventRecord.duration,
            JSON.stringify(eventRecord.story_scenes),
            JSON.stringify(eventRecord.conditions),
            eventRecord.enabled
          ]);

          migratedEvents++;
          console.log(`  ✅ ${eventData.id}: ${eventData.title}`);

        } catch (error) {
          console.error(`  ❌ Ошибка при миграции ${eventData.id}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Результаты миграции events:`);
    console.log(`  Всего событий: ${totalEvents}`);
    console.log(`  Успешно мигрировано: ${migratedEvents}`);
    console.log(`  Ошибок: ${totalEvents - migratedEvents}`);

    // Проверяем результат
    const result = await pool.query('SELECT COUNT(*) as count FROM events');
    console.log(`  Записей в БД: ${result.rows[0].count}`);

    if (migratedEvents === totalEvents) {
      console.log('🎉 Миграция events завершена успешно!');
    } else {
      console.log('⚠️  Миграция завершена с ошибками');
    }

  } catch (error) {
    console.error('💥 Критическая ошибка при миграции events:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateEvents();
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

module.exports = { migrateEvents };
