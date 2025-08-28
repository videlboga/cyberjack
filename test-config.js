// Тестовый файл для проверки загрузки конфигураций
const fs = require('fs');
const path = require('path');

console.log('🔍 Начинаем тестирование загрузки конфигураций...\n');

const filesToCheck = [
  'characters-unified.json',
  'users-unified.json',
  'equipment-unified.json',
  'events-unified.json',
  'contracts-unified.json',
  'story-scenes-unified.json'
];

filesToCheck.forEach(filename => {
  const filepath = path.join(__dirname, 'data', filename);
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(content);

    console.log(`✅ ${filename}:`);
    if (filename === 'characters-unified.json') {
      console.log(`   - Персонажи: ${data.characters?.length || 0}`);
    } else if (filename === 'users-unified.json') {
      console.log(`   - Пользователи: ${data.users?.length || 0}`);
    } else if (filename === 'equipment-unified.json') {
      console.log(`   - Оборудование: ${data.equipment?.length || 0}`);
    } else if (filename === 'events-unified.json') {
      console.log(`   - События: ${data.events?.length || 0}`);
    } else if (filename === 'contracts-unified.json') {
      console.log(`   - Контракты: ${data.available?.length || 0}`);
    } else if (filename === 'story-scenes-unified.json') {
      console.log(`   - Сюжетные сцены: ${Object.keys(data.storyPoints || {}).length}`);
    }
    console.log('');
  } catch (error) {
    console.log(`❌ ${filename}: Ошибка загрузки - ${error.message}\n`);
  }
});

console.log('🏁 Тестирование завершено');
