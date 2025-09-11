#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testQueryDirect() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Подключение к БД установлено');

    // Тестируем SQL запрос из loadUsers
    const result = await client.query(`
      SELECT id, username, email, role, status, created_at, last_login,
             account, characters, user_equipment, attributes, stats,
             assets, preferences, metadata
      FROM users
      ORDER BY created_at DESC
    `);

    console.log('👥 Результат SQL запроса:');
    console.log('Количество пользователей:', result.rows.length);

    if (result.rows.length > 0) {
      const user = result.rows[0];
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
  } finally {
    await client.end();
  }
}

testQueryDirect();
