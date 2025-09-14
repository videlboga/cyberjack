'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus, Save, X } from 'lucide-react'

interface StoryPoint {
  id: string
  name: string
  type: 'NUMERIC' | 'BOOLEAN' | 'STRING'
  category?: string
  description?: string
  defaultValue?: number
  minValue?: number
  maxValue?: number
  tags: string[]
  isActive: boolean
}

export function StoryPointsAdmin() {
  const [storyPoints, setStoryPoints] = useState<StoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<Partial<StoryPoint>>({
    name: '',
    type: 'NUMERIC',
    category: '',
    description: '',
    defaultValue: 0,
    minValue: 0,
    maxValue: 100,
    tags: [],
    isActive: true
  })
  const [newTag, setNewTag] = useState('')

  // Загрузка сюжетных точек
  const fetchStoryPoints = async () => {
    try {
      const response = await fetch('/api/story/points')
      if (response.ok) {
        const data = await response.json()
        setStoryPoints(data)
      }
    } catch (error) {
      console.error('Ошибка при загрузке сюжетных точек:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStoryPoints()
  }, [])

  // Создание новой сюжетной точки
  const handleCreate = async () => {
    try {
      const response = await fetch('/api/story/points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchStoryPoints()
        setIsCreating(false)
        setFormData({
          name: '',
          type: 'NUMERIC',
          category: '',
          description: '',
          defaultValue: 0,
          minValue: 0,
          maxValue: 100,
          tags: [],
          isActive: true
        })
      }
    } catch (error) {
      console.error('Ошибка при создании сюжетной точки:', error)
    }
  }

  // Обновление сюжетной точки
  const handleUpdate = async (id: string) => {
    try {
      const response = await fetch(`/api/story/points/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchStoryPoints()
        setEditingId(null)
        setFormData({
          name: '',
          type: 'NUMERIC',
          category: '',
          description: '',
          defaultValue: 0,
          minValue: 0,
          maxValue: 100,
          tags: [],
          isActive: true
        })
      }
    } catch (error) {
      console.error('Ошибка при обновлении сюжетной точки:', error)
    }
  }

  // Удаление сюжетной точки
  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту сюжетную точку?')) {
      return
    }

    try {
      const response = await fetch(`/api/story/points/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchStoryPoints()
      }
    } catch (error) {
      console.error('Ошибка при удалении сюжетной точки:', error)
    }
  }

  // Начать редактирование
  const startEdit = (storyPoint: StoryPoint) => {
    setEditingId(storyPoint.id)
    setFormData(storyPoint)
  }

  // Отменить редактирование
  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({
      name: '',
      type: 'NUMERIC',
      category: '',
      description: '',
      defaultValue: 0,
      minValue: 0,
      maxValue: 100,
      tags: [],
      isActive: true
    })
  }

  // Добавить тег
  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag.trim()]
      })
      setNewTag('')
    }
  }

  // Удалить тег
  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(tag => tag !== tagToRemove) || []
    })
  }

  if (loading) {
    return <div className="p-6">Загрузка...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Сюжетные точки</h2>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать сюжетную точку
        </Button>
      </div>

      {/* Форма создания/редактирования */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreating ? 'Создание сюжетной точки' : 'Редактирование сюжетной точки'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Введите название"
                />
              </div>
              <div>
                <Label htmlFor="type">Тип *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'NUMERIC' | 'BOOLEAN' | 'STRING') =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NUMERIC">Числовой</SelectItem>
                    <SelectItem value="BOOLEAN">Логический</SelectItem>
                    <SelectItem value="STRING">Строковый</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="category">Категория</Label>
              <Input
                id="category"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Введите категорию"
              />
            </div>

            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Введите описание"
                rows={3}
              />
            </div>

            {formData.type === 'NUMERIC' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="defaultValue">Значение по умолчанию</Label>
                  <Input
                    id="defaultValue"
                    type="number"
                    value={formData.defaultValue || 0}
                    onChange={(e) => setFormData({ ...formData, defaultValue: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="minValue">Минимальное значение</Label>
                  <Input
                    id="minValue"
                    type="number"
                    value={formData.minValue || 0}
                    onChange={(e) => setFormData({ ...formData, minValue: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="maxValue">Максимальное значение</Label>
                  <Input
                    id="maxValue"
                    type="number"
                    value={formData.maxValue || 100}
                    onChange={(e) => setFormData({ ...formData, maxValue: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Теги</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Добавить тег"
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                />
                <Button type="button" onClick={addTag} size="sm">
                  Добавить
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags?.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-500"
                      title={`Удалить тег ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={isCreating ? handleCreate : () => editingId && handleUpdate(editingId)}
                disabled={!formData.name}
              >
                <Save className="w-4 h-4 mr-2" />
                {isCreating ? 'Создать' : 'Сохранить'}
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Список сюжетных точек */}
      <div className="grid gap-4">
        {storyPoints.map((storyPoint) => (
          <Card key={storyPoint.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{storyPoint.name}</h3>
                    <Badge variant={storyPoint.isActive ? 'default' : 'secondary'}>
                      {storyPoint.isActive ? 'Активна' : 'Неактивна'}
                    </Badge>
                    <Badge variant="outline">{storyPoint.type}</Badge>
                    {storyPoint.category && (
                      <Badge variant="outline">{storyPoint.category}</Badge>
                    )}
                  </div>

                  {storyPoint.description && (
                    <p className="text-sm text-gray-600 mb-2">{storyPoint.description}</p>
                  )}

                  {storyPoint.type === 'NUMERIC' && (
                    <div className="text-sm text-gray-500 mb-2">
                      Значение: {storyPoint.defaultValue || 0}
                      (мин: {storyPoint.minValue || 0}, макс: {storyPoint.maxValue || 100})
                    </div>
                  )}

                  {storyPoint.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {storyPoint.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(storyPoint)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(storyPoint.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {storyPoints.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Сюжетные точки не найдены</p>
          <p className="text-sm">Создайте первую сюжетную точку, чтобы начать</p>
        </div>
      )}
    </div>
  )
}
