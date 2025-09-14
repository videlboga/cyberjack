// src/app/api/poses/auto/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { AutoPoseSystem } from '../../../../../lib/core/poses/auto-pose-system'

export async function GET() {
  try {
    const autoPoseSystem = AutoPoseSystem.getInstance()

    // Получить статистику автоматических поз
    const stats = await autoPoseSystem.getAutoPoseStats()

    // Получить список автоматических поз
    const autoPoses = await autoPoseSystem.getAutoPoses()

    return NextResponse.json({
      success: true,
      stats,
      autoPoses
    })
  } catch (error) {
    console.error('Error fetching auto poses:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch auto poses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, characterId } = await request.json()
    const autoPoseSystem = AutoPoseSystem.getInstance()

    switch (action) {
      case 'check_all':
        await autoPoseSystem.checkAndApplyAutoPoses()
        return NextResponse.json({
          success: true,
          message: 'Проверка автоматических поз выполнена'
        })

      case 'check_character':
        if (!characterId) {
          return NextResponse.json(
            { error: 'characterId is required for check_character action' },
            { status: 400 }
          )
        }

        const result = await autoPoseSystem.forceCheckCharacterPoses(characterId)
        return NextResponse.json({
          success: true,
          message: `Проверка поз для персонажа ${characterId} выполнена`,
          result
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check_all, check_character' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error executing auto pose action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute auto pose action' },
      { status: 500 }
    )
  }
}
