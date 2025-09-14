"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

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
  onActionStart?: () => void
  onActionEnd?: () => void
  isHolding?: boolean
}

export function ActionsPanel({
  characterId,
  userId,
  onActionStart,
  onActionEnd,
  isHolding = false
}: ActionsPanelProps) {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

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

  const executeAction = async (action: Action) => {
    try {
      setIsExecuting(true)
      setSelectedAction(action)

      if (onActionStart) {
        onActionStart()
      }

      const response = await fetch('/api/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          actionId: action.id,
          userId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка выполнения действия')
      }

      const result = await response.json()

      // Показать результат
      alert(`Действие "${action.name}" выполнено!\n${result.message}`)

      // Обновить список действий (могли измениться требования)
      await fetchAvailableActions()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка выполнения действия')
    } finally {
      setIsExecuting(false)
      setSelectedAction(null)

      if (onActionEnd) {
        onActionEnd()
      }
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Доступные действия</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Доступные действия</h2>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchAvailableActions}>
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  const actionsByCategory = getActionsByCategory()

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <h2 className="text-xl font-semibold mb-4">Доступные действия</h2>

      {actions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Доступные действия не найдены</p>
          <p className="text-sm mt-2">Проверьте требования к действиям</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(actionsByCategory).map(([category, categoryActions]) => (
            <div key={category}>
              <h3 className="font-medium text-gray-700 mb-2">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryActions.map((action) => (
                  <div
                    key={action.id}
                    className={`p-3 border rounded-lg ${
                      isExecuting && selectedAction?.id === action.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{action.name}</h4>
                      <div className="text-right text-sm text-gray-500">
                        <div>{action.cost} кредитов</div>
                        <div>{action.duration}с</div>
                      </div>
                    </div>

                    {action.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {action.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-gray-500">Интенсивность:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${action.intensity}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{action.intensity}%</span>
                    </div>

                    <Button
                      onClick={() => executeAction(action)}
                      disabled={isExecuting}
                      className="w-full"
                      size="sm"
                    >
                      {isExecuting && selectedAction?.id === action.id ? (
                        'Выполняется...'
                      ) : (
                        'Выполнить'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
