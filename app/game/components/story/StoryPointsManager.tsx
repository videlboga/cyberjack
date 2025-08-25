'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Plus,
  Edit,
  Trash2,
  Target,
  Zap,
  Settings,
  Save,
  RotateCcw
} from "lucide-react"
import { ConditionBuilder } from "@/components/ui/ConditionBuilder"
import { 
  Condition, 
  AssetCondition, 
  PlayerCondition,
  Asset,
  User,
  GameState
} from '@/lib/types'
import { 
  ConditionUtils as Utils,
  ConditionEvaluator as Evaluator,
  ConditionValidator
} from '@/lib/condition-utils'

// Интерфейсы для сюжетных точек
interface StoryPoint {
  id: string
  name: string
  description: string
  value: number | boolean | string
  minValue: number
  maxValue: number
  type: 'numeric' | 'boolean' | 'string'
  category: 'relationship' | 'skill' | 'resource' | 'story' | 'custom'
  tags: string[]
  conditions?: StoryCondition[]
  triggers?: StoryTrigger[]
}

interface StoryCondition {
  id: string
  name: string
  description: string
  type: 'equals' | 'greater' | 'less' | 'range' | 'contains'
  storyPointId: string
  value: any
  secondValue?: any // для range условий
}

interface StoryTrigger {
  id: string
  name: string
  description: string
  conditionIds: string[]
  actions: TriggerAction[]
  isActive: boolean
}

interface TriggerAction {
  type: 'setStoryPoint' | 'showDialog' | 'unlockScene' | 'addResource'
  target: string
  value: any
}

interface StoryPointsManagerProps {
  storyPoints: Record<string, StoryPoint>
  conditions?: Record<string, StoryCondition>
  triggers?: Record<string, StoryTrigger>
  onUpdateStoryPoints: (storyPoints: Record<string, StoryPoint>) => void
  onUpdateConditions?: (conditions: Record<string, StoryCondition>) => void
  onUpdateTriggers?: (triggers: Record<string, StoryTrigger>) => void
  // Новые пропсы для универсальной системы условий
  assets?: Asset[]
  users?: User[]
  gameState?: GameState
}

