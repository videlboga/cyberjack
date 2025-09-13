// app/api/actions/execute/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ActionsSystem } from '../../../../../lib/core/actions/actions-system'

export async function POST(request: NextRequest) {
  try {
    const { characterId, actionId, userId, zoneId } = await request.json()

    if (!characterId || !actionId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const actionsSystem = new ActionsSystem()
    const result = await actionsSystem.executeAction(
      characterId,
      actionId,
      userId,
      zoneId
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error executing action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute action' },
      { status: 500 }
    )
  }
}
