import { NextResponse } from 'next/server'
import { query } from '@/lib/database/client'

export async function GET() {
  try {
    console.log('🧪 Тестируем loadUsers функцию...')

    // Копируем логику из loadUsers
    const users = await query(`
      SELECT id, username, email, role, status, created_at, last_login,
             account, characters, user_equipment, attributes, stats,
             assets, preferences, metadata, credits, experience, level
      FROM users
      ORDER BY created_at DESC
    `)

    console.log('🧪 Результат запроса:', users.length, 'пользователей')
    if (users.length > 0) {
      console.log('🧪 Первый пользователь:', {
        id: users[0].id,
        username: users[0].username,
        characters: users[0].characters,
        user_equipment: users[0].user_equipment,
        allKeys: Object.keys(users[0])
      })
    }

    // Обрабатываем пользователей как в loadUsers
    const processedUsers = users.map(user => ({
      ...user,
      characters: user.characters || [],
      equipment: user.user_equipment || [],
      assets: user.assets || [],
      user_equipment: user.user_equipment || []
    }))

    console.log('🧪 Обработанные пользователи:', processedUsers.length)
    if (processedUsers.length > 0) {
      console.log('🧪 Первый обработанный пользователь:', {
        id: processedUsers[0].id,
        username: processedUsers[0].username,
        characters: processedUsers[0].characters,
        user_equipment: processedUsers[0].user_equipment,
        allKeys: Object.keys(processedUsers[0])
      })
    }

    return NextResponse.json({
      success: true,
      users: processedUsers,
      count: processedUsers.length
    })
  } catch (error) {
    console.error('❌ Ошибка тестирования loadUsers:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
