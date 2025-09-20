// app/api/characteristics/[characterId]/[characteristicId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { CharacteristicsSystem } from '../../../../../../lib/core/characteristics/characteristics-system'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../../lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string, characteristicId: string }> }
) {
  try {
    const { characterId, characteristicId } = await params
    const { change, permanent } = await request.json()

    if (typeof change !== 'number') {
      return NextResponse.json(
        { error: 'Change value is required and must be a number' },
        { status: 400 }
      )
    }

    // Получаем сессию пользователя
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const characteristicsSystem = new CharacteristicsSystem()
    await characteristicsSystem.changeValue(
      characterId,
      characteristicId,
      change,
      permanent || false,
      session.user.id
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating characteristic:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update characteristic' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string, characteristicId: string }> }
) {
  try {
    const { characterId, characteristicId } = await params
    const characteristicsSystem = new CharacteristicsSystem()
    const currentValue = await characteristicsSystem.getCurrentValue(
      characterId,
      characteristicId
    )

    return NextResponse.json({ value: currentValue })
  } catch (error) {
    console.error('Error fetching characteristic value:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch characteristic value' },
      { status: 500 }
    )
  }
}
