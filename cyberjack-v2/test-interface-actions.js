// Тест интерфейса для проверки выполнения действий

const testData = {
  characterId: 'cmfkv6rlo0002hxtm7atmgy6r',
  actionId: 'cmfku3qu1000dhxv7w7bqoe3x',
  userId: 'cmfjeu4430000hxhpz4r17ol8',
  zoneId: 'test-zone',
  durationSeconds: 1
};

async function testInterfaceAction() {
  console.log('🎮 Тестирование интерфейса выполнения действий\n');

  try {
    // Тестируем API endpoint, который использует интерфейс
    console.log('📡 Тестируем API /api/actions/execute...');

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
    console.log('✅ API ответ:', JSON.stringify(result, null, 2));

    if (result.success && result.effects && result.effects.length > 0) {
      console.log('\n🔍 Тестируем получение названий характеристик...');

      // Тестируем получение названий характеристик (как в интерфейсе)
      for (const effect of result.effects) {
        try {
          const charResponse = await fetch(`http://localhost:3000/api/characteristics/definition/${effect.characteristicId}`);

          if (charResponse.ok) {
            const charData = await charResponse.json();
            console.log(`✅ Характеристика ${effect.characteristicId}: ${charData.name}`);
          } else {
            console.log(`❌ Ошибка получения характеристики ${effect.characteristicId}: ${charResponse.status}`);
          }
        } catch (error) {
          console.log(`❌ Ошибка при получении характеристики ${effect.characteristicId}:`, error.message);
        }
      }
    }

    console.log('\n🎯 Тест завершен');

  } catch (error) {
    console.error('❌ Ошибка при тестировании интерфейса:', error.message);
  }
}

// Запускаем тест
testInterfaceAction();
