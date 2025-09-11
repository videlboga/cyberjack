import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Настройки подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
})

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Проверка здоровья базы данных')

    // Проверяем подключение
    const client = await pool.connect()

    try {
      // Выполняем простой запрос
      const result = await client.query('SELECT NOW() as current_time')

      // Получаем список таблиц
      const tablesResult = await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `)

      const tableStats = tablesResult.rows.map(row => ({
        table: row.tablename
      }))

      return NextResponse.json({
        status: 'healthy',
        message: 'База данных работает корректно',
        timestamp: result.rows[0].current_time,
        tables: tableStats,
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || '5433',
          database: process.env.DB_NAME || 'cyberjack'
        }
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('❌ Ошибка проверки здоровья БД:', error)
    return NextResponse.json({
      status: 'unhealthy',
      message: 'Ошибка подключения к базе данных',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
