'use client'

import { useState, useEffect } from 'react'

export default function TestConfigPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    async function loadConfig() {
      try {
        console.log('🔄 Загружаем конфигурацию...')
        const { loadUnifiedConfigWithAdapter } = await import('@/lib/unified-config-adapter')
        const loadedConfig = await loadUnifiedConfigWithAdapter()
        console.log('✅ Конфигурация загружена:', loadedConfig)
        setConfig(loadedConfig)
      } catch (err) {
        console.error('❌ Ошибка загрузки:', err)
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Тестирование конфигурации...</h2>
          <p className="text-gray-400">Загрузка данных</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Ошибка загрузки</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Тест конфигурации</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Активы</h3>
            <p className="text-2xl font-bold text-cyan-400">
              {config?.assets?.assets?.length || 0}
            </p>
            <div className="mt-4 space-y-2">
              {config?.assets?.assets?.map((asset: any) => (
                <div key={asset.id} className="text-sm text-gray-300">
                  {asset.name} ({asset.rank})
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Контракты</h3>
            <p className="text-2xl font-bold text-green-400">
              {config?.contracts?.available?.length || 0}
            </p>
            <div className="mt-4 space-y-2">
              {config?.contracts?.available?.map((contract: any) => (
                <div key={contract.id} className="text-sm text-gray-300">
                  {contract.title}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">События</h3>
            <p className="text-2xl font-bold text-purple-400">
              {(config?.events?.anomalies?.length || 0) + 
               (config?.events?.crises?.length || 0) + 
               (config?.events?.opportunities?.length || 0)}
            </p>
            <div className="mt-4 space-y-2">
              <div className="text-sm text-gray-300">
                Аномалии: {config?.events?.anomalies?.length || 0}
              </div>
              <div className="text-sm text-gray-300">
                Кризисы: {config?.events?.crises?.length || 0}
              </div>
              <div className="text-sm text-gray-300">
                Возможности: {config?.events?.opportunities?.length || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button 
            onClick={() => window.location.href = '/prod'} 
            className="bg-cyan-600 hover:bg-cyan-700 px-6 py-3 rounded-lg font-semibold"
          >
            Перейти на Prod страницу
          </button>
        </div>
      </div>
    </div>
  )
}






