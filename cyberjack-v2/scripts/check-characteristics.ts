#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'

async function checkCharacteristics() {
  console.log('🔍 Проверяем характеристики персонажа...\n')

  try {
    // Получаем первого персонажа
    const character = await prisma.character.findFirst({
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) {
      console.error('❌ Персонаж не найден')
      return
    }

    console.log(`🎭 Персонаж: ${character.name} (${character.id})`)
    console.log(`📊 Характеристики:`)

    for (const char of character.characteristics) {
      console.log(`   - ${char.definition.name} (ID: ${char.definition.id}): ${char.currentValue}`)
    }

    // Проверяем, есть ли характеристика "Настроение"
    const moodChar = character.characteristics.find(c => c.definition.name === 'Настроение')
    if (moodChar) {
      console.log(`\n✅ Характеристика "Настроение" найдена: ${moodChar.currentValue}`)
    } else {
      console.log(`\n❌ Характеристика "Настроение" не найдена`)
    }

    // Проверяем, есть ли характеристика "Доверие"
    const trustChar = character.characteristics.find(c => c.definition.name === 'Доверие')
    if (trustChar) {
      console.log(`✅ Характеристика "Доверие" найдена: ${trustChar.currentValue}`)
    } else {
      console.log(`❌ Характеристика "Доверие" не найдена`)
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем проверку
checkCharacteristics().catch(console.error)
