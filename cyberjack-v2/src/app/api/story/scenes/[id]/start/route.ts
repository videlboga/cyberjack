import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { ScreenBasedStoryManager } from '@/lib/story/screen-based-story-manager'

// POST /api/story/scenes/[id]/start - Запустить сцену
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userId, stationId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'ID пользователя обязателен' },
        { status: 400 }
      )
    }

    // Получаем сцену с экранами
    const scene = await prisma.scene.findUnique({
      where: { id },
      include: {
        screens: {
          include: {
            choices: true
          }
          // Убираем orderBy, так как createdAt не существует в схеме
        }
      }
    })

    if (!scene) {
      return NextResponse.json(
        { error: 'Сцена не найдена' },
        { status: 404 }
      )
    }

    if (!scene.isActive) {
      return NextResponse.json(
        { error: 'Сцена неактивна' },
        { status: 400 }
      )
    }

    // Получаем начальный экран сцены
    let startScreen = null

    // Сначала ищем экран по startScreenId, если он указан
    if (scene.startScreenId) {
      startScreen = scene.screens.find(screen => screen.id === scene.startScreenId)
    }

    // Если не найден по startScreenId, берем первый экран
    if (!startScreen) {
      startScreen = scene.screens[0]
    }

    if (!startScreen) {
      return NextResponse.json(
        { error: 'В сцене нет экранов' },
        { status: 400 }
      )
    }

    // Создаем прогресс сцены для пользователя
    const sceneProgress = await prisma.userSceneProgress.upsert({
      where: {
        userId_sceneId: {
          userId,
          sceneId: id
        }
      },
      update: {
        currentScreenId: startScreen.id,
        status: 'IN_PROGRESS',
        startedAt: new Date()
      },
      create: {
        userId,
        sceneId: id,
        currentScreenId: startScreen.id,
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    })

    // Возвращаем данные для запуска сцены
    return NextResponse.json({
      success: true,
      scene: {
        id: scene.id,
        name: scene.name,
        description: scene.description
      },
      currentScreen: {
        id: startScreen.id,
        name: startScreen.name,
        description: startScreen.description,
        content: startScreen.content,
        choices: startScreen.choices.map(choice => ({
          id: choice.id,
          text: choice.text,
          description: choice.description,
          nextScreenId: choice.nextScreenId,
          consequences: choice.consequences,
          showConditions: choice.showConditions
        }))
      },
      progress: {
        id: sceneProgress.id,
        currentScreenId: sceneProgress.currentScreenId,
        status: sceneProgress.status,
        startedAt: sceneProgress.startedAt
      }
    })

  } catch (error) {
    console.error('Ошибка при запуске сцены:', error)
    return NextResponse.json(
      { error: 'Ошибка при запуске сцены' },
      { status: 500 }
    )
  }
}
