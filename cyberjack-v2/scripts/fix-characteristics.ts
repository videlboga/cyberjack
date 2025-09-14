// scripts/fix-characteristics.ts - Скрипт для исправления характеристик

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Начинаем исправление характеристик...')

  // 1. Находим дублирующиеся определения характеристик
  console.log('📊 Ищем дублирующиеся определения характеристик...')

  const duplicates = await prisma.characteristicDefinition.groupBy({
    by: ['name'],
    having: {
      name: {
        _count: {
          gt: 1
        }
      }
    }
  })

  console.log(`Найдено ${duplicates.length} дублирующихся характеристик:`)
  for (const duplicate of duplicates) {
    console.log(`  - ${duplicate.name}`)
  }

  // 2. Удаляем дублирующиеся определения, оставляя только первое
  for (const duplicate of duplicates) {
    const definitions = await prisma.characteristicDefinition.findMany({
      where: { name: duplicate.name },
      orderBy: { id: 'asc' }
    })

    // Оставляем первое определение, удаляем остальные
    const toDelete = definitions.slice(1)

    for (const def of toDelete) {
      console.log(`🗑️ Удаляем дублирующееся определение: ${def.name} (${def.id})`)

      await prisma.$transaction(async (tx) => {
        // Удаляем знания пользователей
        await tx.characterKnowledge.deleteMany({
          where: { characteristicDefId: def.id }
        })

        // Удаляем характеристики персонажей
        await tx.characteristic.deleteMany({
          where: { characteristicDefId: def.id }
        })

        // Удаляем определение
        await tx.characteristicDefinition.delete({
          where: { id: def.id }
        })
      })
    }
  }

  // 3. Синхронизируем характеристики для всех персонажей
  console.log('🔄 Синхронизируем характеристики для всех персонажей...')

  const characters = await prisma.character.findMany({
    where: { isActive: true }
  })

  const characteristicDefinitions = await prisma.characteristicDefinition.findMany({
    where: { isActive: true }
  })

  for (const character of characters) {
    console.log(`👤 Обрабатываем персонажа: ${character.name}`)

    // Получаем существующие характеристики персонажа
    const existingCharacteristics = await prisma.characteristic.findMany({
      where: { characterId: character.id }
    })

    const existingDefIds = existingCharacteristics.map(c => c.characteristicDefId)

    // Находим отсутствующие характеристики
    const missingDefs = characteristicDefinitions.filter(
      def => !existingDefIds.includes(def.id)
    )

    if (missingDefs.length > 0) {
      console.log(`  ➕ Добавляем ${missingDefs.length} отсутствующих характеристик`)

      await prisma.characteristic.createMany({
        data: missingDefs.map(def => ({
          characterId: character.id,
          characteristicDefId: def.id,
          currentValue: 50,
          baseValue: 50,
          recoveryRate: 1.0
        }))
      })
    } else {
      console.log(`  ✅ Все характеристики уже существуют`)
    }
  }

  // 4. Статистика
  const finalStats = await prisma.characteristicDefinition.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          characteristics: true,
          knowledge: true
        }
      }
    }
  })

  console.log('')
  console.log('📊 Финальная статистика:')
  console.log(`   📋 Определений характеристик: ${finalStats.length}`)

  let totalCharacterCharacteristics = 0
  let totalKnowledge = 0

  for (const def of finalStats) {
    totalCharacterCharacteristics += def._count.characteristics
    totalKnowledge += def._count.knowledge
    console.log(`   - ${def.name}: ${def._count.characteristics} характеристик персонажей, ${def._count.knowledge} знаний`)
  }

  console.log(`   👥 Всего характеристик персонажей: ${totalCharacterCharacteristics}`)
  console.log(`   🧠 Всего знаний пользователей: ${totalKnowledge}`)

  console.log('')
  console.log('✅ Исправление характеристик завершено!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при исправлении характеристик:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
