'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Monitor,
  Building,
  Settings
} from 'lucide-react'

import { ScreenBasedStoryGraph } from './ScreenBasedStoryGraph'
import { StoryScreen, StoryChoice, StoryScene } from '@/types/screen-based-story'

interface Station {
  id: string
  name: string
  type: string
  description?: string
  defaultSceneId?: string
  isActive: boolean
}

export function ScreenBasedStoryAdmin() {
  const [scenes, setScenes] = useState<StoryScene[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [selectedScene, setSelectedScene] = useState<StoryScene | null>(null)
  const [editingScene, setEditingScene] = useState<StoryScene | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isCreatingStation, setIsCreatingStation] = useState(false)
  const [editingStation, setEditingStation] = useState<Station | null>(null)
  const [loading, setLoading] = useState(true)

  // Загрузка данных
  const fetchData = async () => {
    try {
      const [scenesResponse, stationsResponse] = await Promise.all([
        fetch('/api/story/scenes'),
        fetch('/api/story/entities')
      ])

      if (scenesResponse.ok) {
        const scenesData = await scenesResponse.json()
        setScenes(scenesData)
      }

      if (stationsResponse.ok) {
        const stationsData = await stationsResponse.json()
        setStations(stationsData)
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Создание новой сцены
  const handleCreateScene = async () => {
    if (!editingScene) return

    try {
      const response = await fetch('/api/story/scenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingScene.name,
          description: editingScene.description || '',
          stationId: editingScene.stationId || null,
          triggerConditions: editingScene.triggerConditions || [],
          probability: editingScene.probability || 100
        }),
      })

      if (response.ok) {
        const newScene = await response.json()
        setScenes([...scenes, newScene])
        setSelectedScene(newScene)
        setEditingScene(null)
        setIsCreating(false)
      }
    } catch (error) {
      console.error('Ошибка при создании сцены:', error)
    }
  }

  // Обновление сцены
  const handleUpdateScene = async (sceneId: string, updates: Partial<StoryScene>) => {
    try {
      const response = await fetch(`/api/story/scenes/${sceneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedScene = await response.json()
        setScenes(scenes.map(s => s.id === sceneId ? updatedScene : s))
        if (selectedScene?.id === sceneId) {
          setSelectedScene(updatedScene)
        }
      }
    } catch (error) {
      console.error('Ошибка при обновлении сцены:', error)
    }
  }

  // Создание новой станции
  const handleCreateStation = async () => {
    if (!editingStation) return

    try {
      const response = await fetch('/api/story/entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingStation.name,
          type: editingStation.type,
          description: editingStation.description || '',
          isActive: true,
          metadata: {}
        }),
      })

      if (response.ok) {
        const newStation = await response.json()
        setStations([...stations, newStation])
        setEditingStation(null)
        setIsCreatingStation(false)
      }
    } catch (error) {
      console.error('Ошибка при создании станции:', error)
    }
  }

  // Обновление станции
  const handleUpdateStation = async (stationId: string, updates: Partial<Station>) => {
    try {
      const response = await fetch(`/api/story/entities/${stationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedStation = await response.json()
        setStations(stations.map(s => s.id === stationId ? updatedStation : s))
      }
    } catch (error) {
      console.error('Ошибка при обновлении станции:', error)
    }
  }

  // Добавление экрана к сцене
  const handleAddScreen = async (sceneId: string) => {
    try {
      const response = await fetch(`/api/story/scenes/${sceneId}/screens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Новый экран',
          description: '',
          content: { text: '' },
          isFinal: false,
          position: { x: 100, y: 100 }
        }),
      })

      if (response.ok) {
        const newScreen = await response.json()
        const updatedScene = scenes.find(s => s.id === sceneId)
        if (updatedScene) {
          updatedScene.screens.push(newScreen)
          setScenes([...scenes])
          if (selectedScene?.id === sceneId) {
            setSelectedScene(updatedScene)
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при добавлении экрана:', error)
    }
  }

  // Обновление экрана
  const handleUpdateScreen = async (screenId: string, updates: Partial<StoryScreen>) => {
    try {
      const response = await fetch(`/api/story/screens/${screenId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedScreen = await response.json()
        setScenes(scenes.map(scene => ({
          ...scene,
          screens: scene.screens.map(screen =>
            screen.id === screenId ? updatedScreen : screen
          )
        })))

        if (selectedScene) {
          const updatedSelectedScene = {
            ...selectedScene,
            screens: selectedScene.screens.map(screen =>
              screen.id === screenId ? updatedScreen : screen
            )
          }
          setSelectedScene(updatedSelectedScene)
        }
      }
    } catch (error) {
      console.error('Ошибка при обновлении экрана:', error)
    }
  }

  // Добавление выбора к экрану (с созданием нового экрана)
  const handleAddChoice = async (screenId: string) => {
    try {
      console.log('Добавляем выбор для экрана:', screenId)

      // Сначала создаем новый экран
      const newScreenResponse = await fetch('/api/story/screens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sceneId: selectedScene?.id,
          name: 'Новый экран',
          description: '',
          content: {
            text: 'Содержимое нового экрана',
            background: '',
            music: ''
          },
          position: {
            x: Math.random() * 400 + 200,
            y: Math.random() * 300 + 100
          },
          isFinal: false
        }),
      })

      console.log('newScreenResponse status:', newScreenResponse.status)

      if (newScreenResponse.ok) {
        const newScreen = await newScreenResponse.json()
        console.log('Создан новый экран:', newScreen)

        // Теперь создаем выбор, который ссылается на новый экран
        const choiceData = {
          text: 'Новый выбор',
          description: '',
          nextScreenId: newScreen.id,
          consequences: [],
          showConditions: []
        }

        console.log('Отправляем данные выбора:', choiceData)

        const choiceResponse = await fetch(`/api/story/screens/${screenId}/choices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(choiceData),
        })

        console.log('choiceResponse status:', choiceResponse.status)

        if (!choiceResponse.ok) {
          const errorText = await choiceResponse.text()
          console.error('Ошибка создания выбора:', errorText)
          return // Прерываем выполнение, если выбор не создался
        }

        if (choiceResponse.ok) {
          const newChoice = await choiceResponse.json()
          console.log('Создан новый выбор:', newChoice)

          // Убеждаемся, что у нового экрана есть choices
          const newScreenWithChoices = {
            ...newScreen,
            choices: newScreen.choices || []
          }

          // Обновляем состояние один раз - добавляем и экран, и выбор
          setScenes(scenes.map(scene => ({
            ...scene,
            screens: scene.id === selectedScene?.id
              ? scene.screens.map(screen =>
                  screen.id === screenId
                    ? { ...screen, choices: [...(screen.choices || []), newChoice] }
                    : screen
                ).concat(newScreenWithChoices) // Добавляем новый экран в конец
              : scene.screens
          })))

          if (selectedScene) {
            const updatedSelectedScene = {
              ...selectedScene,
              screens: selectedScene.screens
                .map(screen =>
                  screen.id === screenId
                    ? { ...screen, choices: [...(screen.choices || []), newChoice] }
                    : screen
                )
                .concat(newScreenWithChoices) // Добавляем новый экран в конец
            }
            setSelectedScene(updatedSelectedScene)
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при добавлении выбора:', error)
    }
  }

  // Создание выбора с связанным экраном
  const handleCreateChoiceWithScreen = async (sourceScreenId: string, targetScreenId: string) => {
    try {
      // Проверяем, существует ли уже экран с таким ID
      const existingScreen = selectedScene?.screens.find(s => s.id === targetScreenId)

      if (!existingScreen) {
        // Создаем новый экран, если его нет
        console.log('Создаем новый экран для targetScreenId:', targetScreenId)
        console.log('selectedScene.id:', selectedScene?.id)

        const newScreenResponse = await fetch('/api/story/screens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sceneId: selectedScene?.id,
            name: 'Новый экран',
            content: {
              text: 'Содержимое нового экрана',
              background: '',
              music: ''
            },
            position: {
              x: Math.random() * 400 + 200,
              y: Math.random() * 300 + 100
            },
            isFinal: false
          }),
        })

        console.log('newScreenResponse status:', newScreenResponse.status)

        if (newScreenResponse.ok) {
          const newScreen = await newScreenResponse.json()
          console.log('Создан новый экран:', newScreen)

          // Обновляем состояние с новым экраном
          setScenes(scenes.map(scene => ({
            ...scene,
            screens: scene.id === selectedScene?.id
              ? [...scene.screens, newScreen]
              : scene.screens
          })))

          if (selectedScene) {
            const updatedSelectedScene = {
              ...selectedScene,
              screens: [...selectedScene.screens, newScreen]
            }
            setSelectedScene(updatedSelectedScene)
          }

          // Теперь создаем выбор, который ссылается на новый экран
          targetScreenId = newScreen.id
        }
      }

      // Создаем выбор, который ссылается на экран
      const choiceResponse = await fetch(`/api/story/screens/${sourceScreenId}/choices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Переход к экрану',
          description: '',
          nextScreenId: targetScreenId,
          consequences: [],
          showConditions: []
        }),
      })

      if (choiceResponse.ok) {
        const newChoice = await choiceResponse.json()
        setScenes(scenes.map(scene => ({
          ...scene,
          screens: scene.screens.map(screen =>
            screen.id === sourceScreenId
              ? { ...screen, choices: [...screen.choices, newChoice] }
              : screen
          )
        })))

        if (selectedScene) {
          const updatedSelectedScene = {
            ...selectedScene,
            screens: selectedScene.screens.map(screen =>
              screen.id === sourceScreenId
                ? { ...screen, choices: [...screen.choices, newChoice] }
                : screen
            )
          }
          setSelectedScene(updatedSelectedScene)
        }
      }
    } catch (error) {
      console.error('Ошибка при создании выбора с экраном:', error)
    }
  }

  // Удаление экрана
  const handleDeleteScreen = async (screenId: string) => {
    try {
      console.log('Удаляем экран:', screenId)

      const response = await fetch(`/api/story/screens/${screenId}`, {
        method: 'DELETE',
      })

      console.log('deleteScreenResponse status:', response.status)

      if (response.ok) {
        setScenes(scenes.map(scene => ({
          ...scene,
          screens: scene.screens.filter(screen => screen.id !== screenId)
        })))

        if (selectedScene) {
          const updatedSelectedScene = {
            ...selectedScene,
            screens: selectedScene.screens.filter(screen => screen.id !== screenId)
          }
          setSelectedScene(updatedSelectedScene)
        }
      } else {
        const errorText = await response.text()
        console.error('Ошибка удаления экрана:', errorText)
      }
    } catch (error) {
      console.error('Ошибка при удалении экрана:', error)
    }
  }

  // Удаление выбора
  const handleDeleteChoice = async (choiceId: string) => {
    try {
      const response = await fetch(`/api/story/choices/${choiceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setScenes(scenes.map(scene => ({
          ...scene,
          screens: scene.screens.map(screen => ({
            ...screen,
            choices: screen.choices.filter(choice => choice.id !== choiceId)
          }))
        })))

        if (selectedScene) {
          const updatedSelectedScene = {
            ...selectedScene,
            screens: selectedScene.screens.map(screen => ({
              ...screen,
              choices: screen.choices.filter(choice => choice.id !== choiceId)
            }))
          }
          setSelectedScene(updatedSelectedScene)
        }
      }
    } catch (error) {
      console.error('Ошибка при удалении выбора:', error)
    }
  }

  // Обновление выбора
  const handleUpdateChoice = async (choiceId: string, updates: Partial<StoryChoice>) => {
    try {
      const response = await fetch(`/api/story/choices/${choiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedChoice = await response.json()
        setScenes(scenes.map(scene => ({
          ...scene,
          screens: scene.screens.map(screen => ({
            ...screen,
            choices: screen.choices.map(choice =>
              choice.id === choiceId ? updatedChoice : choice
            )
          }))
        })))

        if (selectedScene) {
          const updatedSelectedScene = {
            ...selectedScene,
            screens: selectedScene.screens.map(screen => ({
              ...screen,
              choices: screen.choices.map(choice =>
                choice.id === choiceId ? updatedChoice : choice
              )
            }))
          }
          setSelectedScene(updatedSelectedScene)
        }
      }
    } catch (error) {
      console.error('Ошибка при обновлении выбора:', error)
    }
  }

  if (loading) {
    return <div className="p-6">Загрузка...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Система сюжета</h2>
        <Button onClick={() => {
          setIsCreating(true)
          setEditingScene({
            id: '',
            name: 'Новая сцена',
            description: '',
            stationId: undefined,
            triggerConditions: [],
            probability: 100,
            screens: [],
            isActive: true
          })
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Создать сцену
        </Button>
      </div>

      <Tabs defaultValue="scenes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenes">Сцены</TabsTrigger>
          <TabsTrigger value="stations">Станции</TabsTrigger>
          <TabsTrigger value="graph">Граф</TabsTrigger>
        </TabsList>

        <TabsContent value="scenes" className="mt-6">
          <div className="grid gap-4">
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
                        {scene.stationId && (
                          <Badge variant="outline">
                            Станция: {stations.find(s => s.id === scene.stationId)?.name || 'Неизвестно'}
                          </Badge>
                        )}
                      </div>

                      {scene.description && (
                        <p className="text-sm text-gray-600 mb-2">{scene.description}</p>
                      )}

                      <div className="text-sm text-gray-500 mb-2">
                        Экранов: {scene.screens.length}
                        {scene.probability && (
                          <span className="ml-4">Вероятность: {scene.probability}%</span>
                        )}
                        {scene.triggerConditions && Object.keys(scene.triggerConditions).length > 0 && (
                          <span className="ml-4">Условия: {Object.keys(scene.triggerConditions).length}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedScene(scene)}
                      >
                        <Monitor className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingScene(scene)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stations" className="mt-6">
          <div className="mb-4">
            <Button
              onClick={() => {
                setIsCreatingStation(true)
                setEditingStation({
                  id: '',
                  name: '',
                  type: 'default',
                  description: '',
                  isActive: true
                })
              }}
              className="mb-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать станцию
            </Button>
          </div>
          <div className="grid gap-4">
            {stations.map((station) => (
              <Card key={station.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{station.name}</h3>
                        <Badge variant={station.isActive ? 'default' : 'secondary'}>
                          {station.isActive ? 'Активна' : 'Неактивна'}
                        </Badge>
                        <Badge variant="outline">{station.type}</Badge>
                      </div>

                      {station.description && (
                        <p className="text-sm text-gray-600 mb-2">{station.description}</p>
                      )}

                      <div className="text-sm text-gray-500">
                        Дефолтная сцена: {station.defaultSceneId ?
                          scenes.find(s => s.id === station.defaultSceneId)?.name || 'Неизвестно' :
                          'Не установлена'
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Форма создания/редактирования станции */}
          {(isCreatingStation || editingStation) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>
                  {isCreatingStation ? 'Создание станции' : 'Редактирование станции'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="station-name">Название *</Label>
                    <Input
                      id="station-name"
                      value={editingStation?.name || ''}
                      onChange={(e) => setEditingStation({
                        ...editingStation!,
                        name: e.target.value
                      })}
                      placeholder="Введите название станции"
                    />
                  </div>
                  <div>
                    <Label htmlFor="station-type">Тип *</Label>
                    <Input
                      id="station-type"
                      value={editingStation?.type || ''}
                      onChange={(e) => setEditingStation({
                        ...editingStation!,
                        type: e.target.value
                      })}
                      placeholder="Введите тип станции"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="station-description">Описание</Label>
                  <Textarea
                    id="station-description"
                    value={editingStation?.description || ''}
                    onChange={(e) => setEditingStation({
                      ...editingStation!,
                      description: e.target.value
                    })}
                    placeholder="Введите описание станции"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="station-default-scene">Дефолтная сцена</Label>
                  <Select
                    value={editingStation?.defaultSceneId || 'none'}
                    onValueChange={(value) => setEditingStation({
                      ...editingStation!,
                      defaultSceneId: value === 'none' ? undefined : value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите сцену" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без сцены</SelectItem>
                      {scenes.map((scene) => (
                        <SelectItem key={scene.id} value={scene.id}>
                          {scene.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (editingStation) {
                        handleUpdateStation(editingStation.id, editingStation)
                        setEditingStation(null)
                      } else if (isCreatingStation) {
                        handleCreateStation()
                      }
                    }}
                    disabled={!editingStation?.name || !editingStation?.type}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingStation(null)
                      setIsCreatingStation(false)
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="graph" className="mt-6">
          {selectedScene ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Граф сцены: {selectedScene.name}</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAddScreen(selectedScene.id)}
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить экран
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedScene(null)}
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <ScreenBasedStoryGraph
                sceneId={selectedScene.id}
                screens={selectedScene.screens}
                onUpdateScreen={handleUpdateScreen}
                onUpdateChoice={handleUpdateChoice}
                onAddScreen={() => handleAddScreen(selectedScene.id)}
                onAddChoice={handleAddChoice}
                onDeleteScreen={handleDeleteScreen}
                onDeleteChoice={handleDeleteChoice}
                onCreateChoiceWithScreen={handleCreateChoiceWithScreen}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <h3 className="text-lg font-semibold mb-4">Выберите сцену для редактирования графа</h3>
                <div className="max-w-md mx-auto">
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const scene = scenes.find(s => s.id === value)
                      if (scene) {
                        setSelectedScene(scene)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите сцену" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenes.map((scene) => (
                        <SelectItem key={scene.id} value={scene.id}>
                          {scene.name}
                          {scene.stationId && (
                            <span className="text-gray-500 ml-2">
                              (Станция: {stations.find(s => s.id === scene.stationId)?.name || 'Неизвестно'})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Форма создания/редактирования сцены */}
      {(isCreating || editingScene) && (
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
                  value={editingScene?.name || ''}
                  onChange={(e) => setEditingScene({
                    ...editingScene!,
                    name: e.target.value
                  })}
                  placeholder="Введите название сцены"
                />
              </div>
              <div>
                <Label htmlFor="station">Станция</Label>
                <Select
                  value={editingScene?.stationId || 'none'}
                  onValueChange={(value) => setEditingScene({
                    ...editingScene!,
                    stationId: value === 'none' ? undefined : value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите станцию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без станции</SelectItem>
                    {stations.map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={editingScene?.description || ''}
                onChange={(e) => setEditingScene({
                  ...editingScene!,
                  description: e.target.value
                })}
                placeholder="Введите описание сцены"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="probability">Вероятность (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={editingScene?.probability || 100}
                  onChange={(e) => setEditingScene({
                    ...editingScene!,
                    probability: parseFloat(e.target.value) || 100
                  })}
                  placeholder="Вероятность срабатывания"
                />
              </div>
              <div>
                <Label htmlFor="trigger-conditions">Условия активации (JSON)</Label>
                <Textarea
                  id="trigger-conditions"
                  value={JSON.stringify(editingScene?.triggerConditions || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const conditions = JSON.parse(e.target.value)
                      setEditingScene({
                        ...editingScene!,
                        triggerConditions: conditions
                      })
                    } catch (error) {
                      // Оставляем как есть, если JSON невалидный
                    }
                  }}
                  placeholder='[{"type": "condition", "value": "value"}]'
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (editingScene) {
                    if (isCreating) {
                      handleCreateScene()
                    } else {
                      handleUpdateScene(editingScene.id, editingScene)
                      setEditingScene(null)
                    }
                  }
                }}
                disabled={!editingScene?.name}
              >
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingScene(null)
                  setIsCreating(false)
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
