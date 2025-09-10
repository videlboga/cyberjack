#!/usr/bin/env node

/**
 * Миграционный скрипт для equipment
 * Переносит данные из equipment-unified.json в таблицу equipment
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

async function migrateEquipment() {
  console.log('🚀 Начинаем миграцию equipment...');

  try {
    // Читаем данные из JSON файла
    const equipmentPath = path.join(__dirname, '../data/equipment-unified.json');
    const equipmentData = JSON.parse(fs.readFileSync(equipmentPath, 'utf8'));

    console.log('📖 Данные загружены из equipment-unified.json');

    // Очищаем таблицу equipment
    await pool.query('DELETE FROM equipment');
    console.log('🧹 Таблица equipment очищена');

    let totalEquipment = 0;
    let migratedEquipment = 0;

    // Проходим по всему оборудованию
    if (equipmentData.equipment && Array.isArray(equipmentData.equipment)) {
      for (const equipmentItem of equipmentData.equipment) {
        totalEquipment++;

        try {
          // Подготавливаем данные для вставки
          const equipmentRecord = {
            id: equipmentItem.id,
            name: equipmentItem.name || 'Unnamed Equipment',
            type: equipmentItem.type || 'general',
            slot: equipmentItem.slot || 'general',
            description: equipmentItem.description || '',
            effects: equipmentItem.effects || {},
            removable: equipmentItem.removable !== false,
            power_settings: equipmentItem.powerSettings || {},
            modes: equipmentItem.modes || [],
            progressive_effects: equipmentItem.progressiveEffects || [],
            requirements: equipmentItem.requirements || {},
            cost: equipmentItem.cost || 0,
            rarity: equipmentItem.rarity || 'common',
            enabled: equipmentItem.enabled !== false
          };

          // Вставляем запись в БД
          const query = `
            INSERT INTO equipment (
              id, name, type, slot, description, effects, removable,
              power_settings, modes, progressive_effects, requirements,
              cost, rarity, enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              type = EXCLUDED.type,
              slot = EXCLUDED.slot,
              description = EXCLUDED.description,
              effects = EXCLUDED.effects,
              removable = EXCLUDED.removable,
              power_settings = EXCLUDED.power_settings,
              modes = EXCLUDED.modes,
              progressive_effects = EXCLUDED.progressive_effects,
              requirements = EXCLUDED.requirements,
              cost = EXCLUDED.cost,
              rarity = EXCLUDED.rarity,
              enabled = EXCLUDED.enabled,
              updated_at = CURRENT_TIMESTAMP
          `;

          await pool.query(query, [
            equipmentRecord.id,
            equipmentRecord.name,
            equipmentRecord.type,
            equipmentRecord.slot,
            equipmentRecord.description,
            JSON.stringify(equipmentRecord.effects),
            equipmentRecord.removable,
            JSON.stringify(equipmentRecord.power_settings),
            JSON.stringify(equipmentRecord.modes),
            JSON.stringify(equipmentRecord.progressive_effects),
            JSON.stringify(equipmentRecord.requirements),
            equipmentRecord.cost,
            equipmentRecord.rarity,
            equipmentRecord.enabled
          ]);

          migratedEquipment++;
          console.log(`  ✅ ${equipmentItem.id}: ${equipmentItem.name}`);

        } catch (error) {
          console.error(`  ❌ Ошибка при миграции ${equipmentItem.id}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Результаты миграции equipment:`);
    console.log(`  Всего оборудования: ${totalEquipment}`);
    console.log(`  Успешно мигрировано: ${migratedEquipment}`);
    console.log(`  Ошибок: ${totalEquipment - migratedEquipment}`);

    // Проверяем результат
    const result = await pool.query('SELECT COUNT(*) as count FROM equipment');
    console.log(`  Записей в БД: ${result.rows[0].count}`);

    if (migratedEquipment === totalEquipment) {
      console.log('🎉 Миграция equipment завершена успешно!');
    } else {
      console.log('⚠️  Миграция завершена с ошибками');
    }

  } catch (error) {
    console.error('💥 Критическая ошибка при миграции equipment:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateEquipment();
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

module.exports = { migrateEquipment };
