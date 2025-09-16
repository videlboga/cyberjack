// Тест API для проверки системы действий

const testData = {
  characterId: 'cmfkv6rlo0002hxtm7atmgy6r',
  actionId: 'cmfku3qu1000dhxv7w7bqoe3x',
  userId: 'cmfjeu4430000hxhpz4r17ol8',
  durationSeconds: 1,
  intensity: 50
};

async function testActionAPI() {
  console.log('🧪 Тестирование API действий\n');

  try {
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

    console.log('✅ Запрос выполнен успешно');
    console.log('📊 Результат:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎯 Действие выполнено успешно!');
      console.log(`📝 Сообщение: ${result.message}`);
      console.log(`🔢 Количество эффектов: ${result.effects?.length || 0}`);
    } else {
      console.log('\n❌ Действие не выполнено');
      console.log(`📝 Ошибка: ${result.message}`);
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании API:', error.message);
  }
}

// Запускаем тест
testActionAPI();
