// app/api/actions/execute/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ActionsSystem } from '../../../../../lib/core/actions/actions-system'

export async function POST(request: NextRequest) {
  try {
    const { characterId, actionId, userId, zoneId, durationSeconds } = await request.json()

    if (!characterId || !actionId || !userId || !durationSeconds) {
      return NextResponse.json(
        { error: 'Missing required parameters: characterId, actionId, userId, durationSeconds' },
        { status: 400 }
      )
    }

    if (durationSeconds <= 0) {
      return NextResponse.json(
        { error: 'Duration must be greater than 0' },
        { status: 400 }
      )
    }

    const actionsSystem = new ActionsSystem()
    const result = await actionsSystem.executeActionWithHold(
      characterId,
      actionId,
      userId,
      zoneId,
      durationSeconds
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
