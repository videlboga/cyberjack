// Финальная проверка устранения дублирования поз
const fs = require('fs');
const path = require('path');

// Функция для проверки исправлений
function checkFixes() {
  console.log('🔍 Финальная проверка исправлений дублирования поз...\n');
  
  // Проверяем app/page.tsx
  const pageContent = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
  const hasPoseDisplay = pageContent.includes('Object.entries(characterAIConfig.poses || {}).slice(0, 8).map');
  const hasPoseLinks = pageContent.includes('Управление позами в игре');
  
  console.log('📄 app/page.tsx:');
  console.log(`   ❌ Старое отображение поз: ${hasPoseDisplay ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ Ссылки на игровые режимы: ${hasPoseLinks ? 'ДА' : 'НЕТ'}`);
  
  // Проверяем ActionToolPanel.tsx
  const actionToolPanelContent = fs.readFileSync(path.join(__dirname, '../app/prod/components/ActionToolPanel.tsx'), 'utf8');
  const hasPoseManagementService = actionToolPanelContent.includes('poseManagementService');
  const hasPoseMap = actionToolPanelContent.includes('poses.map((pose: any) =>');
  
  console.log('\n📄 app/prod/components/ActionToolPanel.tsx:');
  console.log(`   ✅ Использование poseManagementService: ${hasPoseManagementService ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ Отображение поз в одной вкладке: ${hasPoseMap ? 'ДА' : 'НЕТ'}`);
  
  // Проверяем useCharacterAI.ts
  const useCharacterAIContent = fs.readFileSync(path.join(__dirname, '../app/prod/hooks/useCharacterAI.ts'), 'utf8');
  const hasPoseManagementUpdate = useCharacterAIContent.includes('setPoseManagementService');
  const hasUseEffectUpdate = useCharacterAIContent.includes('new PoseManagementService');
  
  console.log('\n📄 app/prod/hooks/useCharacterAI.ts:');
  console.log(`   ✅ Обновление PoseManagementService: ${hasPoseManagementUpdate ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ useEffect для обновления: ${hasUseEffectUpdate ? 'ДА' : 'НЕТ'}`);
  
  // Проверяем pose-management-service.ts
  const poseManagementServiceContent = fs.readFileSync(path.join(__dirname, '../lib/character/pose-management-service.ts'), 'utf8');
  const hasDuplicateCheck = poseManagementServiceContent.includes('дублирование ID поз');
  const hasInitLog = poseManagementServiceContent.includes('PoseManagementService инициализирован');
  
  console.log('\n📄 lib/character/pose-management-service.ts:');
  console.log(`   ✅ Проверка дублирования: ${hasDuplicateCheck ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ Логирование инициализации: ${hasInitLog ? 'ДА' : 'НЕТ'}`);
  
  return {
    pageFixed: !hasPoseDisplay && hasPoseLinks,
    actionToolPanelFixed: hasPoseManagementService && hasPoseMap,
    useCharacterAIFixed: hasPoseManagementUpdate && hasUseEffectUpdate,
    poseManagementServiceFixed: hasDuplicateCheck && hasInitLog
  };
}

// Функция для проверки конфигурации
function checkConfiguration() {
  console.log('\n🔍 Проверка конфигурации...');
  
  const gameConfigPath = path.join(__dirname, '../data/game-config-unified.json');
  const gameConfig = JSON.parse(fs.readFileSync(gameConfigPath, 'utf8'));
  
  const poses = gameConfig.characterAI?.poses || {};
  const poseIds = Object.keys(poses);
  const poseNames = Object.values(poses).map(pose => pose.name);
  
  console.log(`   Всего поз в конфигурации: ${poseIds.length}`);
  console.log(`   ID поз: ${poseIds.join(', ')}`);
  
  // Проверяем на дублирование
  const uniqueIds = new Set(poseIds);
  const uniqueNames = new Set(poseNames);
  
  const hasIdDuplicates = uniqueIds.size !== poseIds.length;
  const hasNameDuplicates = uniqueNames.size !== poseNames.length;
  
  console.log(`   Дублирование ID: ${hasIdDuplicates ? 'ОБНАРУЖЕНО' : 'НЕТ'}`);
  console.log(`   Дублирование имен: ${hasNameDuplicates ? 'ОБНАРУЖЕНО' : 'НЕТ'}`);
  
  return {
    totalPoses: poseIds.length,
    hasIdDuplicates,
    hasNameDuplicates
  };
}

