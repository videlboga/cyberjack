"use client"

import { useState, useEffect } from 'react'

export default function SimpleTestPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🧪 Простой тест загрузки данных...')
        const response = await fetch('/api/db/config')
        const result = await response.json()

        if (result.success) {
          setData(result.config)
          console.log('✅ Данные загружены:', {
            characters: result.config.characters?.length || 0,
            actions: Object.keys(result.config.actions?.categories || {}).length,
            contracts: result.config.contracts?.length || 0,
            equipment: result.config.equipment?.length || 0
          })
        } else {
          setError(result.error || 'Ошибка загрузки данных')
        }
      } catch (err) {
        console.error('❌ Ошибка:', err)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="font-bold">Ошибка загрузки данных</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <h2 className="font-bold">Данные не найдены</h2>
          <p>Не удалось загрузить данные из API</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">🧪 Простой тест отображения сущностей</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="font-bold text-blue-800">Персонажи</h3>
          <p className="text-2xl font-bold text-blue-600">{data.characters?.length || 0}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="font-bold text-green-800">Действия</h3>
          <p className="text-2xl font-bold text-green-600">{Object.keys(data.actions?.categories || {}).length}</p>
        </div>
        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="font-bold text-purple-800">Контракты</h3>
          <p className="text-2xl font-bold text-purple-600">{data.contracts?.length || 0}</p>
        </div>
        <div className="bg-orange-100 p-4 rounded-lg">
          <h3 className="font-bold text-orange-800">Оборудование</h3>
          <p className="text-2xl font-bold text-orange-600">{data.equipment?.length || 0}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Персонажи */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Персонажи из базы данных</h2>
          {data.characters && data.characters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.characters.map((character: any, index: number) => (
                <div key={character.id || index} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {character.avatar && <span className="text-2xl">{character.avatar}</span>}
                    <h3 className="font-bold">{character.name || 'Без названия'}</h3>
                  </div>
                  {character.description && (
                    <p className="text-sm text-gray-600 mb-2">{character.description}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {character.rank && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {character.rank}
                      </span>
                    )}
                    {character.status && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {character.status}
                      </span>
                    )}
                    {character.price && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        {character.price} кредитов
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Персонажи не найдены</p>
          )}
        </div>

        {/* Действия */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Действия из базы данных</h2>
          {data.actions && data.actions.categories ? (
            <div className="space-y-4">
              {Object.entries(data.actions.categories).map(([category, actions]: [string, any]) => (
                <div key={category} className="border rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Array.isArray(actions) && actions.map((action: any, index: number) => (
                      <div key={action.id || index} className="bg-gray-50 p-3 rounded">
                        <h4 className="font-semibold">{action.name || action.title || 'Без названия'}</h4>
                        {action.description && (
                          <p className="text-sm text-gray-600">{action.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Действия не найдены</p>
          )}
        </div>

        {/* Контракты */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Контракты из базы данных</h2>
          {data.contracts && data.contracts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.contracts.map((contract: any, index: number) => (
                <div key={contract.id || index} className="border rounded-lg p-4">
                  <h3 className="font-bold">{contract.title || 'Без названия'}</h3>
                  {contract.client && (
                    <p className="text-sm text-gray-600">Клиент: {contract.client}</p>
                  )}
                  {contract.description && (
                    <p className="text-sm text-gray-600 mt-2">{contract.description}</p>
                  )}
                  {contract.reward && (
                    <p className="text-sm font-semibold text-green-600 mt-2">
                      Награда: {contract.reward} кредитов
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Контракты не найдены</p>
          )}
        </div>

        {/* Оборудование */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Оборудование из базы данных</h2>
          {data.equipment && data.equipment.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.equipment.map((equipment: any, index: number) => (
                <div key={equipment.id || index} className="border rounded-lg p-4">
                  <h3 className="font-bold">{equipment.name || 'Без названия'}</h3>
                  {equipment.description && (
                    <p className="text-sm text-gray-600 mb-2">{equipment.description}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {equipment.type && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {equipment.type}
                      </span>
                    )}
                    {equipment.category && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {equipment.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Оборудование не найдено</p>
          )}
        </div>
      </div>
    </div>
  )
}
