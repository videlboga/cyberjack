// Тест фильтрации системных сообщений в чате

const testData = {
  characterId: 'cmfkv6rlo0002hxtm7atmgy6r',
  actionId: 'cmfku3qu1000dhxv7w7bqoe3x',
  userId: 'cmfjeu4430000hxhpz4r17ol8',
  durationSeconds: 1,
  intensity: 50
};

async function testSystemMessagesFilter() {
  console.log('🔍 Тестирование фильтрации системных сообщений в чате\n');

  try {
    // 1. Проверяем историю чата до выполнения действий
    console.log('📋 Проверяем историю чата до выполнения действий...');
    const historyBefore = await fetch(`http://localhost:3000/api/chat/${testData.characterId}/history`);
    if (historyBefore.ok) {
      const chatHistoryBefore = await historyBefore.json();
      console.log(`📊 Сообщений в чате до: ${chatHistoryBefore.length}`);
    }

    // 2. Выполняем несколько действий, чтобы сработал ИИ-триггер
    console.log('\n🎯 Выполняем действия для срабатывания ИИ-триггера...');

    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Выполнение действия #${i} ---`);

      const response = await fetch('http://localhost:3000/api/actions/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Действие #${i} выполнено успешно`);
        console.log(`📝 Сообщение: ${result.message}`);
        console.log(`🔢 Количество эффектов: ${result.effects?.length || 0}`);
      } else {
        console.log(`❌ Действие #${i} не выполнено`);
        console.log(`📝 Ошибка: ${result.message}`);
      }

      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Проверяем историю чата после выполнения действий
    console.log('\n📋 Проверяем историю чата после выполнения действий...');
    const historyAfter = await fetch(`http://localhost:3000/api/chat/${testData.characterId}/history`);
    if (historyAfter.ok) {
      const chatHistoryAfter = await historyAfter.json();
      console.log(`📊 Сообщений в чате после: ${chatHistoryAfter.length}`);

      // Показываем последние сообщения
      const recentMessages = chatHistoryAfter.slice(-10);
      console.log('\n💬 Последние сообщения в чате:');
      recentMessages.forEach((msg, index) => {
        const type = msg.messageType === 'user' ? '👤 Пользователь' : '🤖 Персонаж';
        const time = new Date(msg.createdAt).toLocaleTimeString();
        console.log(`${index + 1}. [${time}] ${type}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      });

      // Проверяем, есть ли системные сообщения
      const systemMessages = chatHistoryAfter.filter(msg =>
        msg.content.includes('К тебе было применено действие') ||
        msg.content.includes('Это вызвало:') ||
        msg.content.includes('Как ты реагируешь на это действие?')
      );

      if (systemMessages.length > 0) {
        console.log(`\n❌ ОШИБКА: Найдено ${systemMessages.length} системных сообщений в чате!`);
        systemMessages.forEach((msg, index) => {
          console.log(`${index + 1}. [${new Date(msg.createdAt).toLocaleTimeString()}] ${msg.content.substring(0, 150)}...`);
        });
      } else {
        console.log('\n✅ ОТЛИЧНО: Системные сообщения не отображаются в чате!');
      }
    }

    // 4. Тестируем отправку обычного сообщения в чат
    console.log('\n💬 Тестируем отправку обычного сообщения в чат...');
    const chatResponse = await fetch(`http://localhost:3000/api/chat/${testData.characterId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Привет! Как дела?',
        userId: testData.userId,
        context: {
          timestamp: new Date().toISOString()
        }
      })
    });

    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ Сообщение в чат отправлено успешно');
      console.log(`🤖 Ответ персонажа: ${chatData.response?.substring(0, 200)}${chatData.response?.length > 200 ? '...' : ''}`);
    } else {
      console.log('❌ Ошибка отправки сообщения в чат');
    }

    // 5. Финальная проверка истории чата
    console.log('\n📋 Финальная проверка истории чата...');
    const finalHistory = await fetch(`http://localhost:3000/api/chat/${testData.characterId}/history`);
    if (finalHistory.ok) {
      const finalChatHistory = await finalHistory.json();
      console.log(`📊 Итого сообщений в чате: ${finalChatHistory.length}`);

      // Показываем статистику по типам сообщений
      const userMessages = finalChatHistory.filter(msg => msg.messageType === 'user').length;
      const characterMessages = finalChatHistory.filter(msg => msg.messageType === 'character').length;
      console.log(`👤 Сообщений пользователя: ${userMessages}`);
      console.log(`🤖 Сообщений персонажа: ${characterMessages}`);

      // Показываем последние сообщения
      const lastMessages = finalChatHistory.slice(-5);
      console.log('\n💬 Последние 5 сообщений:');
      lastMessages.forEach((msg, index) => {
        const type = msg.messageType === 'user' ? '👤 Пользователь' : '🤖 Персонаж';
        const time = new Date(msg.createdAt).toLocaleTimeString();
        console.log(`${index + 1}. [${time}] ${type}: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
      });
    }

    console.log('\n🎉 Тестирование завершено!');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

// Запускаем тест
testSystemMessagesFilter();

