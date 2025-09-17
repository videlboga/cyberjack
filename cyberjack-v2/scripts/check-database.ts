// scripts/check-database.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabase() {
  console.log('🔍 Проверяем заполнение базы данных...')

  try {
    // Проверяем характеристики
    const characteristics = await prisma.characteristicDefinition.count()
    console.log(`📊 Характеристики: ${characteristics}`)

    // Проверяем анатомию
    const anatomy = await prisma.anatomyDefinition.count()
    console.log(`🦴 Анатомия: ${anatomy}`)

    // Проверяем позы
    const poses = await prisma.poseDefinition.count()
    console.log(`🎭 Позы: ${poses}`)

    // Проверяем действия
    const actions = await prisma.action.count()
    console.log(`⚡ Действия: ${actions}`)

    // Проверяем оборудование
    const equipment = await prisma.equipment.count()
    console.log(`🔧 Оборудование: ${equipment}`)

    // Проверяем персонажей
    const characters = await prisma.character.count()
    console.log(`👥 Персонажи: ${characters}`)

    // Проверяем характеристики персонажей
    const characterCharacteristics = await prisma.characteristic.count()
    console.log(`📈 Характеристики персонажей: ${characterCharacteristics}`)

    // Проверяем анатомию персонажей
    const characterAnatomy = await prisma.characterAnatomy.count()
    console.log(`🦴 Анатомия персонажей: ${characterAnatomy}`)

    // Проверяем станции
    const stations = await prisma.stationEntity.count()
    console.log(`🏢 Станции: ${stations}`)

    // Проверяем сцены
    const scenes = await prisma.scene.count()
    console.log(`🎬 Сцены: ${scenes}`)

    // Проверяем экраны
    const screens = await prisma.screen.count()
    console.log(`📺 Экраны: ${screens}`)

    // Проверяем выборы
    const choices = await prisma.choice.count()
    console.log(`🎯 Выборы: ${choices}`)

    console.log('\n✅ Проверка завершена!')
  } catch (error) {
    console.error('❌ Ошибка при проверке БД:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
