const fs = require('fs');
const path = require('path');

const UNIFIED_FILE = path.join(__dirname, '../data/characters-unified.json');

// Маппинг полных имен на краткие
const nameMapping = {
  'Анечка': 'Анечка',
  'Алексей Дмитриевич Морозов': 'Алексей',
  'Альфа-001 (настоящее имя неизвестно)': 'Альфа-001',
  'Анна (Анечка)': 'Анна',
  'Анна Сергеевна Козлова': 'Анна К.',
  'Артём Владимирович Соколов': 'Артём',
  'Виктор Сергеевич Морозов': 'Виктор',
  'Дмитрий Александрович Петров': 'Дмитрий',
  'Елена Александровна Соколова': 'Елена',
  'Мила (предположительно)': 'Мила',
  'Екатерина (Катя)': 'Катя',
  'Елизавета (Лиза)': 'Лиза',
  'Мария Ивановна (фамилия неизвестна)': 'Мария',
  'Михаил (Миша)': 'Миша',
  'Ольга Дмитриевна Волкова': 'Ольга',
  'Алиса (предположительно)': 'Алиса',
  'Сергей Игоревич Волков': 'Сергей',
  'Лилия/Лилит (две личности)': 'Лилия'
};

function shortenCharacterNames() {
  try {
    console.log('✂️ Сокращаем имена персонажей...');
    
    // Загружаем текущую конфигурацию
    const unifiedConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    console.log(`📊 Всего персонажей: ${unifiedConfig.characters.length}`);
    
    let updatedCount = 0;
    
    unifiedConfig.characters.forEach(character => {
      const fullName = character.name;
      const shortName = nameMapping[fullName];
      
      if (shortName && shortName !== fullName) {
        console.log(`📝 ${fullName} → ${shortName}`);
        character.name = shortName;
        
        // Добавляем полное имя в описание, если его там нет
        if (character.description && !character.description.includes(fullName)) {
          character.description = `Полное имя: ${fullName}. ${character.description}`;
        } else if (!character.description) {
          character.description = `Полное имя: ${fullName}`;
        }
        
        updatedCount++;
      }
    });
    
    // Сохраняем обновленную конфигурацию
    fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedConfig, null, 2));
    
    console.log(`✅ Обновлено ${updatedCount} персонажей`);
    console.log('📋 Новые краткие имена:');
    unifiedConfig.characters.forEach(char => {
      console.log(`  - ${char.name}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при сокращении имен:', error);
  }
}

shortenCharacterNames();






