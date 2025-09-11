#!/usr/bin/env node

const { query } = require('../lib/database/client.js');

async function testQueryFunctionDirect() {
  try {
    console.log('🔄 Тестируем query функцию...');

    const users = await query(`
      SELECT id, username, email, role, status, created_at, last_login,
             account, characters, user_equipment, attributes, stats,
             assets, preferences, metadata
      FROM users
      ORDER BY created_at DESC
    `);

    console.log('👥 Результат query функции:');
    console.log('Количество пользователей:', users.length);

    if (users.length > 0) {
      const user = users[0];
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

testQueryFunctionDirect();