'use client'

import React, { useState, useEffect } from 'react'
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
  FileText,
  Target,
  Save,
  Eye,
  Settings,
  Zap,
  Users,
  Package,
  Building,
  Star,
  GitBranch,
  Monitor,
  Upload
} from "lucide-react"

import {
  SimpleStoryConfig,
  SimpleScene,
  SimpleChoice,
  SimpleCondition,
  SimpleEffect,
  SimpleScreen
} from '@/lib/simple-story-types'
import { SceneGraph } from './SceneGraph'

interface SimpleStoryEditorProps {
  storyData: SimpleStoryConfig
  onSave: (data: SimpleStoryConfig) => void
  gameEntities: {
    assets: any[]
    users: any[]
    equipment: any[]
    stationEntities: { [key: string]: any }
  }
}

export function SimpleStoryEditor({ storyData, onSave, gameEntities }: SimpleStoryEditorProps) {
  const [data, setData] = useState<SimpleStoryConfig>(storyData)
  const [selectedScene, setSelectedScene] = useState<SimpleScene | null>(null)
  const [editingScene, setEditingScene] = useState<SimpleScene | null>(null)
  const [activeTab, setActiveTab] = useState<'scenes' | 'storypoints' | 'graph' | 'preview'>('graph')
  const [showNodePanel, setShowNodePanel] = useState(false)
  const [showConditionsPanel, setShowConditionsPanel] = useState(false)
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false)
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null)
  // Предпросмотр
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null)
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null)
  
  // Синхронизация локального состояния с пропсами (после загрузки из localStorage)
  useEffect(() => {
    setData(storyData)
  }, [storyData])

  // Хелперы предпросмотра
  const startPreview = (sceneId: string) => {
    setPreviewSceneId(sceneId)
    const scene = data.scenes.find(s => s.id === sceneId)
    if (scene) {
      const screens = scene.screens || []
      const startId = scene.startScreenId || (screens.length > 0 ? screens[0].id : null)
      setPreviewScreenId(startId || null)
    } else {
      setPreviewScreenId(null)
    }
  }

  const resetPreview = () => {
    setPreviewSceneId(null)
    setPreviewScreenId(null)
  }

  const currentPreviewScene = React.useMemo(() => previewSceneId ? data.scenes.find(s => s.id === previewSceneId) || null : null, [previewSceneId, data.scenes])
  const currentPreviewScreen = React.useMemo(() => {
    if (!currentPreviewScene) return null
    if (!previewScreenId) return null
    return (currentPreviewScene.screens || []).find(sc => sc.id === previewScreenId) || null
  }, [currentPreviewScene, previewScreenId])

  const handlePreviewChoiceClick = (choice: SimpleChoice) => {
    if (choice.nextScreenId && currentPreviewScene) {
      // Переход внутри сцены
      setPreviewScreenId(choice.nextScreenId)
      return
    }
    if (choice.nextScene) {
      // Переход к другой сцене
      startPreview(choice.nextScene)
      return
    }
    // Иначе ничего (можно расширить: завершение сцены и т.п.)
  }

  // Удаление экрана
  const deleteScreen = (sceneId: string, screenIndex: number) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene => {
        if (scene.id !== sceneId) return scene
        const screens = [...(scene.screens || [])]
        const removed = screens[screenIndex]
        if (!removed) return scene
        screens.splice(screenIndex, 1)
        // очистим привязки nextScreenId у выборов сцены
        const cleanedSceneChoices = scene.choices.map(ch => ch.nextScreenId === removed.id ? { ...ch, nextScreenId: undefined } : ch)
        // и у выборов остальных экранов
        const cleanedScreens = screens.map(scr => ({
          ...scr,
          choices: scr.choices.map(ch => ch.nextScreenId === removed.id ? { ...ch, nextScreenId: undefined } : ch)
        }))
        // обновим layout.screenPositions
        const layout = scene.layout || {}
        const screenPositions = { ...(layout.screenPositions || {}) }
        delete screenPositions[removed.id]
        // если стартовый экран удалён — переназначим
        const newStart = scene.startScreenId === removed.id ? (cleanedScreens[0]?.id) : scene.startScreenId
        return { ...scene, screens: cleanedScreens, choices: cleanedSceneChoices, startScreenId: newStart, layout: { ...layout, screenPositions } }
      })
    }))
    setSelectedScreenIndex(null)
  }

  // Удаление выбора сцены (legacy)
  const deleteSceneChoice = (sceneId: string, choiceIndex: number) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene => {
        if (scene.id !== sceneId) return scene
        const newChoices = scene.choices.filter((_, i) => i !== choiceIndex)
        // почистим layout.choicePositions
        const layout = scene.layout || {}
        const choicePositions = { ...(layout.choicePositions || {}) }
        const removedId = scene.choices[choiceIndex]?.id
        if (removedId) delete choicePositions[removedId]
        return { ...scene, choices: newChoices, layout: { ...layout, choicePositions } }
      })
    }))
    setSelectedChoiceIndex(null)
  }

  // Удаление выбора на экране
  const deleteScreenChoice = (sceneId: string, screenIndex: number, choiceIndex: number) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene => {
        if (scene.id !== sceneId) return scene
        const screens = [...(scene.screens || [])]
        const current = screens[screenIndex]
        if (!current) return scene
        const newChoices = current.choices.filter((_, i) => i !== choiceIndex)
        screens[screenIndex] = { ...current, choices: newChoices }
        return { ...scene, screens }
      })
    }))
  }
  const [selectedScreenIndex, setSelectedScreenIndex] = useState<number | null>(null)

  // Если сцена не выбрана, автоматически выбираем первую доступную
  useEffect(() => {
    if (!selectedScene && data.scenes && data.scenes.length > 0) {
      setSelectedScene(data.scenes[0])
      setEditingScene(data.scenes[0])
    }
  }, [data.scenes, selectedScene])

  // Держим selectedScene синхронизированной с данными после правок
  useEffect(() => {
    if (selectedScene) {
      const updated = data.scenes.find(s => s.id === selectedScene.id)
      if (updated && updated !== selectedScene) {
        setSelectedScene(updated)
        setEditingScene(updated)
      }
    }
  }, [data.scenes, selectedScene])

  // Создание новой сцены
  const createNewScene = () => {
    const newScene: SimpleScene = {
      id: `scene_${Date.now()}`,
      title: 'Новая сцена',
      description: 'Описание новой сцены',
      content: {
        text: 'Текст сцены...'
      },
      choices: []
    }
    
    setData(prev => ({
      ...prev,
      scenes: [...prev.scenes, newScene]
    }))
    
    setSelectedScene(newScene)
    setEditingScene(newScene)
  }

  // Сохранение изменений
  const handleSave = () => {
    onSave(data)
  }

  // Добавление выбора к сцене
  const addChoice = (sceneId: string) => {
    const newChoice: SimpleChoice = {
      id: `choice_${Date.now()}`,
      text: 'Новый выбор',
      effects: []
    }
    
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene => 
        scene.id === sceneId 
          ? { ...scene, choices: [...scene.choices, newChoice] }
          : scene
      )
    }))
  }

  // Добавление выбора с указанием позиции на графе
  const addChoiceAtPosition = (sceneId: string, position: { x: number; y: number }) => {
    const newChoice: SimpleChoice = {
      id: `choice_${Date.now()}`,
      text: 'Новый выбор',
      effects: []
    }
    const current = data.scenes.find(s => s.id === sceneId)
    if (!current) return
    const updatedScene: SimpleScene = {
      ...current,
      choices: [...current.choices, newChoice],
      layout: {
        ...(current.layout || {}),
        choicePositions: {
          ...((current.layout && current.layout.choicePositions) || {}),
          [newChoice.id]: { x: position.x, y: position.y }
        }
      }
    }
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => (s.id === sceneId ? updatedScene : s))
    }))
    setSelectedScene(updatedScene)
    setSelectedChoiceIndex(updatedScene.choices.length - 1)
    setShowNodePanel(true)
  }

  // Создание новой сцены с позицией
  const createSceneAtPosition = (position: { x: number; y: number }) => {
    const newScene: SimpleScene = {
      id: `scene_${Date.now()}`,
      title: 'Новая сцена',
      description: 'Описание новой сцены',
      content: { text: 'Текст сцены...' },
      choices: [],
      layout: { x: position.x, y: position.y }
    }
    setData(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }))
    setSelectedScene(newScene)
    setEditingScene(newScene)
    setShowNodePanel(true)
  }

  // Обновление сцены
  const updateScene = (sceneId: string, updates: Partial<SimpleScene>) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene => 
        scene.id === sceneId ? { ...scene, ...updates } : scene
      )
    }))
  }

  // Удаление сцены
  const deleteScene = (sceneId: string) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.filter(scene => scene.id !== sceneId)
    }))
    
    if (selectedScene?.id === sceneId) {
      setSelectedScene(null)
      setEditingScene(null)
    }
  }

  // Компонент для редактирования условий
  const ConditionEditor = ({ 
    condition, 
    onChange, 
    onRemove 
  }: { 
    condition: SimpleCondition
    onChange: (condition: SimpleCondition) => void
    onRemove: () => void
  }) => {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Условие</CardTitle>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Тип сущности</Label>
              <Select 
                value={condition.entityType} 
                onValueChange={(value: any) => onChange({ ...condition, entityType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Актив</SelectItem>
                  <SelectItem value="user">Пользователь</SelectItem>
                  <SelectItem value="equipment">Оборудование</SelectItem>
                  <SelectItem value="station">Станция</SelectItem>
                  <SelectItem value="story_point">Сюжетная точка</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Оператор</Label>
              <Select 
                value={condition.operator} 
                onValueChange={(value: any) => onChange({ ...condition, operator: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="==">Равно</SelectItem>
                  <SelectItem value="!=">Не равно</SelectItem>
                  <SelectItem value=">">Больше</SelectItem>
                  <SelectItem value="<">Меньше</SelectItem>
                  <SelectItem value=">=">Больше или равно</SelectItem>
                  <SelectItem value="<=">Меньше или равно</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Выбор конкретной сущности по типу */}
          {condition.entityType === 'asset' && (
            <div>
              <Label>Актив</Label>
              <Select value={condition.entityId || ''} onValueChange={(value) => onChange({ ...condition, entityId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите актив" />
                </SelectTrigger>
                <SelectContent>
                  {gameEntities.assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name || a.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {condition.entityType === 'user' && (
            <div>
              <Label>Пользователь</Label>
              <Select value={condition.entityId || ''} onValueChange={(value) => onChange({ ...condition, entityId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {gameEntities.users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.username || u.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {condition.entityType === 'equipment' && (
            <div>
              <Label>Оборудование</Label>
              <Select value={condition.entityId || ''} onValueChange={(value) => onChange({ ...condition, entityId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите оборудование" />
                </SelectTrigger>
                <SelectContent>
                  {gameEntities.equipment.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name || e.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {condition.entityType === 'story_point' && (
            <div>
              <Label>Сюжетная точка</Label>
              <Select value={condition.entityId || ''} onValueChange={(value) => onChange({ ...condition, entityId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите точку" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(data.storyPoints).map(([id, sp]) => (
                    <SelectItem key={id} value={id}>{(sp as any).name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {condition.entityType === 'station' && (
            <div>
              <Label>Сущность станции</Label>
              <Select value={condition.entityId || ''} onValueChange={(value) => onChange({ ...condition, entityId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сущность станции" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(gameEntities.stationEntities).map(([id, entity]: [string, any]) => (
                    <SelectItem key={id} value={id}>{entity.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Свойство</Label>
            <Input 
              value={condition.property} 
              onChange={(e) => onChange({ ...condition, property: e.target.value })}
              placeholder="например: rank, skills.neural_hacking"
            />
          </div>

          <div>
            <Label>Значение</Label>
            <Input 
              value={condition.value} 
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              placeholder="значение для сравнения"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Компонент для редактирования эффектов
  const EffectEditor = ({ 
    effect, 
    onChange, 
    onRemove 
  }: { 
    effect: SimpleEffect
    onChange: (effect: SimpleEffect) => void
    onRemove: () => void
  }) => {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Эффект</CardTitle>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Тип эффекта</Label>
            <Select 
              value={(effect as any).type === 'trigger_event' ? 'trigger_station_event' : effect.type} 
              onValueChange={(value: any) => onChange({ ...effect, type: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="change_asset_stat">Изменить характеристику актива</SelectItem>
                <SelectItem value="change_user_stat">Изменить характеристику пользователя</SelectItem>
                <SelectItem value="change_story_point">Изменить сюжетную точку</SelectItem>
                <SelectItem value="gain_credits">Получить кредиты</SelectItem>
                <SelectItem value="lose_credits">Потерять кредиты</SelectItem>
                <SelectItem value="gain_equipment">Получить оборудование</SelectItem>
                <SelectItem value="lose_equipment">Потерять оборудование</SelectItem>
                <SelectItem value="trigger_station_event">Запустить событие станции</SelectItem>
                <SelectItem value="end_scene">Завершить сцену</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {effect.type === 'change_asset_stat' && (
            <>
              <div>
                <Label>Актив</Label>
                <Select value={effect.entityId || ''} onValueChange={(value) => onChange({ ...effect, entityId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите актив" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameEntities.assets.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name || a.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Характеристика</Label>
                <Input 
                  value={effect.stat || ''} 
                  onChange={(e) => onChange({ ...effect, stat: e.target.value })}
                  placeholder="например: skills.neural_hacking"
                />
              </div>
              <div>
                <Label>Изменение</Label>
                <Input 
                  type="number"
                  value={effect.change || 0} 
                  onChange={(e) => onChange({ ...effect, change: parseInt(e.target.value) })}
                />
              </div>
            </>
          )}

          {effect.type === 'change_user_stat' && (
            <>
              <div>
                <Label>Пользователь</Label>
                <Select value={effect.entityId || ''} onValueChange={(value) => onChange({ ...effect, entityId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите пользователя" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameEntities.users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.username || u.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Характеристика</Label>
                <Input 
                  value={effect.stat || ''} 
                  onChange={(e) => onChange({ ...effect, stat: e.target.value })}
                  placeholder="например: skills.neural_hacking"
                />
              </div>
              <div>
                <Label>Изменение</Label>
                <Input 
                  type="number"
                  value={effect.change || 0} 
                  onChange={(e) => onChange({ ...effect, change: parseInt(e.target.value) })}
                />
              </div>
            </>
          )}

          {effect.type === 'change_story_point' && (
            <>
              <div>
                <Label>Сюжетная точка</Label>
                <Select 
                  value={effect.storyPointId || ''} 
                  onValueChange={(value) => onChange({ ...effect, storyPointId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите сюжетную точку" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(data.storyPoints).map(([id, point]) => (
                      <SelectItem key={id} value={id}>{point.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Изменение</Label>
                <Input 
                  type="number"
                  value={effect.storyPointChange || 0} 
                  onChange={(e) => onChange({ ...effect, storyPointChange: parseInt(e.target.value) })}
                />
              </div>
            </>
          )}

          {(effect.type === 'gain_credits' || effect.type === 'lose_credits') && (
            <div>
              <Label>Количество кредитов</Label>
              <Input 
                type="number"
                value={effect.creditsChange || 0} 
                onChange={(e) => onChange({ ...effect, creditsChange: parseInt(e.target.value) })}
              />
            </div>
          )}

          {(effect.type === 'gain_equipment' || effect.type === 'lose_equipment') && (
            <div>
              <Label>Оборудование</Label>
              <Select value={effect.equipmentId || ''} onValueChange={(value) => onChange({ ...effect, equipmentId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите оборудование" />
                </SelectTrigger>
                <SelectContent>
                  {gameEntities.equipment.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name || e.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {effect.type === 'trigger_station_event' && (
            <div>
              <Label>Событие станции</Label>
              <Select value={effect.stationEventId || ''} onValueChange={(value) => onChange({ ...effect, stationEventId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите событие" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(gameEntities.stationEntities).map(([id, entity]: [string, any]) => (
                    <SelectItem key={id} value={id}>{entity.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-bold">Упрощенный редактор сюжетов</h2>
          <p className="text-sm text-muted-foreground">
            Создавайте сцены, используя существующие сущности игры
          </p>
        </div>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Сохранить
        </Button>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex p-2">
        {/* Убираем левую колонку: максимум места под граф */}
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="storypoints">Сюжетные точки</TabsTrigger>
                <TabsTrigger value="graph">Граф сцен</TabsTrigger>
                <TabsTrigger value="preview">Предпросмотр</TabsTrigger>
              </TabsList>

              <TabsContent value="storypoints" className="mt-4">
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-4">
                    {Object.entries(data.storyPoints).map(([id, point]) => (
                      <Card key={id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{point.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">{point.description}</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Текущее значение</Label>
                              <Input 
                                type="number"
                                value={point.value} 
                                onChange={(e) => {
                                  setData(prev => ({
                                    ...prev,
                                    storyPoints: {
                                      ...prev.storyPoints,
                                      [id]: { ...point, value: parseInt(e.target.value) }
                                    }
                                  }))
                                }}
                                min={point.minValue}
                                max={point.maxValue}
                              />
                            </div>
                            <div>
                              <Label>Диапазон</Label>
                              <div className="text-sm text-muted-foreground">
                                {point.minValue} - {point.maxValue}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="graph" className="mt-2">
                <div className="relative h-[calc(100vh-180px)]">
                  <SceneGraph
                    scenes={data.scenes}
                    onSceneSelect={(s) => {
                      setSelectedScene(s)
                      setSelectedChoiceIndex(null)
                      setSelectedScreenIndex(null)
                      setShowNodePanel(true)
                    }}
                    selectedSceneId={selectedScene ? selectedScene.id : ''}
                    onUpdateScene={(sceneId, updates) => {
                      // Сохраняем немедленно, чтобы видеть изменения названия/описания сразу и устойчиво
                      const next = {
                        ...data,
                        scenes: data.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s)
                      }
                      setData(next)
                      try {
                        const persisted = { ...storyData, scenes: next.scenes }
                        onSave(persisted)
                      } catch (_) {}
                    }}
                    onDeleteScene={(sceneId) => deleteScene(sceneId)}
                    stationEntitiesForSelect={(gameEntities.stationEntities || []).map((e: any) => ({ id: e.id, name: e.name }))}
                    onUpdateChoice={(sceneId, screenIndex, choiceIndex, updates) => {
                      setData(prev => ({
                        ...prev,
                        scenes: prev.scenes.map(scene => {
                          if (scene.id !== sceneId) return scene
                          const screens = [...(scene.screens || [])]
                          const screen = screens[screenIndex]
                          if (!screen) return scene
                          const choices = [...(screen.choices || [])]
                          choices[choiceIndex] = { ...choices[choiceIndex], ...updates }
                          screens[screenIndex] = { ...screen, choices }
                          return { ...scene, screens }
                        })
                      }))
                    }}
                    onChoiceSelect={(sceneId, screenIndex, idx) => {
                      const s = data.scenes.find(s => s.id === sceneId)
                      if (!s) return
                      setSelectedScene(s)
                      setSelectedScreenIndex(screenIndex)
                      setSelectedChoiceIndex(idx)
                      setShowNodePanel(true)
                    }}
                    onEntrySelect={(sceneId) => {
                      const s = data.scenes.find(s => s.id === sceneId)
                      if (!s) return
                      setSelectedScene(s)
                      setSelectedChoiceIndex(null)
                      setSelectedScreenIndex(null)
                      setShowConditionsPanel(true)
                      setShowNodePanel(false)
                    }}
                    onScreenSelect={(sceneId, screenIndex) => {
                      const s = data.scenes.find(s => s.id === sceneId)
                      if (!s) return
                      setSelectedScene(s)
                      setSelectedScreenIndex(screenIndex)
                      setSelectedChoiceIndex(null)
                      setShowNodePanel(true)
                    }}
                    storyPoints={data.storyPoints as any}
                    mode="scene"
                    onAddScene={(pos) => createSceneAtPosition(pos)}
                    
                    onAddScreen={(sceneId, pos) => {
                      const newScreen: SimpleScreen = {
                        id: `screen_${Date.now()}`,
                        title: 'Новый экран',
                        description: '',
                        content: { text: 'Текст экрана...' },
                        choices: []
                      }
                      setData(prev => ({
                        ...prev,
                        scenes: prev.scenes.map(s => {
                          if (s.id !== sceneId) return s
                          const screens = [...(s.screens || []), newScreen]
                          const layout = s.layout || {}
                          const screenPositions = { ...(layout.screenPositions || {}), [newScreen.id]: { x: pos.x, y: pos.y } }
                          return { ...s, screens, startScreenId: s.startScreenId || newScreen.id, layout: { ...layout, screenPositions } }
                        })
                      }))
                    }}
                  />

                  {/* Плавающая панель выбора сцен */}
                  <div className="absolute top-4 left-4 w-[300px] max-h-[calc(100vh-240px)] overflow-auto rounded-xl border border-white/10 bg-neutral-900/70 backdrop-blur-xl text-neutral-100 shadow-lg">
                    <div className="px-4 py-3 border-b border-white/10 font-semibold text-sm">Сцены</div>
                    <div className="p-2 space-y-1">
                      {data.scenes.map((scene) => (
                        <button
                          key={scene.id}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedScene?.id === scene.id ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5'}`}
                          onClick={() => setSelectedScene(scene)}
                        >
                          <div className="font-medium truncate">{scene.title}</div>
                          <div className="text-xs text-neutral-400 truncate">{scene.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Плавающие действия */}
                  <div className="fixed bottom-4 right-4 flex gap-2 pointer-events-auto" style={{ zIndex: 10000 }}>
                    <Button size="sm" onClick={createNewScene}>
                      <Plus className="h-4 w-4 mr-1" />
                      Новая сцена
                    </Button>
                    <Button size="sm" variant={showNodePanel ? 'default' : 'outline'} onClick={() => setShowNodePanel((v) => !v)}>
                      Редактор нода
                    </Button>
                    <Button size="sm" variant={showConditionsPanel ? 'default' : 'outline'} onClick={() => setShowConditionsPanel((v) => !v)}>
                      Условия/вероятность
                    </Button>
                    <Button size="sm" variant={showBackgroundPanel ? 'default' : 'outline'} onClick={() => setShowBackgroundPanel((v) => !v)}>
                      Фон
                    </Button>
                  </div>

                  {/* Панель редактора нода (сцена или выбор) */}
                  {showNodePanel && selectedScene && (
                    <div className="fixed top-4 right-4 w-[420px] max-h-[calc(100vh-240px)] overflow-auto rounded-xl border border-white/10 bg-neutral-900/70 backdrop-blur-xl text-neutral-100 shadow-lg" style={{ zIndex: 10000 }}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="font-semibold text-sm">Редактор нода</div>
                        <Button size="sm" variant="ghost" onClick={() => setShowNodePanel(false)}>Закрыть</Button>
                      </div>
                      <div className="p-4 space-y-4">
                        {selectedChoiceIndex === null ? (
                          selectedScreenIndex !== null ? (
                            (() => {
                              const screen = (selectedScene.screens || [])[selectedScreenIndex]
                              if (!screen) return null
                              return (
                                <div className="space-y-4">
                                  <div>
                                    <Label>Заголовок экрана</Label>
                                    <Input
                                      value={screen.title || ''}
                                      onChange={(e) => {
                                        const title = e.target.value
                                        setData(prev => ({
                                          ...prev,
                                          scenes: prev.scenes.map(s => {
                                            if (s.id !== selectedScene.id) return s
                                            const screens = [...(s.screens || [])]
                                            screens[selectedScreenIndex] = { ...screen, title }
                                            return { ...s, screens }
                                          })
                                        }))
                                      }}
                                      placeholder="Заголовок"
                                    />
                                  </div>

                                  <div>
                                    <Label>Текст</Label>
                                    <Textarea
                                      value={screen.content?.text || ''}
                                      onChange={(e) => {
                                        const text = e.target.value
                                        setData(prev => ({
                                          ...prev,
                                          scenes: prev.scenes.map(s => {
                                            if (s.id !== selectedScene.id) return s
                                            const screens = [...(s.screens || [])]
                                            screens[selectedScreenIndex] = { ...screen, content: { ...screen.content, text } }
                                            return { ...s, screens }
                                          })
                                        }))
                                      }}
                                      rows={3}
                                      placeholder="Текст экрана"
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <Label className="font-medium">Выборы на экране</Label>
                                    <Button size="sm" onClick={() => {
                                      const newScreenId = `screen_${Date.now() + 1}`
                                      const newChoiceId = `choice_${Date.now()}`
                                      const newScreen: SimpleScreen = {
                                        id: newScreenId,
                                        title: 'Новый экран',
                                        description: '',
                                        content: { text: 'Текст экрана...' },
                                        choices: []
                                      }
                                      const newChoice: SimpleChoice = {
                                        id: newChoiceId,
                                        text: 'Новый выбор',
                                        effects: [],
                                        nextScreenId: newScreenId
                                      }
                                      setData(prev => ({
                                        ...prev,
                                        scenes: prev.scenes.map(s => {
                                          if (s.id !== selectedScene.id) return s
                                          const screens = [...(s.screens || [])]
                                          const current = screens[selectedScreenIndex]
                                          if (!current) return s
                                          const updatedCurrent: SimpleScreen = { ...current, choices: [...(current.choices || []), newChoice] }
                                          screens[selectedScreenIndex] = updatedCurrent
                                          const layout = s.layout || {}
                                          const basePos = layout.screenPositions?.[current.id] || { x: (layout.x ?? 0) + 520, y: (layout.y ?? 0) }
                                          const screenPositions = { ...(layout.screenPositions || {}), [newScreen.id]: { x: basePos.x + 260, y: basePos.y } }
                                          return { ...s, screens: [...screens, newScreen], startScreenId: s.startScreenId || screens[0]?.id || newScreen.id, layout: { ...layout, screenPositions } }
                                        })
                                      }))
                                    }}>
                                      Добавить выбор
                                    </Button>
                                  </div>

                                <div className="space-y-3">
                                    {(screen.choices || []).length === 0 ? (
                                      <div className="text-sm text-neutral-400">Нет выборов</div>
                                    ) : (
                                      screen.choices.map((choice, cIdx) => (
                                        <Card key={choice.id}>
                                          <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                              <CardTitle className="text-sm">Выбор {cIdx + 1}</CardTitle>
                                              <div className="flex gap-1">
                                                <Button size="sm" variant="outline" onClick={() => {
                                                  const linkedId = choice.nextScreenId
                                                  setData(prev => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map(s => {
                                                      if (s.id !== selectedScene.id) return s
                                                      let screens = [...(s.screens || [])]
                                                      const current = screens[selectedScreenIndex]
                                                      if (!current) return s
                                                      const newChoices = current.choices.filter((_, i) => i !== cIdx)
                                                      if (linkedId) {
                                                        screens = screens.filter(scr => scr.id !== linkedId)
                                                        const layout = s.layout || {}
                                                        const screenPositions = { ...(layout.screenPositions || {}) }
                                                        delete screenPositions[linkedId]
                                                        const newCurrent = { ...current, choices: newChoices }
                                                        screens[selectedScreenIndex] = newCurrent
                                                        return { ...s, screens, layout: { ...layout, screenPositions } }
                                                      }
                                                      screens[selectedScreenIndex] = { ...current, choices: newChoices }
                                                      return { ...s, screens }
                                                    })
                                                  }))
                                                }}>Удалить</Button>
                                              </div>
                                            </div>
                                          </CardHeader>
                                          <CardContent className="space-y-3">
                                            <div>
                                              <Label>Текст выбора</Label>
                                              <Input
                                                value={choice.text}
                                                onChange={(e) => {
                                                  const text = e.target.value
                                                  setData(prev => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map(s => {
                                                      if (s.id !== selectedScene.id) return s
                                                      const screens = [...(s.screens || [])]
                                                      const current = screens[selectedScreenIndex]
                                                      if (!current) return s
                                                      const choices = [...(current.choices || [])]
                                                      choices[cIdx] = { ...choice, text }
                                                      screens[selectedScreenIndex] = { ...current, choices }
                                                      return { ...s, screens }
                                                    })
                                                  }))
                                                }}
                                              />
                                            </div>

                                            <div className="space-y-2">
                                              <div className="flex items-center justify-between">
                                                <Label className="font-medium">Эффекты</Label>
                                                <Button size="sm" variant="outline" onClick={() => {
                                                  const newEffect: SimpleEffect = { type: 'gain_credits', creditsChange: 0 }
                                                  setData(prev => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map(s => {
                                                      if (s.id !== selectedScene.id) return s
                                                      const screens = [...(s.screens || [])]
                                                      const current = screens[selectedScreenIndex]
                                                      if (!current) return s
                                                      const choices = [...(current.choices || [])]
                                                      choices[cIdx] = { ...choice, effects: [...(choice.effects || []), newEffect] }
                                                      screens[selectedScreenIndex] = { ...current, choices }
                                                      return { ...s, screens }
                                                    })
                                                  }))
                                                }}>Добавить эффект</Button>
                                              </div>

                                              {(choice.effects || []).map((effect, eIdx) => (
                                                <EffectEditor
                                                  key={eIdx}
                                                  effect={effect}
                                                  onChange={(updated) => {
                                                    setData(prev => ({
                                                      ...prev,
                                                      scenes: prev.scenes.map(s => {
                                                        if (s.id !== selectedScene.id) return s
                                                        let screens = [...(s.screens || [])]
                                                        const current = screens[selectedScreenIndex]
                                                        if (!current) return s
                                                        const choices = [...(current.choices || [])]
                                                        const updatedEffects = [...(choice.effects || [])]
                                                        updatedEffects[eIdx] = updated
                                                        let updatedChoice: SimpleChoice = { ...choice, effects: updatedEffects }
                                                        if (updated.type === 'end_scene' && choice.nextScreenId) {
                                                          const linkedId = choice.nextScreenId
                                                          screens = screens.filter(scr => scr.id !== linkedId)
                                                          const layout = s.layout || {}
                                                          const screenPositions = { ...(layout.screenPositions || {}) }
                                                          delete screenPositions[linkedId]
                                                          updatedChoice = { ...updatedChoice, nextScreenId: undefined }
                                                          const newCurrent = { ...current, choices: choices.map((ch, idx) => idx === cIdx ? updatedChoice : ch) }
                                                          const newScreens = [...screens]
                                                          newScreens[selectedScreenIndex] = newCurrent
                                                          return { ...s, screens: newScreens, layout: { ...layout, screenPositions } }
                                                        }
                                                        const newCurrent = { ...current, choices: choices.map((ch, idx) => idx === cIdx ? updatedChoice : ch) }
                                                        screens[selectedScreenIndex] = newCurrent
                                                        return { ...s, screens }
                                                      })
                                                    }))
                                                  }}
                                                  onRemove={() => {
                                                    setData(prev => ({
                                                      ...prev,
                                                      scenes: prev.scenes.map(s => {
                                                        if (s.id !== selectedScene.id) return s
                                                        const screens = [...(s.screens || [])]
                                                        const current = screens[selectedScreenIndex]
                                                        if (!current) return s
                                                        const choices = [...(current.choices || [])]
                                                        const newEffects = (choice.effects || []).filter((_, i) => i !== eIdx)
                                                        choices[cIdx] = { ...choice, effects: newEffects }
                                                        screens[selectedScreenIndex] = { ...current, choices }
                                                        return { ...s, screens }
                                                      })
                                                    }))
                                                  }}
                                                />
                                              ))}
                                            </div>

                                            <div className="text-[11px] text-neutral-400">
                                              Цель: {choice.nextScreenId ? `экран ${choice.nextScreenId}` : (choice.nextScene ? `сцена ${choice.nextScene}` : 'не задана')}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )
                            })()
                          ) : (
                            <div className="text-sm text-neutral-400">Выберите экран на графе</div>
                          )
                        ) : (
                          <div className="text-sm text-neutral-400">Выберите узел выбора на графе</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Панель условий/вероятности */}
                  {showConditionsPanel && selectedScene && (
                    <div className="absolute top-4 left-4 w-[420px] max-h-[calc(100vh-240px)] overflow-auto rounded-xl border border-white/10 bg-neutral-900/70 backdrop-blur-xl text-neutral-100 shadow-lg">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="font-semibold text-sm">Условия и вероятность</div>
                        <Button size="sm" variant="ghost" onClick={() => setShowConditionsPanel(false)}>Закрыть</Button>
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <Label>Вероятность показа (%)</Label>
                          <Input type="number" min={0} max={100} value={selectedScene.probability || ''} onChange={(e) => updateScene(selectedScene.id, { probability: e.target.value ? parseInt(e.target.value) : undefined })} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Условия показа</Label>
                            <Button size="sm" onClick={() => {
                              const newCondition: SimpleCondition = { entityType: 'asset', property: 'rank', operator: '>=', value: 'C' }
                              updateScene(selectedScene.id, { conditions: [...(selectedScene.conditions || []), newCondition] })
                            }}>Добавить</Button>
                          </div>
                          <div className="space-y-2">
                            {selectedScene.conditions?.map((condition, index) => (
                              <ConditionEditor
                                key={index}
                                condition={condition}
                                onChange={(updatedCondition) => {
                                  const newConditions = [...(selectedScene.conditions || [])]
                                  newConditions[index] = updatedCondition
                                  updateScene(selectedScene.id, { conditions: newConditions })
                                }}
                                onRemove={() => {
                                  const newConditions = selectedScene.conditions?.filter((_, i) => i !== index)
                                  updateScene(selectedScene.id, { conditions: newConditions })
                                }}
                              />
                            ))}
                            {(!selectedScene.conditions || selectedScene.conditions.length === 0) && (
                              <p className="text-sm text-neutral-400">Нет условий — сцена показывается всегда</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Панель фона */}
                  {showBackgroundPanel && selectedScene && (
                    <div className="absolute bottom-4 left-4 w-[480px] rounded-xl border border-white/10 bg-neutral-900/70 backdrop-blur-xl text-neutral-100 shadow-lg">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="font-semibold text-sm">Фон сцены (фото/видео/гиф)</div>
                        <Button size="sm" variant="ghost" onClick={() => setShowBackgroundPanel(false)}>Закрыть</Button>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onload = () => {
                                  const dataUrl = reader.result as string
                                  updateScene(selectedScene.id, { content: { ...selectedScene.content, background: dataUrl } })
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="hidden"
                            id={`graph-bg-upload-${selectedScene.id}-graph`}
                            aria-label="Выберите фон"
                          />
                          <Button size="sm" variant="outline" onClick={() => document.getElementById(`graph-bg-upload-${selectedScene.id}-graph`)?.click()}>Выбрать файл</Button>
                          {/* Показывать имя файла не можем надёжно после перезагрузки для data URL */}
                          <Button size="sm" variant="destructive" onClick={() => updateScene(selectedScene.id, { content: { ...selectedScene.content, background: undefined } })}>Очистить</Button>
                        </div>
                        {selectedScene.content.background && (
                          <div className="rounded-lg overflow-hidden bg-black/30">
                            {String(selectedScene.content.background).match(/\.(mp4|webm|ogg)$/i) ? (
                              <video src={selectedScene.content.background} className="w-full h-48 object-cover" controls />
                            ) : (
                              <img src={selectedScene.content.background} alt="Фон" className="w-full h-48 object-cover" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="flex gap-3">
                  {/* Список сцен */}
                  <div className="w-80 shrink-0 rounded-xl border border-white/10 bg-neutral-900/70 backdrop-blur-xl text-neutral-100">
                    <div className="px-4 py-3 border-b border-white/10 font-semibold text-sm">Сцены</div>
                    <div className="p-2 space-y-1 max-h-[calc(100vh-260px)] overflow-auto">
                      {data.scenes.map(scene => (
                        <div key={scene.id} className={`p-3 rounded-md ${previewSceneId === scene.id ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{scene.title}</div>
                              <div className="text-xs text-neutral-400 truncate">{scene.description}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startPreview(scene.id)}>Запустить</Button>
                              <Button size="sm" variant="ghost" onClick={() => setPreviewSceneId(scene.id)}>Открыть</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Проигрыватель */}
                  <div className="flex-1">
                    {!currentPreviewScene ? (
                      <div className="h-[calc(100vh-240px)] flex items-center justify-center text-neutral-400">
                        Выберите сцену и нажмите «Запустить»
                      </div>
                    ) : (
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle>Предпросмотр: {currentPreviewScene.title}</CardTitle>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startPreview(currentPreviewScene.id)}>Сброс сцены</Button>
                              <Button size="sm" variant="ghost" onClick={resetPreview}>Выход</Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* Фон */}
                            {(() => {
                              const bg = (currentPreviewScreen?.content?.background) || (currentPreviewScene.content?.background)
                              if (!bg) return null
                              return (
                                <div className="rounded-lg overflow-hidden bg-black/30">
                                  {String(bg).match(/\.(mp4|webm|ogg)$/i) ? (
                                    <video src={bg as any} className="w-full h-48 object-cover" controls />
                                  ) : (
                                    <img src={bg as any} alt="Фон" className="w-full h-48 object-cover" />
                                  )}
                                </div>
                              )
                            })()}

                            {/* Текст */}
                            <div className="bg-muted p-4 rounded-lg">
                              <p>{currentPreviewScreen ? currentPreviewScreen.content?.text : currentPreviewScene.content?.text}</p>
                            </div>

                            {/* Выборы */}
                            <div className="space-y-2">
                              <h4 className="font-medium">Выборы:</h4>
                              {currentPreviewScreen ? (
                                (currentPreviewScreen.choices || []).length === 0 ? (
                                  <div className="text-sm text-neutral-400">Нет выборов на экране</div>
                                ) : (
                                  currentPreviewScreen.choices.map((choice) => (
                                    <div key={choice.id} className="p-3 border rounded-lg flex items-center justify-between">
                                      <div className="font-medium truncate mr-3">{choice.text}</div>
                                      <Button size="sm" onClick={() => handlePreviewChoiceClick(choice)}>Выбрать</Button>
                                    </div>
                                  ))
                                )
                              ) : (
                                (currentPreviewScene.choices || []).length === 0 ? (
                                  <div className="text-sm text-neutral-400">Нет выборов</div>
                                ) : (
                                  currentPreviewScene.choices.map((choice) => (
                                    <div key={choice.id} className="p-3 border rounded-lg flex items-center justify-between">
                                      <div className="font-medium truncate mr-3">{choice.text}</div>
                                      <Button size="sm" onClick={() => handlePreviewChoiceClick(choice)}>Выбрать</Button>
                                    </div>
                                  ))
                                )
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
  )
}
