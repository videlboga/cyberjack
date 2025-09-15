#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'

async function addMissingCharacteristics() {
  console.log('➕ Добавляем недостающие характеристики...\n')

  try {
    // Список характеристик, которые нужны для формул
    const requiredCharacteristics = [
      { name: 'Настроение', category: 'Эмоциональное', description: 'Общее эмоциональное состояние персонажа', minValue: 0, maxValue: 100 },
      { name: 'Доверие', category: 'Эмоциональное', description: 'Уровень доверия к пользователю', minValue: 0, maxValue: 100 },
      { name: 'Энергия', category: 'Физическое', description: 'Уровень физической энергии', minValue: 0, maxValue: 100 },
      { name: 'Стресс', category: 'Эмоциональное', description: 'Уровень стресса', minValue: 0, maxValue: 100 },
      { name: 'Смущение', category: 'Эмоциональное', description: 'Уровень смущения', minValue: 0, maxValue: 100 }
    ]

    for (const charDef of requiredCharacteristics) {
      // Проверяем, существует ли уже такая характеристика
      const existing = await prisma.characteristicDef.findFirst({
        where: { name: charDef.name }
      })

      if (existing) {
        console.log(`⏭️  Характеристика "${charDef.name}" уже существует`)
        continue
      }

      // Создаем определение характеристики
      const newCharDef = await prisma.characteristicDef.create({
        data: {
          name: charDef.name,
          category: charDef.category,
          description: charDef.description,
          minValue: charDef.minValue,
          maxValue: charDef.maxValue,
          isActive: true
        }
      })

      console.log(`✅ Создано определение характеристики: ${charDef.name}`)

      // Добавляем эту характеристику всем персонажам
      const characters = await prisma.character.findMany()

      for (const character of characters) {
        // Проверяем, есть ли уже эта характеристика у персонажа
        const existingChar = await prisma.characteristic.findUnique({
          where: {
            characterId_characteristicDefId: {
              characterId: character.id,
              characteristicDefId: newCharDef.id
            }
          }
        })

        if (existingChar) {
          console.log(`⏭️  У персонажа "${character.name}" уже есть характеристика "${charDef.name}"`)
          continue
        }

        // Создаем характеристику для персонажа
        await prisma.characteristic.create({
          data: {
            characterId: character.id,
            characteristicDefId: newCharDef.id,
            currentValue: 50, // Начальное значение
            baseValue: 50,
            recoveryRate: 1.0,
            shiftThreshold: 60,
            shiftRate: 0.1,
            timeInAlteredState: 0,
            lastChanged: new Date(),
            lastRecovery: new Date()
          }
        })

        console.log(`✅ Добавлена характеристика "${charDef.name}" персонажу "${character.name}"`)
      }
    }

    console.log('\n🎉 Добавление характеристик завершено!')

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем добавление
addMissingCharacteristics().catch(console.error)
