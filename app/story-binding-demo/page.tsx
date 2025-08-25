'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Target, AlertTriangle, Play, Settings } from "lucide-react"

import { StoryBindingUtils } from '@/lib/story-binding-utils'
import { SceneEventBinding } from '@/lib/story-binding-types'

// Моковые данные для демонстрации
const mockGameState = {
  assets: [
    { id: '1', price: 1500, owner: 'player1', attributes: { strength: 5, intelligence: 7 } },
    { id: '2', price: 800, owner: 'player1', attributes: { strength: 3, intelligence: 4 } },
    { id: '3', price: 2500, owner: 'player2', attributes: { strength: 8, intelligence: 6 } }
  ],
  user: {
    id: 'player1',
    account: { balance: 3500 },
    assets: [
      { id: '1', status: 'active' },
      { id: '2', status: 'active' }
    ],
    equipment: [
      { id: 'eq1', status: 'active' },
      { id: 'eq2', status: 'active' }
    ]
  },
  day: 15,
  reputation: 25,
  void_experience: 3
}

const mockScenes = [
  {
    id: 'market_intro',
    title: 'Добро пожаловать на Talent Exchange',
    type: 'auction',
    eventBindings: [
      {
        id: 'auction_basic_1',
        eventType: 'auction',
        sceneId: 'market_intro',
        conditions: [],
        probability: 30,
        priority: 1,
        isBaseChance: true,
        metadata: { source: 'example', createdAt: '', lastModified: '' }
      }
    ]
  },
  {
    id: 'corporate_auction',
    title: 'Корпоративный аукцион',
    type: 'auction',
    eventBindings: [
      {
        id: 'auction_high_value_1',
        eventType: 'auction',
        sceneId: 'corporate_auction',
        conditions: [
          {
            id: 'condition_1',
            type: 'asset',
            field: 'any_asset_price',
            operator: '>',
            value: 1000,
            description: 'Наличие актива стоимостью более 1000 кредитов'
          }
        ],
        probability: 60,
        priority: 2,
        isBaseChance: false,
        metadata: { source: 'example', createdAt: '', lastModified: '' }
      }
    ]
  },
  {
    id: 'void_anomaly',
    title: 'Аномалия в Void',
    type: 'anomaly',
    eventBindings: [
      {
        id: 'anomaly_basic_1',
        eventType: 'anomaly',
        sceneId: 'void_anomaly',
        conditions: [],
        probability: 20,
        priority: 1,
        isBaseChance: true,
        metadata: { source: 'example', createdAt: '', lastModified: '' }
      },
      {
        id: 'anomaly_experienced_1',
        eventType: 'anomaly',
        sceneId: 'void_anomaly',
        conditions: [
          {
            id: 'condition_4',
            type: 'game_state',
            field: 'void_experience',
            operator: '>',
            value: 5,
            description: 'Опыт в Void более 5 операций'
          }
        ],
        probability: 50,
        priority: 2,
        isBaseChance: false,
        metadata: { source: 'example', createdAt: '', lastModified: '' }
      }
    ]
  }
]

