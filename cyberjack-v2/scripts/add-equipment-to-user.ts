import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addEquipmentToUser() {
  console.log('🎒 Добавление оборудования пользователю...')

  try {
    // Находим тестового пользователя
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })

    if (!user) {
      console.log('❌ Тестовый пользователь не найден')
      return
    }

    // Находим оборудование
    const equipment = await prisma.equipment.findFirst({
      where: { name: 'Кожаные наручники' }
    })

    if (!equipment) {
      console.log('❌ Оборудование не найдено')
      return
    }

    // Добавляем оборудование пользователю
    const userEquipment = await prisma.userEquipment.upsert({
      where: {
        userId_equipmentId: {
          userId: user.id,
          equipmentId: equipment.id
        }
      },
      update: {
        quantity: {
          increment: 1
        }
      },
      create: {
        userId: user.id,
        equipmentId: equipment.id,
        quantity: 2,
        settings: {
          condition: 'good',
          customization: 'standard'
        }
      }
    })

    console.log(`✅ Добавлено оборудование "${equipment.name}" пользователю "${user.name}"`)
    console.log(`   Количество: ${userEquipment.quantity}`)

    // Добавляем ещё одно оборудование
    const gynecologicalChair = await prisma.equipment.findFirst({
      where: { name: 'Гинекологическое кресло' }
    })

    if (gynecologicalChair) {
      await prisma.userEquipment.create({
        data: {
          userId: user.id,
          equipmentId: gynecologicalChair.id,
          quantity: 1,
          settings: {
            condition: 'excellent',
            settings: {
              height: 'adjustable',
              restraints: 'included'
            }
          }
        }
      })
      console.log(`✅ Добавлено оборудование "${gynecologicalChair.name}" пользователю "${user.name}"`)
    }

    console.log('🎉 Оборудование успешно добавлено пользователю!')
  } catch (error) {
    console.error('❌ Ошибка добавления оборудования:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addEquipmentToUser()
