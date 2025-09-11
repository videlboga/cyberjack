import { NextResponse } from 'next/server'

export async function GET() {
  console.log('🧪 Тестовый маршрут вызван')

  try {
    const { loadGameConfig } = await import('@/lib/simple-db-loader')
    console.log('📚 Импорт loadGameConfig успешен')

    const config = await loadGameConfig()
    console.log('🎯 Конфигурация получена:', {
      characters: config.characters?.length || 0,
      users: config.users?.length || 0
    })

    return NextResponse.json({
      success: true,
      message: 'Тестовый маршрут работает',
      config: {
        charactersCount: config.characters?.length || 0,
        usersCount: config.users?.length || 0,
        equipmentCount: config.equipment?.length || 0
      }
    })
  } catch (error) {
    console.error('❌ Ошибка в тестовом маршруте:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
