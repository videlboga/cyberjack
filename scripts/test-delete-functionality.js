const fs = require('fs');
const path = require('path');

// Пути к файлам
const UNIFIED_FILE = path.join(__dirname, '../data/characters-unified.json');
const ASSETS_FILE = path.join(__dirname, '../data/assets.json');

// Функция для тестирования удаления
function testDeleteFunctionality() {
  try {
    console.log('🧪 Тестируем функциональность удаления...');
    
    // Загружаем unified конфигурацию
    const unifiedConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    console.log(`📊 Загружено ${unifiedConfig.characters.length} персонажей`);
    
    // Проверяем структуру персонажей
    console.log('\n🔍 Проверяем структуру персонажей:');
    unifiedConfig.characters.forEach((char, index) => {
      console.log(`${index + 1}. ${char.name}:`);
      console.log(`   - ID: ${char.id}`);
      console.log(`   - deleted: ${char.deleted || false}`);
      console.log(`   - has attributes: ${!!char.attributes}`);
      console.log(`   - has states: ${!!char.states}`);
    });
    
    // Проверяем assets файл
    if (fs.existsSync(ASSETS_FILE)) {
      const assetsConfig = JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
      console.log(`\n💎 Assets файл содержит ${assetsConfig.assets?.length || 0} активов`);
      
      if (assetsConfig.assets) {
        console.log('🔍 Проверяем активы:');
        assetsConfig.assets.forEach((asset, index) => {
          console.log(`${index + 1}. ${asset.name}:`);
          console.log(`   - ID: ${asset.id}`);
          console.log(`   - deleted: ${asset.deleted || false}`);
        });
      }
    } else {
      console.log('\n⚠️ Assets файл не найден');
    }
    
    // Симулируем удаление персонажа
    console.log('\n🔄 Симулируем удаление персонажа...');
    const testCharacter = unifiedConfig.characters[0];
    if (testCharacter) {
      console.log(`🗑️ Удаляем персонажа: ${testCharacter.name} (ID: ${testCharacter.id})`);
      
      // Помечаем как удаленный
      testCharacter.deleted = true;
      testCharacter.deletedAt = new Date().toISOString();
      
      // Сохраняем изменения
      fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedConfig, null, 2));
      console.log('✅ Персонаж помечен как удаленный');
      
      // Проверяем фильтрацию
      const activeCharacters = unifiedConfig.characters.filter(char => !char.deleted);
      console.log(`📊 Активных персонажей: ${activeCharacters.length}/${unifiedConfig.characters.length}`);
      
      // Восстанавливаем персонажа для теста
      testCharacter.deleted = false;
      delete testCharacter.deletedAt;
      fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedConfig, null, 2));
      console.log('✅ Персонаж восстановлен');
    }
    
    console.log('\n✅ Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testDeleteFunctionality();






