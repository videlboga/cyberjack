'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Eye,
  Target,
  AlertTriangle,
  Settings,
  FileText
} from "lucide-react"

import { 
  SimplifiedStoryScene, 
  StorySceneBinding, 
  StorySceneCondition,
  StoryScreen,
  StoryChoice
} from '@/lib/types'
import { StorySceneUtils } from '@/lib/story-scene-utils'

interface SimplifiedStoryEditorProps {
  scenes: SimplifiedStoryScene[]
  onScenesChange: (scenes: SimplifiedStoryScene[]) => void
}

export default function SimplifiedStoryEditor({ scenes, onScenesChange }: SimplifiedStoryEditorProps) {
  const [selectedScene, setSelectedScene] = useState<SimplifiedStoryScene | null>(null)
  const [selectedBinding, setSelectedBinding] = useState<StorySceneBinding | null>(null)
  const [editingMode, setEditingMode] = useState<'scene' | 'binding' | 'condition'>('scene')

  // Создать новую сцену
  const createNewScene = () => {
    const newScene: SimplifiedStoryScene = {
      id: `scene_${Date.now()}`,
      title: 'Новая сцена',
      description: 'Описание новой сцены',
      type: 'auction',
      screens: [{
        id: 'screen_1',
        title: 'Начальный экран',
        description: 'Описание начального экрана',
        choices: [{
          id: 'choice_1',
          text: 'Продолжить',
          consequences: [],
          navigation: { type: 'end_scene' }
        }]
      }],
      bindings: [],
      metadata: {
        author: 'user',
        version: '1.0',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    }

    onScenesChange([...scenes, newScene])
    setSelectedScene(newScene)
  }

  // Обновить сцену
  const updateScene = (sceneId: string, updates: Partial<SimplifiedStoryScene>) => {
    const updatedScenes = scenes.map(scene => 
      scene.id === sceneId ? { ...scene, ...updates, metadata: { ...scene.metadata, lastModified: new Date().toISOString() } } : scene
    )
    onScenesChange(updatedScenes)
    setSelectedScene(updatedScenes.find(s => s.id === sceneId) || null)
  }

  // Удалить сцену
  const deleteScene = (sceneId: string) => {
    const updatedScenes = scenes.filter(scene => scene.id !== sceneId)
    onScenesChange(updatedScenes)
    setSelectedScene(null)
  }

  // Создать новую привязку
  const createNewBinding = (sceneId: string) => {
    if (!selectedScene) return

    const newBinding: StorySceneBinding = StorySceneUtils.createSceneBinding(
      selectedScene.type,
      sceneId,
      [],
      30,
      1
    )

    const updatedScene = {
      ...selectedScene,
      bindings: [...selectedScene.bindings, newBinding],
      metadata: { ...selectedScene.metadata, lastModified: new Date().toISOString() }
    }

    updateScene(sceneId, updatedScene)
    setSelectedBinding(newBinding)
    setEditingMode('binding')
  }

  // Обновить привязку
  const updateBinding = (bindingId: string, updates: Partial<StorySceneBinding>) => {
    if (!selectedScene) return

    const updatedBindings = selectedScene.bindings.map(binding =>
      binding.id === bindingId ? { ...binding, ...updates, metadata: { ...binding.metadata, lastModified: new Date().toISOString() } } : binding
    )

    updateScene(selectedScene.id, { bindings: updatedBindings })
    setSelectedBinding(updatedBindings.find(b => b.id === bindingId) || null)
  }

  // Удалить привязку
  const deleteBinding = (bindingId: string) => {
    if (!selectedScene) return

    const updatedBindings = selectedScene.bindings.filter(binding => binding.id !== bindingId)
    updateScene(selectedScene.id, { bindings: updatedBindings })
    setSelectedBinding(null)
  }

  // Создать новое условие
  const createNewCondition = (bindingId: string) => {
    if (!selectedBinding) return

    const newCondition: StorySceneCondition = StorySceneUtils.createBaseCondition(
      'asset',
      'any_asset_price',
      '>',
      1000,
      'Цена любого актива больше 1000'
    )

    const updatedConditions = [...selectedBinding.conditions, newCondition]
    updateBinding(bindingId, { conditions: updatedConditions })
  }

  // Обновить условие
  const updateCondition = (conditionId: string, updates: Partial<StorySceneCondition>) => {
    if (!selectedBinding) return

    const updatedConditions = selectedBinding.conditions.map(condition =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    )

    updateBinding(selectedBinding.id, { conditions: updatedConditions })
  }

  // Удалить условие
  const deleteCondition = (conditionId: string) => {
    if (!selectedBinding) return

    const updatedConditions = selectedBinding.conditions.filter(condition => condition.id !== conditionId)
    updateBinding(selectedBinding.id, { conditions: updatedConditions })
  }

  // Группировка сцен по типу
  const auctionScenes = useMemo(() => scenes.filter(s => s.type === 'auction'), [scenes])
  const anomalyScenes = useMemo(() => scenes.filter(s => s.type === 'anomaly'), [scenes])

  return (
    <div className="flex h-full gap-4">
      {/* Левая панель - список сцен */}
      <div className="w-1/3 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Сюжетные сцены</CardTitle>
              <Button onClick={createNewScene} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Новая сцена
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="auction" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auction" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Аукцион ({auctionScenes.length})
                </TabsTrigger>
                <TabsTrigger value="anomaly" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Аномалии ({anomalyScenes.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="auction" className="mt-4">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {auctionScenes.map(scene => (
                      <Card 
                        key={scene.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedScene?.id === scene.id ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedScene(scene)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{scene.title}</h4>
                              <p className="text-sm text-gray-600">{scene.description}</p>
                              <Badge variant="outline" className="mt-1">
                                {scene.bindings.length} привязок
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteScene(scene.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="anomaly" className="mt-4">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {anomalyScenes.map(scene => (
                      <Card 
                        key={scene.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedScene?.id === scene.id ? 'border-red-500 bg-red-50' : ''
                        }`}
                        onClick={() => setSelectedScene(scene)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{scene.title}</h4>
                              <p className="text-sm text-gray-600">{scene.description}</p>
                              <Badge variant="outline" className="mt-1">
                                {scene.bindings.length} привязок
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteScene(scene.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Правая панель - редактирование */}
      <div className="flex-1 space-y-4">
        {selectedScene ? (
          <>
            {/* Редактирование сцены */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Редактирование сцены</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={editingMode === 'scene' ? 'default' : 'outline'}
                      onClick={() => setEditingMode('scene')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Сцена
                    </Button>
                    <Button
                      size="sm"
                      variant={editingMode === 'binding' ? 'default' : 'outline'}
                      onClick={() => setEditingMode('binding')}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Привязки
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingMode === 'scene' ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="scene-title">Название сцены</Label>
                      <Input
                        id="scene-title"
                        value={selectedScene.title}
                        onChange={(e) => updateScene(selectedScene.id, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="scene-description">Описание</Label>
                      <Textarea
                        id="scene-description"
                        value={selectedScene.description}
                        onChange={(e) => updateScene(selectedScene.id, { description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="scene-type">Тип сцены</Label>
                      <Select
                        value={selectedScene.type}
                        onValueChange={(value: 'auction' | 'anomaly') => 
                          updateScene(selectedScene.id, { type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auction">Аукцион</SelectItem>
                          <SelectItem value="anomaly">Аномалии</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Привязки сцены</h3>
                      <Button onClick={() => createNewBinding(selectedScene.id)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Новая привязка
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {selectedScene.bindings.map(binding => (
                        <Card 
                          key={binding.id}
                          className={`cursor-pointer transition-colors ${
                            selectedBinding?.id === binding.id ? 'border-blue-500 bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedBinding(binding)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">
                                  Привязка к {binding.type === 'auction' ? 'аукциону' : 'аномалиям'}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Вероятность: {binding.probability}% | Приоритет: {binding.priority}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Условий: {binding.conditions.length}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteBinding(binding.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Редактирование привязки */}
            {selectedBinding && (
              <Card>
                <CardHeader>
                  <CardTitle>Редактирование привязки</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="binding-probability">Вероятность (%)</Label>
                        <Input
                          id="binding-probability"
                          type="number"
                          value={selectedBinding.probability}
                          onChange={(e) => updateBinding(selectedBinding.id, { probability: parseInt(e.target.value) })}
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="binding-priority">Приоритет</Label>
                        <Input
                          id="binding-priority"
                          type="number"
                          value={selectedBinding.priority}
                          onChange={(e) => updateBinding(selectedBinding.id, { priority: parseInt(e.target.value) })}
                          min="1"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Условия</Label>
                        <Button onClick={() => createNewCondition(selectedBinding.id)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Новое условие
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {selectedBinding.conditions.map(condition => (
                          <Card key={condition.id} className="p-3">
                            <div className="grid grid-cols-4 gap-2 items-center">
                              <Select
                                value={condition.type}
                                onValueChange={(value: 'asset' | 'player' | 'game_state') => 
                                  updateCondition(condition.id, { type: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="asset">Актив</SelectItem>
                                  <SelectItem value="player">Игрок</SelectItem>
                                  <SelectItem value="game_state">Состояние игры</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={condition.field}
                                onValueChange={(value) => updateCondition(condition.id, { field: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {StorySceneUtils.getAvailableFields(condition.type).map(field => (
                                    <SelectItem key={field.value} value={field.value}>
                                      {field.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={condition.operator}
                                onValueChange={(value: '==' | '!=' | '>' | '<' | '>=' | '<=') => 
                                  updateCondition(condition.id, { operator: value })
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

                              <div className="flex gap-2">
                                <Input
                                  value={condition.value}
                                  onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                                  placeholder="Значение"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteCondition(condition.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>Выберите сцену для редактирования</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

