const { 
  loadCharacterAIConfig, 
  loadCharacters, 
  getCharacterById, 
  getCharacterByName,
  getConfigStats,
  clearCache 
} = require('../lib/character/config-loader.ts');

async function testCharacterAIConfigLoader() {
  console.log('🧪 Тестирование нового загрузчика Character AI...\n');
  
  try {
    // Первая загрузка
    console.log('📥 Первая загрузка конфигурации...');
    const config1 = await loadCharacterAIConfig();
    const stats1 = getConfigStats();
    
    console.log('📊 Статистика первой загрузки:');
    console.log(`   Кэш конфигурации: ${stats1.configCache}`);
    console.log(`   Персонажей в кэше: ${stats1.charactersCache}`);
    console.log(`   Возраст кэша: ${stats1.cacheAge}ms`);
    console.log(`   Кэш валиден: ${stats1.cacheValid}`);
    
    console.log('\n📋 Конфигурация Character AI:');
    console.log(`   Действия: ${Object.keys(config1.actions).length}`);
    console.log(`   Инструменты: ${Object.keys(config1.tools).length}`);
    console.log(`   Позы: ${Object.keys(config1.poses).length}`);
    console.log(`   Условия смены поз: ${Object.keys(config1.poseChangeConditions).length}`);
    console.log(`   Быстрые действия: ${Object.keys(config1.quickActions).length}`);
    console.log(`   Интерактивные области: ${Object.keys(config1.interactiveAreas).length}`);
    
    // Загрузка персонажей
    console.log('\n📥 Загрузка персонажей...');
    const characters = await loadCharacters();
    console.log(`   Загружено персонажей: ${characters.length}`);
    
    if (characters.length > 0) {
      const firstCharacter = characters[0];
      console.log(`   Первый персонаж: ${firstCharacter.name} (${firstCharacter.id})`);
      
      // Тест получения персонажа по ID
      console.log('\n🔍 Тест получения персонажа по ID...');
      const characterById = await getCharacterById(firstCharacter.id);
      console.log(`   Найден персонаж: ${characterById ? characterById.name : 'не найден'}`);
      
      // Тест получения персонажа по имени
      console.log('\n🔍 Тест получения персонажа по имени...');
      const characterByName = await getCharacterByName(firstCharacter.name);
      console.log(`   Найден персонаж: ${characterByName ? characterByName.name : 'не найден'}`);
    }
    
    // Вторая загрузка (должна использовать кэш)
    console.log('\n📥 Вторая загрузка (должна использовать кэш)...');
    const config2 = await loadCharacterAIConfig();
    const stats2 = getConfigStats();
    
    console.log('📊 Статистика второй загрузки:');
    console.log(`   Кэш конфигурации: ${stats2.configCache}`);
    console.log(`   Персонажей в кэше: ${stats2.charactersCache}`);
    console.log(`   Возраст кэша: ${stats2.cacheAge}ms`);
    console.log(`   Кэш валиден: ${stats2.cacheValid}`);
    
    // Очистка кэша
    console.log('\n🧹 Очистка кэша...');
    clearCache();
    const stats3 = getConfigStats();
    
    console.log('📊 Статистика после очистки:');
    console.log(`   Кэш конфигурации: ${stats3.configCache}`);
    console.log(`   Персонажей в кэше: ${stats3.charactersCache}`);
    
    // Третья загрузка (после очистки кэша)
    console.log('\n📥 Третья загрузка (после очистки кэша)...');
    const config3 = await loadCharacterAIConfig();
    const stats4 = getConfigStats();
    
    console.log('📊 Статистика третьей загрузки:');
    console.log(`   Кэш конфигурации: ${stats4.configCache}`);
    console.log(`   Персонажей в кэше: ${stats4.charactersCache}`);
    console.log(`   Возраст кэша: ${stats4.cacheAge}ms`);
    console.log(`   Кэш валиден: ${stats4.cacheValid}`);
    
    console.log('\n✅ Тестирование завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск теста
testCharacterAIConfigLoader();

