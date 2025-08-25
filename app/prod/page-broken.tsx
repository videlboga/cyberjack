"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { loadUnifiedConfigWithAdapter } from "@/lib/unified-config-adapter"
import type { GameConfig, GameAction, GameContract, GameEquipment, CharacterAIConfig } from "@/lib/types"
import RegistrationModal from "./components/RegistrationModal"
import { personalWorkIntegration } from "@/lib/character/personal-work-integration"
import CharacterPanel from "./components/CharacterPanel"
import { useCharacterAI } from "./hooks/useCharacterAI"
import { ActionToolPanel } from "./components/ActionToolPanel"
import { CharacterChat } from "./components/CharacterChat"
import { Character } from '@/lib/character/types'

// Функция для генерации уникальных ID
let idCounter = 0
const generateUniqueId = (prefix: string = '') => {
  idCounter++
  return `${prefix}${Date.now()}-${idCounter}`
}

// Используем типы из lib/types.ts
type Equipment = GameEquipment

interface StatusEffect {
  id: string
  name: string
  type: "buff" | "debuff" | "neutral"
  duration: number
  effects: { [key: string]: number }
  description: string
  icon: string
  removable?: boolean
  source?: string
  stackable?: boolean
  maxStacks?: number
  currentStacks?: number
}

interface Contract {
  id: string
  title: string
  description: string
  reward: number
  duration: number
  difficulty: "easy" | "medium" | "hard"
  requirements: string[]
  assignedCharacter?: string
  progress: number
  kpi: { name: string; target: number; current: number }[]
  deadline?: number
}

interface LocalGameEvent {
  id: string
  title: string
  description: string
  type: "positive" | "negative" | "neutral"
  effects: { stat: string; change: number }[]
  choices?: { text: string; effects: { stat: string; change: number }[] }[]
  icon?: string
}

interface ActionCategory {
  id: string
  name: string
  icon: string
  actions: Action[]
}

// Используем типы из lib/types.ts
type Action = GameAction

