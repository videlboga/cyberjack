import { NextRequest, NextResponse } from 'next/server'
import { ScreenBasedStoryManager } from '@/lib/story/screen-based-story-manager'

// POST /api/story/user/[userId]/choice/[choiceId] - Выполнить выбор
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; choiceId: string }> }
) {
  try {
    const { userId, choiceId } = await params
    const storyManager = ScreenBasedStoryManager.getInstance()

    const result = await storyManager.makeChoice(userId, choiceId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        nextScreenId: result.nextScreenId,
        consequences: result.consequences
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Не удалось выполнить выбор' },
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