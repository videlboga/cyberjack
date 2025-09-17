"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Equipment {
  id: string
  name: string
  category: string
  description: string | null
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
  cost: number
  relatedPoseId: string | null
  relatedPose: {
    id: string
    name: string
  } | null
  requirements: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PoseDefinition {
  id: string
  name: string
  category: string
}

const rarityColors = {
  COMMON: 'bg-gray-100 text-gray-800',
  UNCOMMON: 'bg-green-100 text-green-800',
  RARE: 'bg-blue-100 text-blue-800',
  EPIC: 'bg-purple-100 text-purple-800',
  LEGENDARY: 'bg-yellow-100 text-yellow-800'
}

const rarityLabels = {
  COMMON: 'Обычное',
  UNCOMMON: 'Необычное',
  RARE: 'Редкое',
  EPIC: 'Эпическое',
  LEGENDARY: 'Легендарное'
}

export function EquipmentAdmin() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [poses, setPoses] = useState<PoseDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    rarity: 'COMMON' as const,
    cost: 100,
    relatedPoseId: '',
    requirements: '{}',
    isActive: true
  })

  useEffect(() => {
    fetchEquipment()
    fetchPoses()
  }, [])

  const fetchEquipment = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/equipment')
      if (!response.ok) {
        throw new Error('Ошибка загрузки оборудования')
      }
      const data = await response.json()
      setEquipment(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const fetchPoses = async () => {
    try {
      const response = await fetch('/api/poses')
      if (response.ok) {
        const data = await response.json()
        setPoses(data)
      }
    } catch (err) {
      console.error('Error fetching poses:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingId ? `/api/equipment/${editingId}` : '/api/equipment'
      const method = editingId ? 'PUT' : 'POST'

      const submitData = {
        ...formData,
        relatedPoseId: formData.relatedPoseId || null,
        requirements: JSON.parse(formData.requirements || '{}')
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения оборудования')
      }

      await fetchEquipment()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleEdit = (item: Equipment) => {
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description || '',
      rarity: item.rarity as any,
      cost: item.cost,
      relatedPoseId: item.relatedPoseId || '',
      requirements: JSON.stringify(item.requirements, null, 2),
      isActive: item.isActive
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить это оборудование?')) {
      return
    }

    try {
      const response = await fetch(`/api/equipment/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Ошибка удаления оборудования')
      }
      await fetchEquipment()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      rarity: 'COMMON',
      cost: 100,
      relatedPoseId: '',
      requirements: '{}',
      isActive: true
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Управление оборудованием</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error && !showForm) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Управление оборудованием</h2>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchEquipment} variant="outline">
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Управление оборудованием</h2>
        <Button onClick={() => setShowForm(true)}>
          Создать оборудование
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
            {editingId ? 'Редактировать оборудование' : 'Создать оборудование'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">Название</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  placeholder="Введите название оборудования"
                  required
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium mb-1">Категория</label>
                <input
                  id="category"
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  placeholder="Введите категорию оборудования"
                  required
                />
              </div>
              <div>
                <label htmlFor="rarity" className="block text-sm font-medium mb-1">Редкость</label>
                <select
                  id="rarity"
                  value={formData.rarity}
                  onChange={(e) => setFormData({ ...formData, rarity: e.target.value as any })}
                  className="w-full p-2 border rounded-md"
                  title="Выберите редкость оборудования"
                >
                  {Object.entries(rarityLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cost" className="block text-sm font-medium mb-1">Стоимость (кредиты)</label>
                <input
                  id="cost"
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                  placeholder="Введите стоимость"
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="relatedPoseId" className="block text-sm font-medium mb-1">Связанная поза</label>
                <select
                  id="relatedPoseId"
                  value={formData.relatedPoseId}
                  onChange={(e) => setFormData({ ...formData, relatedPoseId: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  title="Выберите связанную позу"
                >
                  <option value="">Не выбрана</option>
                  {poses.map((pose) => (
                    <option key={pose.id} value={pose.id}>
                      {pose.name} ({pose.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Активно
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">Описание</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 border rounded-md"
                placeholder="Введите описание оборудования"
                rows={3}
              />
            </div>
            <div>
              <label htmlFor="requirements" className="block text-sm font-medium mb-1">Требования (JSON)</label>
              <textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="w-full p-2 border rounded-md font-mono text-sm"
                rows={4}
                placeholder='{"level": 10, "characteristics": {"mood": 50}}'
              />
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
        {equipment.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Оборудование не найдено</p>
            <p className="text-sm mt-2">Создайте первое оборудование</p>
          </div>
        ) : (
          equipment.map((item) => (
            <div key={item.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{item.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${rarityColors[item.rarity]}`}>
                      {rarityLabels[item.rarity]}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.isActive ? 'Активно' : 'Неактивно'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Категория:</strong> {item.category}</p>
                    <p><strong>Стоимость:</strong> {item.cost} кредитов</p>
                    {item.relatedPose && (
                      <p><strong>Связанная поза:</strong> {item.relatedPose.name}</p>
                    )}
                    {item.description && (
                      <p><strong>Описание:</strong> {item.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}>
                    Удалить
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
