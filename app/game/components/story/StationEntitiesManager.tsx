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
  Save,
  Building,
  Package,
  Target,
  Zap,
  MapPin,
  AlertTriangle
} from "lucide-react"

import { StationEntity } from '@/lib/simple-story-types'

interface StationEntitiesManagerProps {
  entities: { [key: string]: StationEntity }
  onUpdate: (entities: { [key: string]: StationEntity }) => void
  scenes: Array<{ id: string; title: string }>
}

export function StationEntitiesManager({ entities, onUpdate, scenes }: StationEntitiesManagerProps) {
  const [selectedEntity, setSelectedEntity] = useState<StationEntity | null>(null)
  const [editingEntity, setEditingEntity] = useState<StationEntity | null>(null)

  // Создание новой сущности
  const createNewEntity = () => {
    const newEntity: StationEntity = {
      id: `station_${Date.now()}`,
      name: 'Новая сущность станции',
      type: 'location',
      description: 'Описание новой сущности',
      isActive: true
    }
    
    const updatedEntities = {
      ...entities,
      [newEntity.id]: newEntity
    }
    
    onUpdate(updatedEntities)
    setSelectedEntity(newEntity)
    setEditingEntity(newEntity)
  }

  // Обновление сущности
  const updateEntity = (entityId: string, updates: Partial<StationEntity>) => {
    const updatedEntities = {
      ...entities,
      [entityId]: { ...entities[entityId], ...updates }
    }
    onUpdate(updatedEntities)
    
    if (selectedEntity?.id === entityId) {
      setSelectedEntity(updatedEntities[entityId])
    }
  }

  // Удаление сущности
  const deleteEntity = (entityId: string) => {
    const updatedEntities = { ...entities }
    delete updatedEntities[entityId]
    onUpdate(updatedEntities)
    
    if (selectedEntity?.id === entityId) {
      setSelectedEntity(null)
      setEditingEntity(null)
    }
  }

  // Получение иконки для типа сущности
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'market': return <Package className="h-4 w-4" />
      case 'auction': return <Target className="h-4 w-4" />
      case 'contract': return <Building className="h-4 w-4" />
      case 'anomaly': return <AlertTriangle className="h-4 w-4" />
      case 'event': return <Zap className="h-4 w-4" />
      case 'location': return <MapPin className="h-4 w-4" />
      default: return <Building className="h-4 w-4" />
    }
  }

  // Получение цвета для типа сущности
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'market': return 'bg-blue-100 text-blue-800'
      case 'auction': return 'bg-purple-100 text-purple-800'
      case 'contract': return 'bg-green-100 text-green-800'
      case 'anomaly': return 'bg-red-100 text-red-800'
      case 'event': return 'bg-yellow-100 text-yellow-800'
      case 'location': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-bold">Сущности станции</h2>
          <p className="text-sm text-muted-foreground">
            Управляйте сущностями станции и их сюжетными сценами
          </p>
        </div>
        <Button onClick={createNewEntity}>
          <Plus className="h-4 w-4 mr-2" />
          Новая сущность
        </Button>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex">
        {/* Левая панель - список сущностей */}
        <div className="w-1/3 border-r p-4">
          <div className="mb-4">
            <h3 className="font-semibold">Сущности ({Object.keys(entities).length})</h3>
          </div>
          
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {Object.entries(entities).map(([id, entity]) => (
                <Card 
                  key={id} 
                  className={`cursor-pointer transition-colors ${
                    selectedEntity?.id === id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedEntity(entity)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(entity.type)}
                          <h4 className="font-medium">{entity.name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{entity.description}</p>
                        <div className="flex gap-1">
                          <Badge variant="outline" className={`text-xs ${getTypeColor(entity.type)}`}>
                            {entity.type}
                          </Badge>
                          {entity.isActive ? (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Активна
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-gray-600">
                              Неактивна
                            </Badge>
                          )}
                          {entity.probability && (
                            <Badge variant="outline" className="text-xs">
                              {entity.probability}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteEntity(id)
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
          {selectedEntity ? (
            <ScrollArea className="h-full">
              <div className="space-y-6">
                {/* Основная информация */}
                <Card>
                  <CardHeader>
                    <CardTitle>Основная информация</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Название</Label>
                      <Input 
                        value={selectedEntity.name} 
                        onChange={(e) => updateEntity(selectedEntity.id, { name: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <Label>Тип сущности</Label>
                      <Select 
                        value={selectedEntity.type} 
                        onValueChange={(value: any) => updateEntity(selectedEntity.id, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="market">Рынок</SelectItem>
                          <SelectItem value="auction">Аукцион</SelectItem>
                          <SelectItem value="contract">Контракт</SelectItem>
                          <SelectItem value="anomaly">Аномалия</SelectItem>
                          <SelectItem value="event">Событие</SelectItem>
                          <SelectItem value="location">Локация</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Описание</Label>
                      <Textarea 
                        value={selectedEntity.description} 
                        onChange={(e) => updateEntity(selectedEntity.id, { description: e.target.value })}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        checked={selectedEntity.isActive} 
                        onCheckedChange={(checked) => updateEntity(selectedEntity.id, { isActive: checked })}
                      />
                      <Label>Активна</Label>
                    </div>
                  </CardContent>
                </Card>

                                {/* Привязанные сцены */}
                <Card>
                  <CardHeader>
                    <CardTitle>Привязанные сцены</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Дефолтная сцена</Label>
                      <Select
                        value={selectedEntity.defaultSceneId || '__none__'}
                        onValueChange={(value) => updateEntity(selectedEntity.id, { defaultSceneId: value === '__none__' ? undefined : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите дефолтную сцену" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Нет дефолтной сцены</SelectItem>
                          {scenes.map(scene => (
                            <SelectItem key={scene.id} value={scene.id}>{scene.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Эта сцена будет показана при запуске сущности
                      </p>
                    </div>

                    {/* Список всех привязанных сцен */}
                    <div>
                      <Label>Все привязанные сцены</Label>
                      <div className="space-y-2 mt-2">
                        {selectedEntity.defaultSceneId && (
                          <div className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Дефолтная</Badge>
                              <span className="text-sm">{scenes.find(s => s.id === selectedEntity.defaultSceneId)?.title || 'Неизвестная сцена'}</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => {
                              // Здесь можно добавить навигацию в редактор сцен
                              console.log('Перейти к сцене:', selectedEntity.defaultSceneId)
                            }}>
                              Редактировать
                            </Button>
                          </div>
                        )}

                        {/* Здесь можно добавить логику для отображения сцен, привязанных через точки входа */}
                        <div className="text-sm text-muted-foreground">
                          Сцены, привязанные через точки входа, будут отображаться здесь
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Метаданные */}
                <Card>
                  <CardHeader>
                    <CardTitle>Дополнительные данные</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Здесь можно добавить дополнительные данные для сущности (в разработке)
                    </p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Выберите сущность для редактирования
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
