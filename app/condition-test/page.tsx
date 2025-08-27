"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConditionBuilder } from '@/components/unified/builders/ConditionBuilder'
import { 
  Condition, 
  AssetCondition, 
  PlayerCondition,
  Asset,
  User,
  GameState
} from '@/lib/unified-entities'
import { 
  ConditionUtils,
  ConditionEvaluator
} from '@/lib/condition-utils'

// Тестовые данные
const testAssets: Asset[] = [
  {
    id: "asset_1",
    name: "Алекс",
    rank: "Junior",
    avatar: "👩‍💻",
    price: 150,
    specialization: "Базовое подчинение",
    description: "Молодая актив с хорошими навыками обслуживания",
    status: "available",
    owner: null,
    location: "talent_exchange",
    attributes: {
      strength: 2,
      empathy: 3,
      intelligence: 4,
      temperament: 3,
      grit: 3,
      ego: 2,
      loyalty: 1,
      obedience: 2,
      resistance: 1
    },
    skills: {
      maid: 2,
      cooking: 1,
      neural_hacking: 4,
      orgasm_control: 3,
      field: 2,
      etiquette: 2,
      logistics: 2,
      medical: 1,
      maintenance: 3,
      data: 3,
      dance: 1,
      seduction: 2,
      interrogation: 1,
      surveillance: 2
    },
    traits: ["loyal", "quick_learner", "tech_savvy"],
    preferences: {
      work_type: ["service", "technical"],
      environment: ["clean", "quiet"],
      avoid: ["violence", "chaos"]
    },
    condition: {
      health: 100,
      mental_state: 85,
      stress: 15,
      fatigue: 20
    },
    history: {
      created: "2024-01-15",
      last_training: "2024-01-20",
      assignments: 3,
      success_rate: 0.85
    }
  },
  {
    id: "asset_2",
    name: "Мария",
    rank: "Middle",
    avatar: "👩‍💼",
    price: 300,
    specialization: "Этикет и подчинение",
    description: "Опытная актив с отличными навыками обслуживания",
    status: "available",
    owner: null,
    location: "talent_exchange",
    attributes: {
      strength: 3,
      empathy: 5,
      intelligence: 3,
      temperament: 4,
      grit: 4,
      ego: 2,
      loyalty: 3,
      obedience: 4,
      resistance: 2
    },
    skills: {
      maid: 4,
      cooking: 5,
      neural_hacking: 2,
      orgasm_control: 2,
      field: 3,
      etiquette: 5,
      logistics: 3,
      medical: 2,
      maintenance: 1,
      data: 2,
      dance: 4,
      seduction: 4,
      interrogation: 2,
      surveillance: 1
    },
    traits: ["experienced", "elegant", "patient"],
    preferences: {
      work_type: ["service", "social"],
      environment: ["luxury", "formal"],
      avoid: ["rough", "casual"]
    },
    condition: {
      health: 95,
      mental_state: 90,
      stress: 10,
      fatigue: 15
    },
    history: {
      created: "2024-01-10",
      last_training: "2024-01-18",
      assignments: 8,
      success_rate: 0.92
    }
  }
]

const testUser: User = {
  id: "user_1",
  username: "Master_Control",
  email: "master@nexus.com",
  role: "admin",
  status: "active",
  created: "2024-01-01",
  lastLogin: "2024-01-25",
  account: {
    balance: 2500,
    currency: "credits",
    transactions: []
  },
  assets: [
    {
      assetId: "asset_1",
      name: "Алекс",
      acquired: "2024-01-15",
      status: "active",
      location: "estate",
      currentAssignment: null
    }
  ],
  equipment: [
    {
      itemId: "implant_1",
      name: "Neural Interface",
      type: "implant",
      slot: "neural",
      installed: "2024-01-10",
      status: "active"
    }
  ],
  settings: {
    theme: "dark",
    notifications: true,
    autoAssign: false,
    riskTolerance: "medium"
  }
}

const testGameState: GameState = {
  assets: testAssets,
  users: [testUser],
  storyScenes: [],
  storyPoints: {},
  currentUser: testUser,
  sceneHistory: []
}

