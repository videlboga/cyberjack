#!/usr/bin/env tsx

/**
 * Скрипт для миграции и оптимизации данных
 * Объединяет дублирующиеся файлы и создает унифицированную структуру
 */

import { 
  performFullMigration, 
  mergeCharacterData, 
  mergeActionsData, 
  mergeEventsData,
  saveMergedData,
  validateMergedData 
} from '../lib/migration-utils'
import { UnifiedGameConfig } from '../lib/unified-types'

async function main() {
  console.log('🚀 Запуск миграции данных...')
  console.log('=' * 50)
  
  try {
    // Выполняем полную миграцию
    const migrationResult = await performFullMigration()
    
    if (!migrationResult.success) {
      console.error('❌ Миграция завершилась с ошибками:')
      migrationResult.errors?.forEach(error => console.error(`  - ${error}`))
      process.exit(1)
    }
    
    console.log('✅ Миграция выполнена успешно!')
    console.log('📊 Статистика:')
    
    const data = migrationResult.data as UnifiedGameConfig
    
    // Выводим статистику
    console.log(`  👥 Персонажи: ${data.characters?.characters?.length || 0}`)
    console.log(`  ⚡ Действия: ${data.actions?.actions?.length || 0}`)
    console.log(`  📅 События: ${data.events?.events?.length || 0}`)
    console.log(`  📋 Контракты: ${data.contracts?.contracts?.length || 0}`)
    console.log(`  🛠️ Оборудование: ${data.equipment?.equipment?.length || 0}`)
    console.log(`  📖 Сцены: ${data.storyScenes?.scenes?.length || 0}`)
    console.log(`  👤 Пользователи: ${data.users?.users?.length || 0}`)
    
    // Валидируем объединенные данные
    console.log('\n🔍 Валидация данных...')
    const validation = validateMergedData(data)
    
    if (!validation.isValid) {
      console.error('❌ Ошибки валидации:')
      validation.errors.forEach(error => console.error(`  - ${error}`))
      process.exit(1)
    }
    
    console.log('✅ Валидация пройдена успешно!')
    
    // Сохраняем объединенные данные
    console.log('\n💾 Сохранение объединенных данных...')
    
    const saveResults = await Promise.all([
      saveMergedData(data.characters, 'characters-unified.json'),
      saveMergedData(data.actions, 'actions-unified.json'),
      saveMergedData(data.events, 'events-unified.json'),
      saveMergedData(data.contracts, 'contracts-unified.json'),
      saveMergedData(data.equipment, 'equipment-unified.json'),
      saveMergedData(data.system, 'system-unified.json'),
      saveMergedData(data.storyScenes, 'story-scenes-unified.json'),
      saveMergedData(data.users, 'users-unified.json'),
      saveMergedData(data, 'game-config-unified.json')
    ])
    
    const failedSaves = saveResults.filter(result => !result.success)
    
    if (failedSaves.length > 0) {
      console.error('❌ Ошибки сохранения:')
      failedSaves.forEach(result => console.error(`  - ${result.message}`))
      process.exit(1)
    }
    
    console.log('✅ Все файлы сохранены успешно!')
    
    // Создаем отчет о миграции
    console.log('\n📋 Создание отчета о миграции...')
    await createMigrationReport(data, migrationResult)
    
    console.log('\n🎉 Миграция завершена успешно!')
    console.log('📁 Объединенные файлы сохранены в папке data/')
    console.log('📄 Отчет о миграции: MIGRATION_REPORT.md')
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
    process.exit(1)
  }
}

async function createMigrationReport(data: UnifiedGameConfig, migrationResult: any) {
  // Подготавливаем статистику по источникам персонажей
  const characterSources = data.characters?.characters?.reduce((acc, char) => {
    const source = char.metadata?.source || 'unknown'
    acc[source] = (acc[source] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}
  
  const sourcesList = Object.entries(characterSources)
    .map(([source, count]) => `  - ${source}: ${count}`)
    .join('\n')
  
  // Подготавливаем статистику по типам событий
  const eventTypes = data.events?.events?.reduce((acc, event) => {
    const type = event.type || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}
  
  const eventTypesList = Object.entries(eventTypes)
    .map(([type, count]) => `  - ${type}: ${count}`)
    .join('\n')
  
  const report = `# Отчет о миграции данных

## 📅 Дата миграции
${new Date().toLocaleString('ru-RU')}

## 📊 Статистика миграции

### Персонажи
- **Всего персонажей:** ${data.characters?.characters?.length || 0}
- **Источники:**
${sourcesList}

### Действия
- **Всего действий:** ${data.actions?.actions?.length || 0}
- **Категории:** ${Object.keys(data.actions?.categories || {}).length}

### События
- **Всего событий:** ${data.events?.events?.length || 0}
- **Типы событий:**
${eventTypesList}

### Контракты
- **Всего контрактов:** ${data.contracts?.contracts?.length || 0}

### Оборудование
- **Всего предметов:** ${data.equipment?.equipment?.length || 0}

### Сюжетные сцены
- **Всего сцен:** ${data.storyScenes?.scenes?.length || 0}

### Пользователи
- **Всего пользователей:** ${data.users?.users?.length || 0}

## 🔧 Выполненные оптимизации

### 1. Объединение дублирующихся файлов
- ✅ \`assets.json\` + \`market.json\` → \`characters-unified.json\`
- ✅ \`actions.json\` + \`actions-config.json\` → \`actions-unified.json\`
- ✅ \`events.json\` + \`events-config.json\` → \`events-unified.json\`

### 2. Унификация типов данных
- ✅ Созданы единые TypeScript интерфейсы
- ✅ Устранены дублирующие типы
- ✅ Нормализована структура данных

### 3. Оптимизация состояний персонажей
- ✅ Объединены связанные состояния (fear + despair → stress)
- ✅ Упрощена система атрибутов
- ✅ Добавлены метаданные для отслеживания

### 4. Валидация данных
- ✅ Проверка уникальности ID
- ✅ Проверка обязательных полей
- ✅ Валидация структуры данных

## 📁 Созданные файлы

- \`characters-unified.json\` - Объединенные данные персонажей
- \`actions-unified.json\` - Объединенные данные действий
- \`events-unified.json\` - Объединенные данные событий
- \`contracts-unified.json\` - Данные контрактов
- \`equipment-unified.json\` - Данные оборудования
- \`system-unified.json\` - Системные определения
- \`story-scenes-unified.json\` - Сюжетные сцены
- \`users-unified.json\` - Данные пользователей
- \`game-config-unified.json\` - Полная конфигурация игры

## 🚀 Следующие шаги

1. Обновить компоненты для использования новых типов
2. Заменить импорты старых файлов на новые
3. Обновить тесты для работы с новой структурой
4. Удалить старые файлы после проверки работоспособности

## ⚠️ Важные замечания

- Старые файлы данных сохранены как резервные копии
- Все ID персонажей, действий и событий сохранены
- Метаданные добавлены для отслеживания источников
- Структура данных обратно совместима

---

*Отчет создан автоматически системой миграции*
`

  const fs = await import('fs')
  const path = await import('path')
  
  await fs.promises.writeFile(
    path.join(process.cwd(), 'MIGRATION_REPORT.md'),
    report,
    'utf8'
  )
}

// Запускаем миграцию
if (require.main === module) {
  main().catch(console.error)
}
