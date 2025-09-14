// app/api/time/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { TimeSystem } from '../../../../lib/core/time/time-system'

export async function GET() {
  try {
    const timeSystem = TimeSystem.getInstance()
    const state = timeSystem.getState()

    return NextResponse.json(state)
  } catch (error) {
    console.error('Error fetching time state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch time state' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, minutes } = await request.json()
    const timeSystem = TimeSystem.getInstance()

    switch (action) {
      case 'start':
        timeSystem.startActionHold()
        break
      case 'stop':
        timeSystem.stopActionHold()
        break
      case 'advance':
        if (typeof minutes === 'number' && minutes > 0) {
          await timeSystem.advanceTime(minutes)
        } else {
          return NextResponse.json(
            { error: 'Valid minutes value is required for advance action' },
            { status: 400 }
          )
        }
        break
      case 'reset':
        timeSystem.reset()
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, advance, or reset' },
          { status: 400 }
        )
    }

    const state = timeSystem.getState()
    return NextResponse.json(state)
  } catch (error) {
    console.error('Error updating time:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update time' },
      { status: 500 }
    )
  }
}
