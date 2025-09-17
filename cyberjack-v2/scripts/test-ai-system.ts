// scripts/test-ai-system.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAISystem() {
  console.log('🤖 Тестируем ИИ-систему...')

  try {
    // Получаем первого персонажа
    const character = await prisma.character.findFirst()
    if (!character) {
      console.log('❌ Персонажи не найдены')
      return
    }

    console.log(`👤 Тестируем с персонажем: ${character.name}`)

    // Получаем первого пользователя
    const user = await prisma.user.findFirst({
      where: { email: { not: 'ai-system@cyberjack.local' } }
    })
    if (!user) {
      console.log('❌ Пользователи не найдены')
      return
    }

    console.log(`👤 Пользователь: ${user.name}`)

    // Проверяем системного пользователя ИИ
    const aiUser = await prisma.user.findFirst({
      where: { email: 'ai-system@cyberjack.local' }
    })
    if (!aiUser) {
      console.log('❌ Системный пользователь ИИ не найден')
      return
    }

    console.log(`🤖 Системный пользователь ИИ: ${aiUser.name}`)

    // Проверяем характеристики персонажа
    const characteristics = await prisma.characteristic.findMany({
      where: { characterId: character.id },
      include: { definition: true }
    })

    console.log(`📊 Характеристики персонажа: ${characteristics.length}`)
    console.log('Топ-5 характеристик:')
    characteristics
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 5)
      .forEach(char => {
        console.log(`  - ${char.definition.name}: ${char.currentValue}`)
      })

    // Проверяем анатомию персонажа
    const anatomy = await prisma.characterAnatomy.findMany({
      where: { characterId: character.id },
      include: { definition: true }
    })

    console.log(`🦴 Анатомические зоны: ${anatomy.length}`)
    console.log('Топ-5 чувствительных зон:')
    anatomy
      .sort((a, b) => b.sensitivity - a.sensitivity)
      .slice(0, 5)
      .forEach(part => {
        console.log(`  - ${part.definition.name}: ${part.sensitivity}`)
      })

    // Проверяем действия
    const actions = await prisma.action.findMany()
    console.log(`⚡ Доступные действия: ${actions.length}`)
    actions.forEach(action => {
      console.log(`  - ${action.name} (${action.category})`)
    })

    // Проверяем оборудование
    const equipment = await prisma.equipment.findMany()
    console.log(`🔧 Доступное оборудование: ${equipment.length}`)
    equipment.forEach(equip => {
      console.log(`  - ${equip.name} (${equip.category})`)
    })

    console.log('\n✅ ИИ-система готова к работе!')
    console.log('🌐 Откройте http://localhost:3000/game для тестирования')

  } catch (error) {
    console.error('❌ Ошибка тестирования ИИ-системы:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAISystem()
