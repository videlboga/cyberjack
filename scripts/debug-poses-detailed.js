// Детальный диагностический скрипт для поиска всех источников дублирования поз
const fs = require('fs');
const path = require('path');

// Функция для поиска всех мест, где отображаются позы
function findAllPoseDisplays() {
  console.log('🔍 Поиск всех мест отображения поз...\n');
  
  const componentsDir = path.join(__dirname, '../app/prod/components');
  const files = fs.readdirSync(componentsDir).filter(file => file.endsWith('.tsx'));
  
  const poseDisplays = [];
  
  for (const file of files) {
    const filePath = path.join(componentsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Ищем все места, где отображаются позы
    const poseMapMatches = content.match(/poses\.map\(/g);
    const objectValuesMatches = content.match(/Object\.values\(.*poses/g);
    const characterAIPosesMatches = content.match(/characterAI.*poses/g);
    const availablePosesMatches = content.match(/availablePoses/g);
    
    if (poseMapMatches || objectValuesMatches || characterAIPosesMatches || availablePosesMatches) {
      console.log(`📄 ${file}:`);
      console.log(`   poses.map(): ${poseMapMatches ? poseMapMatches.length : 0}`);
      console.log(`   Object.values(poses): ${objectValuesMatches ? objectValuesMatches.length : 0}`);
      console.log(`   characterAI.poses: ${characterAIPosesMatches ? characterAIPosesMatches.length : 0}`);
      console.log(`   availablePoses: ${availablePosesMatches ? availablePosesMatches.length : 0}`);
      
      // Ищем конкретные строки
      const lines = content.split('\n');
      const poseDisplayLines = lines.filter((line, index) => {
        return line.includes('poses') && (
          line.includes('map') || 
          line.includes('Object.values') || 
          line.includes('characterAI') ||
          line.includes('availablePoses')
        );
      });
      
      if (poseDisplayLines.length > 0) {
        console.log(`   Строки отображения:`);
        poseDisplayLines.forEach((line, index) => {
          console.log(`     ${index + 1}: ${line.trim()}`);
        });
      }
      
      poseDisplays.push({
        file,
        poseMapCount: poseMapMatches ? poseMapMatches.length : 0,
        objectValuesCount: objectValuesMatches ? objectValuesMatches.length : 0,
        characterAICount: characterAIPosesMatches ? characterAIPosesMatches.length : 0,
        availablePosesCount: availablePosesMatches ? availablePosesMatches.length : 0,
        totalLines: poseDisplayLines.length
      });
    }
  }
  
  return poseDisplays;
}

// Функция для проверки дублирования в конфигурации
function checkConfigDuplication() {
  console.log('\n🔍 Проверка дублирования в конфигурации...');
  
  const gameConfigPath = path.join(__dirname, '../data/game-config-unified.json');
  const gameConfig = JSON.parse(fs.readFileSync(gameConfigPath, 'utf8'));
  
  const poses = gameConfig.characterAI?.poses || {};
  const poseIds = Object.keys(poses);
  const poseNames = Object.values(poses).map(pose => pose.name);
  
  console.log(`   Всего поз в конфигурации: ${poseIds.length}`);
  console.log(`   ID поз: ${poseIds.join(', ')}`);
  console.log(`   Имена поз: ${poseNames.join(', ')}`);
  
  // Проверяем на дублирование
  const uniqueIds = new Set(poseIds);
  const uniqueNames = new Set(poseNames);
  
  if (uniqueIds.size !== poseIds.length) {
    console.log(`   ⚠️  ДУБЛИРОВАНИЕ ID!`);
    const duplicates = poseIds.filter((id, index) => poseIds.indexOf(id) !== index);
    console.log(`   Дублирующиеся ID: ${duplicates.join(', ')}`);
  }
  
  if (uniqueNames.size !== poseNames.length) {
    console.log(`   ⚠️  ДУБЛИРОВАНИЕ ИМЕН!`);
    const duplicates = poseNames.filter((name, index) => poseNames.indexOf(name) !== index);
    console.log(`   Дублирующиеся имена: ${duplicates.join(', ')}`);
  }
  
  return {
    totalPoses: poseIds.length,
    hasIdDuplicates: uniqueIds.size !== poseIds.length,
    hasNameDuplicates: uniqueNames.size !== poseNames.length
  };
}

// Функция для проверки дублирования в других файлах
function checkOtherFiles() {
  console.log('\n🔍 Проверка других файлов на предмет поз...');
  
  const filesToCheck = [
    '../app/page.tsx',
    '../app/game/page.tsx',
    '../app/prod/page.tsx',
    '../lib/character/character-ai-config.ts'
  ];
  
  const results = [];
  
  for (const filePath of filesToCheck) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const poseMatches = content.match(/poses/g);
      const characterAIMatches = content.match(/characterAI/g);
      
      if (poseMatches || characterAIMatches) {
        console.log(`📄 ${filePath}:`);
        console.log(`   Упоминания "poses": ${poseMatches ? poseMatches.length : 0}`);
        console.log(`   Упоминания "characterAI": ${characterAIMatches ? characterAIMatches.length : 0}`);
        
        // Ищем строки с позами
        const lines = content.split('\n');
        const poseLines = lines.filter(line => line.includes('poses'));
        
        if (poseLines.length > 0) {
          console.log(`   Строки с позами:`);
          poseLines.slice(0, 5).forEach((line, index) => {
            console.log(`     ${index + 1}: ${line.trim()}`);
          });
          if (poseLines.length > 5) {
            console.log(`     ... и ещё ${poseLines.length - 5} строк`);
          }
        }
        
        results.push({
          file: filePath,
          poseCount: poseMatches ? poseMatches.length : 0,
          characterAICount: characterAIMatches ? characterAIMatches.length : 0,
          poseLines: poseLines.length
        });
      }
    }
  }
  
  return results;
}

// Функция для анализа возможных причин дублирования
function analyzeDuplicationCauses() {
  console.log('\n🔍 Анализ возможных причин дублирования...');
  
  // Проверяем, есть ли несколько компонентов, которые отображаются одновременно
  const pageContent = fs.readFileSync(path.join(__dirname, '../app/prod/page.tsx'), 'utf8');
  
  const actionToolPanelUsage = pageContent.match(/ActionToolPanel/g);
  const poseDisplayUsage = pageContent.match(/PoseDisplay/g);
  const quickActionPanelUsage = pageContent.match(/QuickActionPanel/g);
  
  console.log(`   ActionToolPanel используется: ${actionToolPanelUsage ? actionToolPanelUsage.length : 0} раз`);
  console.log(`   PoseDisplay используется: ${poseDisplayUsage ? poseDisplayUsage.length : 0} раз`);
  console.log(`   QuickActionPanel используется: ${quickActionPanelUsage ? quickActionPanelUsage.length : 0} раз`);
  
  // Проверяем, есть ли условное отображение
  const conditionalRenders = pageContent.match(/show.*Panel/g);
  if (conditionalRenders) {
    console.log(`   Условное отображение панелей: ${conditionalRenders.length} раз`);
    conditionalRenders.forEach(render => {
      console.log(`     - ${render}`);
    });
  }
  
  // Проверяем, есть ли множественные источники данных
  const dataSources = [
    'characterAIConfig?.poses',
    'characterAI?.characterAIConfig?.poses',
    'poseManagementService',
    'availablePoses'
  ];
  
  console.log('\n   Источники данных поз:');
  dataSources.forEach(source => {
    const matches = pageContent.match(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    console.log(`     ${source}: ${matches ? matches.length : 0} упоминаний`);
  });
}

// Основная функция
function detailedAnalysis() {
  console.log('🎭 Детальный анализ дублирования поз\n');
  
  const poseDisplays = findAllPoseDisplays();
  const configCheck = checkConfigDuplication();
  const otherFiles = checkOtherFiles();
  
  analyzeDuplicationCauses();
  
  // Итоговый анализ
  console.log('\n📊 Итоговый анализ:');
  console.log(`   Компонентов с отображением поз: ${poseDisplays.length}`);
  console.log(`   Файлов с упоминанием поз: ${otherFiles.length}`);
  console.log(`   Поз в конфигурации: ${configCheck.totalPoses}`);
  
  const totalPoseReferences = poseDisplays.reduce((sum, p) => 
    sum + p.poseMapCount + p.objectValuesCount + p.characterAICount + p.availablePosesCount, 0
  );
  
  console.log(`   Общее количество отображений поз: ${totalPoseReferences}`);
  
  if (totalPoseReferences > 5) {
    console.log(`   ⚠️  МНОГО ОТОБРАЖЕНИЙ ПОЗ - ВОЗМОЖНО ДУБЛИРОВАНИЕ!`);
  }
  
  if (configCheck.hasIdDuplicates || configCheck.hasNameDuplicates) {
    console.log(`   ⚠️  ДУБЛИРОВАНИЕ В КОНФИГУРАЦИИ!`);
  }
  
  // Рекомендации
  console.log('\n💡 Рекомендации:');
  if (poseDisplays.length > 1) {
    console.log('   - Проверьте, не отображаются ли несколько компонентов с позами одновременно');
  }
  if (totalPoseReferences > 5) {
    console.log('   - Упростите отображение поз, используйте единый источник данных');
  }
  if (configCheck.hasIdDuplicates || configCheck.hasNameDuplicates) {
    console.log('   - Исправьте дублирование в конфигурации');
  }
}

// Запускаем анализ
detailedAnalysis();




