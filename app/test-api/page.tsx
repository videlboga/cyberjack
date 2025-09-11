"use client"

import { useState, useEffect } from 'react'

export default function TestApiPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testApi = async () => {
      try {
        console.log('🧪 Testing API from browser...')
        const response = await fetch('/api/test')
        const data = await response.json()
        console.log('🧪 API response:', data)
        setResult(data)
      } catch (err) {
        console.error('🧪 API error:', err)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    testApi()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">🧪 Тест API из браузера</h1>

      <div className="space-y-6">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Результат тестирования:</h2>

          {loading && (
            <div className="text-blue-600">⏳ Загрузка...</div>
          )}

          {error && (
            <div className="text-red-600">
              ❌ Ошибка: {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Статус:</span>
                <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                  {result.success ? '✅ Успешно' : '❌ Ошибка'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-medium">Сообщение:</span>
                <span>{result.message}</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-medium">Порт сервера:</span>
                <span>{result.port}</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-medium">Конфигурация загружена:</span>
                <span className={result.configLoaded ? 'text-green-600' : 'text-red-600'}>
                  {result.configLoaded ? '✅ Да' : '❌ Нет'}
                </span>
              </div>

              {result.configLoaded && (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Персонажей:</span>
                    <span>{result.characters}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Категорий действий:</span>
                    <span>{result.actions}</span>
                  </div>
                </>
              )}

              <div className="mt-4">
                <h3 className="font-medium mb-2">Полный ответ:</h3>
                <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Информация о браузере:</h3>
          <div className="text-sm space-y-1">
            <div>Origin: {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</div>
            <div>Protocol: {typeof window !== 'undefined' ? window.location.protocol : 'N/A'}</div>
            <div>Host: {typeof window !== 'undefined' ? window.location.host : 'N/A'}</div>
            <div>Port: {typeof window !== 'undefined' ? window.location.port : 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