// Функция для проверки отображения поз
function checkPoseDisplay() {
  console.log('\n🔍 Проверка отображения поз...');
  
  const filesToCheck = [
    '../app/page.tsx',
    '../app/game/page.tsx',
    '../app/prod/page.tsx',
    '../app/prod/components/ActionToolPanel.tsx'
  ];
  
  const results = [];
  
  for (const filePath of filesToCheck) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const poseMapMatches = content.match(/poses\.map\(/g);
      const objectValuesMatches = content.match(/Object\.values\(.*poses/g);
      const characterAIPosesMatches = content.match(/characterAI.*poses/g);
      
      if (poseMapMatches || objectValuesMatches || characterAIPosesMatches) {
        console.log(`📄 ${filePath}:`);
        console.log(`   poses.map(): ${poseMapMatches ? poseMapMatches.length : 0}`);
        console.log(`   Object.values(poses): ${objectValuesMatches ? objectValuesMatches.length : 0}`);
        console.log(`   characterAI.poses: ${characterAIPosesMatches ? characterAIPosesMatches.length : 0}`);
        
        results.push({
          file: filePath,
          poseMapCount: poseMapMatches ? poseMapMatches.length : 0,
          objectValuesCount: objectValuesMatches ? objectValuesMatches.length : 0,
          characterAICount: characterAIPosesMatches ? characterAIPosesMatches.length : 0
        });
      }
    }
  }
  
  return results;
}

// Основная функция
function finalCheck() {
  console.log('🎭 Финальная проверка устранения дублирования поз\n');
  
  const fixes = checkFixes();
  const config = checkConfiguration();
  const poseDisplays = checkPoseDisplay();
  
  // Итоговый анализ
  console.log('\n📊 Итоговый анализ:');
  console.log(`   ✅ Основная страница исправлена: ${fixes.pageFixed ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ ActionToolPanel исправлен: ${fixes.actionToolPanelFixed ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ useCharacterAI исправлен: ${fixes.useCharacterAIFixed ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ PoseManagementService исправлен: ${fixes.poseManagementServiceFixed ? 'ДА' : 'НЕТ'}`);
  console.log(`   📊 Поз в конфигурации: ${config.totalPoses}`);
  console.log(`   ⚠️  Дублирование в конфигурации: ${config.hasIdDuplicates || config.hasNameDuplicates ? 'ДА' : 'НЕТ'}`);
  
  const totalPoseDisplays = poseDisplays.reduce((sum, p) => 
    sum + p.poseMapCount + p.objectValuesCount + p.characterAICount, 0
  );
  
  console.log(`   📊 Общее количество отображений поз: ${totalPoseDisplays}`);
  
  const allFixesApplied = fixes.pageFixed && fixes.actionToolPanelFixed && 
                         fixes.useCharacterAIFixed && fixes.poseManagementServiceFixed;
  const configClean = !config.hasIdDuplicates && !config.hasNameDuplicates;
  const reasonableDisplays = totalPoseDisplays <= 3; // Допустимо: game, prod, ActionToolPanel
  
  console.log(`\n🎯 Статус исправления: ${allFixesApplied && configClean && reasonableDisplays ? 'ПОЛНОСТЬЮ ИСПРАВЛЕНО' : 'ТРЕБУЕТ ДОРАБОТКИ'}`);
  
  if (allFixesApplied && configClean && reasonableDisplays) {
    console.log('\n✅ Дублирование поз устранено!');
    console.log('   - Основная страница больше не отображает позы');
    console.log('   - Позы отображаются только в игровых режимах');
    console.log('   - Используется единый источник данных через PoseManagementService');
    console.log('   - Добавлены проверки на дублирование');
  } else {
    console.log('\n❌ Требуется доработка:');
    if (!fixes.pageFixed) console.log('   - Исправить основную страницу');
    if (!fixes.actionToolPanelFixed) console.log('   - Исправить ActionToolPanel');
    if (!fixes.useCharacterAIFixed) console.log('   - Исправить useCharacterAI');
    if (!fixes.poseManagementServiceFixed) console.log('   - Исправить PoseManagementService');
    if (!configClean) console.log('   - Исправить дублирование в конфигурации');
    if (!reasonableDisplays) console.log('   - Слишком много мест отображения поз');
  }
}

// Запускаем проверку
finalCheck();






