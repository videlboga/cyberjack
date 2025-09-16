import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const { userId, poseId, angleId } = await request.json()

    if (!userId || !poseId) {
      return NextResponse.json(
        { error: 'userId и poseId обязательны' },
        { status: 400 }
      )
    }

    // Получаем или создаем копию персонажа
    const characterCopy = await prisma.characterCopy.upsert({
      where: {
        userId_characterId: {
          userId,
          characterId
        }
      },
      update: {
        settings: {
          currentPose: poseId,
          currentAngle: angleId,
          lastPoseChange: new Date().toISOString()
        }
      },
      create: {
        userId,
        characterId,
        settings: {
          currentPose: poseId,
          currentAngle: angleId,
          lastPoseChange: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Текущая поза сохранена',
      characterCopy
    })
  } catch (error) {
    console.error('Error saving current pose:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      )
    }

    // Получаем сохраненную позу пользователя
    const characterCopy = await prisma.characterCopy.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId
        }
      }
    })

    return NextResponse.json({
      currentPose: characterCopy?.settings?.currentPose || null,
      currentAngle: characterCopy?.settings?.currentAngle || null,
      lastPoseChange: characterCopy?.settings?.lastPoseChange || null
    })
  } catch (error) {
    console.error('Error fetching current pose:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
