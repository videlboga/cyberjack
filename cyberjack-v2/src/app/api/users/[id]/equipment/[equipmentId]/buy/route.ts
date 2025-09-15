import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, equipmentId: string }> }
) {
  try {
    const { id, equipmentId } = await params
    const userId = id

    // Получаем пользователя и оборудование
    const [user, equipment] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.equipment.findUnique({ where: { id: equipmentId } })
    ])

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    if (!equipment) {
      return NextResponse.json(
        { error: 'Оборудование не найдено' },
        { status: 404 }
      )
    }

    if (!equipment.isActive) {
      return NextResponse.json(
        { error: 'Оборудование недоступно для покупки' },
        { status: 400 }
      )
    }

    // Проверяем, достаточно ли кредитов
    if (user.credits < equipment.cost) {
      return NextResponse.json(
        { error: 'Недостаточно кредитов' },
        { status: 400 }
      )
    }

    // Проверяем, есть ли уже это оборудование у пользователя
    const existingEquipment = await prisma.userEquipment.findUnique({
      where: {
        userId_equipmentId: {
          userId,
          equipmentId
        }
      }
    })

    if (existingEquipment) {
      // Увеличиваем количество
      await prisma.userEquipment.update({
        where: {
          userId_equipmentId: {
            userId,
            equipmentId
          }
        },
        data: {
          quantity: existingEquipment.quantity + 1
        }
      })
    } else {
      // Создаем новую запись
      await prisma.userEquipment.create({
        data: {
          userId,
          equipmentId,
          quantity: 1
        }
      })
    }

    // Списываем кредиты
    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: user.credits - equipment.cost
      }
    })

    return NextResponse.json({
      success: true,
      message: `Оборудование "${equipment.name}" куплено`,
      equipment: {
        id: equipment.id,
        name: equipment.name,
        category: equipment.category,
        cost: equipment.cost
      },
      newCredits: user.credits - equipment.cost
    })
  } catch (error) {
    console.error('Error buying equipment:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
