#!/usr/bin/env node

// ===== ТЕСТИРОВАНИЕ СКРЫТИЯ АТРИБУТОВ В ИНТЕРФЕЙСЕ =====

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, '../data/characters-unified.json');
const SYSTEM_CONFIG_FILE = path.join(__dirname, '../data/system-unified.json');

function testHiddenAttributesUI() {
  console.log('🧪 Тестирование скрытия атрибутов в интерфейсе...\n');

  try {
    // Загружаем данные
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
    const systemConfig = JSON.parse(fs.readFileSync(SYSTEM_CONFIG_FILE, 'utf8'));

    // Тестируем первого персонажа
    const firstCharacter = charactersData.characters[0];
    console.log(`👤 Тестируем персонажа: ${firstCharacter.name}\n`);

    // Проверяем наличие универсальных знаний
    if (!firstCharacter.universalKnowledge) {
      console.log('❌ Ошибка: universalKnowledge отсутствует!');
      return;
    }

    console.log('✅ universalKnowledge присутствует\n');

    // Тестируем скрытие атрибутов
    console.log('🔍 Проверка скрытия атрибутов:');
    const attrs = systemConfig.attributes || [];
    const attrCategories = ['physical', 'psychological', 'social', 'personality', 'special'];

    attrCategories.forEach(category => {
      console.log(`\n📊 Категория: ${category}`);
      const categoryAttrs = attrs.filter(a => a.category === category);

      categoryAttrs.forEach(attr => {
        const knowledge = firstCharacter.universalKnowledge?.attributes?.[category]?.[attr.id];
        const actualValue = firstCharacter.characteristics?.[category]?.[attr.name] || 0;

        if (knowledge) {
          const level = knowledge.level;
          const shouldShow = level !== 'unknown';
          const icon = shouldShow ? '👁️' : '❓';
          console.log(`  ${icon} ${attr.name}: уровень "${level}", показывать: ${shouldShow}, реальное значение: ${actualValue}`);
        } else {
          console.log(`  ❌ ${attr.name}: знания отсутствуют`);
        }
      });
    });

    // Тестируем скрытие фетишей
    console.log('\n🫦 Проверка скрытия фетишей:');
    const fetishes = systemConfig.fetishes || [];
    const fetishCategories = ['bdsm', 'psychological', 'sensory', 'body_parts'];

    fetishCategories.forEach(category => {
      console.log(`\n📊 Категория фетишей: ${category}`);
      const categoryFetishes = fetishes.filter(f => f.category === category);

      categoryFetishes.slice(0, 3).forEach(fetish => { // Проверяем первые 3 для краткости
        const knowledge = firstCharacter.universalKnowledge?.fetishes?.[category]?.[fetish.id];
        const actualValue = firstCharacter.fetishes?.[fetish.id] || 0;

        if (knowledge) {
          const level = knowledge.level;
          const shouldShow = level !== 'unknown';
          const icon = shouldShow ? '👁️' : '❓';
          console.log(`  ${icon} ${fetish.name}: уровень "${level}", показывать: ${shouldShow}, реальное значение: ${actualValue}`);
        } else {
          console.log(`  ❌ ${fetish.name}: знания отсутствуют`);
        }
      });
    });

    console.log('\n✅ Тестирование завершено!');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

// Запускаем тест
testHiddenAttributesUI();
