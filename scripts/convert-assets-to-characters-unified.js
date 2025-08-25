const fs = require('fs');
const path = require('path');

function convertAssetsToCharactersUnified() {
  try {
    // Загружаем активы
    const assetsPath = path.join(__dirname, '../data/assets.json');
    const assetsData = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
    
    // Преобразуем активы в формат characters-unified
    const characters = assetsData.assets.map(asset => {
      // Преобразуем плоские атрибуты в структурированные характеристики
      const characteristics = {
        physical: {
          endurance: asset.attributes.endurance || 0,
          sensitivity: asset.attributes.sensitivity || 0,
          flexibility: asset.attributes.flexibility || 0
        },
        psychological: {
          emotionalStability: asset.attributes.emotional_stability || 0,
          adaptability: asset.attributes.adaptability || 0,
          intelligence: asset.attributes.intelligence || 0
        },
        social: {
          sociability: asset.attributes.sociability || 0,
          empathy: asset.attributes.empathy || 0,
          dominance: asset.attributes.dominance || 0
        },
        personality: {
          selfEsteem: asset.attributes.self_esteem || 0,
          optimism: asset.attributes.optimism || 0,
          curiosity: asset.attributes.curiosity || 0
        },
        special: {
          sexualExperience: asset.attributes.sexual_experience || 0,
          resistance: asset.attributes.resistance || 0,
          dependency: asset.attributes.dependency || 0
        }
      };
      
      // Преобразуем состояния
      const states = {
        mood: asset.condition.mood || 75,
        anxiety: asset.condition.anxiety || 25,
        burnout: asset.condition.burnout || 20,
        engagement: asset.condition.engagement || 80,
        entitlement: asset.condition.entitlement || 30,
        insight: asset.condition.insight || 70,
        routine: asset.condition.routine || 50,
        compliance: asset.condition.compliance || 60,
        neuroplasticity: asset.condition.neuroplasticity || 80,
        cognitiveLoad: asset.condition.cognitiveLoad || 40
      };
      
      return {
        id: asset.id,
        name: asset.name,
        age: asset.metadata?.age || 18,
        archetype: asset.metadata?.archetype || 'unknown',
        description: asset.description,
        dateTransformation: asset.metadata?.dateTransformation || '2024-01-01',
        category: asset.metadata?.category || 'Unknown',
        characteristics,
        states,
        fetishes: asset.fetishes || {},
        traits: asset.traits || [],
        preferences: asset.preferences || {},
        skills: asset.skills || {},
        rank: asset.rank,
        price: asset.price,
        specialization: asset.specialization,
        status: asset.status,
        owner: asset.owner,
        location: asset.location,
        avatar: asset.avatar,
        deleted: asset.deleted || false,
        deletedAt: asset.deletedAt || null
      };
    });
    
    // Создаем структуру characters-unified
    const charactersUnified = {
      characters,
      templates: {},
      config: {
        skillCategories: {
          maid: { name: 'Горничная', description: 'Навыки обслуживания' },
          cooking: { name: 'Кулинария', description: 'Приготовление пищи' },
          neural_hacking: { name: 'Нейрохакерство', description: 'Взлом нейроинтерфейсов' },
          orgasm_control: { name: 'Контроль оргазма', description: 'Управление оргазмом' },
          field: { name: 'Полевые работы', description: 'Работа в полевых условиях' },
          etiquette: { name: 'Этикет', description: 'Правила поведения' },
          logistics: { name: 'Логистика', description: 'Управление ресурсами' },
          medical: { name: 'Медицина', description: 'Медицинские навыки' },
          maintenance: { name: 'Техобслуживание', description: 'Ремонт оборудования' },
          data: { name: 'Работа с данными', description: 'Обработка информации' },
          dance: { name: 'Танцы', description: 'Хореографические навыки' },
          seduction: { name: 'Соблазнение', description: 'Искусство соблазнения' },
          interrogation: { name: 'Допрос', description: 'Техники допроса' },
          surveillance: { name: 'Наблюдение', description: 'Слежка и наблюдение' }
        }
      }
    };
    
    // Сохраняем в characters-unified.json
    const outputPath = path.join(__dirname, '../data/characters-unified.json');
    fs.writeFileSync(outputPath, JSON.stringify(charactersUnified, null, 2), 'utf8');
    
    console.log(`✅ Успешно преобразовано ${characters.length} персонажей в characters-unified.json`);
    console.log(`📁 Файл сохранен: ${outputPath}`);
    
    // Показываем пример первого персонажа
    if (characters.length > 0) {
      console.log('\n📊 Пример первого персонажа:');
      console.log(`- Имя: ${characters[0].name}`);
      console.log(`- Архетип: ${characters[0].archetype}`);
      console.log(`- Характеристики: ${Object.keys(characters[0].characteristics.physical).length} физических, ${Object.keys(characters[0].characteristics.psychological).length} психологических`);
      console.log(`- Состояния: ${Object.keys(characters[0].states).length} состояний`);
      console.log(`- Фетиши: ${Object.keys(characters[0].fetishes).length} фетишей`);
      console.log(`- Черты: ${characters[0].traits.length} черт`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при преобразовании:', error);
  }
}

// Запуск преобразования
if (require.main === module) {
  convertAssetsToCharactersUnified();
}

module.exports = { convertAssetsToCharactersUnified };


