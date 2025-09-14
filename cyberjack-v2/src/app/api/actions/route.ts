// app/api/actions/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ActionsSystem } from '../../../../lib/core/actions/actions-system'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const characterId = searchParams.get('characterId')
    const userId = searchParams.get('userId')

    const actionsSystem = new ActionsSystem()

    let actions
    if (characterId && userId) {
      // Получить доступные действия для персонажа
      actions = await actionsSystem.getAvailableActions(characterId, userId)
    } else if (category) {
      // Получить действия по категории
      actions = await actionsSystem.getActionsByCategory(category)
    } else {
      // Получить все действия
      actions = await actionsSystem.getAllActions()
    }

    return NextResponse.json(actions)
  } catch (error) {
    console.error('Error fetching actions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch actions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const actionData = await request.json()

    const actionsSystem = new ActionsSystem()
    const action = await actionsSystem.createAction(actionData)

    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    console.error('Error creating action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create action' },
      { status: 500 }
    )
  }
}
