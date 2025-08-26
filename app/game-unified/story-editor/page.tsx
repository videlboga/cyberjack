"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  FileText, 
  Edit, 
  Eye, 
  Plus, 
  Save, 
  Settings, 
  Target, 
  AlertTriangle, 
  Building, 
  Package,
  Users,
  Gamepad2,
  Star,
  Zap,
  BookOpen,
  Palette,
  Code,
  BarChart3
} from "lucide-react"

// Импорты компонентов (будут созданы позже)
// import { UnifiedStoryEditor } from './components/UnifiedStoryEditor'
// import { StoryManager } from './components/StoryManager'
// import { StoryTemplates } from './components/StoryTemplates'
// import { StoryPreview } from './components/StoryPreview'
// import { StoryIntegration } from './components/StoryIntegration'

// Импорты загрузчика
import { 
  loadStoryData, 
  StoryData, 
  createNewScene, 
  createNewSimpleStory,
  StoryUtils,
  SimpleStoryUtils
} from '@/lib/story/story-loader'

// Типы
import { SimplifiedStoryScene } from '@/lib/unified-entities'
import { SimpleStoryConfig } from '@/lib/simple-story-types'

const UnifiedStoryEditorPage = () => {
  // Состояние данных
  const [storyData, setStoryData] = useState<StoryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Состояние интерфейса
  const [activeTab, setActiveTab] = useState("editor")
  const [selectedScene, setSelectedScene] = useState<SimplifiedStoryScene | null>(null)
  const [selectedStory, setSelectedStory] = useState<SimpleStoryConfig | null>(null)
  const [editingMode, setEditingMode] = useState<'scene' | 'story' | 'template'>('scene')
  
  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('🔄 Загружаем Story данные...')
        const data = await loadStoryData()
        setStoryData(data)
        
        console.log('✅ Story данные загружены:', {
          scenes: data.scenes.length,
          simpleStories: data.simpleStories.length,
          eventBindings: data.eventBindings.length,
          templates: data.templates.length
        })
      } catch (err) {
        console.error('❌ Ошибка загрузки Story данных:', err)
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [])

  // Обработчики событий
  const handleCreateNewScene = () => {
    if (!storyData) return
    
    const newScene = createNewScene('auction')
    const updatedScenes = StoryUtils.addScene(storyData.scenes, newScene)
    
    setStoryData(prev => prev ? { ...prev, scenes: updatedScenes } : null)
    setSelectedScene(newScene)
    setEditingMode('scene')
    
    console.log('🎬 Создана новая сцена:', newScene.id)
  }

  const handleCreateNewStory = () => {
    if (!storyData) return
    
    const newStory = createNewSimpleStory()
    const updatedStories = SimpleStoryUtils.addStory(storyData.simpleStories, newStory)
    
    setStoryData(prev => prev ? { ...prev, simpleStories: updatedStories } : null)
    setSelectedStory(newStory)
    setEditingMode('story')
    
    console.log('📖 Создана новая история:', newStory.id)
  }

  const handleSaveData = async () => {
    if (!storyData) return
    
    try {
      console.log('💾 Сохранение Story данных...')
      // await saveStoryData(storyData)
      console.log('✅ Story данные сохранены')
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error)
    }
  }

  const handleSceneSelect = (scene: SimplifiedStoryScene) => {
    setSelectedScene(scene)
    setEditingMode('scene')
    console.log('🎬 Выбрана сцена:', scene.title)
  }

  const handleStorySelect = (story: SimpleStoryConfig) => {
    setSelectedStory(story)
    setEditingMode('story')
    console.log('📖 Выбрана история:', story.title)
  }

  // Получение иконки по типу
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'auction': return <Target className="h-4 w-4" />
      case 'anomaly': return <AlertTriangle className="h-4 w-4" />
      case 'contract': return <Building className="h-4 w-4" />
      case 'market': return <Package className="h-4 w-4" />
      case 'training': return <Gamepad2 className="h-4 w-4" />
      case 'therapy': return <Star className="h-4 w-4" />
      case 'void_rescue': return <Zap className="h-4 w-4" />
      case 'corporate': return <Users className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  // Получение цвета по типу
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'auction': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'anomaly': return 'bg-red-100 text-red-800 border-red-200'
      case 'contract': return 'bg-green-100 text-green-800 border-green-200'
      case 'market': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'training': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'therapy': return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'void_rescue': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'corporate': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Загрузка Story редактора...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  if (!storyData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-500 text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold mb-2">Данные не найдены</h2>
          <p className="text-gray-600">Story данные не загружены</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold">Story Редактор</h1>
            <Badge variant="outline" className="text-sm">
              v2.0 Unified
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveData}
            >
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="editor" className="flex items-center space-x-2">
              <Edit className="h-4 w-4" />
              <span>Редактор</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>Шаблоны</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Предварительный просмотр</span>
            </TabsTrigger>
            <TabsTrigger value="integration" className="flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>Интеграция</span>
            </TabsTrigger>
          </TabsList>

          {/* Editor Tab */}
          <TabsContent value="editor" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Panel - Scene/Story List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Сцены и истории</span>
                    </span>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCreateNewScene}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Сцена
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCreateNewStory}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        История
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {/* Scenes */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-600 mb-2">Сцены ({storyData.scenes.length})</h4>
                        <div className="space-y-1">
                          {storyData.scenes.map((scene) => (
                            <div
                              key={scene.id}
                              className={`p-2 rounded border cursor-pointer hover:bg-gray-50 transition-colors ${
                                selectedScene?.id === scene.id ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                              }`}
                              onClick={() => handleSceneSelect(scene)}
                            >
                              <div className="flex items-center space-x-2">
                                {getTypeIcon(scene.type)}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{scene.title}</div>
                                  <div className="text-xs text-gray-500 truncate">{scene.description}</div>
                                </div>
                                <Badge variant="outline" className={`text-xs ${getTypeColor(scene.type)}`}>
                                  {scene.type}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Simple Stories */}
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm text-gray-600 mb-2">Истории ({storyData.simpleStories.length})</h4>
                        <div className="space-y-1">
                          {storyData.simpleStories.map((story) => (
                            <div
                              key={story.id}
                              className={`p-2 rounded border cursor-pointer hover:bg-gray-50 transition-colors ${
                                selectedStory?.id === story.id ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                              }`}
                              onClick={() => handleStorySelect(story)}
                            >
                              <div className="flex items-center space-x-2">
                                <BookOpen className="h-4 w-4" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{story.title}</div>
                                  <div className="text-xs text-gray-500 truncate">{story.description}</div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {story.scenes.length} сцен
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Center Panel - Editor */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Edit className="h-5 w-5" />
                    <span>
                      {editingMode === 'scene' && selectedScene ? `Редактирование сцены: ${selectedScene.title}` : ''}
                      {editingMode === 'story' && selectedStory ? `Редактирование истории: ${selectedStory.title}` : ''}
                      {!selectedScene && !selectedStory ? 'Выберите сцену или историю для редактирования' : ''}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedScene && editingMode === 'scene' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Название</label>
                                                 <input
                           type="text"
                           value={selectedScene.title}
                           onChange={(e) => {
                             const updatedScenes = StoryUtils.updateScene(
                               storyData.scenes,
                               selectedScene.id,
                               { title: e.target.value }
                             )
                             setStoryData(prev => prev ? { ...prev, scenes: updatedScenes } : null)
                             setSelectedScene(updatedScenes.find(s => s.id === selectedScene.id) || null)
                           }}
                           className="w-full p-2 border rounded"
                           placeholder="Введите название сцены"
                           title="Название сцены"
                         />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Описание</label>
                                                 <textarea
                           value={selectedScene.description}
                           onChange={(e) => {
                             const updatedScenes = StoryUtils.updateScene(
                               storyData.scenes,
                               selectedScene.id,
                               { description: e.target.value }
                             )
                             setStoryData(prev => prev ? { ...prev, scenes: updatedScenes } : null)
                             setSelectedScene(updatedScenes.find(s => s.id === selectedScene.id) || null)
                           }}
                           rows={3}
                           className="w-full p-2 border rounded"
                           placeholder="Введите описание сцены"
                           title="Описание сцены"
                         />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Тип</label>
                                                 <select
                           value={selectedScene.type}
                           onChange={(e) => {
                             const updatedScenes = StoryUtils.updateScene(
                               storyData.scenes,
                               selectedScene.id,
                               { type: e.target.value as any }
                             )
                             setStoryData(prev => prev ? { ...prev, scenes: updatedScenes } : null)
                             setSelectedScene(updatedScenes.find(s => s.id === selectedScene.id) || null)
                           }}
                           className="w-full p-2 border rounded"
                           title="Тип сцены"
                         >
                          <option value="auction">Аукцион</option>
                          <option value="anomaly">Аномалия</option>
                          <option value="contract">Контракт</option>
                          <option value="market">Рынок</option>
                          <option value="training">Тренировка</option>
                          <option value="therapy">Терапия</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Экраны ({selectedScene.screens.length})</label>
                        <div className="space-y-2">
                          {selectedScene.screens.map((screen, index) => (
                            <div key={screen.id} className="p-3 border rounded bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">Экран {index + 1}: {screen.title}</span>
                                <Button size="sm" variant="outline">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm text-gray-600">{screen.description}</p>
                              <div className="mt-2">
                                <span className="text-xs text-gray-500">
                                  Выборов: {screen.choices.length}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : selectedStory && editingMode === 'story' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Название</label>
                        <input
                          type="text"
                          value={selectedStory.title}
                          onChange={(e) => {
                            const updatedStories = SimpleStoryUtils.updateStory(
                              storyData.simpleStories,
                              selectedStory.id,
                              { title: e.target.value }
                            )
                            setStoryData(prev => prev ? { ...prev, simpleStories: updatedStories } : null)
                            setSelectedStory(updatedStories.find(s => s.id === selectedStory.id) || null)
                          }}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Описание</label>
                        <textarea
                          value={selectedStory.description}
                          onChange={(e) => {
                            const updatedStories = SimpleStoryUtils.updateStory(
                              storyData.simpleStories,
                              selectedStory.id,
                              { description: e.target.value }
                            )
                            setStoryData(prev => prev ? { ...prev, simpleStories: updatedStories } : null)
                            setSelectedStory(updatedStories.find(s => s.id === selectedStory.id) || null)
                          }}
                          rows={3}
                          className="w-full p-2 border rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Сцены ({selectedStory.scenes.length})</label>
                        <div className="space-y-2">
                          {selectedStory.scenes.map((scene, index) => (
                            <div key={scene.id} className="p-3 border rounded bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">Сцена {index + 1}: {scene.title}</span>
                                <Button size="sm" variant="outline">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm text-gray-600">{scene.description}</p>
                              <div className="mt-2">
                                <span className="text-xs text-gray-500">
                                  Выборов: {scene.choices.length}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Выберите сцену или историю для редактирования</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>Шаблоны историй</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storyData.templates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          {getTypeIcon(template.type)}
                          <h3 className="font-semibold">{template.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-xs ${getTypeColor(template.type)}`}>
                            {template.type}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {template.scenes.length} сцен
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5" />
                  <span>Предварительный просмотр</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Предварительный просмотр будет доступен в следующей версии</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integration Tab */}
          <TabsContent value="integration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5" />
                  <span>Интеграция с игровыми системами</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Character AI</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Интеграция с чатом</span>
                          <Badge variant="outline" className="bg-green-100 text-green-800">Активна</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Динамические ответы</span>
                          <Badge variant="outline" className="bg-green-100 text-green-800">Активна</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Игровые события</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Привязка к событиям</span>
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">Настроена</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Условная логика</span>
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">Настроена</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default UnifiedStoryEditorPage
