'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Play,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Target,
  Coins,
  User,
  Settings
} from "lucide-react"

interface StoryPreviewProps {
  storyData: any
}

interface GameState {
  currentSceneId: string | null
  currentScreenId: string | null
  storyPoints: Record<string, number>
  credits: number
  inventory: string[]
  visitedScreens: string[]
}

export function StoryPreview({ storyData }: StoryPreviewProps) {
  const [gameState, setGameState] = useState<GameState>({
    currentSceneId: null,
    currentScreenId: null,
    storyPoints: {},
    credits: 1000,
    inventory: [],
    visitedScreens: []
  })

  const [isPlaying, setIsPlaying] = useState(false)

  // Инициализация сюжетных точек
  React.useEffect(() => {
    if (storyData.storyPoints && Object.keys(gameState.storyPoints).length === 0) {
      const initialPoints: Record<string, number> = {}
      Object.entries(storyData.storyPoints).forEach(([key, point]: [string, any]) => {
        initialPoints[key] = point.defaultValue || 0
      })
      setGameState(prev => ({ ...prev, storyPoints: initialPoints }))
    }
  }, [storyData.storyPoints, gameState.storyPoints])

  const startPreview = () => {
    if (storyData.scenes && storyData.scenes.length > 0) {
      const firstScene = storyData.scenes[0]
      const firstScreen = firstScene.screens?.[0]
      
      setGameState(prev => ({
        ...prev,
        currentSceneId: firstScene.id,
        currentScreenId: firstScreen?.id || null,
        visitedScreens: firstScreen ? [firstScreen.id] : []
      }))
      setIsPlaying(true)
    }
  }

  const resetPreview = () => {
    setGameState({
      currentSceneId: null,
      currentScreenId: null,
      storyPoints: {},
      credits: 1000,
      inventory: [],
      visitedScreens: []
    })
    setIsPlaying(false)
  }

  const makeChoice = (choice: any) => {
    // Применяем последствия выбора
    if (choice.consequences) {
      let newGameState = { ...gameState }

      choice.consequences.forEach((consequence: any) => {
        switch (consequence.type) {
          case 'gain_credits':
            newGameState.credits += consequence.amount
            break
          case 'lose_credits':
            newGameState.credits -= consequence.amount
            break
          case 'story_point_change':
            newGameState.storyPoints[consequence.pointId] = 
              (newGameState.storyPoints[consequence.pointId] || 0) + consequence.change
            break
          case 'gain_equipment':
            if (!newGameState.inventory.includes(consequence.equipmentId)) {
              newGameState.inventory.push(consequence.equipmentId)
            }
            break
        }
      })

      setGameState(newGameState)
    }

    // Обрабатываем навигацию
    if (choice.navigation) {
      switch (choice.navigation.type) {
        case 'goto_screen':
          const targetScreenId = choice.navigation.screenId
          setGameState(prev => ({
            ...prev,
            currentScreenId: targetScreenId,
            visitedScreens: [...prev.visitedScreens, targetScreenId]
          }))
          break
        case 'end_scene':
          // Находим следующую доступную сцену
          const currentSceneIndex = storyData.scenes.findIndex((s: any) => s.id === gameState.currentSceneId)
          const nextScene = storyData.scenes[currentSceneIndex + 1]
          
          if (nextScene) {
            const firstScreen = nextScene.screens?.[0]
            setGameState(prev => ({
              ...prev,
              currentSceneId: nextScene.id,
              currentScreenId: firstScreen?.id || null,
              visitedScreens: firstScreen ? [...prev.visitedScreens, firstScreen.id] : prev.visitedScreens
            }))
          } else {
            // Конец всех сцен
            setIsPlaying(false)
            alert('Предпросмотр завершен!')
          }
          break
      }
    }
  }

  const getCurrentScene = () => {
    return storyData.scenes?.find((s: any) => s.id === gameState.currentSceneId)
  }

  const getCurrentScreen = () => {
    const currentScene = getCurrentScene()
    return currentScene?.screens?.find((s: any) => s.id === gameState.currentScreenId)
  }

  const getStoryPointValue = (pointId: string) => {
    const point = storyData.storyPoints?.[pointId]
    const currentValue = gameState.storyPoints[pointId] || 0
    const maxValue = point?.maxValue || 100
    const minValue = point?.minValue || 0
    
    return {
      current: currentValue,
      max: maxValue,
      min: minValue,
      percentage: ((currentValue - minValue) / (maxValue - minValue)) * 100
    }
  }

  const canMakeChoice = (choice: any) => {
    // Проверяем условия доступности выбора
    if (!choice.accessConditions) return true
    
    return choice.accessConditions.every((condition: any) => {
      if (condition.type === 'story_point') {
        const currentValue = gameState.storyPoints[condition.pointId] || 0
        switch (condition.operator) {
          case '>=':
            return currentValue >= condition.value
          case '>':
            return currentValue > condition.value
          case '<=':
            return currentValue <= condition.value
          case '<':
            return currentValue < condition.value
          case '==':
            return currentValue === condition.value
          default:
            return true
        }
      }
      return true
    })
  }

  if (!isPlaying) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Play className="h-16 w-16 mx-auto mb-6 text-primary" />
          <h2 className="text-2xl font-bold mb-4">Предпросмотр сценариев</h2>
          <p className="text-muted-foreground mb-6">
            Протестируйте созданные сцены и проследите логику переходов между экранами
          </p>
          
          {storyData.scenes && storyData.scenes.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Доступные сцены:</h3>
                <div className="space-y-2">
                  {storyData.scenes.map((scene: any) => (
                    <div key={scene.id} className="flex items-center justify-between">
                      <span className="text-sm">{scene.title}</span>
                      <Badge variant="outline">
                        {scene.screens?.length || 0} экранов
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button onClick={startPreview} size="lg" className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Начать предпросмотр
              </Button>
            </div>
          ) : (
            <div className="text-muted-foreground">
              <p>Нет доступных сцен для предпросмотра</p>
              <p className="text-sm mt-2">Создайте сцены в визуальном редакторе</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const currentScene = getCurrentScene()
  const currentScreen = getCurrentScreen()

  if (!currentScene || !currentScreen) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Ошибка загрузки сцены</h3>
          <Button onClick={resetPreview}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Перезапустить
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Основная область игры */}
      <div className="flex-1 flex flex-col">
        {/* Заголовок сцены */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{currentScene.title}</h2>
              <p className="text-sm text-muted-foreground">{currentScreen.title}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetPreview}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Перезапустить
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsPlaying(false)}>
                Выход
              </Button>
            </div>
          </div>
        </div>

        {/* Экран игры */}
        <div className="flex-1 p-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                {currentScreen.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Описание экрана */}
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm leading-relaxed">
                  {currentScreen.description}
                </p>
              </div>

              {/* Выборы */}
              <div className="space-y-3">
                <h4 className="font-semibold">Доступные действия:</h4>
                {currentScreen.choices?.map((choice: any) => {
                  const canChoose = canMakeChoice(choice)
                  return (
                    <Card 
                      key={choice.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        canChoose ? 'border-primary/20 hover:border-primary' : 'opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => canChoose && makeChoice(choice)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className={canChoose ? '' : 'text-muted-foreground'}>
                            {choice.text}
                          </span>
                          {canChoose && <ArrowRight className="h-4 w-4" />}
                        </div>
                        
                        {choice.consequences && choice.consequences.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {choice.consequences.map((consequence: any, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {consequence.type === 'gain_credits' && `+${consequence.amount} кредитов`}
                                {consequence.type === 'lose_credits' && `-${consequence.amount} кредитов`}
                                {consequence.type === 'story_point_change' && 
                                  `${consequence.change > 0 ? '+' : ''}${consequence.change} ${consequence.pointId}`}
                                {consequence.type === 'gain_equipment' && `+${consequence.equipmentId}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Боковая панель с состоянием игры */}
      <div className="w-80 border-l p-4 space-y-4">
        <ScrollArea className="h-full">
          {/* Ресурсы */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Ресурсы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Кредиты:</span>
                <span className="font-semibold">{gameState.credits}</span>
              </div>
              {gameState.inventory.length > 0 && (
                <div>
                  <span className="text-sm">Инвентарь:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {gameState.inventory.map((item, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Сюжетные точки */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Сюжетные точки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(gameState.storyPoints).map(([pointId, value]) => {
                const pointInfo = getStoryPointValue(pointId)
                const storyPoint = storyData.storyPoints?.[pointId]
                
                return (
                  <div key={pointId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{storyPoint?.name || pointId}</span>
                      <span className="font-semibold">{pointInfo.current}</span>
                    </div>
                    <Progress value={pointInfo.percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pointInfo.min}</span>
                      <span>{pointInfo.max}</span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Прогресс */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Прогресс
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Текущая сцена:</span>
                <span className="font-semibold">{gameState.currentSceneId}</span>
              </div>
              <div className="flex justify-between">
                <span>Посещено экранов:</span>
                <span className="font-semibold">{gameState.visitedScreens.length}</span>
              </div>
              <div className="mt-3">
                <span className="text-xs text-muted-foreground">Посещенные экраны:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {gameState.visitedScreens.slice(-5).map((screenId, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {screenId}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollArea>
      </div>
    </div>
  )
}
