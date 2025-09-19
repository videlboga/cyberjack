// app/api/time/advance/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TimeSystem } from '../../../../../lib/core/time/time-system'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('No session or user ID')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { minutes, reason } = await request.json()
    console.log(`Advancing time for user ${session.user.id}: +${minutes} minutes`)

    if (typeof minutes !== 'number' || minutes <= 0) {
      return NextResponse.json(
        { error: 'Minutes must be a positive number' },
        { status: 400 }
      )
    }

    const timeSystem = TimeSystem.getInstance()
    await timeSystem.advanceTime(session.user.id, minutes)

    const gameTime = await timeSystem.getGameTime(session.user.id)
    const formattedTime = await timeSystem.getFormattedTime(session.user.id)

    console.log(`Time advanced successfully. New time: ${gameTime} minutes (${formattedTime})`)

    return NextResponse.json({
      gameTime,
      formattedTime,
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
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const timeSystem = TimeSystem.getInstance()
    const state = await timeSystem.getState(session.user.id)

    return NextResponse.json(state)
  } catch (error) {
    console.error('Error getting time state:', error)
    return NextResponse.json(
      { error: 'Failed to get time state' },
      { status: 500 }
    )
  }
}
