// ===== API ENDPOINT ДЛЯ УНИВЕРСАЛЬНОЙ ЗАГРУЗКИ КОНФИГУРАЦИИ =====
// Переключается между JSON файлами и базой данных в зависимости от feature flags

import { NextResponse } from 'next/server'
import { loadGameConfig } from '@/lib/simple-db-loader'

// GET /api/db/config - ПРОСТОЙ API: Используем единственный загрузчик
export async function GET() {
  try {
    console.log('🔥 ПРОСТОЙ DB API: Используем единственный загрузчик')
    const config = await loadGameConfig()


    return NextResponse.json({
      success: true,
      config,
      source: 'database',
      sources: { database: true, json: false, errors: [] },
      meta: {
        charactersCount: config.characters?.length || 0,
        actionsCount: Object.keys(config.actions?.categories || {}).length,
        contractsCount: config.contracts?.length || 0,
        eventsCount: (config.events?.anomalies?.length || 0) + (config.events?.crises?.length || 0) + (config.events?.opportunities?.length || 0),
        equipmentCount: config.equipment?.length || 0,
        usersCount: config.users?.length || 0,
        storyScenesCount: config.storyScenes?.length || 0,
        conditionsCount: config.conditions?.length || 0,
        stationEntitiesCount: Object.keys(config.station?.stationEntities || {}).length,
        timestamp: new Date().toISOString(),
        featureFlags: ['useDatabase']
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ Ошибка загрузки универсальной конфигурации:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}

// POST /api/db/config - Очистка кэша
export async function POST() {
  try {
    console.log('🗑️ Очистка кэша универсальной конфигурации...')
    clearUniversalConfigCache()

    return NextResponse.json({
      success: true,
      message: 'Кэш очищен'
    })
  } catch (error) {
    console.error('❌ Ошибка очистки кэша:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, {
      status: 500
    })
  }
}
