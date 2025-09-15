#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'

async function testGameAPI() {
  console.log('🧪 Тестирование API игрового интерфейса...\n')

  try {
    // 1. Проверяем наличие персонажей
    console.log('1. Проверка персонажей...')
    const characters = await prisma.character.findMany({
      where: { isActive: true },
      take: 3
    })
    console.log(`   ✅ Найдено ${characters.length} активных персонажей`)

    if (characters.length > 0) {
      const character = characters[0]
      console.log(`   📝 Первый персонаж: ${character.name} (ID: ${character.id})`)
    }

    // 2. Проверяем наличие пользователей
    console.log('\n2. Проверка пользователей...')
    const users = await prisma.user.findMany({
      take: 3
    })
    console.log(`   ✅ Найдено ${users.length} пользователей`)

    if (users.length > 0) {
      const user = users[0]
      console.log(`   📝 Первый пользователь: ${user.name} (ID: ${user.id})`)
    }

    // 3. Проверяем наличие поз
    console.log('\n3. Проверка поз...')
    const poses = await prisma.poseDefinition.findMany({
      where: { isActive: true },
      take: 3
    })
    console.log(`   ✅ Найдено ${poses.length} активных поз`)

    if (poses.length > 0) {
      const pose = poses[0]
      console.log(`   📝 Первая поза: ${pose.name} (ID: ${pose.id})`)
    }

    // 4. Проверяем наличие оборудования
    console.log('\n4. Проверка оборудования...')
    const equipment = await prisma.equipment.findMany({
      where: { isActive: true },
      take: 3
    })
    console.log(`   ✅ Найдено ${equipment.length} активного оборудования`)

    if (equipment.length > 0) {
      const item = equipment[0]
      console.log(`   📝 Первое оборудование: ${item.name} (ID: ${item.id})`)
    }

    // 5. Проверяем наличие характеристик
    console.log('\n5. Проверка характеристик...')
    const characteristics = await prisma.characteristicDefinition.findMany({
      where: { isActive: true },
      take: 3
    })
    console.log(`   ✅ Найдено ${characteristics.length} активных характеристик`)

    if (characteristics.length > 0) {
      const char = characteristics[0]
      console.log(`   📝 Первая характеристика: ${char.name} (ID: ${char.id})`)
    }

    // 6. Проверяем наличие действий
    console.log('\n6. Проверка действий...')
    const actions = await prisma.action.findMany({
      where: { isActive: true },
      take: 3
    })
    console.log(`   ✅ Найдено ${actions.length} активных действий`)

    if (actions.length > 0) {
      const action = actions[0]
      console.log(`   📝 Первое действие: ${action.name} (ID: ${action.id})`)
    }

    console.log('\n🎉 Все проверки пройдены успешно!')
    console.log('\n📋 Рекомендации:')

    if (characters.length === 0) {
      console.log('   ⚠️  Создайте персонажей в админ-панели')
    }

    if (poses.length === 0) {
      console.log('   ⚠️  Создайте позы в админ-панели')
    }

    if (equipment.length === 0) {
      console.log('   ⚠️  Создайте оборудование в админ-панели')
    }

    if (actions.length === 0) {
      console.log('   ⚠️  Создайте действия в админ-панели')
    }

    console.log('\n🚀 Игровой интерфейс готов к использованию!')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем тест
testGameAPI()
