// Тест системы ИИ-триггеров при применении действий

const testData = {
  characterId: 'cmfkv6rlo0002hxtm7atmgy6r',
  actionId: 'cmfku3qu1000dhxv7w7bqoe3x',
  userId: 'cmfjeu4430000hxhpz4r17ol8',
  durationSeconds: 1,
  intensity: 50
};

async function testAIActionTrigger() {
  console.log('🤖 Тестирование системы ИИ-триггеров при применении действий\n');

  try {
    // Выполняем действие несколько раз, чтобы проверить триггеры
    for (let i = 1; i <= 12; i++) {
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

        // Проверяем, должен ли сработать ИИ-триггер
        const shouldTrigger = i === 2 || (i >= 10 && i % 10 === 0);
        if (shouldTrigger) {
          console.log(`🎯 ИИ-триггер должен сработать на ${i}-м применении`);
        }
      } else {
        console.log(`❌ Действие #${i} не выполнено`);
        console.log(`📝 Ошибка: ${result.message}`);
      }

      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n🏁 Тестирование завершено');
    console.log('📋 Проверьте логи сервера на наличие ИИ-запросов');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

// Запускаем тест
testAIActionTrigger();
