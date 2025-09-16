// Скрипт для очистки системных сообщений из чата

const testData = {
  characterId: 'cmfkv6rlo0002hxtm7atmgy6r'
};

async function clearSystemMessages() {
  console.log('🧹 Очистка системных сообщений из чата\n');

  try {
    // Получаем все сообщения чата
    const response = await fetch(`http://localhost:3000/api/chat/${testData.characterId}/history`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const chatHistory = await response.json();
    console.log(`📊 Всего сообщений в чате: ${chatHistory.length}`);

    // Находим системные сообщения
    const systemMessages = chatHistory.filter(msg =>
      msg.content.includes('К тебе было применено действие') ||
      msg.content.includes('Это вызвало:') ||
      msg.content.includes('Как ты реагируешь на это действие?')
    );

    console.log(`🔍 Найдено системных сообщений: ${systemMessages.length}`);

    if (systemMessages.length > 0) {
      console.log('\n📝 Системные сообщения для удаления:');
      systemMessages.forEach((msg, index) => {
        console.log(`${index + 1}. [${new Date(msg.createdAt).toLocaleTimeString()}] ${msg.content.substring(0, 100)}...`);
      });

      // Удаляем системные сообщения через API (если есть такой endpoint)
      // Пока просто показываем, что нужно удалить
      console.log('\n⚠️ Для удаления этих сообщений нужно:');
      console.log('1. Подключиться к базе данных');
      console.log('2. Удалить записи с ID:', systemMessages.map(msg => msg.id).join(', '));

      // Альтернативно, можно очистить весь чат
      console.log('\n🔄 Или очистить весь чат для чистого тестирования');
    } else {
      console.log('✅ Системных сообщений не найдено');
    }

    // Показываем статистику
    const userMessages = chatHistory.filter(msg => msg.messageType === 'user').length;
    const characterMessages = chatHistory.filter(msg => msg.messageType === 'character').length;
    console.log(`\n📊 Статистика чата:`);
    console.log(`👤 Сообщений пользователя: ${userMessages}`);
    console.log(`🤖 Сообщений персонажа: ${characterMessages}`);

  } catch (error) {
    console.error('❌ Ошибка при очистке:', error.message);
  }
}

// Запускаем очистку
clearSystemMessages();
