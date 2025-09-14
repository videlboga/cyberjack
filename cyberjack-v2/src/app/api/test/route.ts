// app/api/test/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { TimeSystem } from '../../../../lib/core/time/time-system'
import { CharacteristicsSystem } from '../../../../lib/core/characteristics/characteristics-system'
import { ActionsSystem } from '../../../../lib/core/actions/actions-system'

export async function GET() {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      tests: {
        timeSystem: false,
        characteristicsSystem: false,
        actionsSystem: false,
        database: false
      },
      errors: [] as string[]
    }

    // Тест системы времени
    try {
      const timeSystem = TimeSystem.getInstance()
      const state = timeSystem.getState()
      results.tests.timeSystem = true
    } catch (error) {
      results.errors.push(`TimeSystem error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Тест системы характеристик
    try {
      const characteristicsSystem = new CharacteristicsSystem()
      // Просто проверяем, что класс создается
      results.tests.characteristicsSystem = true
    } catch (error) {
      results.errors.push(`CharacteristicsSystem error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Тест системы действий
    try {
      const actionsSystem = new ActionsSystem()
      // Просто проверяем, что класс создается
      results.tests.actionsSystem = true
    } catch (error) {
      results.errors.push(`ActionsSystem error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Тест базы данных
    try {
      const { prisma } = await import('@/lib/db/client')
      // Просто проверяем подключение
      await prisma.$queryRaw`SELECT 1`
      results.tests.database = true
    } catch (error) {
      results.errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const allTestsPassed = Object.values(results.tests).every(test => test === true)

    return NextResponse.json({
      ...results,
      status: allTestsPassed ? 'PASS' : 'FAIL',
      summary: `${Object.values(results.tests).filter(Boolean).length}/${Object.keys(results.tests).length} tests passed`
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}