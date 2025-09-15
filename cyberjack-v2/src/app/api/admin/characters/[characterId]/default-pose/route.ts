import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params
    const { poseId } = await request.json()

    if (!poseId) {
      return NextResponse.json(
        { error: 'poseId обязателен' },
        { status: 400 }
      )
    }

    // Сначала снимаем флаг isDefault со всех поз персонажа
    await prisma.characterPose.updateMany({
      where: {
        characterId,
        isDefault: true
      },
      data: {
        isDefault: false
      }
    })

    // Устанавливаем новую дефолтную позу
    const updatedPose = await prisma.characterPose.update({
      where: {
        id: poseId
      },
      data: {
        isDefault: true
      },
      include: {
        definition: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Дефолтная поза обновлена',
      pose: updatedPose
    })
  } catch (error) {
    console.error('Error setting default pose:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params

    // Получаем дефолтную позу персонажа
    const defaultPose = await prisma.characterPose.findFirst({
      where: {
        characterId,
        isDefault: true
      },
      include: {
        definition: true
      }
    })

    return NextResponse.json({
      defaultPose: defaultPose || null
    })
  } catch (error) {
    console.error('Error fetching default pose:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