export default function CharacterArchitectProd() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  
  // Состояние для регистрации
  const [showRegistration, setShowRegistration] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; id: string } | null>(null)
  const [showCharacterPanel, setShowCharacterPanel] = useState(false)
  
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [neuralPulses, setNeuralPulses] = useState(100)
  const [credits, setCredits] = useState(5000)
  
  // Кастомный хук для управления кредитами с сохранением
  const updateCredits = (newCredits: number | ((prev: number) => number)) => {
    const updatedCredits = typeof newCredits === 'function' ? newCredits(credits) : newCredits
    setCredits(updatedCredits)
    // Обновляем баланс только если пользователь зарегистрирован
    if (currentUser) {
      updateUserBalance(updatedCredits)
    }
  }

  // Функция для обновления баланса пользователя
  const updateUserBalance = (newBalance: number) => {
    if (!gameConfig?.users?.users) return
    
    setGameConfig(prev => {
      if (!prev?.users?.users) return prev
      
      const updatedUsers = prev.users.users.map(user => 
        user.id === currentUser?.id 
          ? { ...user, account: { ...user.account, balance: newBalance } }
          : user
      )
      
      return {
        ...prev,
        users: {
          ...prev.users,
          users: updatedUsers
        }
      }
    })
  }

  // Состояние для персонажей (используем новую систему Character)
  const [characters, setCharacters] = useState<Character[]>([])
  const [activeTab, setActiveTab] = useState("characters")

  // Состояние для контрактов
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  // Состояние для событий
  const [events, setEvents] = useState<LocalGameEvent[]>([])
  const [activeEvent, setActiveEvent] = useState<LocalGameEvent | null>(null)

  // Состояние для оборудования
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)

  // Состояние для действий
  const [actions, setActions] = useState<Action[]>([])
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)

  // Состояние для эффектов статуса
  const [statusEffects, setStatusEffects] = useState<StatusEffect[]>([])

  // Состояние для Character AI
  const characterAI = useCharacterAI({
    characterAIConfig: gameConfig?.characterAI || {
      poses: {},
      actions: {},
      tools: {},
      poseChangeConditions: {},
      interactiveAreas: {},
      quickActions: {}
    },
    characterStates: selectedCharacter?.stats ? {
      endurance: selectedCharacter.stats.physical.endurance,
      sensitivity: selectedCharacter.stats.physical.sensitivity,
      flexibility: selectedCharacter.stats.physical.flexibility,
      emotionalStability: selectedCharacter.stats.psychological.emotionalStability,
      adaptability: selectedCharacter.stats.psychological.adaptability,
      intelligence: selectedCharacter.stats.psychological.intelligence,
      sociability: selectedCharacter.stats.social.sociability,
      empathy: selectedCharacter.stats.social.empathy,
      dominance: selectedCharacter.stats.social.dominance,
      sexualExperience: selectedCharacter.stats.special.sexualExperience,
      resistance: selectedCharacter.stats.special.resistance,
      dependency: selectedCharacter.stats.special.dependency,
      fetishSensitivity: selectedCharacter.stats.special.fetishSensitivity,
      fetishDiscovery: selectedCharacter.stats.special.fetishDiscovery
    } : {},
    characterAttributes: selectedCharacter?.stats ? {
      endurance: selectedCharacter.stats.physical.endurance,
      sensitivity: selectedCharacter.stats.physical.sensitivity,
      flexibility: selectedCharacter.stats.physical.flexibility,
      emotionalStability: selectedCharacter.stats.psychological.emotionalStability,
      adaptability: selectedCharacter.stats.psychological.adaptability,
      intelligence: selectedCharacter.stats.psychological.intelligence,
      sociability: selectedCharacter.stats.social.sociability,
      empathy: selectedCharacter.stats.social.empathy,
      dominance: selectedCharacter.stats.social.dominance,
      sexualExperience: selectedCharacter.stats.special.sexualExperience,
      resistance: selectedCharacter.stats.special.resistance,
      dependency: selectedCharacter.stats.special.dependency,
      fetishSensitivity: selectedCharacter.stats.special.fetishSensitivity,
      fetishDiscovery: selectedCharacter.stats.special.fetishDiscovery
    } : {},
    characterFetishes: selectedCharacter?.fetishes ? {
      ...Object.fromEntries(selectedCharacter.fetishes.primary.map(f => [f.name, f.intensity])),
      ...Object.fromEntries(selectedCharacter.fetishes.secondary.map(f => [f.name, f.intensity])),
      ...Object.fromEntries(selectedCharacter.fetishes.discovered.map(f => [f.name, f.intensity]))
    } : {},
    userEquipment: equipment.map(e => e.id),
    currentPose: 'default',
    geminiApiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY
  })

  // Загрузка конфигурации
  useEffect(() => {
    const loadConfig = async () => {
      try {
        console.log('🔄 Загрузка конфигурации...')
        const config = await loadUnifiedConfigWithAdapter()
        setGameConfig(config)
        
        // Заполнение characters из конфигурации
        console.log('🔄 Заполняем characters из конфигурации...')
        const charactersFromConfig = config.characters?.characters || []
        console.log('✅ Characters заполнены из конфигурации:', charactersFromConfig)
        setCharacters(charactersFromConfig)
        
        // Заполнение других данных
        if (config.contracts?.available) {
          setContracts(config.contracts.available.map(contract => ({
            id: contract.id,
            title: contract.title,
            description: contract.description,
            reward: contract.reward,
            duration: 30,
            difficulty: "medium" as const,
            requirements: [],
            progress: 0,
            kpi: contract.kpi || []
          })))
        }

        if (config.equipment?.equipment) {
          setEquipment(config.equipment.equipment)
        }

        if (config.actions?.categories) {
          const allActions: Action[] = []
          Object.values(config.actions.categories).forEach(category => {
            if (category.actions) {
              Object.values(category.actions).forEach(action => {
                allActions.push(action)
              })
            }
          })
          setActions(allActions)
        }

        setConfigLoading(false)
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигурации:', error)
        setConfigError(error instanceof Error ? error.message : 'Неизвестная ошибка')
        setConfigLoading(false)
      }
    }

    loadConfig()
  }, [])

  // Обработчик выбора персонажа
  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character)
    setShowCharacterPanel(true)
  }

  // Обработчик регистрации
  const handleRegistration = (username: string) => {
    const userId = generateUniqueId('user_')
    const newUser = {
      id: userId,
      username,
      email: `${username}@example.com`,
      role: 'user',
      status: 'active',
      created: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      account: {
        balance: credits,
        reputation: 0,
        level: 1,
        experience: 0
      },
      assets: [],
      equipment: [],
      settings: {}
    }

    setCurrentUser({ username, id: userId })
    setShowRegistration(false)

    // Добавляем пользователя в конфигурацию
    if (gameConfig) {
      setGameConfig(prev => ({
        ...prev!,
        users: {
          ...prev!.users,
          users: [...(prev!.users?.users || []), newUser]
        }
      }))
    }
  }

  // Обработчик действий с персонажем
  const handleCharacterAction = (action: Action) => {
    if (!selectedCharacter) return

    console.log(`🎯 Выполняется действие: ${action.name} для персонажа ${selectedCharacter.name}`)
    
    // Здесь можно добавить логику выполнения действий
    // Например, изменение статистик персонажа, получение наград и т.д.
    
    // Обновляем кредиты
    if (action.reward) {
      updateCredits(prev => prev + action.reward)
    }
  }

  // Обработчик назначения контракта
  const handleAssignContract = (contract: Contract) => {
    if (!selectedCharacter) return

    setContracts(prev => prev.map(c => 
      c.id === contract.id 
        ? { ...c, assignedCharacter: selectedCharacter.id }
        : c
    ))
    setSelectedContract(contract)
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Загрузка конфигурации...</p>
        </div>
      </div>
    )
  }

  if (configError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Ошибка загрузки</h2>
          <p className="text-gray-600">{configError}</p>
        </div>
      </div>
    )
  }

  if (showRegistration) {
    return (
      <RegistrationModal 
        onRegister={handleRegistration}
        onClose={() => setShowRegistration(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Верхняя панель */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold text-gray-900">Character Architect</h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Кредиты:</span>
                  <span className="font-semibold text-green-600">{credits.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Нейроимпульсы:</span>
                  <span className="font-semibold text-blue-600">{neuralPulses}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Пользователь: {currentUser?.username}</span>
              <button 
                onClick={() => setShowRegistration(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Сменить пользователя
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Левая панель - Список персонажей */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Персонажи ({characters.length})</h2>
              <div className="space-y-2">
                {characters.map((character) => (
                  <div
                    key={character.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedCharacter?.id === character.id
                        ? 'bg-blue-100 border-blue-300 border'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => handleCharacterSelect(character)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{character.name}</h3>
                        <p className="text-sm text-gray-600">{character.archetype}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          {character.emotionalState}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Центральная панель - Детали персонажа */}
          <div className="lg:col-span-2">
            {selectedCharacter ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedCharacter.name}</h2>
                    <p className="text-gray-600">{selectedCharacter.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Архетип: {selectedCharacter.archetype}</div>
                    <div className="text-sm text-gray-500">Состояние: {selectedCharacter.emotionalState}</div>
                  </div>
                </div>

                {/* Статистики */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold mb-3">Физические характеристики</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Выносливость:</span>
                        <span>{selectedCharacter.stats.physical.endurance}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Чувствительность:</span>
                        <span>{selectedCharacter.stats.physical.sensitivity}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Гибкость:</span>
                        <span>{selectedCharacter.stats.physical.flexibility}/10</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-3">Психологические характеристики</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Эмоциональная стабильность:</span>
                        <span>{selectedCharacter.stats.psychological.emotionalStability}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Адаптивность:</span>
                        <span>{selectedCharacter.stats.psychological.adaptability}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Интеллект:</span>
                        <span>{selectedCharacter.stats.psychological.intelligence}/10</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Фетиши */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Фетиши</h3>
                  <div className="space-y-2">
                    {selectedCharacter.fetishes.primary.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-red-600 mb-1">Основные:</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedCharacter.fetishes.primary.map((fetish) => (
                            <span key={fetish.id} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                              {fetish.name} ({fetish.intensity}/10)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedCharacter.fetishes.secondary.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-orange-600 mb-1">Вторичные:</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedCharacter.fetishes.secondary.map((fetish) => (
                            <span key={fetish.id} className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                              {fetish.name} ({fetish.intensity}/10)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Действия */}
                <div>
                  <h3 className="font-semibold mb-3">Доступные действия</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {actions.slice(0, 6).map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleCharacterAction(action)}
                        className="p-2 text-left bg-gray-50 hover:bg-gray-100 rounded text-sm"
                      >
                        <div className="font-medium">{action.name}</div>
                        <div className="text-xs text-gray-600">{action.description}</div>
                        {action.reward && (
                          <div className="text-xs text-green-600">+{action.reward} кредитов</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center text-gray-500">
                  <p>Выберите персонажа для просмотра деталей</p>
                </div>
              </div>
            )}
          </div>

          {/* Правая панель - Контракты и события */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Контракты */}
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-4">Контракты ({contracts.length})</h2>
                <div className="space-y-2">
                  {contracts.slice(0, 3).map((contract) => (
                    <div
                      key={contract.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedContract?.id === contract.id
                          ? 'bg-green-100 border-green-300 border'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedContract(contract)}
                    >
                      <h3 className="font-medium">{contract.title}</h3>
                      <p className="text-sm text-gray-600">{contract.description}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-green-600">+{contract.reward} кредитов</span>
                        <span className="text-xs text-gray-500">{contract.difficulty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Оборудование */}
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-4">Оборудование ({equipment.length})</h2>
                <div className="space-y-2">
                  {equipment.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedEquipment?.id === item.id
                          ? 'bg-purple-100 border-purple-300 border'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedEquipment(item)}
                    >
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                      <div className="text-xs text-gray-500 mt-1">{item.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальные окна */}
      {showCharacterPanel && selectedCharacter && (
        <CharacterPanel
          character={selectedCharacter}
          onClose={() => setShowCharacterPanel(false)}
          onAction={handleCharacterAction}
        />
      )}

      {selectedCharacter && characterAI && (
        <CharacterChat
          characterAI={characterAI}
          selectedCharacter={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
        />
      )}
    </div>
  )
}
