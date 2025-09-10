#!/usr/bin/env node

/**
 * Универсальный скрипт для запуска всех миграций
 * Выполняет миграцию всех сущностей в правильном порядке
 */

const { migrateActions } = require('./migrate-actions');
const { migrateContracts } = require('./migrate-contracts');
const { migrateEvents } = require('./migrate-events');
const { migrateEquipment } = require('./migrate-equipment');
const { migrateUsers } = require('./migrate-users');

async function migrateAll() {
  console.log('🚀 Начинаем полную миграцию всех сущностей...\n');

  const startTime = Date.now();
  let successCount = 0;
  let totalCount = 5;

  try {
    // 1. Actions
    console.log('='.repeat(50));
    console.log('1️⃣  МИГРАЦИЯ ACTIONS');
    console.log('='.repeat(50));
    await migrateActions();
    successCount++;
    console.log('✅ Actions мигрированы успешно\n');

    // 2. Contracts
    console.log('='.repeat(50));
    console.log('2️⃣  МИГРАЦИЯ CONTRACTS');
    console.log('='.repeat(50));
    await migrateContracts();
    successCount++;
    console.log('✅ Contracts мигрированы успешно\n');

    // 3. Events
    console.log('='.repeat(50));
    console.log('3️⃣  МИГРАЦИЯ EVENTS');
    console.log('='.repeat(50));
    await migrateEvents();
    successCount++;
    console.log('✅ Events мигрированы успешно\n');

    // 4. Equipment
    console.log('='.repeat(50));
    console.log('4️⃣  МИГРАЦИЯ EQUIPMENT');
    console.log('='.repeat(50));
    await migrateEquipment();
    successCount++;
    console.log('✅ Equipment мигрировано успешно\n');

    // 5. Users
    console.log('='.repeat(50));
    console.log('5️⃣  МИГРАЦИЯ USERS');
    console.log('='.repeat(50));
    await migrateUsers();
    successCount++;
    console.log('✅ Users мигрированы успешно\n');

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('='.repeat(50));
    console.log('🎉 МИГРАЦИЯ ЗАВЕРШЕНА!');
    console.log('='.repeat(50));
    console.log(`✅ Успешно мигрировано: ${successCount}/${totalCount} сущностей`);
    console.log(`⏱️  Время выполнения: ${duration} секунд`);
    console.log(`📊 Общий прогресс: ${Math.round((successCount / totalCount) * 100)}%`);

    if (successCount === totalCount) {
      console.log('\n🎊 Все миграции выполнены успешно!');
      console.log('🚀 Готово к созданию API endpoints');
    } else {
      console.log('\n⚠️  Некоторые миграции завершились с ошибками');
    }

  } catch (error) {
    console.error('\n💥 Критическая ошибка при миграции:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateAll();
  } catch (error) {
    console.error('💥 Миграция не удалась:', error);
    process.exit(1);
  }
}

// Запускаем миграцию
if (require.main === module) {
  main();
}

module.exports = { migrateAll };
