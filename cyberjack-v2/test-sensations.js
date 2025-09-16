// Тест системы ощущений персонажа

const testData = {
  characterId: 'cmfkv6rlo0002hxtm7atmgy6r',
  actionId: 'cmfku3qu1000dhxv7w7bqoe3x',
  userId: 'cmfjeu4430000hxhpz4r17ol8',
  durationSeconds: 1,
  intensity: 50
};

async function testSensations() {
  console.log('🎭 Тест системы ощущений персонажа\n');

  try {
    // 1. Проверяем текущее состояние чата
    console.log('📋 Проверяем текущее состояние чата...');
    const historyBefore = await fetch(`http://localhost:3000/api/chat/${testData.characterId}/history`);
    if (historyBefore.ok) {
      const chatHistoryBefore = await historyBefore.json();
      console.log(`📊 Сообщений в чате до: ${chatHistoryBefore.length}`);
    }

    // 2. Выполняем несколько действий для срабатывания ИИ-триггеров
    console.log('\n🎯 Выполняем действия для проверки ощущений...');

    for (let i = 1; i <= 6; i++) {
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

        // Показываем эффекты
        if (result.effects && result.effects.length > 0) {
          console.log('📊 Эффекты:');
          result.effects.forEach((effect, index) => {
            console.log(`  ${index + 1}. Характеристика ${effect.characteristicId}: ${effect.change > 0 ? '+' : ''}${effect.change.toFixed(1)}`);
          });
        }
      } else {
        console.log(`❌ Действие #${i} не выполнено`);
        console.log(`📝 Ошибка: ${result.message}`);
      }

      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 2000));
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
        console.log(`${index + 1}. [${time}] ${type}: ${msg.content.substring(0, 120)}${msg.content.length > 120 ? '...' : ''}`);
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

      // Показываем статистику
      const userMessages = chatHistoryAfter.filter(msg => msg.messageType === 'user').length;
      const characterMessages = chatHistoryAfter.filter(msg => msg.messageType === 'character').length;
      console.log(`\n📊 Статистика чата:`);
      console.log(`👤 Сообщений пользователя: ${userMessages}`);
      console.log(`🤖 Сообщений персонажа: ${characterMessages}`);

      // Показываем новые сообщения (если есть)
      const newMessages = chatHistoryAfter.slice(-5);
      if (newMessages.length > 0) {
        console.log('\n🆕 Новые сообщения:');
        newMessages.forEach((msg, index) => {
          const type = msg.messageType === 'user' ? '👤 Пользователь' : '🤖 Персонаж';
          const time = new Date(msg.createdAt).toLocaleTimeString();
          console.log(`${index + 1}. [${time}] ${type}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });
      }
    }

    console.log('\n🎉 Тестирование завершено!');
    console.log('\n📝 Ожидаемые изменения:');
    console.log('1. Персонаж должен реагировать на ощущения, а не на цифры');
    console.log('2. Сообщения должны содержать фразы типа "Ты чувствуешь..."');
    console.log('3. Не должно быть технических описаний характеристик');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

// Запускаем тест
testSensations();
