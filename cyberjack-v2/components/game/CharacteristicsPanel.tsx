"use client"

import { useState, useEffect } from 'react'

interface Character {
  id: string
  name: string
  description: string | null
  age: number | null
  avatar: string | null
  isActive: boolean
  characteristics: Array<{
    currentValue: number
    baseValue: number
    definition: {
      name: string
      category: string
    }
  }>
  copyId?: string // ID персональной копии
}

interface CharacterKnowledge {
  id: string
  characteristicDefId: string
  level: 'UNKNOWN' | 'APPROXIMATE' | 'DETAILED' | 'PRECISE'
  value: number | null
  accuracy: number | null
  lastRevealed: string | null
  definition: {
    name: string
    category: string
  }
}

interface CharacteristicsPanelProps {
  character: Character
  userId: string
}

export function CharacteristicsPanel({ character, userId }: CharacteristicsPanelProps) {
  const [knowledge, setKnowledge] = useState<CharacterKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCharacterKnowledge()
  }, [character.id, userId])

  const fetchCharacterKnowledge = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/characters/${character.id}/knowledge?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setKnowledge(data)
      } else {
        setError(`Ошибка загрузки: ${response.status}`)
      }
    } catch (err) {
      console.error('❌ [UI] Ошибка загрузки знаний:', err)
      setError(err instanceof Error ? err.message : 'Ошибка загрузки знаний')
    } finally {
      setLoading(false)
    }
  }

  const getKnowledgeLevel = (characteristicId: string) => {
    const known = knowledge.find(k => k.characteristicDefId === characteristicId)
    return known?.level || 'UNKNOWN'
  }

  const getDisplayValue = (characteristic: any) => {
    const level = getKnowledgeLevel(characteristic.definition.name)
    const known = knowledge.find(k => k.characteristicDefId === characteristic.definition.name)

    switch (level) {
      case 'PRECISE':
        return {
          value: characteristic.currentValue,
          display: Math.round(characteristic.currentValue),
          accuracy: 0,
          color: 'text-green-400'
        }
      case 'DETAILED':
        return {
          value: known?.value || characteristic.currentValue,
          display: known?.value ? Math.round(known.value) : '~' + Math.round(characteristic.currentValue),
          accuracy: known?.accuracy || 15,
          color: 'text-yellow-400'
        }
      case 'APPROXIMATE':
        return {
          value: known?.value || characteristic.currentValue,
          display: known?.value ? '~' + Math.round(known.value) : '~' + Math.round(characteristic.currentValue),
          accuracy: known?.accuracy || 30,
          color: 'text-orange-400'
        }
      default:
        return {
          value: null,
          display: '???',
          accuracy: 100,
          color: 'text-gray-500'
        }
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'PRECISE': return '🎯'
      case 'DETAILED': return '🔍'
      case 'APPROXIMATE': return '📊'
      default: return '❓'
    }
  }

  const getLevelDescription = (level: string) => {
    switch (level) {
      case 'PRECISE': return 'Точное значение'
      case 'DETAILED': return 'Детальное знание (±15%)'
      case 'APPROXIMATE': return 'Приблизительное (±30%)'
      default: return 'Неизвестно'
    }
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'physical': '💪',
      'mental': '🧠',
      'emotional': '❤️',
      'social': '👥',
      'sexual': '🔥',
      'health': '🏥',
      'default': '📊'
    }
    return icons[category] || icons.default
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
        <p className="text-gray-400">Загрузка характеристик...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchCharacterKnowledge}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  // Группируем характеристики по категориям
  const characteristicsByCategory = character.characteristics.reduce((acc, char) => {
    const category = char.definition.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(char)
    return acc
  }, {} as Record<string, typeof character.characteristics>)

  return (
    <div className="p-4 space-y-4">
      {/* Заголовок */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-white">{character.name}</h3>
        <p className="text-sm text-gray-400">
          {character.copyId ? 'Персональные характеристики и уровень знаний' : 'Характеристики и уровень знаний'}
        </p>
        {character.copyId && (
          <p className="text-xs text-blue-400 mt-1">
            🔒 Ваша персональная копия персонажа
          </p>
        )}
      </div>

      {/* Характеристики по категориям */}
      {Object.entries(characteristicsByCategory).map(([category, characteristics]) => (
        <div key={category} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <span>{getCategoryIcon(category)}</span>
            <span className="capitalize">{category}</span>
          </div>

          <div className="space-y-2">
            {characteristics.map((char) => {
              const display = getDisplayValue(char)
              const level = getKnowledgeLevel(char.definition.name)

              return (
                <div key={char.definition.name} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {char.definition.name}
                      </span>
                      <span className="text-xs" title={getLevelDescription(level)}>
                        {getLevelIcon(level)}
                      </span>
                    </div>
                    <div className={`text-sm font-semibold ${display.color}`}>
                      {display.display}
                      {display.accuracy > 0 && display.accuracy < 100 && (
                        <span className="text-xs text-gray-400 ml-1">
                          (±{display.accuracy}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Прогресс-бар */}
                  <div className="relative">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          level === 'UNKNOWN'
                            ? 'bg-gray-600'
                            : level === 'PRECISE'
                            ? 'bg-green-500'
                            : level === 'DETAILED'
                            ? 'bg-yellow-500'
                            : 'bg-orange-500'
                        }`}
                        style={{
                          width: display.value !== null
                            ? `${Math.min(100, Math.max(0, display.value))}%`
                            : '0%'
                        }}
                      />
                    </div>

                    {/* Базовое значение (если известно) */}
                    {level !== 'UNKNOWN' && (
                      <div
                        className="absolute top-0 h-2 w-0.5 bg-white opacity-50"
                        style={{ left: `${char.baseValue}%` }}
                        title={`Базовое значение: ${Math.round(char.baseValue)}`}
                      />
                    )}
                  </div>

                  {/* Дополнительная информация */}
                  {level !== 'UNKNOWN' && (
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Базовое: {Math.round(char.baseValue)}</span>
                      <span>Изменение: {Math.round(char.currentValue - char.baseValue)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Легенда */}
      <div className="mt-6 p-3 bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-white mb-2">Уровни знаний:</h4>
        <div className="space-y-1 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>🎯</span>
            <span>Точное значение</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🔍</span>
            <span>Детальное (±15%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📊</span>
            <span>Приблизительное (±30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>❓</span>
            <span>Неизвестно</span>
          </div>
        </div>
      </div>
    </div>
  )
}
