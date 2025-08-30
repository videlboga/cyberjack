const { loadUnifiedConfigV2, getConfigStats, getCacheStatus } = require('../lib/unified-config-loader-v2.ts');

async function testConfigLoader() {
  console.log('🧪 Тестирование нового загрузчика конфигов v2...\n');
  
  try {
    // Первая загрузка
    console.log('📥 Первая загрузка...');
    const config1 = await loadUnifiedConfigV2();
    const stats1 = getConfigStats(config1);
    
    console.log('📊 Статистика первой загрузки:');
    console.log(`   Персонажи: ${stats1.characters}`);
    console.log(`   Действия: ${stats1.actions}`);
    console.log(`   События: ${stats1.events}`);
    console.log(`   Контракты: ${stats1.contracts}`);
    console.log(`   Оборудование: ${stats1.equipment}`);
    console.log(`   Пользователи: ${stats1.users}`);
    console.log(`   Активы: ${stats1.assets}`);
    console.log(`   Позы AI: ${stats1.characterAI.poses}`);
    console.log('');
    
    // Проверяем кэш
    const cacheStatus1 = getCacheStatus();
    console.log('📋 Статус кэша после первой загрузки:');
    console.log(`   Есть кэш: ${cacheStatus1.hasCache}`);
    console.log(`   Возраст: ${cacheStatus1.age}ms`);
    console.log('');
    
    // Вторая загрузка (должна использовать кэш)
    console.log('📥 Вторая загрузка (должна использовать кэш)...');
    const config2 = await loadUnifiedConfigV2();
    const stats2 = getConfigStats(config2);
    
    console.log('📊 Статистика второй загрузки:');
    console.log(`   Персонажи: ${stats2.characters}`);
    console.log(`   Действия: ${stats2.actions}`);
    console.log(`   События: ${stats2.events}`);
    console.log(`   Контракты: ${stats2.contracts}`);
    console.log(`   Оборудование: ${stats2.equipment}`);
    console.log(`   Пользователи: ${stats2.users}`);
    console.log(`   Активы: ${stats2.assets}`);
    console.log(`   Позы AI: ${stats2.characterAI.poses}`);
    console.log('');
    
    // Проверяем, что данные одинаковые
    const isEqual = JSON.stringify(stats1) === JSON.stringify(stats2);
    console.log(`✅ Данные одинаковые: ${isEqual}`);
    
    // Проверяем структуру конфига
    console.log('\n🔍 Проверка структуры конфига:');
    console.log(`   characters: ${!!config2.characters}`);
    console.log(`   actions: ${!!config2.actions}`);
    console.log(`   events: ${!!config2.events}`);
    console.log(`   contracts: ${!!config2.contracts}`);
    console.log(`   equipment: ${!!config2.equipment}`);
    console.log(`   system: ${!!config2.system}`);
    console.log(`   storyScenes: ${!!config2.storyScenes}`);
    console.log(`   users: ${!!config2.users}`);
    console.log(`   market: ${!!config2.market}`);
    console.log(`   assets: ${!!config2.assets}`);
    console.log(`   characterAI: ${!!config2.characterAI}`);
    
    console.log('\n✅ Тест завершен успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запускаем тест
testConfigLoader();







