"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConditionBuilder } from '@/components/unified/builders/ConditionBuilder'
import { 
  Condition, 
  AssetCondition,
  ConditionUtils,
  ConditionEvaluator,
  GameState
} from '@/lib/unified-entities'
import { 
  ConditionUtils as Utils,
  ConditionEvaluator as Evaluator,
  ConditionValidator
} from '@/lib/condition-utils'

// Простые тестовые данные
const demoAssets = [
  {
    id: "demo_1",
    name: "Анна",
    rank: "Junior",
    avatar: "👩‍💻",
    price: 200,
    specialization: "Техническая поддержка",
    description: "Молодая специалистка",
    status: "available",
    owner: null,
    location: "talent_exchange",
    attributes: {
      strength: 2,
      empathy: 4,
      intelligence: 5,
      temperament: 3,
      grit: 3,
      ego: 2,
      loyalty: 2,
      obedience: 3,
      resistance: 1
    },
    skills: {
      maid: 1,
      cooking: 2,
      neural_hacking: 5,
      orgasm_control: 2,
      field: 1,
      etiquette: 2,
      logistics: 3,
      medical: 1,
      maintenance: 4,
      data: 5,
      dance: 1,
      seduction: 2,
      interrogation: 1,
      surveillance: 3
    },
    traits: ["tech_savvy", "analytical", "quiet"],
    preferences: {
      work_type: ["technical", "data"],
      environment: ["clean", "quiet"],
      avoid: ["social", "chaos"]
    },
    condition: {
      health: 100,
      mental_state: 90,
      stress: 10,
      fatigue: 15
    },
    history: {
      created: "2024-01-20",
      last_training: "2024-01-25",
      assignments: 2,
      success_rate: 0.9
    }
  }
]

const demoUser = {
  id: "demo_user",
  username: "Demo_Player",
  email: "demo@test.com",
  role: "user",
  status: "active",
  created: "2024-01-01",
  lastLogin: "2024-01-25",
  account: {
    balance: 1500,
    currency: "credits",
    transactions: []
  },
  assets: [],
  equipment: [],
  settings: {
    theme: "dark",
    notifications: true,
    autoAssign: false,
    riskTolerance: "medium"
  }
}

const demoGameState: GameState = {
  assets: demoAssets,
  users: [demoUser],
  storyScenes: [],
  storyPoints: {},
  currentUser: demoUser,
  sceneHistory: []
}

export default function ConditionDemoPage() {
  const [currentCondition, setCurrentCondition] = useState<Condition>({
    id: Utils.generateConditionId(),
    type: "asset_condition",
    name: "Демо условие",
    description: "Условие для демонстрации",
    target: {
      entityId: "any",
      attribute: "intelligence",
      operator: ">=",
      value: 4
    }
  } as AssetCondition)

  const [result, setResult] = useState<boolean | null>(null)

  const handleConditionChange = (condition: Condition) => {
    setCurrentCondition(condition)
    setResult(null)
  }

  const evaluateCondition = () => {
    try {
      const evaluationResult = Evaluator.evaluateCondition(currentCondition, demoGameState)
      setResult(evaluationResult)
    } catch (error) {
      console.error("Ошибка вычисления:", error)
      setResult(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">🎯 Демонстрация системы условий</h1>
        <p className="text-lg text-muted-foreground">
          Универсальная система для создания сложных игровых условий
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Построитель условий */}
        <div>
          <ConditionBuilder
            condition={currentCondition}
            onConditionChange={handleConditionChange}
            assets={demoAssets}
            users={[demoUser]}
          />
          
          <div className="mt-4">
            <Button onClick={evaluateCondition} className="w-full" size="lg">
              🧮 Вычислить условие
            </Button>
          </div>

          {result !== null && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className={`p-4 rounded-lg text-center ${
                  result 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <div className="text-2xl mb-2">
                    {result ? '✅ Истинно' : '❌ Ложно'}
                  </div>
                  <p className="text-sm">
                    Условие {result ? 'выполняется' : 'не выполняется'} для текущего состояния игры
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Информация и примеры */}
        <div className="space-y-6">
          {/* Описание текущего условия */}
          <Card>
            <CardHeader>
              <CardTitle>📝 Текущее условие</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Тип:</strong> {currentCondition.type}</p>
                <p><strong>Описание:</strong> {Utils.getConditionDescription(currentCondition)}</p>
                <p><strong>Валидно:</strong> {ConditionValidator.validateCondition(currentCondition) ? '✅ Да' : '❌ Нет'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Тестовые данные */}
          <Card>
            <CardHeader>
              <CardTitle>🎮 Тестовые данные</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Актив: Анна</h4>
                  <div className="text-sm space-y-1">
                    <p>Интеллект: 5</p>
                    <p>Нейрохакерство: 5</p>
                    <p>Работа с данными: 5</p>
                    <p>Трейты: tech_savvy, analytical, quiet</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Игрок: Demo_Player</h4>
                  <div className="text-sm space-y-1">
                    <p>Баланс: 1500 credits</p>
                    <p>Активов: 0</p>
                    <p>Роль: user</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Быстрые примеры */}
          <Card>
            <CardHeader>
              <CardTitle>⚡ Быстрые примеры</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => {
                    const condition: AssetCondition = {
                      id: Utils.generateConditionId(),
                      type: "asset_condition",
                      name: "Высокий интеллект",
                      description: "Актив с интеллектом >= 4",
                      target: {
                        entityId: "any",
                        attribute: "intelligence",
                        operator: ">=",
                        value: 4
                      }
                    }
                    setCurrentCondition(condition)
                    setResult(null)
                  }}
                >
                  🧠 Интеллект &gt;= 4
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => {
                    const condition: AssetCondition = {
                      id: Utils.generateConditionId(),
                      type: "asset_condition",
                      name: "Технарь",
                      description: "Актив с навыком нейрохакерства >= 3",
                      target: {
                        entityId: "any",
                        attribute: "neural_hacking",
                        operator: ">=",
                        value: 3
                      }
                    }
                    setCurrentCondition(condition)
                    setResult(null)
                  }}
                >
                  💻 Нейрохакерство &gt;= 3
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => {
                    const condition: AssetCondition = {
                      id: Utils.generateConditionId(),
                      type: "asset_condition",
                      name: "Аналитик",
                      description: "Актив с трейтом analytical",
                      target: {
                        entityId: "any",
                        attribute: "traits",
                        operator: "contains",
                        value: "analytical"
                      }
                    }
                    setCurrentCondition(condition)
                    setResult(null)
                  }}
                >
                  📊 Трейт "analytical"
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* JSON представление */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>🔧 JSON представление</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-64">
            {JSON.stringify(currentCondition, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
