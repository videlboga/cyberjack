"use client"

import { useState, useEffect } from 'react'

interface Action {
  id: string
  name: string
  category: string
  description: string | null
  intensity: number
  cost: number
  duration: number
  effects: Record<string, any>
  requirements: Record<string, any>
  isActive: boolean
}

interface ActionsPanelProps {
  characterId: string
  userId: string
  selectedAction: string | null
  onActionSelect: (actionId: string) => void
  onActionDeselect: () => void
}

export function ActionsPanel({
  characterId,
  userId,
  selectedAction,
  onActionSelect,
  onActionDeselect
}: ActionsPanelProps) {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('all')

  useEffect(() => {
    if (characterId && userId) {
      fetchAvailableActions()
    }
  }, [characterId, userId])

  const fetchAvailableActions = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/actions?characterId=${characterId}&userId=${userId}`
      )
      if (!response.ok) {
        throw new Error('Ошибка загрузки действий')
      }
      const data = await response.json()
      setActions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const getActionsByCategory = () => {
    const categories: Record<string, Action[]> = {}
    actions.forEach(action => {
      if (!categories[action.category]) {
        categories[action.category] = []
      }
      categories[action.category].push(action)
    })
    return categories
  }

  const getFilteredActions = () => {
    if (activeTab === 'all') return actions
    return actions.filter(action => action.category === activeTab)
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'touch': '✋',
      'talk': '💬',
      'equipment': '🔧',
      'medical': '🏥',
      'training': '💪',
      'interaction': '🤝',
      'default': '⚡'
    }
    return icons[category] || icons.default
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
        <p className="text-gray-400">Загрузка действий...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchAvailableActions}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  const actionsByCategory = getActionsByCategory()
  const filteredActions = getFilteredActions()

  return (
    <div className="h-full flex flex-col">
      {/* Табы категорий */}
      <div className="flex-shrink-0 border-b border-purple-400 border-opacity-30">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-purple-400 text-purple-300 '
                : 'border-transparent text-gray-400 hover:text-purple-300'
            }`}
          >
            Все ({actions.length})
          </button>
          {Object.keys(actionsByCategory).map((category) => (
            <button
              key={category}
              onClick={() => setActiveTab(category)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === category
                  ? 'border-purple-400 text-purple-300 '
                  : 'border-transparent text-gray-400 hover:text-purple-300'
              }`}
            >
              {getCategoryIcon(category)} {category} ({actionsByCategory[category].length})
            </button>
          ))}
        </div>
      </div>

      {/* Список действий */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredActions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2 ">⚡</div>
            <p>Действия не найдены</p>
            <p className="text-sm mt-1 text-purple-300">
              {activeTab === 'all'
                ? 'Проверьте требования к действиям'
                : `Нет действий в категории "${activeTab}"`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActions.map((action) => (
              <div
                key={action.id}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  selectedAction === action.id
                    ? 'liquid-glass-card border-purple-400 neon-border-purple'
                    : 'liquid-glass-card border-purple-400 border-opacity-20 hover:border-purple-400 hover:border-opacity-40'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg ">{getCategoryIcon(action.category)}</span>
                    <h4 className="font-semibold text-white ">{action.name}</h4>
                  </div>
                  <div className="text-right text-sm text-purple-300">
                    <div>{action.cost} кредитов</div>
                    <div>{action.duration}с</div>
                  </div>
                </div>

                {action.description && (
                  <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                    {action.description}
                  </p>
                )}

                {/* Интенсивность */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-purple-300">Интенсивность:</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300  intensity-bar"
                      style={{ '--intensity-width': `${action.intensity}%` } as React.CSSProperties}
                    ></div>
                  </div>
                  <span className="text-xs text-purple-300">{action.intensity}%</span>
                </div>

                {/* Кнопка действия */}
                <button
                  onClick={() => {
                    if (selectedAction === action.id) {
                      onActionDeselect()
                    } else {
                      onActionSelect(action.id)
                    }
                  }}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors liquid-shimmer ${
                    selectedAction === action.id
                      ? 'glass-button neon-border-red'
                      : 'glass-button neon-border-purple'
                  }`}
                >
                  {selectedAction === action.id ? (
                    <>
                      🎯 Отменить выбор
                      <div className="text-xs mt-1">Кликните на зону персонажа</div>
                    </>
                  ) : (
                    'Выбрать действие'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Подсказка */}
      {selectedAction && (
        <div className="flex-shrink-0 p-4 liquid-glass-card border-t border-purple-400 border-opacity-30">
          <div className="text-sm text-purple-300">
            <div className="font-semibold mb-1 ">🎯 Активные зоны включены</div>
            <p>Кликните на красные зоны на изображении персонажа для выполнения действия</p>
          </div>
        </div>
      )}
    </div>
  )
}