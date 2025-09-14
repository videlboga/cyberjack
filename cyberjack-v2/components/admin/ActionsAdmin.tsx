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

export function ActionsAdmin() {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    intensity: 5,
    cost: 10,
    duration: 30,
    effects: {},
    requirements: {},
    isActive: true
  })

  useEffect(() => {
    fetchActions()
  }, [])

  const fetchActions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/actions')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingId ? `/api/actions/${editingId}` : '/api/actions'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения действия')
      }

      await fetchActions()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleEdit = (action: Action) => {
    setFormData({
      name: action.name,
      category: action.category,
      description: action.description || '',
      intensity: action.intensity,
      cost: action.cost,
      duration: action.duration,
      effects: action.effects,
      requirements: action.requirements,
      isActive: action.isActive
    })
    setEditingId(action.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить это действие?')) {
      return
    }

    try {
      const response = await fetch(`/api/actions/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Ошибка удаления действия')
      }
      await fetchActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      intensity: 5,
      cost: 10,
      duration: 30,
      effects: {},
      requirements: {},
      isActive: true
    })
    setEditingId(null)
    setShowForm(false)
  }

  const updateEffects = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      effects: {
        ...prev.effects,
        [key]: value
      }
    }))
  }

  const updateRequirements = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        [key]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Управление действиями</h2>
        <Button onClick={() => setShowForm(true)}>
          Создать действие
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">
            {editingId ? 'Редактировать действие' : 'Создать действие'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите название действия"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Категория</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите категорию"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите описание действия"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Интенсивность (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.intensity}
                  onChange={(e) => setFormData({ ...formData, intensity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Стоимость (кредиты)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Длительность (сек)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30"
                  required
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                Активно
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? 'Обновить' : 'Создать'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {actions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Действия не найдены</p>
            <p className="text-sm mt-2">Создайте первое действие</p>
          </div>
        ) : (
          actions.map((action) => (
            <div key={action.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{action.name}</h3>
                    <span className="text-sm text-gray-500">({action.category})</span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        action.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {action.isActive ? 'Активно' : 'Неактивно'}
                    </span>
                  </div>
                  {action.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {action.description}
                    </p>
                  )}
                  <div className="flex gap-4 text-xs text-gray-500 mt-1">
                    <span>Интенсивность: {action.intensity}/100</span>
                    <span>Стоимость: {action.cost} кредитов</span>
                    <span>Длительность: {action.duration}с</span>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(action)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(action.id)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