export default function StoryBindingDemo() {
  const [gameState, setGameState] = useState(mockGameState)
  const [selectedScene, setSelectedScene] = useState<any>(null)
  const [testResults, setTestResults] = useState<any>(null)

  const testAuctionScenes = () => {
    const availableScenes = StoryBindingUtils.getAvailableScenes('auction', mockScenes, gameState)
    const selectedScene = StoryBindingUtils.selectRandomScene(availableScenes)
    
    setTestResults({
      type: 'auction',
      availableScenes,
      selectedScene,
      timestamp: new Date().toISOString()
    })
  }

  const testAnomalyScenes = () => {
    const availableScenes = StoryBindingUtils.getAvailableScenes('anomaly', mockScenes, gameState)
    const selectedScene = StoryBindingUtils.selectRandomScene(availableScenes)
    
    setTestResults({
      type: 'anomaly',
      availableScenes,
      selectedScene,
      timestamp: new Date().toISOString()
    })
  }

  const updateGameState = (field: string, value: any) => {
    setGameState(prev => {
      const newState = { ...prev }
      
      if (field === 'balance') {
        newState.user.account.balance = value
      } else if (field === 'void_experience') {
        newState.void_experience = value
      } else if (field === 'reputation') {
        newState.reputation = value
      }
      
      return newState
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Демонстрация системы привязок сцен</h1>
        <p className="text-muted-foreground">
          Тестирование привязки сюжетных сцен к аукциону и аномалиям с множественными условиями
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Игровое состояние */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Игровое состояние
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Баланс игрока</label>
                <input
                  type="number"
                  value={gameState.user.account.balance}
                  onChange={(e) => updateGameState('balance', parseInt(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Опыт в Void</label>
                <input
                  type="number"
                  value={gameState.void_experience}
                  onChange={(e) => updateGameState('void_experience', parseInt(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Репутация</label>
                <input
                  type="number"
                  value={gameState.reputation}
                  onChange={(e) => updateGameState('reputation', parseInt(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">День</label>
                <input
                  type="number"
                  value={gameState.day}
                  disabled
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Активы игрока</label>
              <div className="mt-1 space-y-1">
                {gameState.assets.filter(asset => asset.owner === gameState.user.id).map(asset => (
                  <div key={asset.id} className="text-sm bg-gray-50 px-3 py-2 rounded">
                    Актив {asset.id}: {asset.price} кредитов
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Тестирование */}
        <Card>
          <CardHeader>
            <CardTitle>Тестирование привязок</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={testAuctionScenes} className="flex-1">
                <Target className="h-4 w-4 mr-2" />
                Тест аукциона
              </Button>
              <Button onClick={testAnomalyScenes} className="flex-1">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Тест аномалий
              </Button>
            </div>

            {testResults && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {testResults.type === 'auction' ? 'Аукцион' : 'Аномалия'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(testResults.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Доступные сцены:</h4>
                  <div className="space-y-2">
                    {testResults.availableScenes.map((item: any, index: number) => (
                      <div key={index} className="text-sm bg-gray-50 px-3 py-2 rounded">
                        <div className="font-medium">{item.scene.title}</div>
                        <div className="text-muted-foreground">
                          Вероятность: {item.probability}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {testResults.selectedScene && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <h4 className="font-medium text-blue-900 mb-1">Выбранная сцена:</h4>
                    <div className="text-blue-800">{testResults.selectedScene.title}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Сцены и привязки */}
      <Tabs defaultValue="auction" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="auction" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Аукцион
          </TabsTrigger>
          <TabsTrigger value="anomaly" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Аномалии
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auction" className="space-y-4">
          <h3 className="text-xl font-semibold">Сцены аукциона</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockScenes.filter(scene => scene.type === 'auction').map(scene => (
              <Card key={scene.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{scene.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {scene.eventBindings?.map(binding => (
                      <div key={binding.id} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-purple-100 text-purple-800">
                            {binding.probability}% | Приоритет: {binding.priority}
                          </Badge>
                          {binding.isBaseChance && (
                            <Badge variant="secondary">Базовый шанс</Badge>
                          )}
                        </div>
                        
                        {binding.conditions.length > 0 ? (
                          <div className="space-y-1">
                            {binding.conditions.map(condition => (
                              <div key={condition.id} className="text-sm bg-gray-50 px-2 py-1 rounded">
                                {condition.description}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Без условий
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="anomaly" className="space-y-4">
          <h3 className="text-xl font-semibold">Сцены аномалий</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockScenes.filter(scene => scene.type === 'anomaly').map(scene => (
              <Card key={scene.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{scene.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {scene.eventBindings?.map(binding => (
                      <div key={binding.id} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-red-100 text-red-800">
                            {binding.probability}% | Приоритет: {binding.priority}
                          </Badge>
                          {binding.isBaseChance && (
                            <Badge variant="secondary">Базовый шанс</Badge>
                          )}
                        </div>
                        
                        {binding.conditions.length > 0 ? (
                          <div className="space-y-1">
                            {binding.conditions.map(condition => (
                              <div key={condition.id} className="text-sm bg-gray-50 px-2 py-1 rounded">
                                {condition.description}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Без условий
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Примеры использования */}
      <Card>
        <CardHeader>
          <CardTitle>Примеры использования</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Аукцион</h4>
              <ul className="space-y-2 text-sm">
                <li>• <strong>Базовый шанс:</strong> 30% - срабатывает всегда</li>
                <li>• <strong>Высокие цены:</strong> 60% - при наличии актива &gt;1000 кредитов</li>
                <li>• <strong>Элитный:</strong> 80% - для богатых игроков с множественными активами</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Аномалии</h4>
              <ul className="space-y-2 text-sm">
                <li>• <strong>Базовая:</strong> 20% - срабатывает всегда</li>
                <li>• <strong>Для опытных:</strong> 50% - при опыте в Void &gt;5 операций</li>
                <li>• <strong>Опасная:</strong> 70% - для игроков в сложном положении</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
