import { NextRequest, NextResponse } from 'next/server'
import { ActionsSystem } from '@/lib/core/actions/actions-system'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actionId, characterId, userId, intensity, durationSeconds } = body

    if (!actionId || !characterId || !userId || !intensity) {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные параметры' },
        { status: 400 }
      )
    }

    const actionsSystem = new ActionsSystem()
    const result = await actionsSystem.executeSimpleAction(
      characterId,
      actionId,
      userId,
      intensity,
      durationSeconds || 5
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Ошибка выполнения простого действия:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
