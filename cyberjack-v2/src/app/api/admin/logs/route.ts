// src/app/api/admin/logs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { serverLogger, LogCategory, LogLevel } from '@/lib/utils/server-logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category') as LogCategory | undefined
    const level = searchParams.get('level') as LogLevel | undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Получаем логи
    const logs = await serverLogger.getLogs(category, level, limit + offset)

    // Применяем пагинацию
    const paginatedLogs = logs.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: {
        logs: paginatedLogs,
        total: logs.length,
        hasMore: logs.length > offset + limit
      }
    })
  } catch (error) {
    console.error('Ошибка получения логов:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка получения логов' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const logEntry = await request.json()
    
    // Логируем полученный лог от клиента
    serverLogger.info(
      LogCategory.API, 
      'Получен лог от клиента', 
      logEntry
    )

    return NextResponse.json({
      success: true,
      message: 'Лог получен'
    })
  } catch (error) {
    console.error('Ошибка обработки лога от клиента:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка обработки лога' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const daysOld = parseInt(searchParams.get('daysOld') || '30')

    // Очищаем старые логи
    await serverLogger.cleanupOldLogs(daysOld)

    return NextResponse.json({
      success: true,
      message: `Старые логи (старше ${daysOld} дней) удалены`
    })
  } catch (error) {
    console.error('Ошибка очистки логов:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка очистки логов' },
      { status: 500 }
    )
  }
}
