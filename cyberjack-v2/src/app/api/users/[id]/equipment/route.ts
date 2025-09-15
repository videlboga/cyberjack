import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    // Получаем оборудование пользователя
    const userEquipment = await prisma.userEquipment.findMany({
      where: { userId },
      include: {
        equipment: {
          include: {
            relatedPose: true
          }
        }
      }
    })

    // Преобразуем в нужный формат
    const formattedEquipment = userEquipment.map(item => ({
      id: item.id,
      equipmentId: item.equipmentId,
      quantity: item.quantity,
      settings: item.settings,
      acquiredAt: item.acquiredAt,
      equipment: {
        id: item.equipment.id,
        name: item.equipment.name,
        category: item.equipment.category,
        description: item.equipment.description,
        rarity: item.equipment.rarity,
        cost: item.equipment.cost,
        relatedPose: item.equipment.relatedPose ? {
          id: item.equipment.relatedPose.id,
          name: item.equipment.relatedPose.name
        } : null,
        requirements: item.equipment.requirements
      }
    }))

    return NextResponse.json(formattedEquipment)
  } catch (error) {
    console.error('Error fetching user equipment:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const body = await request.json()
    const { equipmentId, quantity = 1 } = body

    if (!equipmentId) {
      return NextResponse.json(
        { error: 'ID оборудования обязателен' },
        { status: 400 }
      )
    }

    // Проверяем, существует ли оборудование
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId }
    })

    if (!equipment) {
      return NextResponse.json(
        { error: 'Оборудование не найдено' },
        { status: 404 }
      )
    }

    // Проверяем, есть ли уже такое оборудование у пользователя
    const existingUserEquipment = await prisma.userEquipment.findFirst({
      where: {
        userId,
        equipmentId
      }
    })

    if (existingUserEquipment) {
      // Увеличиваем количество существующего оборудования
      const updatedEquipment = await prisma.userEquipment.update({
        where: { id: existingUserEquipment.id },
        data: {
          quantity: existingUserEquipment.quantity + quantity
        },
        include: {
          equipment: true
        }
      })

      return NextResponse.json({
        message: 'Оборудование добавлено',
        equipment: updatedEquipment
      })
    } else {
      // Создаем новую запись оборудования
      const newUserEquipment = await prisma.userEquipment.create({
        data: {
          userId,
          equipmentId,
          quantity,
          settings: {},
          acquiredAt: new Date()
        },
        include: {
          equipment: true
        }
      })

      return NextResponse.json({
        message: 'Оборудование добавлено',
        equipment: newUserEquipment
      })
    }
  } catch (error) {
    console.error('Error adding equipment to user:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}