// scripts/test-all-systems.ts - Полное тестирование всех систем

import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 ЗАПУСК ПОЛНОГО ТЕСТИРОВАНИЯ ВСЕХ СИСТЕМ')
  console.log('=' .repeat(60))

  try {
    // 1. Подготовка базы данных
    console.log('\n📊 1. Подготовка базы данных...')
    await prisma.$executeRaw`DELETE FROM "action_logs"`
    await prisma.$executeRaw`DELETE FROM "character_knowledge"`
    await prisma.$executeRaw`DELETE FROM "character_copies"`
    await prisma.$executeRaw`DELETE FROM "character_active_zones"`
    await prisma.$executeRaw`DELETE FROM "character_pose_angles"`
    await prisma.$executeRaw`DELETE FROM "character_poses"`
    await prisma.$executeRaw`DELETE FROM "character_anatomy"`
    await prisma.$executeRaw`DELETE FROM "characteristics"`
    await prisma.$executeRaw`DELETE FROM "active_zones"`
    await prisma.$executeRaw`DELETE FROM "pose_angles"`
    await prisma.$executeRaw`DELETE FROM "character_poses"`
    await prisma.$executeRaw`DELETE FROM "actions"`
    await prisma.$executeRaw`DELETE FROM "pose_definitions"`
    await prisma.$executeRaw`DELETE FROM "anatomy_definitions"`
    await prisma.$executeRaw`DELETE FROM "characteristic_definitions"`
    await prisma.$executeRaw`DELETE FROM "characters"`
    await prisma.$executeRaw`DELETE FROM "users"`
    console.log('✅ База данных очищена')

    // 2. Заполнение тестовыми данными
    console.log('\n🌱 2. Заполнение тестовыми данными...')
    execSync('npx tsx lib/db/seed-v2.ts', { stdio: 'inherit' })
    console.log('✅ Тестовые данные созданы')

    // 3. Создание системы оборудования
    console.log('\n🔧 3. Создание системы оборудования...')
    execSync('npx tsx lib/db/seed-equipment.ts', { stdio: 'inherit' })
    console.log('✅ Система оборудования создана')

    // 4. Создание персонажей из старой версии
    console.log('\n👥 4. Создание персонажей из старой версии...')
    execSync('npx tsx lib/db/seed-characters-v2.ts', { stdio: 'inherit' })
    console.log('✅ Персонажи из старой версии созданы')

    // 5. Unit тесты
    console.log('\n🧪 5. Запуск Unit тестов...')
    try {
      execSync('npm run test:unit', { stdio: 'inherit' })
      console.log('✅ Unit тесты прошли успешно')
    } catch (error) {
      console.log('❌ Unit тесты провалились')
      throw error
    }

    // 6. Integration тесты
    console.log('\n🔗 6. Запуск Integration тестов...')
    try {
      execSync('npm run test:integration', { stdio: 'inherit' })
      console.log('✅ Integration тесты прошли успешно')
    } catch (error) {
      console.log('❌ Integration тесты провалились')
      throw error
    }

    // 7. E2E тесты
    console.log('\n🎭 7. Запуск E2E тестов...')
    try {
      execSync('npm run test:e2e', { stdio: 'inherit' })
      console.log('✅ E2E тесты прошли успешно')
    } catch (error) {
      console.log('❌ E2E тесты провалились')
      throw error
    }

    // 8. Тестирование API endpoints
    console.log('\n🌐 8. Тестирование API endpoints...')
    try {
      execSync('npm run test:api', { stdio: 'inherit' })
      console.log('✅ API тесты прошли успешно')
    } catch (error) {
      console.log('❌ API тесты провалились')
      throw error
    }

    // 9. Проверка покрытия кода
    console.log('\n📊 9. Проверка покрытия кода...')
    try {
      execSync('npm run test:coverage', { stdio: 'inherit' })
      console.log('✅ Покрытие кода проверено')
    } catch (error) {
      console.log('❌ Проблемы с покрытием кода')
      throw error
    }

    // 10. Финальная статистика
    console.log('\n📈 10. Финальная статистика...')
    const stats = await getDatabaseStats()
    console.log('📊 Статистика базы данных:')
    console.log(`   👥 Пользователей: ${stats.users}`)
    console.log(`   👤 Персонажей: ${stats.characters}`)
    console.log(`   📊 Характеристик: ${stats.characteristics}`)
    console.log(`   🎭 Действий: ${stats.actions}`)
    console.log(`   🧍 Поз: ${stats.poses}`)
    console.log(`   🔬 Анатомических зон: ${stats.anatomy}`)
    console.log(`   🔧 Оборудования: ${stats.equipment}`)
    console.log(`   🧠 Записей знаний: ${stats.knowledge}`)

    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!')
    console.log('🚀 Система готова к использованию!')

  } catch (error) {
    console.error('\n❌ ОШИБКА ПРИ ТЕСТИРОВАНИИ:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function getDatabaseStats() {
  const [
    users,
    characters,
    characteristics,
    actions,
    poses,
    anatomy,
    equipment,
    knowledge
  ] = await Promise.all([
    prisma.user.count(),
    prisma.character.count(),
    prisma.characteristic.count(),
    prisma.action.count(),
    prisma.poseDefinition.count(),
    prisma.anatomyDefinition.count(),
    prisma.equipment.count(),
    prisma.characterKnowledge.count()
  ])

  return {
    users,
    characters,
    characteristics,
    actions,
    poses,
    anatomy,
    equipment,
    knowledge
  }
}

main()
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e)
    process.exit(1)
  })
