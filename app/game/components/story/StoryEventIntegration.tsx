'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Link,
  Unlink,
  Play,
  Pause,
  Settings,
  Zap,
  Target,
  Package,
  AlertTriangle,
  Building,
  Users,
  Gamepad2,
  Star,
  Plus,
  Save,
  Trash2,
  Eye
} from "lucide-react"

import { StoryScene, GameEvent, StoryTrigger, TriggerCondition } from '@/lib/types'

interface StoryEventIntegrationProps {
  storyScenes: StoryScene[]
  gameEvents: GameEvent[]
  onEventUpdate: (event: GameEvent) => void
  onSceneLink: (sceneId: string, eventId: string) => void
  onSceneUnlink: (eventId: string) => void
}

export const StoryEventIntegration: React.FC<StoryEventIntegrationProps> = ({
  storyScenes,
  gameEvents,
  onEventUpdate,
  onSceneLink,
  onSceneUnlink
}) => {
  const [activeTab, setActiveTab] = useState<'events' | 'scenes' | 'mapping'>('events')
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null)
  const [selectedScene, setSelectedScene] = useState<StoryScene | null>(null)

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'market': return <Package className="h-4 w-4" />
      case 'auction': return <Target className="h-4 w-4" />
      case 'anomaly': return <AlertTriangle className="h-4 w-4" />
      case 'contract': return <Building className="h-4 w-4" />
      case 'void_rescue': return <Zap className="h-4 w-4" />
      case 'corporate': return <Users className="h-4 w-4" />
      case 'training': return <Gamepad2 className="h-4 w-4" />
      case 'therapy': return <Star className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'market': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'auction': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'anomaly': return 'bg-red-100 text-red-800 border-red-200'
      case 'contract': return 'bg-green-100 text-green-800 border-green-200'
      case 'void_rescue': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'corporate': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'training': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'therapy': return 'bg-pink-100 text-pink-800 border-pink-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const handleEventUpdate = (field: string, value: any) => {
    if (!selectedEvent) return

    const updatedEvent = {
      ...selectedEvent,
      [field]: value
    }
    setSelectedEvent(updatedEvent)
    onEventUpdate(updatedEvent)
  }

  const handleSceneLink = (sceneId: string) => {
    if (!selectedEvent) return
    onSceneLink(sceneId, selectedEvent.id)
    setSelectedEvent({
      ...selectedEvent,
      storySceneId: sceneId
    })
  }

  const handleSceneUnlink = () => {
    if (!selectedEvent) return
    onSceneUnlink(selectedEvent.id)
    setSelectedEvent({
      ...selectedEvent,
      storySceneId: undefined
    })
  }

  const linkedScenes = storyScenes.filter(scene => 
    gameEvents.some(event => event.storySceneId === scene.id)
  )

  const unlinkedScenes = storyScenes.filter(scene => 
    !gameEvents.some(event => event.storySceneId === scene.id)
  )

  const linkedEvents = gameEvents.filter(event => event.storySceneId)

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Интеграция сюжетов и событий</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{storyScenes.length} сцен</Badge>
            <Badge variant="outline">{gameEvents.length} событий</Badge>
            <Badge variant="outline">{linkedEvents.length} связанных</Badge>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events">Игровые события</TabsTrigger>
          <TabsTrigger value="scenes">Сюжетные сцены</TabsTrigger>
          <TabsTrigger value="mapping">Связи</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="flex-1 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Список событий */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Игровые события</h3>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {gameEvents.map((event) => (
                    <Card 
                      key={event.id} 
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        selectedEvent?.id === event.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getEventTypeIcon(event.type)}
                            <div>
                              <h4 className="font-medium">{event.title}</h4>
                              <p className="text-sm text-gray-600">{event.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getEventTypeColor(event.type)}>
                              {event.type}
                            </Badge>
                            {event.storySceneId && (
                              <Badge variant="outline" className="text-green-600">
                                <Link className="h-3 w-3 mr-1" />
                                Связано
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Детали события */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Детали события</h3>
              {selectedEvent ? (
                <div className="space-y-4">
                  <div>
                    <Label>Название</Label>
                    <Input
                      value={selectedEvent.title}
                      onChange={(e) => handleEventUpdate('title', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Описание</Label>
                    <Textarea
                      value={selectedEvent.description}
                      onChange={(e) => handleEventUpdate('description', e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Тип события</Label>
                    <Select
                      value={selectedEvent.type}
                      onValueChange={(value) => handleEventUpdate('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">Рынок</SelectItem>
                        <SelectItem value="auction">Аукцион</SelectItem>
                        <SelectItem value="anomaly">Аномалии</SelectItem>
                        <SelectItem value="contract">Контракты</SelectItem>
                        <SelectItem value="void_rescue">Спасение в Void</SelectItem>
                        <SelectItem value="corporate">Корпоративные</SelectItem>
                        <SelectItem value="training">Тренировки</SelectItem>
                        <SelectItem value="therapy">Терапия</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Вероятность (%)</Label>
                    <Input
                      type="number"
                      value={selectedEvent.probability}
                      onChange={(e) => handleEventUpdate('probability', parseInt(e.target.value))}
                    />
                  </div>

                  {/* Связь со сценой */}
                  <div>
                    <Label>Связанная сцена</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      {selectedEvent.storySceneId ? (
                        <>
                          <div className="flex-1">
                            <Select
                              value={selectedEvent.storySceneId}
                              onValueChange={handleSceneLink}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {storyScenes.map((scene) => (
                                  <SelectItem key={scene.id} value={scene.id}>
                                    {scene.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSceneUnlink}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1">
                            <Select onValueChange={handleSceneLink}>
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите сцену" />
                              </SelectTrigger>
                              <SelectContent>
                                {unlinkedScenes.map((scene) => (
                                  <SelectItem key={scene.id} value={scene.id}>
                                    {scene.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={unlinkedScenes.length === 0}
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Выберите событие для редактирования
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scenes" className="flex-1 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Связанные сцены */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Связанные сцены</h3>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {linkedScenes.map((scene) => {
                    const linkedEvent = gameEvents.find(event => event.storySceneId === scene.id)
                    return (
                      <Card key={scene.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {getEventTypeIcon(scene.type)}
                              <div>
                                <h4 className="font-medium">{scene.title}</h4>
                                <p className="text-sm text-gray-600">{scene.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getEventTypeColor(scene.type)}>
                                {scene.type}
                              </Badge>
                              {linkedEvent && (
                                <Badge variant="outline" className="text-blue-600">
                                  {linkedEvent.title}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Несвязанные сцены */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Несвязанные сцены</h3>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {unlinkedScenes.map((scene) => (
                    <Card key={scene.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getEventTypeIcon(scene.type)}
                            <div>
                              <h4 className="font-medium">{scene.title}</h4>
                              <p className="text-sm text-gray-600">{scene.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getEventTypeColor(scene.type)}>
                              {scene.type}
                            </Badge>
                            <Badge variant="outline" className="text-gray-500">
                              Не связано
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mapping" className="flex-1 p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Карта связей</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {linkedEvents.map((event) => {
                  const linkedScene = storyScenes.find(scene => scene.id === event.storySceneId)
                  return (
                    <Card key={event.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="text-sm">{event.title}</span>
                          <Badge className={getEventTypeColor(event.type)}>
                            {event.type}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Link className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Связано с:</span>
                          </div>
                          {linkedScene && (
                            <div className="pl-6">
                              <div className="text-sm font-medium">{linkedScene.title}</div>
                              <div className="text-xs text-gray-600">{linkedScene.description}</div>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <div className="text-xs text-gray-500">
                              Вероятность: {event.probability}%
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onSceneUnlink(event.id)}
                            >
                              <Unlink className="h-3 w-3 mr-1" />
                              Отвязать
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {linkedEvents.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Link className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Нет связанных событий</p>
                <p className="text-sm">Свяжите сюжетные сцены с игровыми событиями</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
