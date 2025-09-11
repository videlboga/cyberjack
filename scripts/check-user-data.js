#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkUserData() {
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

    // Проверяем пользователей
    const usersResult = await client.query(`
      SELECT id, username, email, role, characters, assets, preferences
      FROM users
      ORDER BY created_at DESC
    `);

    console.log('👥 Пользователи в БД:');
    usersResult.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. Пользователь:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Characters: ${JSON.stringify(user.characters)}`);
      console.log(`   Assets: ${JSON.stringify(user.assets)}`);
      console.log(`   Characters type: ${typeof user.characters}`);
      console.log(`   Assets type: ${typeof user.assets}`);
    });

    // Проверяем персонажей
    const charactersResult = await client.query(`
      SELECT id, name, description, archetype, status
      FROM characters
      ORDER BY id
    `);

    console.log('\n👤 Персонажи в БД:');
    charactersResult.rows.forEach((char, index) => {
      console.log(`${index + 1}. ${char.name} (${char.id}) - ${char.status}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await client.end();
  }
}

checkUserData();
