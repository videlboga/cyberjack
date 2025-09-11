#!/usr/bin/env node

// Скрипт для привязки персонажей к пользователю
const { query } = require('../lib/database/client.js');

async function fixUserCharacters() {
  try {
    console.log('🔄 Привязываем персонажей к пользователю...');

    // Получаем всех персонажей
    const characters = await query('SELECT id FROM characters');
    console.log(`👥 Найдено персонажей: ${characters.length}`);

    // Получаем пользователя
    const users = await query('SELECT id, username FROM users');
    console.log(`👤 Найдено пользователей: ${users.length}`);

    if (users.length === 0) {
      console.log('❌ Пользователи не найдены');
      return;
    }

    if (characters.length === 0) {
      console.log('❌ Персонажи не найдены');
      return;
    }

    // Привязываем всех персонажей к первому пользователю
    const userId = users[0].id;
    const characterIds = characters.map(c => c.id);

    console.log(`🔗 Привязываем персонажей к пользователю ${users[0].username} (${userId})`);
    console.log(`📋 Персонажи: ${characterIds.join(', ')}`);

    // Обновляем пользователя
    await query(
      'UPDATE users SET characters = $1 WHERE id = $2',
      [JSON.stringify(characterIds), userId]
    );

    console.log('✅ Персонажи успешно привязаны к пользователю');

    // Проверяем результат
    const updatedUser = await query('SELECT id, username, characters FROM users WHERE id = $1', [userId]);
    console.log('🔍 Результат:', {
      id: updatedUser[0].id,
      username: updatedUser[0].username,
      characters: updatedUser[0].characters
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

fixUserCharacters();