export default function ConditionTestPage() {
  const [currentCondition, setCurrentCondition] = useState<Condition>({
    id: ConditionUtils.generateConditionId(),
    type: "asset_condition",
    name: "Тестовое условие",
    description: "Условие для тестирования",
    target: {
      entityId: "any",
      attribute: "strength",
      operator: ">=",
      value: 3
    }
  } as AssetCondition)

  const [evaluationResult, setEvaluationResult] = useState<boolean | null>(null)

  const handleConditionChange = (condition: Condition) => {
    setCurrentCondition(condition)
    setEvaluationResult(null)
  }

  const evaluateCondition = () => {
    try {
      const result = ConditionEvaluator.evaluateCondition(currentCondition, testGameState)
      setEvaluationResult(result)
    } catch (error) {
      console.error("Ошибка вычисления условия:", error)
      setEvaluationResult(false)
    }
  }

  const createExampleConditions = () => {
    const examples: Condition[] = [
      // Пример 1: Актив с высоким интеллектом
      {
        id: ConditionUtils.generateConditionId(),
        type: "asset_condition",
        name: "Высокий интеллект",
        description: "Актив с интеллектом больше 4",
        target: {
          entityId: "any",
          attribute: "intelligence",
          operator: ">",
          value: 4
        }
      } as AssetCondition,

      // Пример 2: Игрок с достаточным балансом
      {
        id: ConditionUtils.generateConditionId(),
        type: "player_condition",
        name: "Достаточный баланс",
        description: "Игрок с балансом больше 1000",
        target: {
          attribute: "balance",
          operator: ">=",
          value: 1000
        }
      } as PlayerCondition,

      // Пример 3: Актив с определенным трейтом
      {
        id: ConditionUtils.generateConditionId(),
        type: "asset_condition",
        name: "Лояльный актив",
        description: "Актив с трейтом 'loyal'",
        target: {
          entityId: "any",
          attribute: "traits",
          operator: "contains",
          value: "loyal"
        }
      } as AssetCondition,

      // Пример 4: Актив с высокими навыками обслуживания
      {
        id: ConditionUtils.generateConditionId(),
        type: "asset_condition",
        name: "Опытный слуга",
        description: "Актив с навыком обслуживания больше 3",
        target: {
          entityId: "any",
          attribute: "maid",
          operator: ">=",
          value: 3
        }
      } as AssetCondition
    ]

    return examples
  }

  const loadExample = (example: Condition) => {
    setCurrentCondition(example)
    setEvaluationResult(null)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Тестирование системы условий</h1>
        <p className="text-muted-foreground">
          Демонстрация универсальной системы условий для игры
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Построитель условий */}
        <div>
          <ConditionBuilder
            condition={currentCondition}
            onConditionChange={handleConditionChange}
            assets={testAssets}
            users={[testUser]}
          />
          
          <div className="mt-4">
            <Button onClick={evaluateCondition} className="w-full">
              Вычислить условие
            </Button>
          </div>

          {evaluationResult !== null && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className={`p-3 rounded ${
                  evaluationResult 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <strong>Результат вычисления:</strong> {evaluationResult ? 'Истинно' : 'Ложно'}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Примеры условий */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Примеры условий</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {createExampleConditions().map((example, index) => (
                <div key={example.id} className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{example.name}</h4>
                      <p className="text-sm text-muted-foreground">{example.description}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {ConditionUtils.getConditionDescription(example)}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => loadExample(example)}
                    >
                      Загрузить
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Информация о тестовых данных */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Тестовые данные</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Активы:</h4>
                <div className="space-y-2">
                  {testAssets.map(asset => (
                    <div key={asset.id} className="text-sm p-2 bg-gray-50 rounded">
                      <strong>{asset.name}</strong> ({asset.rank}) - {asset.specialization}
                      <br />
                      <span className="text-muted-foreground">
                        Интеллект: {asset.attributes.intelligence}, 
                        Обслуживание: {asset.skills.maid}, 
                        Трейты: {asset.traits.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Игрок:</h4>
                <div className="text-sm p-2 bg-gray-50 rounded">
                  <strong>{testUser.username}</strong> ({testUser.role})
                  <br />
                  <span className="text-muted-foreground">
                    Баланс: {testUser.account.balance} {testUser.account.currency}, 
                    Активов: {testUser.assets.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* JSON представление текущего условия */}
      <Card>
        <CardHeader>
          <CardTitle>JSON представление условия</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(currentCondition, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
