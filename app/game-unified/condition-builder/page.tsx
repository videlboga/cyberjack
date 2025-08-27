"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Settings, 
  Plus, 
  Save, 
  Eye, 
  Code, 
  Target, 
  Users, 
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Building,
  Package,
  Star,
  BookOpen,
  TestTube,
  HelpCircle
} from "lucide-react"

// Импорты загрузчика
import { 
  loadConditionData, 
  ConditionData, 
  createNewCondition,
  ConditionLoaderUtils,
  validateCondition,
  checkCondition
} from '@/lib/condition/condition-loader'

// Импорты компонентов
import { ConditionBuilder } from '@/components/unified/builders/ConditionBuilder'

// Типы
import { Condition, Character as Asset, User } from '@/lib/unified-entities'

const UnifiedConditionBuilderPage = () => {
  // Состояние данных
  const [conditionData, setConditionData] = useState<ConditionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Состояние интерфейса
  const [activeTab, setActiveTab] = useState("builder")
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [testResults, setTestResults] = useState<any[]>([])
  
  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('🔄 Загружаем Condition данные...')
        const data = await loadConditionData()
        setConditionData(data)
        
        console.log('✅ Condition данные загружены:', {
          templates: data.templates.length,
          examples: data.examples.length,
          fieldConfigs: data.fieldConfigs.length
        })
      } catch (err) {
        console.error('❌ Ошибка загрузки Condition данных:', err)
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [])

  // Обработчики событий
  const handleCreateNewCondition = (type: Condition['type']) => {
    const newCondition = createNewCondition(type)
    setSelectedCondition(newCondition)
    console.log('🔧 Создано новое условие:', newCondition.id)
  }

  const handleConditionChange = (condition: Condition) => {
    setSelectedCondition(condition)
    console.log('🔧 Условие изменено:', condition.id)
  }

  const handleSaveCondition = async () => {
    if (!selectedCondition || !conditionData) return
    
    try {
      console.log('💾 Сохранение условия...')
      // await saveConditionData({ conditions: [selectedCondition] })
      console.log('✅ Условие сохранено')
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error)
    }
  }

  const handleTestCondition = async () => {
    if (!selectedCondition || !conditionData) return
    
    try {
      console.log('🧪 Тестирование условия...')
      const results = []
      
      // Тестируем на примерах
      for (const example of conditionData.examples) {
        const result = checkCondition(selectedCondition, example.testData)
        results.push({
          example: example.name,
          expected: example.expectedResult,
          actual: result,
          passed: result === example.expectedResult
        })
      }
      
      setTestResults(results)
      console.log('✅ Тестирование завершено:', results)
    } catch (error) {
      console.error('❌ Ошибка тестирования:', error)
    }
  }

  const handleUseTemplate = (template: any) => {
    const conditionFromTemplate = ConditionLoaderUtils.createConditionFromTemplate(template)
    setSelectedCondition(conditionFromTemplate)
    setSelectedTemplate(template)
    console.log('📋 Использован шаблон:', template.name)
  }

  // Получение иконки по типу условия
  const getConditionTypeIcon = (type: string) => {
    switch (type) {
      case 'asset_condition': return <Target className="h-4 w-4" />
      case 'player_condition': return <Users className="h-4 w-4" />
      case 'scene_choice_condition': return <FileText className="h-4 w-4" />
      case 'story_point_condition': return <Star className="h-4 w-4" />
      case 'compound_condition': return <Zap className="h-4 w-4" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  // Получение цвета по типу условия
  const getConditionTypeColor = (type: string) => {
    switch (type) {
      case 'asset_condition': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'player_condition': return 'bg-green-100 text-green-800 border-green-200'
      case 'scene_choice_condition': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'story_point_condition': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'compound_condition': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Загрузка Condition построителя...</p>
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

  if (!conditionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-500 text-6xl mb-4">🔧</div>
          <h2 className="text-2xl font-bold mb-2">Данные не найдены</h2>
          <p className="text-gray-600">Condition данные не загружены</p>
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
            <h1 className="text-3xl font-bold">Condition Построитель</h1>
            <Badge variant="outline" className="text-sm">
              v2.0 Unified
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveCondition}
              disabled={!selectedCondition}
            >
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestCondition}
              disabled={!selectedCondition}
            >
              <TestTube className="h-4 w-4 mr-2" />
              Тестировать
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="builder" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Построитель</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>Шаблоны</span>
            </TabsTrigger>
            <TabsTrigger value="testing" className="flex items-center space-x-2">
              <TestTube className="h-4 w-4" />
              <span>Тестирование</span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center space-x-2">
              <HelpCircle className="h-4 w-4" />
              <span>Документация</span>
            </TabsTrigger>
          </TabsList>

          {/* Builder Tab */}
          <TabsContent value="builder" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Panel - Condition Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Plus className="h-5 w-5" />
                      <span>Типы условий</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleCreateNewCondition('asset_condition')}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Условие актива
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleCreateNewCondition('player_condition')}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Условие игрока
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleCreateNewCondition('scene_choice_condition')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Условие выбора сцены
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleCreateNewCondition('story_point_condition')}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Условие сюжетной точки
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleCreateNewCondition('compound_condition')}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Составное условие
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Center Panel - Condition Builder */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>
                      {selectedCondition ? `Построитель: ${selectedCondition.name}` : 'Выберите тип условия'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCondition ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        {getConditionTypeIcon(selectedCondition.type)}
                        <Badge variant="outline" className={getConditionTypeColor(selectedCondition.type)}>
                          {selectedCondition.type}
                        </Badge>
                      </div>
                      
                      <ConditionBuilder
                        condition={selectedCondition}
                        onConditionChange={handleConditionChange}
                        className="w-full"
                      />
                      
                      <div className="flex items-center space-x-2 pt-4">
                        <Button onClick={handleTestCondition}>
                          <TestTube className="h-4 w-4 mr-2" />
                          Тестировать
                        </Button>
                        
                        <Button variant="outline" onClick={handleSaveCondition}>
                          <Save className="h-4 w-4 mr-2" />
                          Сохранить
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Выберите тип условия для начала работы</p>
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
                  <span>Шаблоны условий</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {conditionData.templates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          {getConditionTypeIcon(template.condition.type)}
                          <h3 className="font-semibold">{template.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className={`text-xs ${getConditionTypeColor(template.condition.type)}`}>
                            {template.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {template.metadata.usageCount} использований
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Использовать
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TestTube className="h-5 w-5" />
                  <span>Тестирование условий</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedCondition ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold">Текущее условие:</h3>
                      <Badge variant="outline">{selectedCondition.name}</Badge>
                    </div>
                    
                    <Button onClick={handleTestCondition}>
                      <TestTube className="h-4 w-4 mr-2" />
                      Запустить тесты
                    </Button>
                    
                    {testResults.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold">Результаты тестирования:</h4>
                        <div className="space-y-2">
                          {testResults.map((result, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                              <span className="text-sm">{result.example}</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">
                                  Ожидалось: {result.expected ? 'true' : 'false'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Получено: {result.actual ? 'true' : 'false'}
                                </span>
                                {result.passed ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Создайте условие для тестирования</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <HelpCircle className="h-5 w-5" />
                  <span>Документация</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Типы условий</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Target className="h-4 w-4" />
                        <span><strong>Условие актива</strong> - проверка атрибутов персонажа</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span><strong>Условие игрока</strong> - проверка состояния игрока</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span><strong>Условие выбора сцены</strong> - проверка выбора в сцене</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Star className="h-4 w-4" />
                        <span><strong>Условие сюжетной точки</strong> - проверка прогресса истории</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Zap className="h-4 w-4" />
                        <span><strong>Составное условие</strong> - комбинация нескольких условий</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Операторы</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><code>=</code> - равно</div>
                      <div><code>!=</code> - не равно</div>
                      <div><code>&gt;</code> - больше</div>
                      <div><code>&lt;</code> - меньше</div>
                      <div><code>&gt;=</code> - больше или равно</div>
                      <div><code>&lt;=</code> - меньше или равно</div>
                      <div><code>in</code> - содержится в</div>
                      <div><code>not_in</code> - не содержится в</div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Примеры использования</h3>
                    <div className="space-y-2 text-sm">
                      <div className="p-2 bg-gray-100 rounded">
                        <strong>Сильный актив:</strong> asset.strength &gt;= 70
                      </div>
                      <div className="p-2 bg-gray-100 rounded">
                        <strong>Богатый игрок:</strong> player.balance &gt;= 10000
                      </div>
                      <div className="p-2 bg-gray-100 rounded">
                        <strong>Лояльный актив:</strong> asset.loyalty &gt;= 80
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default UnifiedConditionBuilderPage
