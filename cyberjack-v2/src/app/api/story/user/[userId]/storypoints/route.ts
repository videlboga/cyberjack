import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { StoryPointsManager } from '@/lib/story/story-points'

// GET /api/story/user/[userId]/storypoints - Получить сюжетные точки пользователя
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const storyPointsManager = StoryPointsManager.getInstance()

    const userStoryPoints = await storyPointsManager.getUserStoryPoints(userId)

    return NextResponse.json(userStoryPoints)
  } catch (error) {
    console.error('Ошибка при получении сюжетных точек пользователя:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сюжетных точек пользователя' },
      { status: 500 }
    )
  }
}

// POST /api/story/user/[userId]/storypoints - Установить значение сюжетной точки
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const body = await request.json()
    const { storyPointId, value, source = 'manual' } = body

    if (!storyPointId || value === undefined) {
      return NextResponse.json(
        { error: 'storyPointId и value обязательны' },
        { status: 400 }
      )
    }

    const storyPointsManager = StoryPointsManager.getInstance()
    await storyPointsManager.setStoryPointValue(userId, storyPointId, value, source)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка при установке значения сюжетной точки:', error)
    return NextResponse.json(
      { error: 'Ошибка при установке значения сюжетной точки' },
      { status: 500 }
    )
  }
}