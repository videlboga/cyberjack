#!/usr/bin/env node

/**
 * Миграционный скрипт для contracts
 * Переносит данные из contracts-unified.json в таблицу contracts
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

async function migrateContracts() {
  console.log('🚀 Начинаем миграцию contracts...');

  try {
    // Читаем данные из JSON файла
    const contractsPath = path.join(__dirname, '../data/contracts-unified.json');
    const contractsData = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));

    console.log('📖 Данные загружены из contracts-unified.json');

    // Очищаем таблицу contracts
    await pool.query('DELETE FROM contracts');
    console.log('🧹 Таблица contracts очищена');

    let totalContracts = 0;
    let migratedContracts = 0;

    // Проходим по всем контрактам
    if (contractsData.available && Array.isArray(contractsData.available)) {
      for (const contractData of contractsData.available) {
        totalContracts++;

        try {
          // Подготавливаем данные для вставки
          const contractRecord = {
            id: contractData.id,
            client: contractData.client || 'Unknown Client',
            title: contractData.title || 'Untitled Contract',
            description: contractData.description || '',
            requirements: contractData.requirements || {},
            reward: contractData.reward || 0,
            deadline: contractData.deadline || 7,
            kpi: contractData.kpi || [],
            assigned_talents: contractData.assigned_talents || [],
            status: contractData.status || 'available',
            story_scenes: contractData.storyScenes || []
          };

          // Вставляем запись в БД
          const query = `
            INSERT INTO contracts (
              id, client, title, description, requirements, reward, deadline,
              kpi, assigned_talents, status, story_scenes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
              client = EXCLUDED.client,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              requirements = EXCLUDED.requirements,
              reward = EXCLUDED.reward,
              deadline = EXCLUDED.deadline,
              kpi = EXCLUDED.kpi,
              assigned_talents = EXCLUDED.assigned_talents,
              status = EXCLUDED.status,
              story_scenes = EXCLUDED.story_scenes,
              updated_at = CURRENT_TIMESTAMP
          `;

          await pool.query(query, [
            contractRecord.id,
            contractRecord.client,
            contractRecord.title,
            contractRecord.description,
            JSON.stringify(contractRecord.requirements),
            contractRecord.reward,
            contractRecord.deadline,
            JSON.stringify(contractRecord.kpi),
            JSON.stringify(contractRecord.assigned_talents),
            contractRecord.status,
            JSON.stringify(contractRecord.story_scenes)
          ]);

          migratedContracts++;
          console.log(`  ✅ ${contractData.id}: ${contractData.title}`);

        } catch (error) {
          console.error(`  ❌ Ошибка при миграции ${contractData.id}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Результаты миграции contracts:`);
    console.log(`  Всего контрактов: ${totalContracts}`);
    console.log(`  Успешно мигрировано: ${migratedContracts}`);
    console.log(`  Ошибок: ${totalContracts - migratedContracts}`);

    // Проверяем результат
    const result = await pool.query('SELECT COUNT(*) as count FROM contracts');
    console.log(`  Записей в БД: ${result.rows[0].count}`);

    if (migratedContracts === totalContracts) {
      console.log('🎉 Миграция contracts завершена успешно!');
    } else {
      console.log('⚠️  Миграция завершена с ошибками');
    }

  } catch (error) {
    console.error('💥 Критическая ошибка при миграции contracts:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateContracts();
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

module.exports = { migrateContracts };
