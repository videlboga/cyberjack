'use client'

import { useState } from 'react'
import { syncAllFromLocalStorage } from '@/lib/sync-utils'

export default function SyncDataPage() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSync = async () => {
    try {
      setSyncing(true)
      setResult(null)
      
      console.log('🔄 Начинаем синхронизацию...')
      await syncAllFromLocalStorage()
      
      setResult('✅ Синхронизация завершена успешно!')
      console.log('✅ Синхронизация завершена')
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error)
      setResult(`❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">🔄 Синхронизация данных</h1>
        
        <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-600">
          <p className="text-gray-300 mb-6">
            Эта страница синхронизирует данные из localStorage с файлами unified конфигурации.
            Используйте после внесения изменений в dev режиме.
          </p>
          
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
              syncing 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-cyan-600 hover:bg-cyan-700'
            }`}
          >
            {syncing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto mb-2"></div>
                Синхронизация...
              </>
            ) : (
              '🔄 Синхронизировать данные'
            )}
          </button>
          
          {result && (
            <div className={`mt-4 p-3 rounded ${
              result.startsWith('✅') 
                ? 'bg-green-900/50 border border-green-500 text-green-300' 
                : 'bg-red-900/50 border border-red-500 text-red-300'
            }`}>
              {result}
            </div>
          )}
        </div>
        
        <div className="mt-8 space-y-4">
          <a 
            href="/prod" 
            className="block bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold transition-all"
          >
            📊 Перейти на Prod
          </a>
          
          <a 
            href="/game" 
            className="block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-all"
          >
            🎮 Перейти на Game
          </a>
        </div>
      </div>
    </div>
  )
}
