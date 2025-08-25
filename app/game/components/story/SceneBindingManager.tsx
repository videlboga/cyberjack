'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  Edit,
  Trash2,
  Target,
  AlertTriangle,
  Settings,
  Save
} from "lucide-react"

import { 
  SceneEventBinding, 
  SceneCondition 
} from '@/lib/story-binding-types'
import { StoryBindingUtils } from '@/lib/story-binding-utils'

interface SceneBindingManagerProps {
  sceneId: string
  sceneType: 'auction' | 'anomaly'
  bindings: SceneEventBinding[]
  onBindingsChange: (bindings: SceneEventBinding[]) => void
}

export const SceneBindingManager: React.FC<SceneBindingManagerProps> = ({
  sceneId,
  sceneType,
  bindings,
  onBindingsChange
}) => {
  const [selectedBinding, setSelectedBinding] = useState<SceneEventBinding | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const addBinding = () => {
    const newBinding = StoryBindingUtils.createBinding(
      sceneType,
      sceneId,
      [],
      30,
      1,
      false
    )
    onBindingsChange([...bindings, newBinding])
    setSelectedBinding(newBinding)
    setIsEditing(true)
  }

  const updateBinding = (bindingId: string, updates: Partial<SceneEventBinding>) => {
    const updatedBindings = bindings.map(binding =>
      binding.id === bindingId ? { ...binding, ...updates } : binding
    )
    onBindingsChange(updatedBindings)
    
    if (selectedBinding?.id === bindingId) {
      setSelectedBinding({ ...selectedBinding, ...updates })
    }
  }

  const deleteBinding = (bindingId: string) => {
    const updatedBindings = bindings.filter(binding => binding.id !== bindingId)
    onBindingsChange(updatedBindings)
    
    if (selectedBinding?.id === bindingId) {
      setSelectedBinding(null)
      setIsEditing(false)
    }
  }

  const addCondition = (bindingId: string) => {
    const binding = bindings.find(b => b.id === bindingId)
    if (!binding) return

    const newCondition = StoryBindingUtils.createCondition(
      'asset',
      'any_asset_price',
      '>',
      1000,
      'Новое условие'
    )

    const updatedConditions = [...binding.conditions, newCondition]
    updateBinding(bindingId, { conditions: updatedConditions })
  }

  const updateCondition = (bindingId: string, conditionId: string, updates: Partial<SceneCondition>) => {
    const binding = bindings.find(b => b.id === bindingId)
    if (!binding) return

    const updatedConditions = binding.conditions.map(condition =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    )
    updateBinding(bindingId, { conditions: updatedConditions })
  }

  const deleteCondition = (bindingId: string, conditionId: string) => {
    const binding = bindings.find(b => b.id === bindingId)
    if (!binding) return

    const updatedConditions = binding.conditions.filter(condition => condition.id !== conditionId)
    updateBinding(bindingId, { conditions: updatedConditions })
  }

  const getEventTypeIcon = (type: 'auction' | 'anomaly') => {
    switch (type) {
      case 'auction': return <Target className="h-4 w-4 text-purple-600" />
      case 'anomaly': return <AlertTriangle className="h-4 w-4 text-red-600" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  const getEventTypeColor = (type: 'auction' | 'anomaly') => {
    switch (type) {
      case 'auction': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'anomaly': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getEventTypeIcon(sceneType)}
          <h3 className="text-lg font-semibold">
            Привязки к {sceneType === 'auction' ? 'аукциону' : 'аномалиям'}
          </h3>
        </div>
        <Button size="sm" onClick={addBinding}>
          <Plus className="h-3 w-3 mr-1" />
          Добавить привязку
        </Button>
      </div>

      {/* Список привязок */}
      <ScrollArea className="h-64">
        <div className="space-y-2">
          {bindings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Нет привязок. Создайте первую привязку для этой сцены.</p>
            </div>
          ) : (
            bindings.map(binding => (
              <Card 
                key={binding.id} 
                className={`cursor-pointer transition-colors ${
                  selectedBinding?.id === binding.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => {
                  setSelectedBinding(binding)
                  setIsEditing(false)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getEventTypeColor(binding.eventType)}>
                        {binding.eventType === 'auction' ? 'Аукцион' : 'Аномалия'}
                      </Badge>
                      {binding.isBaseChance && (
                        <Badge variant="secondary">Базовый шанс</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {binding.probability}% | Приоритет: {binding.priority}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBinding(binding)
                            setIsEditing(true)
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteBinding(binding.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      Условий: {binding.conditions.length}
                    </p>
                    {binding.conditions.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {binding.conditions.slice(0, 2).map(condition => (
                          <div key={condition.id} className="text-xs bg-gray-50 px-2 py-1 rounded">
                            {condition.description}
                          </div>
                        ))}
                        {binding.conditions.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{binding.conditions.length - 2} ещё
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Редактор привязки */}
      {selectedBinding && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Редактирование привязки</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Просмотр' : 'Редактировать'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedBinding(null)
                    setIsEditing(false)
                  }}
                >
                  ✕
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                {/* Основные настройки */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="probability">Вероятность (%)</Label>
                    <Input
                      id="probability"
                      type="number"
                      value={selectedBinding.probability}
                      onChange={(e) => updateBinding(selectedBinding.id, { 
                        probability: parseInt(e.target.value) || 0 
                      })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Приоритет</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={selectedBinding.priority}
                      onChange={(e) => updateBinding(selectedBinding.id, { 
                        priority: parseInt(e.target.value) || 1 
                      })}
                      min="1"
                      max="10"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="base-chance"
                    checked={selectedBinding.isBaseChance}
                    onCheckedChange={(checked) => updateBinding(selectedBinding.id, { 
                      isBaseChance: checked 
                    })}
                  />
                  <Label htmlFor="base-chance">Базовый шанс</Label>
                </div>

                {/* Условия */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Условия</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addCondition(selectedBinding.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить условие
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedBinding.conditions.map(condition => (
                      <div key={condition.id} className="border rounded p-3">
                        <div className="grid grid-cols-4 gap-2">
                          <Select
                            value={condition.type}
                            onValueChange={(value: 'asset' | 'player' | 'game_state') => 
                              updateCondition(selectedBinding.id, condition.id, { type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asset">Актив</SelectItem>
                              <SelectItem value="player">Игрок</SelectItem>
                              <SelectItem value="game_state">Игра</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Select
                            value={condition.field}
                            onValueChange={(value) => 
                              updateCondition(selectedBinding.id, condition.id, { field: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {StoryBindingUtils.getAvailableFields(condition.type).map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Select
                            value={condition.operator}
                            onValueChange={(value: '==' | '!=' | '>' | '<' | '>=' | '<=') => 
                              updateCondition(selectedBinding.id, condition.id, { operator: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="==">=</SelectItem>
                              <SelectItem value="!=">≠</SelectItem>
                              <SelectItem value=">">&gt;</SelectItem>
                              <SelectItem value="<">&lt;</SelectItem>
                              <SelectItem value=">=">≥</SelectItem>
                              <SelectItem value="<=">≤</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <div className="flex gap-1">
                            <Input
                              value={condition.value}
                              onChange={(e) => 
                                updateCondition(selectedBinding.id, condition.id, { 
                                  value: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                                })
                              }
                              placeholder="Значение"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteCondition(selectedBinding.id, condition.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <Textarea
                            value={condition.description}
                            onChange={(e) => 
                              updateCondition(selectedBinding.id, condition.id, { 
                                description: e.target.value 
                              })
                            }
                            placeholder="Описание условия"
                            rows={1}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Просмотр привязки */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Вероятность</Label>
                    <p className="text-lg font-semibold">{selectedBinding.probability}%</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Приоритет</Label>
                    <p className="text-lg font-semibold">{selectedBinding.priority}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Тип</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={getEventTypeColor(selectedBinding.eventType)}>
                      {selectedBinding.eventType === 'auction' ? 'Аукцион' : 'Аномалия'}
                    </Badge>
                    {selectedBinding.isBaseChance && (
                      <Badge variant="secondary">Базовый шанс</Badge>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Условия ({selectedBinding.conditions.length})</Label>
                  <div className="mt-1 space-y-1">
                    {selectedBinding.conditions.map(condition => (
                      <div key={condition.id} className="text-sm bg-gray-50 px-3 py-2 rounded">
                        <div className="font-medium">{condition.description}</div>
                        <div className="text-muted-foreground">
                          {condition.type}: {condition.field} {condition.operator} {condition.value}
                        </div>
                      </div>
                    ))}
                    {selectedBinding.conditions.length === 0 && (
                      <div className="text-sm text-muted-foreground italic">
                        Нет условий
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

