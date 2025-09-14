"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { PoseFormulasEditor } from './PoseFormulasEditor-v2'
import { PoseFormulas } from '@/types/pose-formulas'

interface PoseDefinition {
  id: string
  name: string
  category: string
  description: string | null
  effects: Record<string, any>
  requirements: Record<string, any>
  isActive: boolean
  angles: Array<{
    id: string
    name: string
    angle: string
    media: Record<string, any>
    zones: Array<{
      id: string
      name: string
      x: number
      y: number
      width: number
      height: number
      anatomy: {
        id: string
        name: string
      } | null
    }>
  }>
}

export function PosesAdmin() {
  const [poses, setPoses] = useState<PoseDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showFormulasEditor, setShowFormulasEditor] = useState(false)
  const [editingPoseId, setEditingPoseId] = useState<string | null>(null)
  const [editingPoseName, setEditingPoseName] = useState<string>('')

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    effects: {},
    requirements: {},
    isActive: true
  })

  useEffect(() => {
    fetchPoses()
  }, [])

  const fetchPoses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/poses')
      if (!response.ok) {
        throw new Error('Ошибка загрузки поз')
      }
      const data = await response.json()
      setPoses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingId ? `/api/poses/${editingId}` : '/api/poses'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения позы')
      }

      await fetchPoses()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleEdit = (pose: PoseDefinition) => {
    setFormData({
      name: pose.name,
      category: pose.category,
      description: pose.description || '',
      effects: pose.effects,
      requirements: pose.requirements,
      isActive: pose.isActive
    })
    setEditingId(pose.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту позу?')) {
      return
    }

    try {
      const response = await fetch(`/api/poses/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Ошибка удаления позы')
      }
      await fetchPoses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      effects: {},
      requirements: {},
      isActive: true
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEditFormulas = (pose: PoseDefinition) => {
    setEditingPoseId(pose.id)
    setEditingPoseName(pose.name)
    setShowFormulasEditor(true)
  }

  const handleSaveFormulas = async (formulas: PoseFormulas) => {
    if (!editingPoseId) return

    try {
      const response = await fetch(`/api/poses/${editingPoseId}/formulas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulas)
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения формул')
      }

      setShowFormulasEditor(false)
      setEditingPoseId(null)
      setEditingPoseName('')
      await fetchPoses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения формул')
    }
  }

  const handleCancelFormulas = () => {
    setShowFormulasEditor(false)
    setEditingPoseId(null)
    setEditingPoseName('')
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
        <h2 className="text-xl font-semibold">Управление позами</h2>
        <Button onClick={() => setShowForm(true)}>
          Создать позу
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
            {editingId ? 'Редактировать позу' : 'Создать позу'}
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
                  placeholder="Введите название позы"
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
                placeholder="Введите описание позы"
                rows={3}
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
        {poses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Позы не найдены</p>
            <p className="text-sm mt-2">Создайте первую позу</p>
          </div>
        ) : (
          poses.map((pose) => (
            <div key={pose.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{pose.name}</h3>
                    <span className="text-sm text-gray-500">({pose.category})</span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        pose.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {pose.isActive ? 'Активна' : 'Неактивна'}
                    </span>
                  </div>
                  {pose.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {pose.description}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Ракурсы: {pose.angles?.length || 0}</p>
                    <p>Активные зоны: {pose.angles?.reduce((total, angle) => total + (angle.zones?.length || 0), 0) || 0}</p>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditFormulas(pose)}
                    title="Редактировать формулы"
                  >
                    🧮
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(pose)}
                    title="Редактировать позу"
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(pose.id)}
                    title="Удалить позу"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Редактор формул */}
      {showFormulasEditor && editingPoseId && (
        <PoseFormulasEditor
          poseId={editingPoseId}
          poseName={editingPoseName}
          onSave={handleSaveFormulas}
          onCancel={handleCancelFormulas}
        />
      )}
    </div>
  )
}
