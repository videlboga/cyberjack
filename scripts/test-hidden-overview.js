#!/usr/bin/env node

// ===== ТЕСТИРОВАНИЕ СКРЫТИЯ ЭЛЕМЕНТОВ ОБЗОРА =====

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, '../data/characters-unified.json');
const SYSTEM_CONFIG_FILE = path.join(__dirname, '../data/system-unified.json');

function testHiddenOverview() {
  console.log('🧪 Тестирование скрытия элементов обзора...\n');

  try {
    // Загружаем данные
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
    const systemConfig = JSON.parse(fs.readFileSync(SYSTEM_CONFIG_FILE, 'utf8'));

    // Тестируем первого персонажа
    const firstCharacter = charactersData.characters[0];
    console.log(`👤 Тестируем персонажа: ${firstCharacter.name}\n`);

    // Проверяем настроение
    console.log('🎭 Проверка настроения:');
    const mood = firstCharacter.states?.['Настроение'] || firstCharacter.states?.mood || 0;
    const moodKnowledge = firstCharacter.universalKnowledge?.states?.['Настроение'] || firstCharacter.universalKnowledge?.states?.mood;
    const moodLevel = moodKnowledge?.level || 'unknown';
    const shouldShowMood = moodLevel !== 'unknown';

    console.log(`  Настроение: ${mood}%`);
    console.log(`  Уровень знания: ${moodLevel}`);
    console.log(`  Должно показываться: ${shouldShowMood}`);
    console.log(`  Отображаемое значение: ${shouldShowMood ? `${mood}%` : '❓'}\n`);

    // Проверяем топ характеристики
    console.log('📊 Проверка топ характеристик:');
    const attrs = systemConfig.attributes || [];
    const physicalAttrs = attrs.filter(a => a.category === 'physical');

    physicalAttrs.forEach(attr => {
      const value = firstCharacter.characteristics?.physical?.[attr.name] || 0;
      const knowledge = firstCharacter.universalKnowledge?.attributes?.physical?.[attr.id];
      const level = knowledge?.level || 'unknown';
      const shouldShow = level !== 'unknown' && value > 0;

      console.log(`  ${attr.name}: значение=${value}, уровень="${level}", показывать=${shouldShow}`);
    });

    console.log('\n');

    // Проверяем топ чувствительности
    console.log('🎯 Проверка топ чувствительностей:');
    const extraAttrs = systemConfig.attributes_extra || [];
    const sensitivityAttrs = extraAttrs.filter(a => a.category === 'special');

    sensitivityAttrs.slice(0, 3).forEach(attr => { // Проверяем первые 3 для краткости
      const value = firstCharacter.characteristics?.special?.[attr.name] || 0;
      const knowledge = firstCharacter.universalKnowledge?.attributes?.special?.[attr.id];
      const level = knowledge?.level || 'unknown';
      const shouldShow = level !== 'unknown' && value > 0;

      console.log(`  ${attr.name}: значение=${value}, уровень="${level}", показывать=${shouldShow}`);
    });

    console.log('\n✅ Тестирование завершено!');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

// Запускаем тест
testHiddenOverview();
