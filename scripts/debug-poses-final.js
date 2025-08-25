// Финальный диагностический скрипт для проверки исправлений дублирования поз
const fs = require('fs');
const path = require('path');

// Функция для проверки исправлений в файлах
function checkFixes() {
  console.log('🔍 Проверка исправлений дублирования поз...\n');
  
  // Проверяем useCharacterAI.ts
  const useCharacterAIPath = path.join(__dirname, '../app/prod/hooks/useCharacterAI.ts');
  const useCharacterAIContent = fs.readFileSync(useCharacterAIPath, 'utf8');
  
  console.log('📄 app/prod/hooks/useCharacterAI.ts:');
  const hasPoseManagementUpdate = useCharacterAIContent.includes('setPoseManagementService');
  const hasUseEffectUpdate = useCharacterAIContent.includes('new PoseManagementService');
  console.log(`   ✅ Обновление PoseManagementService: ${hasPoseManagementUpdate ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ useEffect для обновления: ${hasUseEffectUpdate ? 'ДА' : 'НЕТ'}`);
  
  // Проверяем ActionToolPanel.tsx
  const actionToolPanelPath = path.join(__dirname, '../app/prod/components/ActionToolPanel.tsx');
  const actionToolPanelContent = fs.readFileSync(actionToolPanelPath, 'utf8');
  
  console.log('\n📄 app/prod/components/ActionToolPanel.tsx:');
  const hasPoseManagementServiceUsage = actionToolPanelContent.includes('poseManagementService');
  const hasPosesSourceCheck = actionToolPanelContent.includes('posesSource');
  console.log(`   ✅ Использование poseManagementService: ${hasPoseManagementServiceUsage ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ Проверка источника поз: ${hasPosesSourceCheck ? 'ДА' : 'НЕТ'}`);
  
  // Проверяем pose-management-service.ts
  const poseManagementServicePath = path.join(__dirname, '../lib/character/pose-management-service.ts');
  const poseManagementServiceContent = fs.readFileSync(poseManagementServicePath, 'utf8');
  
  console.log('\n📄 lib/character/pose-management-service.ts:');
  const hasDuplicateCheck = poseManagementServiceContent.includes('дублирование ID поз');
  const hasNameDuplicateCheck = poseManagementServiceContent.includes('дублирование имен поз');
  const hasInitLog = poseManagementServiceContent.includes('PoseManagementService инициализирован');
  console.log(`   ✅ Проверка дублирования ID: ${hasDuplicateCheck ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ Проверка дублирования имен: ${hasNameDuplicateCheck ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ Логирование инициализации: ${hasInitLog ? 'ДА' : 'НЕТ'}`);
  
  return {
    useCharacterAI: hasPoseManagementUpdate && hasUseEffectUpdate,
    actionToolPanel: hasPoseManagementServiceUsage && hasPosesSourceCheck,
    poseManagementService: hasDuplicateCheck && hasNameDuplicateCheck && hasInitLog
  };
}

// Функция для проверки конфигурации
function checkConfiguration() {
  console.log('\n🔍 Проверка конфигурации поз...');
  
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
  
  const hasIdDuplicates = uniqueIds.size !== poseIds.length;
  const hasNameDuplicates = uniqueNames.size !== poseNames.length;
  
  console.log(`   Дублирование ID: ${hasIdDuplicates ? 'ОБНАРУЖЕНО' : 'НЕТ'}`);
  console.log(`   Дублирование имен: ${hasNameDuplicates ? 'ОБНАРУЖЕНО' : 'НЕТ'}`);
  
  if (hasIdDuplicates) {
    const duplicates = poseIds.filter((id, index) => poseIds.indexOf(id) !== index);
    console.log(`   Дублирующиеся ID: ${duplicates.join(', ')}`);
  }
  
  if (hasNameDuplicates) {
    const duplicates = poseNames.filter((name, index) => poseNames.indexOf(name) !== index);
    console.log(`   Дублирующиеся имена: ${duplicates.join(', ')}`);
  }
  
  return {
    totalPoses: poseIds.length,
    hasIdDuplicates,
    hasNameDuplicates
  };
}

// Функция для генерации отчета
function generateReport() {
  console.log('🎭 Отчет по исправлению дублирования поз\n');
  
  const fixes = checkFixes();
  const config = checkConfiguration();
  
  console.log('\n📊 Итоговый отчет:');
  console.log(`   ✅ useCharacterAI исправлен: ${fixes.useCharacterAI ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ ActionToolPanel исправлен: ${fixes.actionToolPanel ? 'ДА' : 'НЕТ'}`);
  console.log(`   ✅ PoseManagementService исправлен: ${fixes.poseManagementService ? 'ДА' : 'НЕТ'}`);
  console.log(`   📊 Поз в конфигурации: ${config.totalPoses}`);
  console.log(`   ⚠️  Дублирование в конфигурации: ${config.hasIdDuplicates || config.hasNameDuplicates ? 'ДА' : 'НЕТ'}`);
  
  const allFixesApplied = fixes.useCharacterAI && fixes.actionToolPanel && fixes.poseManagementService;
  const configClean = !config.hasIdDuplicates && !config.hasNameDuplicates;
  
  console.log(`\n🎯 Статус исправления: ${allFixesApplied && configClean ? 'ПОЛНОСТЬЮ ИСПРАВЛЕНО' : 'ТРЕБУЕТ ДОРАБОТКИ'}`);
  
  if (!allFixesApplied) {
    console.log('\n❌ Не применены исправления:');
    if (!fixes.useCharacterAI) console.log('   - useCharacterAI.ts');
    if (!fixes.actionToolPanel) console.log('   - ActionToolPanel.tsx');
    if (!fixes.poseManagementService) console.log('   - pose-management-service.ts');
  }
  
  if (!configClean) {
    console.log('\n❌ Проблемы в конфигурации:');
    if (config.hasIdDuplicates) console.log('   - Дублирование ID поз');
    if (config.hasNameDuplicates) console.log('   - Дублирование имен поз');
  }
  
  if (allFixesApplied && configClean) {
    console.log('\n✅ Все исправления применены! Дублирование поз должно быть устранено.');
  }
}

// Запускаем отчет
generateReport();



