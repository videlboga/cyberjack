import { NextResponse } from 'next/server'
import { query } from '@/lib/database/client'

export async function GET() {
  try {
    console.log('🧪 Тестируем загрузку пользователей...')

    const users = await query(`
      SELECT id, username, characters, user_equipment
      FROM users
      LIMIT 1
    `)

    console.log('🧪 Результат запроса:', users)

    if (users.length > 0) {
      const user = users[0]
      console.log('🧪 Пользователь:', {
        id: user.id,
        username: user.username,
        characters: user.characters,
        user_equipment: user.user_equipment,
        characters_type: typeof user.characters,
        user_equipment_type: typeof user.user_equipment
      })
    }

    return NextResponse.json({
      success: true,
      users,
      count: users.length
    })
  } catch (error) {
    console.error('❌ Ошибка тестирования пользователей:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
