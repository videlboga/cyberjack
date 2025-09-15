import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, equipmentId: string }> }
) {
  try {
    const { id, equipmentId } = await params
    const userId = id

    // Проверяем, есть ли у пользователя это оборудование
    const userEquipment = await prisma.userEquipment.findUnique({
      where: {
        userId_equipmentId: {
          userId,
          equipmentId
        }
      },
      include: {
        equipment: {
          include: {
            relatedPose: true
          }
        }
      }
    })

    if (!userEquipment) {
      return NextResponse.json(
        { error: 'У вас нет этого оборудования' },
        { status: 404 }
      )
    }

    if (userEquipment.quantity <= 0) {
      return NextResponse.json(
        { error: 'Недостаточно оборудования' },
        { status: 400 }
      )
    }

    // Здесь можно добавить логику использования оборудования
    // Например, активация связанной позы, изменение характеристик и т.д.

    // Пока просто возвращаем успех
    return NextResponse.json({
      success: true,
      message: `Оборудование "${userEquipment.equipment.name}" использовано`,
      equipment: {
        id: userEquipment.equipment.id,
        name: userEquipment.equipment.name,
        category: userEquipment.equipment.category,
        relatedPose: userEquipment.equipment.relatedPose
      }
    })
  } catch (error) {
    console.error('Error using equipment:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
