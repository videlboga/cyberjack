// Скрипт для очистки системных сообщений через API

const testData = {
  characterId: 'cmfkv6rlo0002hxtm7atmgy6r'
};

async function clearSystemMessagesAPI() {
  console.log('🧹 Очистка системных сообщений через API\n');

  try {
    // Удаляем системные сообщения
    const response = await fetch(`http://localhost:3000/api/chat/${testData.characterId}/clear-system`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Результат очистки:', result);

    // Проверяем историю чата после очистки
    console.log('\n📋 Проверяем историю чата после очистки...');
    const historyResponse = await fetch(`http://localhost:3000/api/chat/${testData.characterId}/history`);
    if (historyResponse.ok) {
      const chatHistory = await historyResponse.json();
      console.log(`📊 Сообщений в чате после очистки: ${chatHistory.length}`);

      // Показываем оставшиеся сообщения
      if (chatHistory.length > 0) {
        console.log('\n💬 Оставшиеся сообщения в чате:');
        chatHistory.forEach((msg, index) => {
          const type = msg.messageType === 'user' ? '👤 Пользователь' : '🤖 Персонаж';
          const time = new Date(msg.createdAt).toLocaleTimeString();
          console.log(`${index + 1}. [${time}] ${type}: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
        });
      } else {
        console.log('📭 Чат пуст');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при очистке:', error.message);
  }
}

// Запускаем очистку
clearSystemMessagesAPI();
