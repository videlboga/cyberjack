"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface CharacteristicDefinition {
  id: string
  name: string
  category: string
  description: string | null
  minValue: number
  maxValue: number
  isActive: boolean
}

export function CharacteristicsAdmin() {
  const [characteristics, setCharacteristics] = useState<CharacteristicDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    minValue: 0,
    maxValue: 100,
    isActive: true
  })

  useEffect(() => {
    fetchCharacteristics()
  }, [])

  const fetchCharacteristics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/characteristics')
      if (!response.ok) {
        throw new Error('Ошибка загрузки характеристик')
      }
      const data = await response.json()
      setCharacteristics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingId ? `/api/characteristics/${editingId}` : '/api/characteristics'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения характеристики')
      }

      await fetchCharacteristics()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleEdit = (characteristic: CharacteristicDefinition) => {
    setFormData({
      name: characteristic.name,
      category: characteristic.category,
      description: characteristic.description || '',
      minValue: characteristic.minValue,
      maxValue: characteristic.maxValue,
      isActive: characteristic.isActive
    })
    setEditingId(characteristic.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту характеристику?')) {
      return
    }

    try {
      const response = await fetch(`/api/characteristics/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Ошибка удаления характеристики')
      }
      await fetchCharacteristics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      minValue: 0,
      maxValue: 100,
      isActive: true
    })
    setEditingId(null)
    setShowForm(false)
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
        <h2 className="text-xl font-semibold">Управление характеристиками</h2>
        <Button onClick={() => setShowForm(true)}>
          Создать характеристику
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
            {editingId ? 'Редактировать характеристику' : 'Создать характеристику'}
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
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Минимальное значение</label>
                <input
                  type="number"
                  value={formData.minValue}
                  onChange={(e) => setFormData({ ...formData, minValue: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Максимальное значение</label>
                <input
                  type="number"
                  value={formData.maxValue}
                  onChange={(e) => setFormData({ ...formData, maxValue: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  Активна
                </label>
              </div>
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
        {characteristics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Характеристики не найдены</p>
            <p className="text-sm mt-2">Создайте первую характеристику</p>
          </div>
        ) : (
          characteristics.map((characteristic) => (
            <div key={characteristic.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{characteristic.name}</h3>
                    <span className="text-sm text-gray-500">({characteristic.category})</span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        characteristic.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {characteristic.isActive ? 'Активна' : 'Неактивна'}
                    </span>
                  </div>
                  {characteristic.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {characteristic.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Диапазон: {characteristic.minValue} - {characteristic.maxValue}
                  </p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(characteristic)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(characteristic.id)}
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
