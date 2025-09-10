// ===== КЛИЕНТ БАЗЫ ДАННЫХ CYBERJACK =====
// Централизованное подключение к PostgreSQL

import { Pool, PoolClient } from 'pg'

// Конфигурация подключения к БД
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'cyberjack',
  user: process.env.DB_USER || 'cyberjack',
  password: process.env.DB_PASSWORD || 'password',
  max: 20, // максимальное количество соединений в пуле
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

// Создание пула соединений
export const pool = new Pool(dbConfig)

// Обработка ошибок подключения
pool.on('error', (err) => {
  console.error('❌ Ошибка подключения к БД:', err)
})

// Функция для выполнения запросов с автоматическим управлением соединениями
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows
  } catch (error) {
    console.error('❌ Ошибка выполнения запроса:', error)
    throw error
  } finally {
    client.release()
  }
}

// Функция для выполнения транзакций
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Ошибка транзакции:', error)
    throw error
  } finally {
    client.release()
  }
}

// Функция для проверки подключения к БД
export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT 1')
    console.log('✅ Подключение к БД успешно')
    return true
  } catch (error) {
    console.error('❌ Не удалось подключиться к БД:', error)
    return false
  }
}

// Функция для закрытия всех соединений
export async function closePool(): Promise<void> {
  await pool.end()
  console.log('🔌 Пул соединений закрыт')
}

// Экспорт типов для использования в других модулях
export type { PoolClient }
