// app/api/characteristics/[characterId]/[characteristicId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { CharacteristicsSystem } from '../../../../../../lib/core/characteristics/characteristics-system'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { characterId: string, characteristicId: string } }
) {
  try {
    const { change, permanent } = await request.json()

    if (typeof change !== 'number') {
      return NextResponse.json(
        { error: 'Change must be a number' },
        { status: 400 }
      )
    }

    const characteristicsSystem = new CharacteristicsSystem()
    await characteristicsSystem.changeValue(
      params.characterId,
      params.characteristicId,
      change,
      permanent || false
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to update characteristic' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { characterId: string, characteristicId: string } }
) {
  try {
    const characteristicsSystem = new CharacteristicsSystem()
    const value = await characteristicsSystem.getCurrentValue(
      params.characterId,
      params.characteristicId
    )

    return NextResponse.json({ value })
  } catch (error) {
    console.error('Error getting characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to get characteristic' },
      { status: 500 }
    )
  }
}
