import { NextResponse } from 'next/server'
import { query } from '@/lib/database/client'

export async function GET() {
  try {
    console.log('🧪 Тестируем SQL запрос...')

    const users = await query(`
      SELECT id, username, characters, user_equipment,
             characters IS NULL as chars_null,
             user_equipment IS NULL as equip_null
      FROM users
      LIMIT 1
    `)

    console.log('🧪 Результат SQL запроса:', users)

    return NextResponse.json({
      success: true,
      users,
      count: users.length
    })
  } catch (error) {
    console.error('❌ Ошибка SQL теста:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