export function StoryPointsManager({
  storyPoints = {},
  conditions = {},
  triggers = {},
  onUpdateStoryPoints,
  onUpdateConditions,
  onUpdateTriggers,
  assets = [],
  users = [],
  gameState
}: StoryPointsManagerProps) {
  const [selectedStoryPoint, setSelectedStoryPoint] = useState<StoryPoint | null>(null)
  const [selectedCondition, setSelectedCondition] = useState<StoryCondition | null>(null)
  const [selectedTrigger, setSelectedTrigger] = useState<StoryTrigger | null>(null)
  const [editingStoryPoint, setEditingStoryPoint] = useState<Partial<StoryPoint>>({})
  const [editingCondition, setEditingCondition] = useState<Partial<StoryCondition>>({})
  const [editingTrigger, setEditingTrigger] = useState<Partial<StoryTrigger>>({})
  const [activeTab, setActiveTab] = useState<'storypoints' | 'conditions' | 'triggers'>('storypoints')
  
  // Состояние для универсальной системы условий
  const [universalConditions, setUniversalConditions] = useState<Record<string, Condition>>({})
  const [selectedUniversalCondition, setSelectedUniversalCondition] = useState<Condition | null>(null)
  const [evaluationResult, setEvaluationResult] = useState<boolean | null>(null)

  // Функция для нормализации сюжетных точек - добавляет недостающие поля
  const normalizeStoryPoints = (points: Record<string, any>): Record<string, StoryPoint> => {
    const normalized: Record<string, StoryPoint> = {}
    
    Object.entries(points).forEach(([id, point]) => {
      normalized[id] = {
        id,
        name: point.name || 'Неизвестная точка',
        description: point.description || '',
        value: point.value ?? point.defaultValue ?? 0,
        minValue: point.minValue ?? 0,
        maxValue: point.maxValue ?? 100,
        type: point.type || 'numeric',
        category: point.category || 'story',
        tags: point.tags || [],
        conditions: point.conditions || [],
        triggers: point.triggers || []
      }
    })
    
    return normalized
  }

  // Нормализуем входящие данные
  const normalizedStoryPoints = normalizeStoryPoints(storyPoints)

  // Функции для работы с сюжетными точками
  const addStoryPoint = () => {
    const newId = `sp_${Date.now()}`
    const newStoryPoint: StoryPoint = {
      id: newId,
      name: 'Новая сюжетная точка',
      description: '',
      value: 0,
      minValue: 0,
      maxValue: 100,
      type: 'numeric',
      category: 'story',
      tags: [],
      conditions: [],
      triggers: []
    }
    
    const updatedStoryPoints = {
      ...storyPoints,
      [newId]: newStoryPoint
    }
    
    onUpdateStoryPoints(updatedStoryPoints)
    setSelectedStoryPoint(newStoryPoint)
    setEditingStoryPoint(newStoryPoint)
  }

  const updateStoryPoint = (id: string, updates: Partial<StoryPoint>) => {
    const updatedStoryPoints = {
      ...storyPoints,
      [id]: { ...storyPoints[id], ...updates }
    }
    
    onUpdateStoryPoints(updatedStoryPoints)
    
    if (selectedStoryPoint?.id === id) {
      setSelectedStoryPoint(updatedStoryPoints[id])
    }
  }

  const deleteStoryPoint = (id: string) => {
    const updatedStoryPoints = { ...storyPoints }
    delete updatedStoryPoints[id]
    
    onUpdateStoryPoints(updatedStoryPoints)
    
    if (selectedStoryPoint?.id === id) {
      setSelectedStoryPoint(null)
    }
  }

  const addCondition = () => {
    if (!onUpdateConditions) return
    
    const newId = `cond_${Date.now()}`
    const newCondition: StoryCondition = {
      id: newId,
      name: 'Новое условие',
      description: '',
      type: 'equals',
      storyPointId: Object.keys(storyPoints)[0] || '',
      value: 0
    }
    
    const updatedConditions = {
      ...conditions,
      [newId]: newCondition
    }
    
    onUpdateConditions(updatedConditions)
    setSelectedCondition(newCondition)
    setEditingCondition(newCondition)
  }

  const addTrigger = () => {
    if (!onUpdateTriggers) return
    
    const newId = `trigger_${Date.now()}`
    const newTrigger: StoryTrigger = {
      id: newId,
      name: 'Новый триггер',
      description: '',
      conditionIds: [],
      actions: [],
      isActive: true
    }
    
    const updatedTriggers = {
      ...triggers,
      [newId]: newTrigger
    }
    
    onUpdateTriggers(updatedTriggers)
    setSelectedTrigger(newTrigger)
    setEditingTrigger(newTrigger)
  }

  const saveEditingStoryPoint = () => {
    if (editingStoryPoint.id) {
      updateStoryPoint(editingStoryPoint.id, editingStoryPoint)
      setEditingStoryPoint({})
    }
  }

  const saveEditingCondition = () => {
    if (editingCondition.id && onUpdateConditions) {
      const updatedConditions = {
        ...conditions,
        [editingCondition.id]: editingCondition as StoryCondition
      }
      onUpdateConditions(updatedConditions)
      setEditingCondition({})
    }
  }

  const saveEditingTrigger = () => {
    if (editingTrigger.id && onUpdateTriggers) {
      const updatedTriggers = {
        ...triggers,
        [editingTrigger.id]: editingTrigger as StoryTrigger
      }
      onUpdateTriggers(updatedTriggers)
      setEditingTrigger({})
    }
  }

  const deleteCondition = (id: string) => {
    if (!onUpdateConditions) return
    
    const updatedConditions = { ...conditions }
    delete updatedConditions[id]
    onUpdateConditions(updatedConditions)
    
    if (selectedCondition?.id === id) {
      setSelectedCondition(null)
    }
  }

  const deleteTrigger = (id: string) => {
    if (!onUpdateTriggers) return
    
    const updatedTriggers = { ...triggers }
    delete updatedTriggers[id]
    onUpdateTriggers(updatedTriggers)
    
    if (selectedTrigger?.id === id) {
      setSelectedTrigger(null)
    }
  }

  // Функции для универсальной системы условий
  const addUniversalCondition = () => {
    const newCondition: Condition = {
      id: Utils.generateConditionId(),
      type: "asset_condition",
      name: "Новое условие",
      description: "Описание условия",
      target: {
        entityId: "any",
        attribute: "strength",
        operator: ">=",
        value: 3
      }
    } as AssetCondition
    
    setUniversalConditions(prev => ({
      ...prev,
      [newCondition.id]: newCondition
    }))
    setSelectedUniversalCondition(newCondition)
  }

  const updateUniversalCondition = (condition: Condition) => {
    setUniversalConditions(prev => ({
      ...prev,
      [condition.id]: condition
    }))
  }

  const deleteUniversalCondition = (id: string) => {
    setUniversalConditions(prev => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
    
    if (selectedUniversalCondition?.id === id) {
      setSelectedUniversalCondition(null)
    }
  }

  const evaluateUniversalCondition = () => {
    if (!selectedUniversalCondition || !gameState) return
    
    try {
      const result = Evaluator.evaluateCondition(selectedUniversalCondition, gameState)
      setEvaluationResult(result)
    } catch (error) {
      console.error("Ошибка вычисления условия:", error)
      setEvaluationResult(false)
    }
  }

  const getStoryPointValue = (storyPoint: StoryPoint) => {
    if (storyPoint.type === 'boolean') {
      return storyPoint.value ? 'Да' : 'Нет'
    }
    return storyPoint.value?.toString() || '0'
  }

  const getValueColor = (storyPoint: StoryPoint) => {
    if (storyPoint.type === 'numeric') {
      const value = typeof storyPoint.value === 'number' ? storyPoint.value : 0
      const minValue = typeof storyPoint.minValue === 'number' ? storyPoint.minValue : 0
      const maxValue = typeof storyPoint.maxValue === 'number' ? storyPoint.maxValue : 100
      const percentage = ((value - minValue) / (maxValue - minValue)) * 100
      if (percentage < 33) return 'text-red-600'
      if (percentage < 66) return 'text-yellow-600'
      return 'text-green-600'
    }
    return 'text-blue-600'
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      relationship: 'bg-pink-100 text-pink-800',
      skill: 'bg-blue-100 text-blue-800',
      resource: 'bg-green-100 text-green-800',
      story: 'bg-purple-100 text-purple-800',
      custom: 'bg-gray-100 text-gray-800'
    }
    return colors[category as keyof typeof colors] || colors.custom
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Панель инструментов */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Управление сюжетными точками</h1>
          
          <div className="flex gap-1 bg-muted rounded-md p-1">
            <Button
              variant={activeTab === 'storypoints' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('storypoints')}
            >
              <Target className="h-3 w-3 mr-1" />
              Точки
            </Button>
            <Button
              variant={activeTab === 'conditions' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('conditions')}
            >
              <Zap className="h-3 w-3 mr-1" />
              Условия
            </Button>
            <Button
              variant={activeTab === 'triggers' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('triggers')}
            >
              <Settings className="h-3 w-3 mr-1" />
              Триггеры
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          {activeTab === 'storypoints' && (
            <Button onClick={addStoryPoint}>
              <Plus className="h-3 w-3 mr-1" />
              Добавить точку
            </Button>
          )}
          {activeTab === 'conditions' && (
            <Button onClick={addUniversalCondition}>
              <Plus className="h-3 w-3 mr-1" />
              Добавить условие
            </Button>
          )}
          {activeTab === 'triggers' && (
            <Button onClick={addTrigger}>
              <Plus className="h-3 w-3 mr-1" />
              Добавить триггер
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Список элементов */}
        <div className="flex-1 p-4">
          <ScrollArea className="h-full">
            {activeTab === 'storypoints' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(normalizedStoryPoints).map((storyPoint) => (
                  <Card 
                    key={storyPoint.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedStoryPoint?.id === storyPoint.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedStoryPoint(storyPoint)
                      setEditingStoryPoint(storyPoint)
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{storyPoint.name}</CardTitle>
                        <Badge className={getCategoryColor(storyPoint.category)}>
                          {storyPoint.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Значение:</span>
                          <span className={`font-semibold ${getValueColor(storyPoint)}`}>
                            {getStoryPointValue(storyPoint)}
                          </span>
                        </div>
                        
                        {storyPoint.type === 'numeric' && (
                          <div className="space-y-1">
                            <Progress 
                              value={(() => {
                                const value = typeof storyPoint.value === 'number' ? storyPoint.value : 0
                                const minValue = typeof storyPoint.minValue === 'number' ? storyPoint.minValue : 0
                                const maxValue = typeof storyPoint.maxValue === 'number' ? storyPoint.maxValue : 100
                                return ((value - minValue) / (maxValue - minValue)) * 100
                              })()} 
                              className="h-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{storyPoint.minValue}</span>
                              <span>{storyPoint.maxValue}</span>
                            </div>
                          </div>
                        )}
                        
                        {storyPoint.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {storyPoint.description}
                          </p>
                        )}
                        
                        {storyPoint.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {storyPoint.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {storyPoint.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{storyPoint.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {Object.keys(normalizedStoryPoints).length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Нет сюжетных точек</h3>
                    <p className="text-muted-foreground mb-4">
                      Создайте первую сюжетную точку для отслеживания прогресса в игре
                    </p>
                    <Button onClick={addStoryPoint}>
                      <Plus className="h-4 w-4 mr-2" />
                      Создать сюжетную точку
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'conditions' && (
              <div className="space-y-4">
                {Object.keys(universalConditions).length > 0 ? (
                  Object.values(universalConditions).map((condition) => (
                    <Card 
                      key={condition.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedUniversalCondition?.id === condition.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => {
                        setSelectedUniversalCondition(condition)
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{condition.name}</CardTitle>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteUniversalCondition(condition.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {condition.description || 'Описание отсутствует'}
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline">{condition.type}</Badge>
                            <span className="text-muted-foreground">
                              {Utils.getConditionDescription(condition)}
                            </span>
                          </div>
                          {gameState && (
                            <div className="text-xs text-muted-foreground">
                              Валидно: {ConditionValidator.validateCondition(condition) ? '✅ Да' : '❌ Нет'}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Нет условий</h3>
                    <p className="text-muted-foreground mb-4">
                      Создайте универсальные условия для активации сцен и событий
                    </p>
                    <Button onClick={addUniversalCondition}>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить условие
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'triggers' && (
              <div className="space-y-4">
                {Object.keys(triggers).length > 0 ? (
                  Object.values(triggers).map((trigger) => (
                    <Card 
                      key={trigger.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedTrigger?.id === trigger.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => {
                        setSelectedTrigger(trigger)
                        setEditingTrigger(trigger)
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{trigger.name}</CardTitle>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteTrigger(trigger.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {trigger.description || 'Описание отсутствует'}
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant={trigger.isActive ? "default" : "secondary"}>
                              {trigger.isActive ? 'Активен' : 'Неактивен'}
                            </Badge>
                            <span className="text-muted-foreground">
                              {trigger.conditionIds.length} условий
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Действий: {trigger.actions.length}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Нет триггеров</h3>
                    <p className="text-muted-foreground mb-4">
                      Создайте автоматические события на основе условий
                    </p>
                    <Button onClick={addTrigger}>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить триггер
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Панель редактирования */}
        <div className="w-80 border-l p-4 overflow-y-auto">
          {selectedStoryPoint && activeTab === 'storypoints' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Редактирование точки</h3>
                <div className="flex gap-1">
                  <Button size="sm" onClick={saveEditingStoryPoint}>
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setEditingStoryPoint(selectedStoryPoint)}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteStoryPoint(selectedStoryPoint.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={editingStoryPoint.name || ''}
                    onChange={(e) => setEditingStoryPoint(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Название сюжетной точки"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={editingStoryPoint.description || ''}
                    onChange={(e) => setEditingStoryPoint(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Описание назначения этой точки"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="type">Тип</Label>
                    <Select
                      value={editingStoryPoint.type || 'numeric'}
                      onValueChange={(value) => setEditingStoryPoint(prev => ({ ...prev, type: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="numeric">Число</SelectItem>
                        <SelectItem value="boolean">Да/Нет</SelectItem>
                        <SelectItem value="string">Текст</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="category">Категория</Label>
                    <Select
                      value={editingStoryPoint.category || 'story'}
                      onValueChange={(value) => setEditingStoryPoint(prev => ({ ...prev, category: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relationship">Отношения</SelectItem>
                        <SelectItem value="skill">Навыки</SelectItem>
                        <SelectItem value="resource">Ресурсы</SelectItem>
                        <SelectItem value="story">Сюжет</SelectItem>
                        <SelectItem value="custom">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Примеры использования */}
                <div className="bg-muted p-3 rounded-md">
                  <h4 className="text-sm font-semibold mb-2">Примеры использования:</h4>
                  <div className="text-xs space-y-1">
                    <p><strong>Число:</strong> Репутация (0-100), Навыки (1-10), Кредиты</p>
                    <p><strong>Да/Нет:</strong> Статусы, Флаги, Доступность</p>
                    <p><strong>Текст:</strong> Имена NPC, Локации, Ключевые слова</p>
                    <p><strong>Отношения:</strong> Дружба с фракциями, Романтические связи</p>
                    <p><strong>Навыки:</strong> Боевые, Социальные, Технические</p>
                    <p><strong>Ресурсы:</strong> Деньги, Материалы, Энергия</p>
                  </div>
                </div>

                {editingStoryPoint.type === 'numeric' && (
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="value">Текущее значение</Label>
                      <Input
                        id="value"
                        type="number"
                        value={typeof editingStoryPoint.value === 'number' ? editingStoryPoint.value : 0}
                        onChange={(e) => setEditingStoryPoint(prev => ({ ...prev, value: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="minValue">Минимум</Label>
                        <Input
                          id="minValue"
                          type="number"
                          value={typeof editingStoryPoint.minValue === 'number' ? editingStoryPoint.minValue : 0}
                          onChange={(e) => setEditingStoryPoint(prev => ({ ...prev, minValue: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxValue">Максимум</Label>
                        <Input
                          id="maxValue"
                          type="number"
                          value={typeof editingStoryPoint.maxValue === 'number' ? editingStoryPoint.maxValue : 100}
                          onChange={(e) => setEditingStoryPoint(prev => ({ ...prev, maxValue: parseInt(e.target.value) || 100 }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingStoryPoint.type === 'boolean' && (
                  <div>
                    <Label htmlFor="boolValue">Значение</Label>
                    <Select
                      value={typeof editingStoryPoint.value === 'boolean' ? (editingStoryPoint.value ? 'true' : 'false') : 'false'}
                      onValueChange={(value) => setEditingStoryPoint(prev => ({ ...prev, value: value === 'true' }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Да</SelectItem>
                        <SelectItem value="false">Нет</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editingStoryPoint.type === 'string' && (
                  <div>
                    <Label htmlFor="stringValue">Значение</Label>
                    <Input
                      id="stringValue"
                      value={typeof editingStoryPoint.value === 'string' ? editingStoryPoint.value : ''}
                      onChange={(e) => setEditingStoryPoint(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="Текстовое значение"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="tags">Теги (через запятую)</Label>
                  <Input
                    id="tags"
                    value={editingStoryPoint.tags?.join(', ') || ''}
                    onChange={(e) => setEditingStoryPoint(prev => ({ 
                      ...prev, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                    }))}
                    placeholder="тег1, тег2, тег3"
                  />
                </div>
              </div>
            </div>
          ) : selectedUniversalCondition && activeTab === 'conditions' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Редактирование условия</h3>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedUniversalCondition(null)}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteUniversalCondition(selectedUniversalCondition.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <ConditionBuilder
                condition={selectedUniversalCondition}
                onConditionChange={updateUniversalCondition}
                assets={assets}
                users={users}
              />

              {gameState && (
                <div className="space-y-2">
                  <Button onClick={evaluateUniversalCondition} className="w-full">
                    🧮 Вычислить условие
                  </Button>
                  
                  {evaluationResult !== null && (
                    <div className={`p-3 rounded ${
                      evaluationResult 
                        ? 'bg-green-50 border border-green-200 text-green-800' 
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                      <strong>Результат:</strong> {evaluationResult ? 'Истинно' : 'Ложно'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : selectedTrigger && activeTab === 'triggers' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Редактирование триггера</h3>
                <div className="flex gap-1">
                  <Button size="sm" onClick={saveEditingTrigger}>
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setEditingTrigger(selectedTrigger)}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteTrigger(selectedTrigger.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="triggerName">Название</Label>
                  <Input
                    id="triggerName"
                    value={editingTrigger.name || ''}
                    onChange={(e) => setEditingTrigger(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Название триггера"
                  />
                </div>

                <div>
                  <Label htmlFor="triggerDescription">Описание</Label>
                  <Textarea
                    id="triggerDescription"
                    value={editingTrigger.description || ''}
                    onChange={(e) => setEditingTrigger(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Описание триггера"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="triggerActive"
                    checked={editingTrigger.isActive || false}
                    onCheckedChange={(checked) => setEditingTrigger(prev => ({ ...prev, isActive: checked === true }))}
                  />
                  <Label htmlFor="triggerActive" className="text-sm">Активен</Label>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Выберите элемент для редактирования</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
