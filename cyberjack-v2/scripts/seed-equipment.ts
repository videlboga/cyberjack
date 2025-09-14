import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedEquipment() {
  console.log('🌱 Создание тестового оборудования...')

  try {
    // Создаем базовые категории оборудования
    const equipmentData = [
      {
        name: 'Гинекологическое кресло',
        category: 'Медицинское',
        description: 'Специализированное медицинское оборудование для обследований',
        rarity: 'UNCOMMON',
        cost: 500,
        requirements: {
          level: 1,
          characteristics: {
            trust: 30
          }
        }
      },
      {
        name: 'Кожаные наручники',
        category: 'Ограничения',
        description: 'Мягкие наручники для ограничения движений',
        rarity: 'COMMON',
        cost: 100,
        requirements: {
          level: 1
        }
      },
      {
        name: 'Вибратор',
        category: 'Стимуляция',
        description: 'Электронный стимулятор для различных частей тела',
        rarity: 'RARE',
        cost: 800,
        requirements: {
          level: 5,
          characteristics: {
            trust: 50,
            arousal: 20
          }
        }
      },
      {
        name: 'Клетка для содержания',
        category: 'Содержание',
        description: 'Специальная клетка для длительного содержания активов',
        rarity: 'EPIC',
        cost: 1500,
        requirements: {
          level: 10,
          characteristics: {
            trust: 80,
            obedience: 70
          }
        }
      },
      {
        name: 'Королевский трон',
        category: 'Роскошь',
        description: 'Роскошный трон для особых церемоний',
        rarity: 'LEGENDARY',
        cost: 5000,
        requirements: {
          level: 20,
          characteristics: {
            trust: 90,
            worship: 80
          }
        }
      }
    ]

    for (const equipment of equipmentData) {
      const existing = await prisma.equipment.findFirst({
        where: { name: equipment.name }
      })

      if (!existing) {
        await prisma.equipment.create({
          data: equipment
        })
        console.log(`✅ Создано оборудование: ${equipment.name}`)
      } else {
        console.log(`⚠️  Оборудование уже существует: ${equipment.name}`)
      }
    }

    console.log('🎉 Тестовое оборудование создано успешно!')
  } catch (error) {
    console.error('❌ Ошибка создания оборудования:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedEquipment()
