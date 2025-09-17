"use client"

import { useState, useEffect } from 'react'

interface Equipment {
  id: string
  name: string
  category: string
  description: string | null
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
  cost: number
  relatedPose: {
    id: string
    name: string
  } | null
  requirements: Record<string, any>
}

interface UserEquipment {
  id: string
  equipmentId: string
  quantity: number
  settings: Record<string, any>
  acquiredAt: string
  equipment: Equipment
}

interface EquipmentPanelProps {
  userId: string
}

export function EquipmentPanel({ userId }: EquipmentPanelProps) {
  const [userEquipment, setUserEquipment] = useState<UserEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      fetchEquipment()
    }
  }, [userId])

  const fetchEquipment = async () => {
    try {
      setLoading(true)

      // Проверяем, что userId определен
      if (!userId) {
        console.warn('EquipmentPanel: userId не определен')
        setError('ID пользователя не определен')
        return
      }

      // Загружаем оборудование пользователя
      const userResponse = await fetch(`/api/users/${userId}/equipment`)
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setUserEquipment(userData)
      } else {
        console.error('Ошибка загрузки оборудования пользователя:', userResponse.status, userResponse.statusText)
      }
    } catch (err) {
      console.error('EquipmentPanel fetchEquipment error:', err)
      setError(err instanceof Error ? err.message : 'Ошибка загрузки оборудования')
    } finally {
      setLoading(false)
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'COMMON': return 'text-gray-400'
      case 'UNCOMMON': return 'text-green-400'
      case 'RARE': return 'text-blue-400'
      case 'EPIC': return 'text-purple-400'
      case 'LEGENDARY': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'COMMON': return '⚪'
      case 'UNCOMMON': return '🟢'
      case 'RARE': return '🔵'
      case 'EPIC': return '🟣'
      case 'LEGENDARY': return '🟡'
      default: return '⚪'
    }
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'restraints': '🔗',
      'tools': '🔧',
      'medical': '🏥',
      'training': '💪',
      'toys': '🎮',
      'clothing': '👕',
      'furniture': '🪑',
      'default': '📦'
    }
    return icons[category] || icons.default
  }

  const handleUseEquipment = async (equipmentId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/equipment/${equipmentId}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        // Обновляем список оборудования
        await fetchEquipment()
      }
    } catch (error) {
      console.error('Error using equipment:', error)
    }
  }


  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
        <p className="text-gray-400">Загрузка оборудования...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchEquipment}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Заголовок */}
      <div className="flex-shrink-0 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎒</span>
          <span className="text-sm font-medium text-white">Мое оборудование ({userEquipment.length})</span>
        </div>
      </div>

      {/* Содержимое */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {userEquipment.length === 0 ? (
            <div className="text-center text-gray-400 py-6">
              <div className="text-3xl mb-2">🎒</div>
              <p className="text-sm">Нет оборудования</p>
              <p className="text-xs text-gray-500 mt-1">Оборудование приобретается через сюжетные события</p>
            </div>
          ) : (
            userEquipment.map((item) => (
              <div key={item.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{getCategoryIcon(item.equipment.category)}</span>
                    <div>
                      <h4 className="font-medium text-white text-sm">{item.equipment.name}</h4>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={getRarityColor(item.equipment.rarity)}>
                          {getRarityIcon(item.equipment.rarity)} {item.equipment.rarity}
                        </span>
                        <span className="text-gray-400">x{item.quantity}</span>
                      </div>
                      {item.equipment.relatedPose && (
                        <div className="text-xs text-blue-400 mt-1">
                          🎭 Связанная поза: {item.equipment.relatedPose.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUseEquipment(item.equipmentId)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-xs transition-colors"
                  >
                    Использовать
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
