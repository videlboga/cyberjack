#!/usr/bin/env node

/**
 * Миграционный скрипт для users
 * Переносит данные из users-unified.json в таблицу users
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

async function migrateUsers() {
  console.log('🚀 Начинаем миграцию users...');

  try {
    // Читаем данные из JSON файла
    const usersPath = path.join(__dirname, '../data/users-unified.json');
    const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    console.log('📖 Данные загружены из users-unified.json');

    // Очищаем таблицу users
    await pool.query('DELETE FROM users');
    console.log('🧹 Таблица users очищена');

    let totalUsers = 0;
    let migratedUsers = 0;

    // Проходим по всем пользователям
    if (usersData.users && Array.isArray(usersData.users)) {
      for (const userData of usersData.users) {
        totalUsers++;

        try {
          // Подготавливаем данные для вставки
          const userRecord = {
            id: userData.id,
            username: userData.username || 'unknown',
            role: userData.role || 'user',
            status: userData.status || 'active',
            created_at: userData.created ? new Date(userData.created) : new Date(),
            last_login: userData.lastLogin ? new Date(userData.lastLogin) : null,
            account: userData.account || {},
            characters: userData.characters || [],
            user_equipment: userData.userEquipment || [],
            attributes: userData.attributes || {},
            stats: userData.stats || {},
            assets: userData.assets || [],
            preferences: userData.preferences || {},
            metadata: userData.metadata || {}
          };

          // Вставляем запись в БД
          const query = `
            INSERT INTO users (
              id, username, role, status, created_at, last_login, account,
              characters, user_equipment, attributes, stats, assets,
              preferences, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO UPDATE SET
              username = EXCLUDED.username,
              role = EXCLUDED.role,
              status = EXCLUDED.status,
              created_at = EXCLUDED.created_at,
              last_login = EXCLUDED.last_login,
              account = EXCLUDED.account,
              characters = EXCLUDED.characters,
              user_equipment = EXCLUDED.user_equipment,
              attributes = EXCLUDED.attributes,
              stats = EXCLUDED.stats,
              assets = EXCLUDED.assets,
              preferences = EXCLUDED.preferences,
              metadata = EXCLUDED.metadata,
              updated_at = CURRENT_TIMESTAMP
          `;

          await pool.query(query, [
            userRecord.id,
            userRecord.username,
            userRecord.role,
            userRecord.status,
            userRecord.created_at,
            userRecord.last_login,
            JSON.stringify(userRecord.account),
            JSON.stringify(userRecord.characters),
            JSON.stringify(userRecord.user_equipment),
            JSON.stringify(userRecord.attributes),
            JSON.stringify(userRecord.stats),
            JSON.stringify(userRecord.assets),
            JSON.stringify(userRecord.preferences),
            JSON.stringify(userRecord.metadata)
          ]);

          migratedUsers++;
          console.log(`  ✅ ${userData.id}: ${userData.username}`);

        } catch (error) {
          console.error(`  ❌ Ошибка при миграции ${userData.id}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Результаты миграции users:`);
    console.log(`  Всего пользователей: ${totalUsers}`);
    console.log(`  Успешно мигрировано: ${migratedUsers}`);
    console.log(`  Ошибок: ${totalUsers - migratedUsers}`);

    // Проверяем результат
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`  Записей в БД: ${result.rows[0].count}`);

    if (migratedUsers === totalUsers) {
      console.log('🎉 Миграция users завершена успешно!');
    } else {
      console.log('⚠️  Миграция завершена с ошибками');
    }

  } catch (error) {
    console.error('💥 Критическая ошибка при миграции users:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateUsers();
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

module.exports = { migrateUsers };
