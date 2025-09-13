// app/api/time/advance/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { TimeSystem } from '../../../../../lib/core/time/time-system'

export async function POST(request: NextRequest) {
  try {
    const { minutes, reason } = await request.json()

    if (typeof minutes !== 'number' || minutes <= 0) {
      return NextResponse.json(
        { error: 'Minutes must be a positive number' },
        { status: 400 }
      )
    }

    const timeSystem = TimeSystem.getInstance()
    await timeSystem.advanceTime(minutes)

    return NextResponse.json({
      gameTime: timeSystem.getGameTime(),
      formattedTime: timeSystem.getFormattedTime(),
      reason: reason || 'manual'
    })
  } catch (error) {
    console.error('Error advancing time:', error)
    return NextResponse.json(
      { error: 'Failed to advance time' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const timeSystem = TimeSystem.getInstance()
    const state = timeSystem.getState()

    return NextResponse.json(state)
  } catch (error) {
    console.error('Error getting time state:', error)
    return NextResponse.json(
      { error: 'Failed to get time state' },
      { status: 500 }
    )
  }
}
