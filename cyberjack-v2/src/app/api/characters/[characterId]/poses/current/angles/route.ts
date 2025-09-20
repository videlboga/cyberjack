import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/characters/[characterId]/poses/current/angles - получить доступные ракурсы для текущей позы персонажа
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


    // Получаем текущую позу из копии персонажа
    const characterCopy = await prisma.characterCopy.findFirst({
      where: {
        characterId,
        userId
      }
    })

    let currentPoseDefId = null
    if (characterCopy?.settings && typeof characterCopy.settings === 'object' && characterCopy.settings !== null) {
      const settings = characterCopy.settings as any
      currentPoseDefId = settings.currentPose
    }

    if (!currentPoseDefId) {
      return NextResponse.json(
        { error: 'Текущая поза не установлена' },
        { status: 404 }
      )
    }

    // Находим позу персонажа по poseDefId
    const characterPose = await prisma.characterPose.findFirst({
      where: {
        characterId,
        poseDefId: currentPoseDefId
      }
    })

    if (!characterPose) {
      return NextResponse.json(
        { error: 'Поза персонажа не найдена' },
        { status: 404 }
      )
    }

    // Получаем ракурсы для текущей позы
    const angles = await prisma.characterPoseAngle.findMany({
      where: {
        characterPoseId: characterPose.id
      },
      include: {
        zones: {
          include: {
            anatomy: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    })

    // Фильтруем только ракурсы с медиа
    const anglesWithMedia = angles.filter(angle => {
      const media = angle.media as any || { files: [] }
      return media.files && media.files.length > 0
    })


    return NextResponse.json(anglesWithMedia)
  } catch (error) {
    console.error('Error fetching current pose angles:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
