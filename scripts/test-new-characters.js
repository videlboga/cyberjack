const fs = require('fs');
const path = require('path');

// Пути к файлам
const UNIFIED_FILE = path.join(__dirname, '../data/characters-unified.json');

// Функция для тестирования персонажей
function testCharacters() {
  try {
    console.log('🧪 Начинаем тестирование персонажей...');
    
    // Загружаем unified конфигурацию
    const unifiedConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    console.log(`📊 Загружено ${unifiedConfig.characters.length} персонажей`);
    
    // Группируем персонажей по возрасту
    const children = unifiedConfig.characters.filter(c => c.age && c.age < 18);
    const adults = unifiedConfig.characters.filter(c => c.age && c.age >= 18);
    const unknownAge = unifiedConfig.characters.filter(c => !c.age);
    
    console.log('\n📋 Статистика персонажей:');
    console.log(`👶 Дети (до 18 лет): ${children.length}`);
    console.log(`👨‍🦰 Взрослые (18+ лет): ${adults.length}`);
    console.log(`❓ Неизвестный возраст: ${unknownAge.length}`);
    
    // Выводим детских персонажей
    console.log('\n👶 Детские персонажи:');
    children.forEach(char => {
      console.log(`- ${char.name} (${char.age} лет): ${char.description}`);
    });
    
    // Выводим взрослых персонажей
    console.log('\n👨‍🦰 Взрослые персонажи:');
    adults.forEach(char => {
      console.log(`- ${char.name} (${char.age} лет): ${char.description}`);
    });
    
    // Проверяем характеристики
    console.log('\n🔍 Проверка характеристик:');
    unifiedConfig.characters.forEach(char => {
      const hasCharacteristics = char.characteristics && 
        (char.characteristics.physical || char.characteristics.psychological || char.characteristics.social);
      
      const hasFetishes = char.fetishes && 
        (char.fetishes.primary?.length > 0 || char.fetishes.secondary?.length > 0);
      
      const hasPrompt = char.basePrompt && char.basePrompt.length > 0;
      
      console.log(`${char.name}:`);
      console.log(`  - Характеристики: ${hasCharacteristics ? '✅' : '❌'}`);
      console.log(`  - Фетиши: ${hasFetishes ? '✅' : '❌'}`);
      console.log(`  - Промт: ${hasPrompt ? '✅' : '❌'}`);
    });
    
    // Тестируем промты для детских персонажей
    console.log('\n🧪 Тестирование промтов для детских персонажей:');
    children.slice(0, 3).forEach(char => {
      console.log(`\n📝 ${char.name} (${char.age} лет):`);
      console.log(`Промт: ${char.basePrompt.substring(0, 100)}...`);
      
      if (char.characteristics?.physical) {
        console.log(`Физические характеристики:`);
        Object.entries(char.characteristics.physical).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}/10`);
        });
      }
      
      if (char.fetishes?.primary?.length > 0) {
        console.log(`Основные фетиши: ${char.fetishes.primary.join(', ')}`);
      }
    });
    
    // Создаем отчет о тестировании
    const testReport = {
      timestamp: new Date().toISOString(),
      totalCharacters: unifiedConfig.characters.length,
      children: children.length,
      adults: adults.length,
      unknownAge: unknownAge.length,
      charactersWithCharacteristics: unifiedConfig.characters.filter(c => 
        c.characteristics && (c.characteristics.physical || c.characteristics.psychological || c.characteristics.social)
      ).length,
      charactersWithFetishes: unifiedConfig.characters.filter(c => 
        c.fetishes && (c.fetishes.primary?.length > 0 || c.fetishes.secondary?.length > 0)
      ).length,
      charactersWithPrompts: unifiedConfig.characters.filter(c => 
        c.basePrompt && c.basePrompt.length > 0
      ).length
    };
    
    const reportPath = path.join(__dirname, '../migration-results/test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));
    
    console.log(`\n📄 Отчет о тестировании сохранен в: ${reportPath}`);
    console.log('\n✅ Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тестирование
testCharacters();







