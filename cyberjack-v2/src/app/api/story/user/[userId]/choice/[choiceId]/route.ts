import { NextRequest, NextResponse } from 'next/server'
import { SceneManager } from '@/lib/story/scene-manager'

// POST /api/story/user/[userId]/choice/[choiceId] - Выполнить выбор
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string; choiceId: string } }
) {
  try {
    const { userId, choiceId } = params
    const sceneManager = SceneManager.getInstance()

    const success = await sceneManager.makeChoice(userId, choiceId)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Не удалось выполнить выбор' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Ошибка при выполнении выбора:', error)
    return NextResponse.json(
      { error: 'Ошибка при выполнении выбора' },
      { status: 500 }
    )
  }
}