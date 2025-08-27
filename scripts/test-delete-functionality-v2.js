const fs = require('fs');
const path = require('path');

const UNIFIED_FILE = path.join(__dirname, '../data/characters-unified.json');

function testDeleteFunctionality() {
  try {
    console.log('🧪 Тестируем функциональность удаления персонажей...');
    
    // Загружаем текущую конфигурацию
    const unifiedConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    console.log(`📊 Всего персонажей: ${unifiedConfig.characters.length}`);
    
    // Находим персонажа для тестирования
    const testCharacter = unifiedConfig.characters.find(char => char.name === 'Анечка');
    if (!testCharacter) {
      console.log('❌ Персонаж Анечка не найден');
      return;
    }
    
    console.log(`🎭 Тестируем персонажа: ${testCharacter.name} (ID: ${testCharacter.id})`);
    console.log(`📋 Текущий статус deleted: ${testCharacter.deleted || false}`);
    
    // Проверяем активных персонажей
    const activeCharacters = unifiedConfig.characters.filter(char => !char.deleted);
    console.log(`✅ Активных персонажей: ${activeCharacters.length}/${unifiedConfig.characters.length}`);
    
    // Тестируем удаление
    console.log('\n🗑️ Тестируем удаление...');
    testCharacter.deleted = true;
    testCharacter.deletedAt = new Date().toISOString();
    
    fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedConfig, null, 2));
    console.log('✅ Персонаж помечен как удаленный');
    
    // Проверяем результат
    const updatedConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    const updatedActiveCharacters = updatedConfig.characters.filter(char => !char.deleted);
    console.log(`📊 Активных персонажей после удаления: ${updatedActiveCharacters.length}/${updatedConfig.characters.length}`);
    
    // Восстанавливаем персонажа
    console.log('\n🔄 Восстанавливаем персонажа...');
    testCharacter.deleted = false;
    delete testCharacter.deletedAt;
    
    fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedConfig, null, 2));
    console.log('✅ Персонаж восстановлен');
    
    // Финальная проверка
    const finalConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    const finalActiveCharacters = finalConfig.characters.filter(char => !char.deleted);
    console.log(`📊 Финальное количество активных персонажей: ${finalActiveCharacters.length}/${finalConfig.characters.length}`);
    
    console.log('\n✅ Тестирование завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

testDeleteFunctionality();





