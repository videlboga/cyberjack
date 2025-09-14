// src/app/api/actions/modified/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ActionsSystem } from '../../../../../lib/core/actions/actions-system'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const characterId = searchParams.get('characterId')
    const userId = searchParams.get('userId')

    if (!characterId || !userId) {
      return NextResponse.json(
        { error: 'characterId and userId are required' },
        { status: 400 }
      )
    }

    const actionsSystem = new ActionsSystem()
    const modifiedActions = await actionsSystem.getModifiedActionsForCharacter(characterId, userId)

    return NextResponse.json({
      success: true,
      actions: modifiedActions,
      count: modifiedActions.length
    })
  } catch (error) {
    console.error('Error fetching modified actions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch modified actions' },
      { status: 500 }
    )
  }
}
