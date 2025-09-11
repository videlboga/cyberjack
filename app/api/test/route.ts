import { NextResponse } from 'next/server'

export async function GET() {
  console.log('🧪 Тестовый маршрут вызван')

  try {
    // Простой тест - возвращаем фиктивные данные
    return NextResponse.json({
      success: true,
      message: 'API работает!',
      timestamp: new Date().toISOString(),
      testData: {
        characters: 4,
        actions: 17,
        tools: 5
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
