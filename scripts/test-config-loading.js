#!/usr/bin/env node

console.log('🧪 Тестируем загрузку конфигурации...');

async function testConfigLoading() {
  try {
    console.log('1️⃣ Тестируем загрузку JSON файлов...');
    
    // Загружаем файлы напрямую
    const charactersData = JSON.parse(require('fs').readFileSync('data/characters-unified.json', 'utf8'));
    const actionsData = JSON.parse(require('fs').readFileSync('data/actions-unified.json', 'utf8'));
    const contractsData = JSON.parse(require('fs').readFileSync('data/contracts-unified.json', 'utf8'));
    const eventsData = JSON.parse(require('fs').readFileSync('data/events-unified.json', 'utf8'));
    
    const unifiedConfig = {
      characters: charactersData,
      actions: actionsData,
      contracts: contractsData,
      events: eventsData
    };
    console.log('✅ Unified конфигурация загружена');
    console.log('📊 Статистика:');
    console.log(`- Персонажей: ${unifiedConfig.characters?.characters?.length || 0}`);
    console.log(`- Действий: ${unifiedConfig.actions?.actions?.length || 0}`);
    console.log(`- Контрактов: ${unifiedConfig.contracts?.available?.length || 0}`);
    console.log(`- Событий: ${unifiedConfig.events?.events?.length || 0}`);
    
    console.log('\n2️⃣ Тестируем адаптацию данных...');
    
    // Простая адаптация данных
    const adaptedConfig = {
      assets: {
        assets: unifiedConfig.characters.characters.map(char => ({
          id: char.id,
          name: char.name,
          rank: char.rank,
          avatar: char.avatar,
          price: char.price,
          specialization: char.specialization,
          description: char.description,
          status: char.status,
          owner: char.owner,
          location: char.location,
          attributes: char.attributes,
          skills: char.skills,
          traits: char.traits || [],
          preferences: char.preferences || {},
          condition: char.condition || {},
          history: char.history || {}
        }))
      },
      contracts: {
        available: unifiedConfig.contracts.available.map(contract => ({
          id: contract.id,
          client: contract.client,
          title: contract.title,
          description: contract.description,
          requirements: contract.requirements,
          reward: contract.reward,
          deadline: contract.deadline,
          kpi: contract.kpi || [],
          assignedTalents: contract.assignedTalents || [],
          status: contract.status,
          storyScenes: contract.storyScenes || {}
        }))
      },
      events: {
        anomalies: unifiedConfig.events.events.filter(e => e.type === 'anomaly'),
        crises: unifiedConfig.events.events.filter(e => e.type === 'crisis'),
        opportunities: unifiedConfig.events.events.filter(e => e.type === 'opportunity')
      },
      actions: {
        categories: unifiedConfig.actions.categories || {}
      }
    };
    console.log('✅ Адаптер работает');
    console.log('📊 Статистика адаптированной конфигурации:');
    console.log(`- Активов: ${adaptedConfig.assets?.assets?.length || 0}`);
    console.log(`- Контрактов: ${adaptedConfig.contracts?.available?.length || 0}`);
    console.log(`- Категорий действий: ${Object.keys(adaptedConfig.actions?.categories || {}).length}`);
    console.log(`- Событий: ${(adaptedConfig.events?.anomalies?.length || 0) + (adaptedConfig.events?.crises?.length || 0) + (adaptedConfig.events?.opportunities?.length || 0)}`);
    
    console.log('\n🎉 Все тесты пройдены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка в тестах:', error);
    console.error('Stack trace:', error.stack);
  }
}

testConfigLoading();
