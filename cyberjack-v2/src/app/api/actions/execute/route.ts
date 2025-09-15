// app/api/actions/execute/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ActionsSystem } from '../../../../../lib/core/actions/actions-system'

export async function POST(request: NextRequest) {
  try {
    const { characterId, actionId, userId, zoneId, durationSeconds, intensity } = await request.json()

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

    // Используем простую систему вместо сложных формул
    const result = await actionsSystem.executeSimpleAction(
      characterId,
      actionId,
      userId,
      intensity || 50, // Дефолтная интенсивность
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
