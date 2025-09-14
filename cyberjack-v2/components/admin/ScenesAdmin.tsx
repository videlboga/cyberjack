'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus, Save, X, Eye, EyeOff } from 'lucide-react'

interface Scene {
  id: string
  name: string
  type: string
  description?: string
  triggerConditions: Record<string, any>
  probability: number
  isActive: boolean
  screens: Screen[]
}

interface Screen {
  id: string
  name: string
  description?: string
  content: Record<string, any>
  accessConditions: Record<string, any>
  choices: Choice[]
}

interface Choice {
  id: string
  text: string
  description?: string
  consequences: Record<string, any>
  showConditions: Record<string, any>
}

export function ScenesAdmin() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<Partial<Scene>>({
    name: '',
    type: '',
    description: '',
    triggerConditions: {},
    probability: 100,
    isActive: true
  })
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())

  // Загрузка сцен
  const fetchScenes = async () => {
    try {
      const response = await fetch('/api/story/scenes')
      if (response.ok) {
        const data = await response.json()
        setScenes(data)
      }
    } catch (error) {
      console.error('Ошибка при загрузке сцен:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScenes()
  }, [])

  // Создание новой сцены
  const handleCreate = async () => {
    try {
      const response = await fetch('/api/story/scenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchScenes()
        setIsCreating(false)
        setFormData({
          name: '',
          type: '',
          description: '',
          triggerConditions: {},
          probability: 100,
          isActive: true
        })
      }
    } catch (error) {
      console.error('Ошибка при создании сцены:', error)
    }
  }

  // Обновление сцены
  const handleUpdate = async (id: string) => {
    try {
      const response = await fetch(`/api/story/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchScenes()
        setEditingId(null)
        setFormData({
          name: '',
          type: '',
          description: '',
          triggerConditions: {},
          probability: 100,
          isActive: true
        })
      }
    } catch (error) {
      console.error('Ошибка при обновлении сцены:', error)
    }
  }

  // Удаление сцены
  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту сцену? Все связанные экраны и выборы также будут удалены.')) {
      return
    }

    try {
      const response = await fetch(`/api/story/scenes/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchScenes()
      }
    } catch (error) {
      console.error('Ошибка при удалении сцены:', error)
    }
  }

  // Начать редактирование
  const startEdit = (scene: Scene) => {
    setEditingId(scene.id)
    setFormData(scene)
  }

  // Отменить редактирование
  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({
      name: '',
      type: '',
      description: '',
      triggerConditions: {},
      probability: 100,
      isActive: true
    })
  }

  // Переключить видимость сцены
  const toggleExpanded = (sceneId: string) => {
    const newExpanded = new Set(expandedScenes)
    if (newExpanded.has(sceneId)) {
      newExpanded.delete(sceneId)
    } else {
      newExpanded.add(sceneId)
    }
    setExpandedScenes(newExpanded)
  }

  if (loading) {
    return <div className="p-6">Загрузка...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Сцены</h2>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать сцену
        </Button>
      </div>

      {/* Форма создания/редактирования */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreating ? 'Создание сцены' : 'Редактирование сцены'}
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
                  placeholder="Введите название сцены"
                />
              </div>
              <div>
                <Label htmlFor="type">Тип *</Label>
                <Input
                  id="type"
                  value={formData.type || ''}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="Введите тип сцены"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Введите описание сцены"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="probability">Вероятность активации (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={formData.probability || 100}
                onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="triggerConditions">Условия активации (JSON)</Label>
              <Textarea
                id="triggerConditions"
                value={JSON.stringify(formData.triggerConditions, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setFormData({ ...formData, triggerConditions: parsed })
                  } catch {
                    // Игнорируем ошибки парсинга во время ввода
                  }
                }}
                placeholder='{"condition": "value"}'
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={isCreating ? handleCreate : () => editingId && handleUpdate(editingId)}
                disabled={!formData.name || !formData.type}
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

      {/* Список сцен */}
      <div className="space-y-4">
        {scenes.map((scene) => (
          <Card key={scene.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{scene.name}</h3>
                    <Badge variant={scene.isActive ? 'default' : 'secondary'}>
                      {scene.isActive ? 'Активна' : 'Неактивна'}
                    </Badge>
                    <Badge variant="outline">{scene.type}</Badge>
                    <Badge variant="outline">{scene.probability}%</Badge>
                  </div>

                  {scene.description && (
                    <p className="text-sm text-gray-600 mb-2">{scene.description}</p>
                  )}

                  <div className="text-sm text-gray-500 mb-2">
                    Экранов: {scene.screens.length}
                  </div>

                  {Object.keys(scene.triggerConditions).length > 0 && (
                    <div className="text-sm text-gray-500">
                      Условия: {JSON.stringify(scene.triggerConditions)}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpanded(scene.id)}
                  >
                    {expandedScenes.has(scene.id) ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(scene)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(scene.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Детали сцены */}
              {expandedScenes.has(scene.id) && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-3">Экраны сцены</h4>
                  {scene.screens.length > 0 ? (
                    <div className="space-y-2">
                      {scene.screens.map((screen) => (
                        <div key={screen.id} className="bg-gray-50 p-3 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium">{screen.name}</h5>
                              {screen.description && (
                                <p className="text-sm text-gray-600">{screen.description}</p>
                              )}
                              <div className="text-sm text-gray-500 mt-1">
                                Выборов: {screen.choices.length}
                              </div>
                            </div>
                          </div>

                          {screen.choices.length > 0 && (
                            <div className="mt-2">
                              <h6 className="text-sm font-medium text-gray-700">Выборы:</h6>
                              <div className="space-y-1 mt-1">
                                {screen.choices.map((choice) => (
                                  <div key={choice.id} className="text-sm text-gray-600 pl-2">
                                    • {choice.text}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Экраны не найдены</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {scenes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Сцены не найдены</p>
          <p className="text-sm">Создайте первую сцену, чтобы начать</p>
        </div>
      )}
    </div>
  )
}
