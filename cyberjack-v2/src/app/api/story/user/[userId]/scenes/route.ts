import { NextRequest, NextResponse } from 'next/server'
import { SceneManager } from '@/lib/story/scene-manager'

// GET /api/story/user/[userId]/scenes - Получить доступные сцены для пользователя
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const sceneManager = SceneManager.getInstance()

    const availableScenes = await sceneManager.getAvailableScenes(userId)
    const userProgress = await sceneManager.getUserSceneProgress(userId)

    return NextResponse.json({
      availableScenes,
      userProgress
    })
  } catch (error) {
    console.error('Ошибка при получении сцен пользователя:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сцен пользователя' },
      { status: 500 }
    )
  }
}

// POST /api/story/user/[userId]/scenes - Начать сцену
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const body = await request.json()
    const { sceneId, action } = body

    if (!sceneId || !action) {
      return NextResponse.json(
        { error: 'sceneId и action обязательны' },
        { status: 400 }
      )
    }

    const sceneManager = SceneManager.getInstance()
    let result = false

    switch (action) {
      case 'start':
        result = await sceneManager.startScene(userId, sceneId)
        break
      case 'complete':
        result = await sceneManager.completeScene(userId, sceneId)
        break
      default:
        return NextResponse.json(
          { error: 'Неизвестное действие' },
          { status: 400 }
        )
    }

    if (result) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Не удалось выполнить действие' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Ошибка при выполнении действия со сценой:', error)
    return NextResponse.json(
      { error: 'Ошибка при выполнении действия со сценой' },
      { status: 500 }
    )
  }
}