import { NextResponse } from 'next/server'
import { loadGameConfig } from '@/lib/simple-db-loader'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function GET() {
  try {
    const config = await loadGameConfig()
    return NextResponse.json({
      success: true,
      config,
      meta: {
        charactersCount: config.characters?.length || 0,
        usersCount: (config as any).users?.length || 0,
        equipmentCount: (config as any).equipment?.length || 0,
        stationEntitiesCount: (config as any).station?.stationEntities?.length || 0,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500, headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    } })
  }
}

// POST /api/config — сохранение изменений в конфигурационные JSON файлы
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { target, data } = body || {}

    if (!target || !data) {
      return NextResponse.json({ success: false, error: 'Missing target or data' }, { status: 400 })
    }

    // Разрешённые цели сохранения (минимально необходимый безопасный список)
    const targetMap: Record<string, string> = {
      'characters': path.join(process.cwd(), 'data', 'characters-unified.json'),
      'characterAI': path.join(process.cwd(), 'lib', 'character', 'character-ai-config.ts'),
      'game': path.join(process.cwd(), 'data', 'game-config-unified.json'),
      // Сохранение сущностей станции из редактора
      'stationEntities': path.join(process.cwd(), 'data', 'station-entities.json'),
      // Сохранение сюжетных сцен
      'storyScenes': path.join(process.cwd(), 'data', 'story-scenes-unified.json'),
    }

    const filePath = targetMap[target]
    if (!filePath) {
      return NextResponse.json({ success: false, error: 'Unsupported target' }, { status: 400 })
    }

    // Для JSON файлов — пишем prettified JSON
    if (filePath.endsWith('.json')) {
      const json = JSON.stringify(data, null, 2)
      await writeFile(filePath, json, 'utf-8')
      return NextResponse.json({ success: true })
    }

    // Для TS конфига character-ai — ожидаем поле raw (полный текст файла)
    if (filePath.endsWith('.ts')) {
      if (typeof data?.raw !== 'string') {
        return NextResponse.json({ success: false, error: 'Expected data.raw (string) for TS target' }, { status: 400 })
      }
      await writeFile(filePath, data.raw, 'utf-8')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unhandled target type' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
