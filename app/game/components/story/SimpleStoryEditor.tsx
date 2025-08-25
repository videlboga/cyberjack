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
  Star
} from "lucide-react"

import { 
  SimpleStoryConfig, 
  SimpleScene, 
  SimpleChoice, 
  SimpleCondition, 
  SimpleEffect 
} from '@/lib/simple-story-types'

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
  const [activeTab, setActiveTab] = useState<'scenes' | 'storypoints' | 'preview'>('scenes')

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
          
                     <div>
             <Label>Свойство</Label>
             <Input 
               value={condition.property} 
               onChange={(e) => onChange({ ...condition, property: e.target.value })}
               placeholder="например: rank, skills.neural_hacking"
             />
           </div>
           
           {condition.entityType === 'station' && (
             <div>
               <Label>Сущность станции</Label>
               <Select 
                 value={condition.entityId || ''} 
                 onValueChange={(value) => onChange({ ...condition, entityId: value })}
               >
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
              value={effect.type} 
              onValueChange={(value: any) => onChange({ ...effect, type: value })}
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
                <SelectItem value="trigger_event">Запустить событие</SelectItem>
                <SelectItem value="end_scene">Завершить сцену</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {effect.type === 'change_asset_stat' || effect.type === 'change_user_stat' ? (
            <>
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
          ) : effect.type === 'change_story_point' ? (
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
          ) : effect.type === 'gain_credits' || effect.type === 'lose_credits' ? (
            <div>
              <Label>Количество кредитов</Label>
              <Input 
                type="number"
                value={effect.creditsChange || 0} 
                onChange={(e) => onChange({ ...effect, creditsChange: parseInt(e.target.value) })}
              />
            </div>
          ) : null}
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
      <div className="flex-1 flex">
        {/* Левая панель - список сцен */}
        <div className="w-1/3 border-r p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Сцены ({data.scenes.length})</h3>
            <Button size="sm" onClick={createNewScene}>
              <Plus className="h-4 w-4 mr-1" />
              Новая сцена
            </Button>
          </div>
          
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {data.scenes.map(scene => (
                <Card 
                  key={scene.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedScene?.id === scene.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedScene(scene)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{scene.title}</h4>
                        <p className="text-sm text-muted-foreground">{scene.description}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {scene.choices.length} выборов
                          </Badge>
                          {scene.probability && (
                            <Badge variant="outline" className="text-xs">
                              {scene.probability}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
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
        </div>

        {/* Правая панель - редактирование */}
        <div className="flex-1 p-4">
          {selectedScene ? (
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="scenes">Редактирование</TabsTrigger>
                <TabsTrigger value="storypoints">Сюжетные точки</TabsTrigger>
                <TabsTrigger value="preview">Предпросмотр</TabsTrigger>
              </TabsList>

              <TabsContent value="scenes" className="mt-4">
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-6">
                    {/* Основная информация о сцене */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Основная информация</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Название сцены</Label>
                          <Input 
                            value={selectedScene.title} 
                            onChange={(e) => updateScene(selectedScene.id, { title: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Описание</Label>
                          <Textarea 
                            value={selectedScene.description} 
                            onChange={(e) => updateScene(selectedScene.id, { description: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Текст сцены</Label>
                          <Textarea 
                            value={selectedScene.content.text} 
                            onChange={(e) => updateScene(selectedScene.id, { 
                              content: { ...selectedScene.content, text: e.target.value }
                            })}
                          />
                        </div>
                        <div>
                          <Label>Вероятность показа (%)</Label>
                          <Input 
                            type="number"
                            min="0"
                            max="100"
                            value={selectedScene.probability || ''} 
                            onChange={(e) => updateScene(selectedScene.id, { 
                              probability: e.target.value ? parseInt(e.target.value) : undefined
                            })}
                            placeholder="Оставьте пустым для 100%"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Условия показа сцены */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Условия показа сцены</CardTitle>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              const newCondition: SimpleCondition = {
                                entityType: 'asset',
                                property: 'rank',
                                operator: '>=',
                                value: 'C'
                              }
                              updateScene(selectedScene.id, { 
                                conditions: [...(selectedScene.conditions || []), newCondition]
                              })
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Добавить условие
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
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
                          <p className="text-sm text-muted-foreground">
                            Нет условий - сцена показывается всегда
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Выборы */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Выборы игрока</CardTitle>
                          <Button 
                            size="sm" 
                            onClick={() => addChoice(selectedScene.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Добавить выбор
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedScene.choices.map((choice, choiceIndex) => (
                            <Card key={choice.id} className="border-dashed">
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm">Выбор {choiceIndex + 1}</CardTitle>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      const newChoices = selectedScene.choices.filter((_, i) => i !== choiceIndex)
                                      updateScene(selectedScene.id, { choices: newChoices })
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <Label>Текст выбора</Label>
                                  <Input 
                                    value={choice.text} 
                                    onChange={(e) => {
                                      const newChoices = [...selectedScene.choices]
                                      newChoices[choiceIndex] = { ...choice, text: e.target.value }
                                      updateScene(selectedScene.id, { choices: newChoices })
                                    }}
                                  />
                                </div>
                                
                                {/* Эффекты выбора */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label>Эффекты</Label>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        const newEffect: SimpleEffect = {
                                          type: 'change_story_point'
                                        }
                                        const newChoices = [...selectedScene.choices]
                                        newChoices[choiceIndex] = { 
                                          ...choice, 
                                          effects: [...choice.effects, newEffect]
                                        }
                                        updateScene(selectedScene.id, { choices: newChoices })
                                      }}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Добавить эффект
                                    </Button>
                                  </div>
                                  
                                  {choice.effects.map((effect, effectIndex) => (
                                    <EffectEditor
                                      key={effectIndex}
                                      effect={effect}
                                      onChange={(updatedEffect) => {
                                        const newChoices = [...selectedScene.choices]
                                        const newEffects = [...choice.effects]
                                        newEffects[effectIndex] = updatedEffect
                                        newChoices[choiceIndex] = { ...choice, effects: newEffects }
                                        updateScene(selectedScene.id, { choices: newChoices })
                                      }}
                                      onRemove={() => {
                                        const newChoices = [...selectedScene.choices]
                                        const newEffects = choice.effects.filter((_, i) => i !== effectIndex)
                                        newChoices[choiceIndex] = { ...choice, effects: newEffects }
                                        updateScene(selectedScene.id, { choices: newChoices })
                                      }}
                                    />
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

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

              <TabsContent value="preview" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Предпросмотр сцены</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg">{selectedScene.title}</h3>
                        <p className="text-muted-foreground">{selectedScene.description}</p>
                      </div>
                      
                      <div className="bg-muted p-4 rounded-lg">
                        <p>{selectedScene.content.text}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">Выборы:</h4>
                        {selectedScene.choices.map((choice, index) => (
                          <div key={choice.id} className="p-3 border rounded-lg">
                            <div className="font-medium">{index + 1}. {choice.text}</div>
                            {choice.effects.length > 0 && (
                              <div className="text-sm text-muted-foreground mt-1">
                                Эффекты: {choice.effects.map(effect => effect.type).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Выберите сцену для редактирования
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
