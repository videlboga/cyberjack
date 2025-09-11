#!/usr/bin/env node

const { loadDatabaseConfig } = require('../lib/database/config-loader.js');

async function debugLoadUsers() {
  try {
    console.log('🔄 Тестируем загрузку конфигурации из БД...');
    const config = await loadDatabaseConfig();

    console.log('✅ Конфигурация загружена');
    console.log('👥 Пользователи:', config.users?.length || 0);

    if (config.users && config.users.length > 0) {
      const user = config.users[0];
      console.log('\n🔍 Первый пользователь:');
      console.log('  ID:', user.id);
      console.log('  Username:', user.username);
      console.log('  Characters:', JSON.stringify(user.characters));
      console.log('  Assets:', JSON.stringify(user.assets));
      console.log('  Characters type:', typeof user.characters);
      console.log('  Assets type:', typeof user.assets);
      console.log('  All keys:', Object.keys(user));
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

debugLoadUsers();
