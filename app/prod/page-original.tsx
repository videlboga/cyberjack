"use client"

import React from "react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { loadUnifiedConfigV2 } from "@/lib/unified-config-loader"
import type { GameConfig, GameAction, GameContract, GameEquipment, CharacterAIConfig } from "@/lib/unified-entities"
import RegistrationModal from "./components/RegistrationModal"
import { personalWorkIntegration } from "@/lib/character/personal-work-integration"
import {
  getCharacteristicDisplayValue,
  initializeHiddenCharacteristics
} from "@/lib/character-analysis"
import type { PlayerCharacterKnowledge, CharacteristicKnowledge } from "@/lib/unified-entities"

import { useCharacterAI } from "./hooks/useCharacterAI"
import { ActionToolPanel } from "./components/ActionToolPanel"
import { CharacterChat } from "./components/CharacterChat"
// import { CharacterAdapter } from "@/lib/character/character-adapter" // Удален
import { OpenRouterDebugPanel } from './components/OpenRouterDebugPanel'
import { Button } from "@/components/ui/button"
import { StatNotification } from "@/components/ui/stat-notification"
import { CharacterStatsPanel } from "@/components/ui/character-stats-panel"
import { Toaster } from "@/components/ui/toaster"

  // Функция для генерации уникальных ID
  let idCounter = 0
  const generateUniqueId = (prefix: string = '') => {
    idCounter++
    return `${prefix}${Date.now()}-${idCounter}`
  }

// Используем типы из lib/types.ts
type Equipment = GameEquipment

/**
 * Получает знания пользователя о конкретном персонаже
 */
function getPlayerCharacterKnowledge(
  user: any,
  characterId: string,
  userCharacterKnowledge: any
): PlayerCharacterKnowledge | null {
  // Используем состояние userCharacterKnowledge если оно загружено
  if (userCharacterKnowledge && userCharacterKnowledge[characterId]) {
    return userCharacterKnowledge[characterId]
  }

  // Fallback на localStorage
  const savedUser = localStorage.getItem('currentUser')
  if (savedUser) {
    try {
      const fullUser = JSON.parse(savedUser)
      if (fullUser.characterKnowledge && fullUser.characterKnowledge[characterId]) {
        return fullUser.characterKnowledge[characterId]
      }
    } catch (error) {
      console.error('Ошибка чтения данных пользователя из localStorage:', error)
    }
  }

  return null
}

/**
 * Получает отображаемое значение характеристики с учетом знаний пользователя
 */
function getCharacteristicDisplayValueForProd(
  knowledge: CharacteristicKnowledge | null,
  actualValue: number,
  charName?: string
): number {
  if (!knowledge || knowledge.level === 'unknown') {
    return 0 // Используем 0 как индикатор неизвестной характеристики
  }

  const displayValue = getCharacteristicDisplayValue(knowledge, actualValue)

  // Парсим строку и возвращаем число
  const parsed = parseFloat(displayValue)
  return isNaN(parsed) ? 0 : parsed
}

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

interface Talent {
  id: string
  name: string
  role: string
  level: number
  mood: number
  fear: number
  despair: number
  devotion: number
  strength: number
  empathy: number
  intelligence: number
  creativity: number
  status: "available" | "working" | "resting"
  memories: string[]
  experience: number
  maxExperience: number
  statusEffects: StatusEffect[]
  equippedItems: Equipment[]
  inventory: Equipment[]
  neuralPulses?: number
  attributes: {
    strength: number
    empathy: number
    intelligence: number
    creativity: number
    temperament: number
    grit: number
    ego: number
  }
  states: {
    mood: number
    fear: number
    despair: number
    devotion: number
    entitlement: number
    awareness: number
    routine: number
    compliance: number
    sensuality: number
    endurance: number
    sensory_overload: number
  }
  skills: {
    maid: number
    cooking: number
    neural_hacking: number
    orgasm_control: number
    field: number
    etiquette: number
    logistics: number
    medical: number
    maintenance: number
    data: number
    dance: number
  }
  affinities: { [key: string]: number }
  stressors: { [key: string]: number }
}

interface Contract {
  id: string
  title: string
  description: string
  reward: number
  duration: number
  difficulty: "easy" | "medium" | "hard"
  requirements: string[]
  assignedTalent?: string
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

export default function TalentArchitectProd() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  
  // Состояние для регистрации
  const [showRegistration, setShowRegistration] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; id: string } | null>(null)
  const [userCharacterKnowledge, setUserCharacterKnowledge] = useState<any>(null)
  const [showCharacterPanel, setShowCharacterPanel] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null)
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
  const [reputation, setReputation] = useState(75)
  const [currentDay, setCurrentDay] = useState(1)
  const [activeTab, setActiveTab] = useState("talents")
  const [editMode, setEditMode] = useState(false)
  const [currentEvent, setCurrentEvent] = useState<LocalGameEvent | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)
  const [showInventory, setShowInventory] = useState(false)
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<string | null>(null)
  const [showImplantControl, setShowImplantControl] = useState(false)
  const [selectedImplant, setSelectedImplant] = useState<Equipment | null>(null)
  const [showStatusEffects, setShowStatusEffects] = useState(false)
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false)


  const [personalWorkMode, setPersonalWorkMode] = useState(false)
  const [showInteractionPanel, setShowInteractionPanel] = useState(false)
  const [selectedInteractionType, setSelectedInteractionType] = useState<string | null>(null)
  const [showLLMChat, setShowLLMChat] = useState(false)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [interactiveAreas, setInteractiveAreas] = useState<{ [key: string]: boolean }>({})
  const [floatingPanelPosition, setFloatingPanelPosition] = useState({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const [chatMessages, setChatMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string; timestamp: Date }[]
  >([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [chatPosition, setChatPosition] = useState({ x: 200, y: 150 })
  const [isChatDragging, setIsChatDragging] = useState(false)
  const [chatDragOffset, setChatDragOffset] = useState({ x: 0, y: 0 })

  // Character AI состояния
  const [characterAIConfig, setCharacterAIConfig] = useState<CharacterAIConfig | null>(null)
  const [showCharacterAIPanel, setShowCharacterAIPanel] = useState(false)
  const [showActionToolPanel, setShowActionToolPanel] = useState(false)
  const [showCharacterChat, setShowCharacterChat] = useState(false)
  const [showOpenRouterDebug, setShowOpenRouterDebug] = useState(false)
  
  // Состояние для уведомлений об изменениях характеристик
  const [statChanges, setStatChanges] = useState<Array<{ stat: string; change: number; timestamp: number }>>([])

  // Инициализация Character AI - всегда вызываем хук, но передаем пустую конфигурацию если нет данных
  const characterAI = useCharacterAI({
    characterAIConfig: characterAIConfig || {
      actions: {},
      tools: {},
      poses: {},
      poseChangeConditions: {},
      emotions: {},
      fetishes: {},
      settings: {},
      llmPrompts: {
        basePrompt: "",
        characteristicInterpretations: {},
        fetishResponses: {}
      }
    },
    characterStates: selectedTalent?.states || {},
    characterAttributes: selectedTalent?.attributes || {},
    characterFetishes: selectedTalent?.affinities || {},
    userEquipment: selectedTalent?.equippedItems?.map(item => item.id) || [],
    currentPose: "standing_normal",
    geminiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
  })

  // Загрузка конфигурации при монтировании компонента
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setConfigLoading(true)

        const config = await loadUnifiedConfigV2()
        setGameConfig(config)

        // Загружаем конфигурацию Character AI
        if (config.characterAI) {
          setCharacterAIConfig(config.characterAI)
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигурации в prod:', error)
        setConfigError(error instanceof Error ? error.message : 'Неизвестная ошибка загрузки')
      } finally {
        setConfigLoading(false)
      }
    }
    
    loadConfig()
  }, [])



  // Заполнение talents из конфигурации (только привязанные к пользователю персонажи)
  useEffect(() => {
    if (gameConfig?.characters && currentUser && gameConfig?.equipment?.equipment && gameConfig.equipment.equipment.length > 0) {
      // Получаем привязанных персонажей пользователя
      let userCharacters: string[] = []

      if (gameConfig.users?.users) {
        // Ищем пользователя сначала по ID, потом по имени (для обратной совместимости)
        let userData = gameConfig.users.users.find((u: any) =>
          u.id === currentUser.id || u.name === currentUser.username || u.username === currentUser.username
        )

        // Если не нашли, попробуем найти по всем возможным полям
        if (!userData) {
          userData = gameConfig.users.users.find((u: any) => {
            const matches = []
            if (u.id === currentUser.id) matches.push('id')
            if (u.name === currentUser.username) matches.push('name')
            if (u.username === currentUser.username) matches.push('username')
            if (u.email === currentUser.username) matches.push('email')
            return matches.length > 0
          })
        }
        userCharacters = userData?.characters || []
        const userEquipmentIds = userData?.userEquipment || []

        console.log('🔧 Данные пользователя:', userData)
        console.log('🎯 userEquipmentIds:', userEquipmentIds)
        console.log('🎯 gameConfig.equipment.equipment:', gameConfig?.equipment?.equipment?.length || 'undefined')

        // Фильтруем оборудование по принадлежности пользователю
        const userEquipmentList = userEquipmentIds.length > 0
          ? gameConfig.equipment.equipment.filter((equipment: any) => userEquipmentIds.includes(equipment.id))
          : []

        console.log('🎯 Отфильтрованное оборудование:', userEquipmentList.map((eq: any) => eq.id))
        console.log('🎯 Количество отфильтрованного оборудования:', userEquipmentList.length)

        setUserEquipment(userEquipmentList)
        setFilteredInventory(userEquipmentList)

      }

      // Фильтруем персонажей по привязанным персонажам
      const filteredCharacters = userCharacters.length > 0
        ? gameConfig.characters.filter((character: any) => userCharacters.includes(character.id))
        : [] // Если нет привязанных персонажей, показываем пустой список

      

      const talentsFromConfig = filteredCharacters.map(character => {

        // Получаем знания пользователя об этом персонаже
        const characterKnowledge = getPlayerCharacterKnowledge(currentUser, character.id, userCharacterKnowledge)

        // Используем новую систему характеристик с учетом знаний пользователя
        const mappedAttributes = {
          // Физические характеристики
          endurance: characterKnowledge?.knowledge?.physical?.['Выносливость']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.physical['Выносливость'], character.characteristics?.physical?.['Выносливость'] || 0, 'Выносливость')
            : 0,
          sensitivity: characterKnowledge?.knowledge?.physical?.['Чувствительность']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.physical['Чувствительность'], character.characteristics?.physical?.['Чувствительность'] || 0, 'Чувствительность')
            : 0,
          flexibility: characterKnowledge?.knowledge?.physical?.['Гибкость']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.physical['Гибкость'], character.characteristics?.physical?.['Гибкость'] || 0, 'Гибкость')
            : 0,

          // Психологические характеристики
          emotionalStability: characterKnowledge?.knowledge?.psychological?.['Эмоциональная стабильность']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.psychological['Эмоциональная стабильность'], character.characteristics?.psychological?.['Эмоциональная стабильность'] || 0)
            : 0,
          adaptability: characterKnowledge?.knowledge?.psychological?.['Адаптивность']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.psychological['Адаптивность'], character.characteristics?.psychological?.['Адаптивность'] || 0)
            : 0,
          intelligence: characterKnowledge?.knowledge?.psychological?.['Интеллект']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.psychological['Интеллект'], character.characteristics?.psychological?.['Интеллект'] || 0)
            : 0,

          // Социальные характеристики
          sociability: characterKnowledge?.knowledge?.social?.['Общительность']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.social['Общительность'], character.characteristics?.social?.['Общительность'] || 0)
            : 0,
          empathy: characterKnowledge?.knowledge?.social?.['Эмпатия']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.social['Эмпатия'], character.characteristics?.social?.['Эмпатия'] || 0)
            : 0,
          dominance: characterKnowledge?.knowledge?.social?.['Доминантность']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.social['Доминантность'], character.characteristics?.social?.['Доминантность'] || 0)
            : 0,

          // Личностные характеристики
          selfEsteem: characterKnowledge?.knowledge?.personality?.['Самооценка']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.personality['Самооценка'], character.characteristics?.personality?.['Самооценка'] || 0)
            : 0,
          optimism: characterKnowledge?.knowledge?.personality?.['Оптимизм']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.personality['Оптимизм'], character.characteristics?.personality?.['Оптимизм'] || 0)
            : 0,
          curiosity: characterKnowledge?.knowledge?.personality?.['Любопытство']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.personality['Любопытство'], character.characteristics?.personality?.['Любопытство'] || 0)
            : 0,

          // Специальные характеристики
          sexualExperience: characterKnowledge?.knowledge?.special?.['Сексуальная опытность']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.special['Сексуальная опытность'], character.characteristics?.special?.['Сексуальная опытность'] || 0)
            : 0,
          resistance: characterKnowledge?.knowledge?.special?.['Сопротивляемость']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.special['Сопротивляемость'], character.characteristics?.special?.['Сопротивляемость'] || 0)
            : 0,
          dependency: characterKnowledge?.knowledge?.special?.['Зависимость']
            ? getCharacteristicDisplayValueForProd(characterKnowledge.knowledge.special['Зависимость'], character.characteristics?.special?.['Зависимость'] || 0)
            : 0,
        }
        
        // Создаем состояния на основе атрибутов или используем дефолтные (шкала 0-100)
        const mappedStates = {
          mood: 75,
          anxiety: 25,
          burnout: 20,
          engagement: 80,
          entitlement: 30,
          insight: 70,
          routine: 50,
          compliance: 60,
          neuroplasticity: 80,
          cognitiveLoad: 40,
        }
        
        return {
          id: character.id,
          name: character.name,
          role: character.specialization,
          level: character.rank === 'Junior' ? 3 : character.rank === 'Middle' ? 5 : 7,
          attributes: mappedAttributes,
          states: mappedStates,
          skills: character.skills,
          status: "available",
          memories: [],
          experience: 0,
          statusEffects: [],
          affinities: character.fetishes || {},
          stressors: {},
          equippedItems: [],
          inventory: [],
        }
      })

      setTalents(talentsFromConfig)
      console.log('🎭 Финальный список talents:', talentsFromConfig.length)
    }
  }, [gameConfig, currentUser, userCharacterKnowledge])

  // Проверка существующего пользователя при загрузке
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        setCurrentUser({ username: user.username, id: user.id })
        setUserCharacterKnowledge(user.characterKnowledge || null)
        setShowRegistration(false)

        // Восстанавливаем игровые ресурсы пользователя
        updateCredits(user.account?.balance || 5000)
        setNeuralPulses(100) // Сбрасываем каждый день
        setReputation(75) // Базовое значение
        setCurrentDay(1) // Начинаем с первого дня
      } catch (error) {
        console.error('Ошибка загрузки пользователя:', error)
        localStorage.removeItem('currentUser')
      }
    }
  }, [])

  // Синхронизация данных пользователя с файлом при загрузке конфигурации
  useEffect(() => {
    if (gameConfig?.users?.users && currentUser) {
      // Ищем пользователя в конфигурации по ID или имени
      let userData = gameConfig.users.users.find((u: any) =>
        u.id === currentUser.id || u.name === currentUser.username || u.username === currentUser.username
      )

      if (!userData) {
        // Попробуем найти по всем возможным полям
        userData = gameConfig.users.users.find((u: any) => {
          const matches = []
          if (u.id === currentUser.id) matches.push('id')
          if (u.name === currentUser.username) matches.push('name')
          if (u.username === currentUser.username) matches.push('username')
          if (u.email === currentUser.username) matches.push('email')
          return matches.length > 0
        })
      }

      if (userData) {
        // Обновляем данные в localStorage и состоянии, если они отличаются
        const savedUser = localStorage.getItem('currentUser')
        if (savedUser) {
          const currentSavedUser = JSON.parse(savedUser)
          if (JSON.stringify(currentSavedUser.characterKnowledge) !== JSON.stringify(userData.characterKnowledge)) {
            console.log('📝 Обновление characterKnowledge в localStorage и состоянии')
            const updatedUser = {
              ...currentSavedUser,
              characterKnowledge: userData.characterKnowledge
            }
            localStorage.setItem('currentUser', JSON.stringify(updatedUser))
            setUserCharacterKnowledge(userData.characterKnowledge)
          }
        }
      }
    }
  }, [gameConfig, currentUser])

  // Функция для обработки регистрации пользователя
  const handleUserRegistration = async (username: string, password: string) => {
    console.log('🔐 Начинаем регистрацию/вход для:', username)
    console.log('🔐 Пароль:', password ? '***' : 'пустой')
    
    // Получаем всех существующих пользователей
    const allUsersStr = localStorage.getItem('allUsers')
    console.log('📋 allUsers из localStorage:', allUsersStr)
    const allUsers = JSON.parse(allUsersStr || '[]')
    console.log('📋 Существующие пользователи:', allUsers)
    
    // Проверяем, существует ли пользователь
    const existingUser = allUsers.find((user: any) => 
      user.username.toLowerCase() === username.toLowerCase()
    )
    console.log('🔍 Найден существующий пользователь:', existingUser)

    let currentUserData

    if (existingUser) {
      // Вход существующего пользователя
      currentUserData = {
        ...existingUser,
        lastLogin: new Date().toISOString().split('T')[0]
      }
      
      // Обновляем данные существующего пользователя
      const updatedUsers = allUsers.map((user: any) => 
        user.username.toLowerCase() === username.toLowerCase() ? currentUserData : user
      )
      localStorage.setItem('allUsers', JSON.stringify(updatedUsers))
    } else {
      // Регистрация нового пользователя
      const userId = generateUniqueId('user-')
      currentUserData = {
        id: userId,
        username: username,
        password: password, // В реальном приложении пароль должен быть захеширован!
        created: new Date().toISOString().split('T')[0],
        lastLogin: new Date().toISOString().split('T')[0],
        role: 'user' as const,
        status: 'active' as const,
        account: {
          balance: 5000,
          currency: 'credits',
          transactions: []
        },
        assets: [],
        equipment: [],
        settings: {
          theme: 'dark',
          notifications: true,
          autoAssign: false,
          riskTolerance: 'medium'
        }
      }

      // Добавляем нового пользователя в список всех пользователей
      allUsers.push(currentUserData)
      localStorage.setItem('allUsers', JSON.stringify(allUsers))
      console.log('✅ Новый пользователь добавлен в allUsers:', currentUserData)
      
      // Синхронизируем с файлом users-unified.json
      try {
        const response = await fetch('/api/sync-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            configType: 'users',
            data: { users: allUsers }
          })
        })
        
        if (response.ok) {
          console.log('✅ Пользователи синхронизированы с файлом')
        } else {
          console.error('❌ Ошибка синхронизации пользователей:', response.statusText)
        }
              } catch (error) {
          console.error('❌ Ошибка при синхронизации пользователей:', error)
        }
    }

    if (existingUser) {
      // Обновляем данные существующего пользователя
      const updatedUsers = allUsers.map((user: any) => 
        user.username.toLowerCase() === username.toLowerCase() ? currentUserData : user
      )
      localStorage.setItem('allUsers', JSON.stringify(updatedUsers))
      
      // Синхронизируем обновленные данные с файлом
      try {
        const response = await fetch('/api/sync-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            configType: 'users',
            data: { users: updatedUsers }
          })
        })
        
        if (response.ok) {
          console.log('✅ Обновленные пользователи синхронизированы с файлом')
        } else {
          console.error('❌ Ошибка синхронизации обновленных пользователей:', response.statusText)
        }
      } catch (error) {
        console.error('❌ Ошибка при синхронизации обновленных пользователей:', error)
      }
    }

    // Сохраняем текущего пользователя
    localStorage.setItem('currentUser', JSON.stringify(currentUserData))
    console.log('💾 Текущий пользователь сохранен:', currentUserData)
    
    setCurrentUser({ username, id: currentUserData.id })
    setShowRegistration(false)
    console.log('🎮 Игра начата для пользователя:', username)
    
    // Устанавливаем игровые ресурсы
    updateCredits(currentUserData.account?.balance || 5000)
    setNeuralPulses(100)
    setReputation(75)
    setCurrentDay(1)
  }

  // Функция выхода
  const handleLogout = () => {
    console.log('🚪 Выход пользователя:', currentUser?.username)
    localStorage.removeItem('currentUser')
    setCurrentUser(null)
    setShowRegistration(true)
    setShowLogoutModal(false)
    // Сбрасываем игровые ресурсы
    setCredits(5000)
    setNeuralPulses(100)
    setReputation(75)
    setCurrentDay(1)
  }

  // Функция для обновления баланса пользователя
  const updateUserBalance = async (newBalance: number) => {
    if (!currentUser) return
    
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        user.account.balance = newBalance
        user.lastLogin = new Date().toISOString().split('T')[0]
        localStorage.setItem('currentUser', JSON.stringify(user))
        
        // Также обновляем в списке всех пользователей
        const allUsers = JSON.parse(localStorage.getItem('allUsers') || '[]')
        const updatedUsers = allUsers.map((u: any) => 
          u.id === user.id ? user : u
        )
        localStorage.setItem('allUsers', JSON.stringify(updatedUsers))
        
        // Синхронизируем обновленные данные с файлом
        try {
          const response = await fetch('/api/sync-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              configType: 'users',
              data: { users: updatedUsers }
            })
          })
          
          if (response.ok) {
            console.log('✅ Баланс пользователя синхронизирован с файлом')
          } else {
            console.error('❌ Ошибка синхронизации баланса:', response.statusText)
          }
        } catch (error) {
          console.error('❌ Ошибка при синхронизации баланса:', error)
        }
      } catch (error) {
        console.error('Ошибка обновления баланса:', error)
      }
    }
  }

  const [availableStatusEffects] = useState<StatusEffect[]>([
    {
      id: "adrenaline-rush",
      name: "Адреналиновый всплеск",
      type: "buff",
      duration: 2,
      effects: { strength: 25, engagement: 20, anxiety: 15 },
      description: "Мощный выброс адреналина повышает физические способности",
      icon: "⚡",
      removable: false,
      source: "implant",
    },
    {
      id: "deep-focus",
      name: "Глубокая концентрация",
      type: "buff",
      duration: 3,
      effects: { intelligence: 20, creativity: 15 },
      description: "Повышенная способность к сосредоточению",
      icon: "🧠",
      removable: true,
      source: "training",
    },
    {
      id: "creative-flow",
      name: "Творческий поток",
      type: "buff",
      duration: 4,
      effects: { creativity: 30, mood: 15, engagement: 10 },
      description: "Состояние максимальной творческой продуктивности",
      icon: "🎨",
      removable: true,
      source: "coaching",
    },
    {
      id: "neural-overload",
      name: "Нейроперегрузка",
      type: "debuff",
      duration: 3,
      effects: { intelligence: -20, anxiety: 25, burnout: 15 },
      description: "Перегрузка нейронных систем от интенсивного использования",
      icon: "🔥",
      removable: true,
      source: "implant",
    },
    {
      id: "empathic-resonance",
      name: "Эмпатический резонанс",
      type: "buff",
      duration: 2,
      effects: { empathy: 25, mood: 10, intelligence: 5 },
      description: "Усиленное восприятие эмоций окружающих",
      icon: "💫",
      removable: true,
      source: "therapy",
    },
    {
      id: "system-fatigue",
      name: "Системная усталость",
      type: "debuff",
      duration: 2,
      effects: { engagement: -15, mood: -10, strength: -5 },
      description: "Снижение работоспособности из-за переутомления",
      icon: "😴",
      removable: true,
      source: "overwork",
    },
    {
      id: "quantum-insight",
      name: "Квантовое озарение",
      type: "buff",
      duration: 1,
      effects: { intelligence: 35, creativity: 25, anxiety: 10 },
      description: "Кратковременное понимание сложных квантовых процессов",
      icon: "🌌",
      removable: false,
      source: "device",
    },
    {
      id: "social-anxiety",
      name: "Социальная тревожность",
      type: "debuff",
      duration: 3,
      effects: { empathy: -15, anxiety: 20, engagement: -10 },
      description: "Повышенная тревожность в социальных ситуациях",
      icon: "😰",
      removable: true,
      source: "stress",
    },
    {
      id: "enhanced-reflexes",
      name: "Усиленные рефлексы",
      type: "buff",
      duration: 2,
      effects: { strength: 20, engagement: 15 },
      description: "Улучшенная реакция и координация движений",
      icon: "⚡",
      removable: false,
      source: "implant",
      stackable: true,
      maxStacks: 3,
      currentStacks: 1,
    },
    {
      id: "inspiration",
      name: "Вдохновение",
      type: "buff",
      duration: 5,
      effects: { creativity: 20, mood: 20, engagement: 15 },
      description: "Состояние творческого подъема и мотивации",
      icon: "✨",
      removable: true,
      source: "reward",
    },
  ])

  const [storyScenes, setStoryScenes] = useState<any[]>([])
  const [currentScene, setCurrentScene] = useState<any>(null)
  const [showStoryScene, setShowStoryScene] = useState(false)

  const [talents, setTalents] = useState<Talent[]>([])

  // Используем конфигурацию оборудования из JSON
  const [globalInventory, setGlobalInventory] = useState<Equipment[]>(
    gameConfig?.equipment.equipment || []
  )

  // Фильтруем оборудование по принадлежности пользователю
  const [userEquipment, setUserEquipment] = useState<Equipment[]>([])
  const [filteredInventory, setFilteredInventory] = useState<Equipment[]>([])

  // Используем конфигурацию контрактов из JSON
  const [contracts, setContracts] = useState<Contract[]>(
    gameConfig?.contracts?.available?.map(contract => ({
      ...contract,
      progress: 0,
      difficulty: "medium" // По умолчанию
    })) || []
  )

  // Обновляем состояния при изменении конфигурации
  useEffect(() => {
    if (gameConfig) {
      console.log('🔧 Устанавливаем globalInventory из gameConfig')
      console.log('🔧 gameConfig.equipment.equipment:', gameConfig.equipment?.equipment?.length || 'undefined')
      setGlobalInventory(gameConfig.equipment.equipment || [])
      setContracts(gameConfig.contracts?.available?.map(contract => ({
        ...contract,
        progress: 0,
        difficulty: "medium"
      })) || [])
    }
  }, [gameConfig])




  // Используем конфигурацию событий из JSON
  const [events] = useState<LocalGameEvent[]>(
    gameConfig?.events?.events?.map(event => ({
      ...event,
      type: "neutral" // По умолчанию
    })) || []
  )

  useEffect(() => {
    // В реальном приложении это будет загрузка из story-scenes.json
    const mockScenes = [
      {
        id: "void-rescue-1",
        title: "Спасение в Пустоте",
        description: "Вы обнаружили сигнал бедствия в опасном секторе Void Border",
        image: "/cyberpunk-void-rescue.png",
        category: "void-rescues",
        choices: [
          {
            id: "rescue",
            text: "Организовать спасательную операцию",
            cost: 2000,
            outcomes: [
              {
                probability: 0.7,
                effects: [{ type: "add_talent", talent: "rescued_specialist" }],
                description: "Успешно спасли специалиста",
              },
              {
                probability: 0.3,
                effects: [{ type: "lose_credits", amount: 1000 }],
                description: "Операция провалилась",
              },
            ],
          },
          {
            id: "ignore",
            text: "Проигнорировать сигнал",
            outcomes: [
              {
                probability: 1.0,
                effects: [{ type: "change_reputation", amount: -5 }],
                description: "Репутация пострадала",
              },
            ],
          },
        ],
      },
    ]
    setStoryScenes(mockScenes)
  }, [])

  const triggerStoryScene = (category: string, context?: any) => {
    const availableScenes = storyScenes.filter((scene) => scene.category === category)
    if (availableScenes.length > 0) {
      const randomScene = availableScenes[Math.floor(Math.random() * availableScenes.length)]
      setCurrentScene({ ...randomScene, context })
      setShowStoryScene(true)
    }
  }

  const handleSceneChoice = (choice: any) => {
    const outcome = choice.outcomes[Math.floor(Math.random() * choice.outcomes.length)]

    // Применяем эффекты исхода
    outcome.effects.forEach((effect: any) => {
      switch (effect.type) {
        case "add_talent":
          // Добавляем нового таланта
          const newTalent = generateRandomTalent()
          newTalent.name = "Спасенный Специалист"
          newTalent.memories = ["Спасен из Void Border"]
          setTalents((prev) => [...prev, newTalent])
          break
        case "lose_credits":
          updateCredits((prev) => Math.max(0, prev - effect.amount))
          break
        case "change_reputation":
          setReputation((prev) => prev + effect.amount)
          break
      }
    })

    setShowStoryScene(false)
    setCurrentScene(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "working":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "resting":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    }
  }

  const getMoodColor = (value: number) => {
    if (value >= 80) return "text-green-400"
    if (value >= 60) return "text-yellow-400"
    if (value >= 40) return "text-orange-400"
    return "text-red-400"
  }

  const toggleEquipment = (itemId: string) => {
    setGlobalInventory((prev) => prev.map((item) => (item.id === itemId ? { ...item, enabled: !item.enabled } : item)))
  }

  const updateEquipmentSettings = (itemId: string, newSettings: Equipment["settings"]) => {
    setGlobalInventory((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, settings: { ...item.settings, ...newSettings } } : item)),
    )
  }

  const changeEquipmentMode = (itemId: string, mode: string) => {
    setGlobalInventory((prev) => prev.map((item) => (item.id === itemId ? { ...item, activeMode: mode } : item)))
  }

  const adjustPowerLevel = (itemId: string, powerLevel: number) => {
    setGlobalInventory((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, powerLevel: Math.max(0, Math.min(item.maxPowerLevel || 100, powerLevel)) }
          : item,
      ),
    )
  }

  const getBarColor = (value: number, max = 100) => {
    const percentage = (value / max) * 100
    if (percentage >= 80) return "bg-green-400"
    if (percentage >= 60) return "bg-yellow-400"
    if (percentage >= 40) return "bg-orange-400"
    return "bg-red-400"
  }

  const getAttributeDisplayName = (stat: string): string => {
    const displayNames: { [key: string]: string } = {
      // Физические характеристики
      endurance: 'ВЫНОСЛИВОСТЬ',
      sensitivity: 'ЧУВСТВИТЕЛЬНОСТЬ',
      flexibility: 'ГИБКОСТЬ',
      
      // Психологические характеристики
      emotionalStability: 'ЭМОЦИОНАЛЬНАЯ СТАБИЛЬНОСТЬ',
      adaptability: 'АДАПТИВНОСТЬ',
      intelligence: 'ИНТЕЛЛЕКТ',
      
      // Социальные характеристики
      sociability: 'ОБЩИТЕЛЬНОСТЬ',
      empathy: 'ЭМПАТИЯ',
      dominance: 'ДОМИНАНТНОСТЬ',
      
      // Личностные характеристики
      selfEsteem: 'САМООЦЕНКА',
      optimism: 'ОПТИМИЗМ',
      curiosity: 'ЛЮБОПЫТСТВО',
      
      // Специальные характеристики
      sexualExperience: 'СЕКСУАЛЬНАЯ ОПЫТНОСТЬ',
      resistance: 'СОПРОТИВЛЯЕМОСТЬ',
      dependency: 'ЗАВИСИМОСТЬ',
      fetishSensitivity: 'ЧУВСТВИТЕЛЬНОСТЬ К ФЕТИШАМ',
      fetishDiscovery: 'ГОТОВНОСТЬ К ОТКРЫТИЯМ'
    }
    
    return displayNames[stat] || stat.toUpperCase()
  }



  const applyStatusEffect = (talentId: string, effectTemplate: StatusEffect) => {
    setTalents((prev) =>
      prev.map((talent) => {
        if (talent.id === talentId) {
          const existingEffect = talent.statusEffects.find((e) => e.id === effectTemplate.id)

          if (existingEffect && effectTemplate.stackable) {
            // Увеличиваем стаки если возможно
            const newStacks = Math.min((existingEffect.currentStacks || 1) + 1, effectTemplate.maxStacks || 1)
            return {
              ...talent,
              statusEffects: talent.statusEffects.map((e) =>
                e.id === effectTemplate.id ? { ...e, currentStacks: newStacks, duration: effectTemplate.duration } : e,
              ),
            }
          } else if (existingEffect) {
            // Обновляем длительность существующего эффекта
            return {
              ...talent,
              statusEffects: talent.statusEffects.map((e) =>
                e.id === effectTemplate.id ? { ...e, duration: effectTemplate.duration } : e,
              ),
            }
          } else {
            // Добавляем новый эффект
            const newEffect = {
              ...effectTemplate,
              id: `${effectTemplate.id}-${generateUniqueId()}`,
              currentStacks: effectTemplate.stackable ? 1 : undefined,
            }
            return {
              ...talent,
              statusEffects: [...talent.statusEffects, newEffect],
            }
          }
        }
        return talent
      }),
    )
  }

  const removeStatusEffect = (talentId: string, effectId: string) => {
    if (neuralPulses < 10) return // Требует НП для снятия эффекта

    setNeuralPulses((prev) => prev - 10)
    setTalents((prev) =>
      prev.map((talent) => {
        if (talent.id === talentId) {
          return {
            ...talent,
            statusEffects: talent.statusEffects.filter((e) => e.id !== effectId),
          }
        }
        return talent
      }),
    )
  }

  const updateStatusEffectsDuration = () => {
    setTalents((prev) =>
      prev.map((talent) => ({
        ...talent,
        statusEffects: talent.statusEffects
          .map((effect) => ({ ...effect, duration: effect.duration - 1 }))
          .filter((effect) => effect.duration > 0),
      })),
    )
  }

  const getStatusEffectColor = (type: string) => {
    switch (type) {
      case "buff":
        return "text-green-400 border-green-500/30"
      case "debuff":
        return "text-red-400 border-red-500/30"
      case "neutral":
        return "text-blue-400 border-blue-500/30"
      default:
        return "text-gray-400 border-gray-500/30"
    }
  }



  const handleEventChoice = (choice: { text: string; effects: { stat: string; change: number }[] }) => {
    choice.effects.forEach((effect) => {
      switch (effect.stat) {
        case "credits":
          updateCredits((prev) => Math.max(0, prev + effect.change))
          break
        case "reputation":
          setReputation((prev) => Math.max(0, Math.min(100, prev + effect.change)))
          break
        case "anxiety":
        case "mood":
          const updatedTalents = talents.map((talent) => ({
            ...talent,
            [effect.stat]: Math.max(0, Math.min(100, (talent[effect.stat as keyof Talent] as number) + effect.change)),
          }))
          setTalents(updatedTalents)
          break
      }
    })
    setCurrentEvent(null)
  }

  const nextDay = () => {
    setCurrentDay((prev) => prev + 1)
    setNeuralPulses(100)

    updateStatusEffectsDuration()

    // Случайное событие с 30% вероятностью
    if (Math.random() < 0.3) {
      const randomEvent = events[Math.floor(Math.random() * events.length)]
      setCurrentEvent(randomEvent)
    }
  }

  const handleMouseEnter = (actionKey: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left - 300, // 300px ширина подсказки + отступ
      y: rect.top,
    })
    setHoveredAction(actionKey)
  }

  const handleMouseLeave = () => {
    setHoveredAction(null)
  }

  const getTooltipContent = (actionKey: string) => {
    // Старая система действий удалена
    return null
  }

  const changeImplantMode = (talentId: string, implantId: string, newMode: string) => {
    setTalents((prev) =>
      prev.map((talent) => {
        if (talent.id === talentId) {
          return {
            ...talent,
            equippedItems: talent.equippedItems.map((item) =>
              item.id === implantId ? { ...item, activeMode: newMode } : item,
            ),
            inventory: talent.inventory.map((item) =>
              item.id === implantId ? { ...item, activeMode: newMode } : item,
            ),
          }
        }
        return talent
      }),
    )
  }

  const adjustImplantPower = (talentId: string, implantId: string, newPowerLevel: number) => {
    if (neuralPulses < 5) return // Требует НП для настройки

    setNeuralPulses((prev) => prev - 5)
    setTalents((prev) =>
      prev.map((talent) => {
        if (talent.id === talentId) {
          return {
            ...talent,
            equippedItems: talent.equippedItems.map((item) =>
              item.id === implantId
                ? { ...item, powerLevel: Math.max(0, Math.min(item.maxPowerLevel || 100, newPowerLevel)) }
                : item,
            ),
            inventory: talent.inventory.map((item) =>
              item.id === implantId
                ? { ...item, powerLevel: Math.max(0, Math.min(item.maxPowerLevel || 100, newPowerLevel)) }
                : item,
            ),
          }
        }
        return talent
      }),
    )
  }

  const activateSpecialMode = (talentId: string, implantId: string, mode: string) => {
    const talent = talents.find((t) => t.id === talentId)
    if (!talent) return

    const implant = [...talent.equippedItems, ...talent.inventory].find((item) => item.id === implantId)
    if (!implant || !implant.energyConsumption) return

    // Проверяем кулдаун
    if (implant.lastUsed && currentDay - implant.lastUsed < (implant.cooldownTime || 0)) return

    // Проверяем энергию
    if (neuralPulses < implant.energyConsumption) return

    setNeuralPulses((prev) => prev - implant.energyConsumption)

    // Применяем эффекты режима
    const modeEffects = getModeEffects(mode)
    if (modeEffects) {
      setTalents((prev) =>
        prev.map((t) => {
          if (t.id === talentId) {
            const updatedTalent = { ...t }
            Object.entries(modeEffects).forEach(([stat, value]) => {
              if (stat in updatedTalent) {
                ;(updatedTalent as any)[stat] = Math.max(0, Math.min(100, (updatedTalent as any)[stat] + value))
              }
            })

            // Обновляем время последнего использования
            updatedTalent.equippedItems = updatedTalent.equippedItems.map((item) =>
              item.id === implantId ? { ...item, lastUsed: currentDay } : item,
            )
            updatedTalent.inventory = updatedTalent.inventory.map((item) =>
              item.id === implantId ? { ...item, lastUsed: currentDay } : item,
            )

            // Добавляем воспоминание
            updatedTalent.memories = [...updatedTalent.memories.slice(-4), `Активировал ${mode} на ${implant.name}`]

            return updatedTalent
          }
          return t
        }),
      )
    }
  }

  const getModeEffects = (mode: string): { [key: string]: number } | null => {
    const effects: { [key: string]: { [key: string]: number } } = {
      "Турбо-режим": { intelligence: 25, creativity: 20, anxiety: 15 },
      Энергосбережение: { mood: 10, burnout: -5 },
      "Аналитический режим": { intelligence: 15, empathy: -5 },
      "Адреналиновый всплеск": { strength: 30, engagement: 25, anxiety: 20 },
      Стабилизация: { mood: 15, anxiety: -10 },
      "Экстренный режим": { strength: 40, intelligence: 20, burnout: 25 },
      "Анализ эмоций": { empathy: 20, intelligence: 10 },
      "Техническое зрение": { intelligence: 25, creativity: 15 },
      "Ночное видение": { strength: 10, mood: 5 },
      "Рентген-режим": { intelligence: 30, anxiety: 10 },
      "Квантовые вычисления": { intelligence: 20, creativity: 25 },
      Прогнозирование: { intelligence: 15, empathy: 10 },
      Оптимизация: { creativity: 20, engagement: 15 },
    }
    return effects[mode] || null
  }

  const getImplantStatusColor = (implant: Equipment) => {
    if (!implant.powerLevel) return "text-gray-400"
    if (implant.powerLevel >= 80) return "text-green-400"
    if (implant.powerLevel >= 50) return "text-yellow-400"
    if (implant.powerLevel >= 20) return "text-orange-400"
    return "text-red-400"
  }

  const canActivateMode = (implant: Equipment, mode: string) => {
    if (!implant.energyConsumption) return false
    if (neuralPulses < implant.energyConsumption) return false
    if (implant.lastUsed && currentDay - implant.lastUsed < (implant.cooldownTime || 0)) return false
    return true
  }

  const generateDynamicPortrait = (talent: Talent) => {
    // Базовый портрет зависит от настроения
    let baseExpression =
      talent.mood >= 80 ? "😊" : talent.mood >= 60 ? "🙂" : talent.mood >= 40 ? "😐" : talent.mood >= 20 ? "😔" : "😞"

    // Модификации от состояний
    const hasPositiveEffect = talent.statusEffects?.some((effect) =>
      ["Вдохновение", "Нейроускорение", "Эмпатический резонанс"].includes(effect.name),
    )
    const hasNegativeEffect = talent.statusEffects?.some((effect) =>
      ["Усталость", "Стресс", "Перегрузка"].includes(effect.name),
    )

    if (hasPositiveEffect) baseExpression = "✨" + baseExpression
    if (hasNegativeEffect) baseExpression = "💫" + baseExpression

    // Эффекты от экипировки
    const hasHighTechGear = talent.equippedItems?.some(
      (item) => item.name.includes("Нейро") || item.name.includes("Кибер"),
    )
    if (hasHighTechGear) baseExpression = "🔮" + baseExpression

    // Цвет фона зависит от выгорания и тревожности
    const bgColor =
      talent.burnout > 70
        ? "bg-red-900/20"
        : talent.anxiety > 70
          ? "bg-yellow-900/20"
          : talent.engagement > 80
            ? "bg-green-900/20"
            : "bg-blue-900/20"

    return { expression: baseExpression, bgColor }
  }

  // Функция для получения иконок категорий
  const getCategoryIcon = (categoryId: string): string => {
    const icons: { [key: string]: string } = {
      training: "📚",
      coaching: "🎯", 
      therapy: "🌟",
      work: "💼",
      rest: "😴",
      social: "👥"
    }
    return icons[categoryId] || "⚡"
  }

  // Используем конфигурацию из JSON файлов
  const actionsConfig = gameConfig ? Object.entries(gameConfig.actions?.categories || {}).map(([categoryId, category]) => ({
    id: categoryId,
    name: category.title,
    icon: getCategoryIcon(categoryId),
    actions: Object.entries(category.actions).map(([actionId, action]) => ({
      id: `${categoryId}-${actionId}`,
      name: action.title,
      description: action.description,
      cost: action.cost,
      effects: action.effects,
      sideEffects: action.riskEffects,
      risk: action.probability ? {
        chance: action.probability.failure * 100,
        positiveOutcome: action.outcomes?.success?.states || {},
        negativeOutcome: action.outcomes?.failure?.states || {}
      } : undefined
    }))
  })) : []



  const getEquipmentRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "text-gray-400"
      case "rare":
        return "text-blue-400"
      case "epic":
        return "text-purple-400"
      case "legendary":
        return "text-yellow-400"
      default:
        return "text-gray-400"
    }
  }

  const equipItem = (talentId: string, item: Equipment) => {
    setTalents((prev) =>
      prev.map((talent) => {
        if (talent.id === talentId) {
          // Проверяем, можно ли надеть предмет в этот слот
          if (talent.equippedItems.find((equippedItem) => equippedItem.slot === item.slot)) {
            alert("Этот слот уже занят!")
            return talent
          }

          // Убираем предмет из глобального инвентаря
          setGlobalInventory((prevInventory) => prevInventory.filter((invItem) => invItem.id !== item.id))

          // Добавляем предмет в экипировку таланта
          return {
            ...talent,
            equippedItems: [...talent.equippedItems, { ...item, equippedBy: talentId }],
          }
        }
        return talent
      }),
    )
  }

  const unequipItem = (talentId: string, item: Equipment) => {
    setTalents((prev) =>
      prev.map((talent) => {
        if (talent.id === talentId) {
          // Убираем предмет из экипировки таланта
          const updatedEquippedItems = talent.equippedItems.filter((equippedItem) => equippedItem.id !== item.id)

          // Возвращаем предмет в глобальный инвентарь
          setGlobalInventory((prevInventory) => [...prevInventory, { ...item, equippedBy: undefined }])

          return {
            ...talent,
            equippedItems: updatedEquippedItems,
          }
        }
        return talent
      }),
    )
  }

  const toggleTalentTarget = (itemId: string, talentId: string) => {
    setGlobalInventory((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const targetTalents = item.targetTalents || []
          if (targetTalents.includes(talentId)) {
            return { ...item, targetTalents: targetTalents.filter((id) => id !== talentId) }
          } else {
            return { ...item, targetTalents: [...targetTalents, talentId] }
          }
        }
        return item
      }),
    )
  }

  const updateEquipmentPower = (itemId: string, powerLevel: number) => {
    setGlobalInventory((prev) => prev.map((item) => (item.id === itemId ? { ...item, powerLevel: powerLevel } : item)))
  }

  const updateEquipmentMode = (itemId: string, mode: string) => {
    setGlobalInventory((prev) => prev.map((item) => (item.id === itemId ? { ...item, mode: mode } : item)))
  }

  const getPortraitImage = (talent: Talent) => {
    const activeEquipment = filteredInventory.filter((item) => item.enabled && item.targetTalents?.includes(talent.id))

    // Base portraits for each talent
    const basePortraits: Record<string, string> = {
      "1": "/cyberpunk-holograms.png",
      "2": "/neon-lab-tech.png",
      "3": "/data-analyst-floating-screens.png",
    }

    if (selectedTalent?.id === talent.id) {
      // Портреты в зависимости от выбранного инструмента
      if (selectedTool === "marker") {
        return `/placeholder.svg?height=600&width=400&query=cyberpunk+character+drawing+on+holographic+tablet+creative+workspace`
      }
      if (selectedTool === "scanner") {
        return `/placeholder.svg?height=600&width=400&query=character+using+advanced+scanner+device+analyzing+data+streams`
      }
      if (selectedTool === "calibrator") {
        return `/placeholder.svg?height=600&width=400&query=person+calibrating+neural+implants+with+technical+interface`
      }
      if (selectedTool === "stimulator") {
        return `/placeholder.svg?height=600&width=400&query=character+with+neural+stimulation+effects+glowing+brain+activity`
      }

      // Портреты в зависимости от типа взаимодействия
      if (selectedInteractionType === "personal-learning") {
        return `/placeholder.svg?height=600&width=400&query=focused+student+in+futuristic+learning+environment+with+data+streams`
      }
      if (selectedInteractionType === "coaching-session") {
        return `/placeholder.svg?height=600&width=400&query=motivated+person+in+coaching+session+with+holographic+goals`
      }
      if (selectedInteractionType === "therapy") {
        return `/placeholder.svg?height=600&width=400&query=calm+person+in+therapeutic+environment+with+soothing+lights`
      }
      if (selectedInteractionType === "creative-work") {
        return `/placeholder.svg?height=600&width=400&query=artist+in+creative+flow+surrounded+by+holographic+art+tools`
      }
      if (selectedInteractionType === "meditation") {
        return `/placeholder.svg?height=600&width=400&query=person+meditating+in+zen+cyberpunk+space+with+energy+aura`
      }

      // Портреты в зависимости от интерактивных областей
      if (interactiveAreas["tablet"]) {
        return `/placeholder.svg?height=600&width=400&query=character+actively+drawing+on+glowing+tablet+creative+energy`
      }
      if (interactiveAreas["head"]) {
        return `/placeholder.svg?height=600&width=400&query=person+with+activated+neural+interface+glowing+head+implants`
      }
      if (interactiveAreas["ar_display"]) {
        return `/placeholder.svg?height=600&width=400&query=character+interacting+with+AR+holographic+display+immersive`
      }
    }

    // Портреты в зависимости от состояний (усиленные эффекты)
    const hasCreativeFlow = talent.statusEffects.some((effect) => effect.name.includes("Творческий"))
    const hasNeuralStimulation = talent.statusEffects.some((effect) => effect.name.includes("Нейро"))
    const hasInspiration = talent.statusEffects.some((effect) => effect.name.includes("Вдохновение"))

    if (hasCreativeFlow) {
      return `/placeholder.svg?height=600&width=400&query=artist+in+creative+flow+with+swirling+energy+and+inspiration+aura`
    }
    if (hasNeuralStimulation) {
      return `/placeholder.svg?height=600&width=400&query=character+with+active+neural+stimulation+glowing+brain+patterns`
    }
    if (hasInspiration) {
      return `/placeholder.svg?height=600&width=400&query=inspired+person+with+bright+aura+and+floating+ideas+around`
    }

    // Equipment-modified portraits
    if (activeEquipment.some((eq) => eq.type === "implant" && eq.slot === "neural")) {
      return `/placeholder.svg?height=600&width=400&query=cyberpunk+character+with+glowing+neural+implants+in+futuristic+setting`
    }

    if (activeEquipment.some((eq) => eq.type === "device" && eq.slot === "head")) {
      return `/placeholder.svg?height=600&width=400&query=character+wearing+AR+glasses+in+high+tech+environment`
    }

    if (activeEquipment.some((eq) => eq.type === "clothing" && eq.slot === "body")) {
      return `/placeholder.svg?height=600&width=400&query=person+in+smart+adaptive+clothing+in+cyberpunk+interior`
    }

    return basePortraits[talent.id] || basePortraits["1"]
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setFloatingPanelPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, dragOffset.x, dragOffset.y])

  React.useEffect(() => {
    const handleChatMouseMove = (e: MouseEvent) => {
      if (isChatDragging) {
        setChatPosition({
          x: e.clientX - chatDragOffset.x,
          y: e.clientY - chatDragOffset.y,
        })
      }
    }

    const handleChatMouseUp = () => {
      setIsChatDragging(false)
    }

    if (isChatDragging) {
      document.addEventListener("mousemove", handleChatMouseMove)
      document.addEventListener("mouseup", handleChatMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleChatMouseMove)
        document.removeEventListener("mouseup", handleChatMouseUp)
      }
    }
  }, [isChatDragging, chatDragOffset.x, chatDragOffset.y])

  const handlePanelMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - floatingPanelPosition.x,
      y: e.clientY - floatingPanelPosition.y,
    })
  }

  const handlePanelMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setFloatingPanelPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }
  }

  const handlePanelMouseUp = () => {
    setIsDragging(false)
  }

  const memoizedEffectiveStats = React.useMemo(() => {
    if (!selectedTalent) return null
    // Используем новую систему Character AI
    // return CharacterAdapter.getEffectiveStats(selectedTalent) // Адаптер удален
    return selectedTalent
  }, [selectedTalent])

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handlePanelMouseMove)
      document.addEventListener("mouseup", handlePanelMouseUp)
      return () => {
        document.removeEventListener("mousemove", handlePanelMouseMove)
        document.removeEventListener("mouseup", handlePanelMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const generateTalentContext = (talent: Talent) => {
    // Проверяем, что talent и его свойства существуют
    if (!talent || !talent.attributes || !talent.states) {
      console.warn('Talent or its properties are undefined in generateTalentContext:', talent)
      return {
        name: talent?.name || 'Unknown',
        role: talent?.role || 'Unknown',
        level: talent?.level || 1,
        baseStats: {
          strength: 0,
          empathy: 0,
          intelligence: 0,
          creativity: 0,
        },
        effectiveStats: CharacterAdapter.getEffectiveStats(talent || {} as any),
        mentalState: {
          mood: 0,
          anxiety: 0,
          burnout: 0,
          engagement: 0,
        },
        statusEffects: [],
        activeEquipment: [],
        recentMemories: [],
        interactionType: selectedInteractionType,
        selectedTool,
        currentDay,
        neuralPulses,
      }
    }

    const effectiveStats = CharacterAdapter.getEffectiveStats(talent)
    const activeEquipment = filteredInventory.filter((item) => item.enabled && item.targetTalents?.includes(talent.id))

    return {
      name: talent.name,
      role: talent.role,
      level: talent.level,
      baseStats: {
        strength: talent.attributes.strength || 0,
        empathy: talent.attributes.empathy || 0,
        intelligence: talent.attributes.intelligence || 0,
        creativity: talent.attributes.creativity || 0,
      },
      effectiveStats,
      mentalState: {
        mood: talent.states.mood || 0,
        anxiety: talent.states.anxiety || 0,
        burnout: talent.states.burnout || 0,
        engagement: talent.states.engagement || 0,
      },
      statusEffects: talent.statusEffects?.map((effect) => ({
        name: effect.name,
        type: effect.type,
        description: effect.description,
        duration: effect.duration,
        effects: effect.effects,
      })) || [],
      activeEquipment: activeEquipment.map((eq) => ({
        name: eq.name,
        type: eq.type,
        description: eq.description,
        effects: eq.effects,
        powerLevel: eq.powerLevel,
        mode: eq.mode,
      })),
      recentMemories: talent.memories?.slice(-3) || [],
      interactionType: selectedInteractionType,
      selectedTool,
      currentDay,
      neuralPulses,
    }
  }

  const sendMessageToLLM = async (message: string) => {
    if (!selectedTalent || !message.trim()) return

    const userMessage = {
      id: generateUniqueId(),
      role: "user" as const,
      content: message,
      timestamp: new Date(),
    }

    setChatMessages((prev) => [...prev, userMessage])
    setCurrentMessage("")
    setIsProcessing(true)

    try {
      // Сначала пробуем Character AI для анализа сообщения
      let characterAIResponse = null
      try {
        characterAIResponse = characterAI ? await characterAI.analyzeMessage(message) : null
        console.log('Character AI анализ:', characterAIResponse)
      } catch (error) {
        console.log('Character AI недоступен, используем fallback')
      }

      // Используем реальную AI-систему персонажей
      const contextData = generateTalentContext(selectedTalent)
      
      const response = await personalWorkIntegration.processMessage({
        talentId: selectedTalent.id,
        message,
        context: contextData,
        interactionType: selectedInteractionType,
        selectedTool,
        equipment: filteredInventory.filter(item =>
          item.enabled && item.targetTalents?.includes(selectedTalent.id)
        )
      })

      // Объединяем ответы от обеих систем
      let finalResponse = response.message
      if (characterAIResponse && characterAIResponse.response) {
        finalResponse = `${characterAIResponse.response}\n\n${response.message}`
      }

      const assistantMessage = {
        id: generateUniqueId(),
        role: "assistant" as const,
        content: finalResponse,
        timestamp: new Date(),
      }

      setChatMessages((prev) => [...prev, assistantMessage])
      
      // Применяем изменения от обеих систем
      if (response.changes) {
        applyAIChanges(selectedTalent.id, response.changes)
      }
      
      // Применяем изменения от Character AI
      if (characterAIResponse && characterAIResponse.statChanges) {
        console.log('Применяем изменения от Character AI:', characterAIResponse.statChanges)
        
        // Добавляем уведомления об изменениях характеристик
        const newChanges = Object.entries(characterAIResponse.statChanges).map(([stat, change]) => ({
          stat,
          change,
          timestamp: Date.now()
        }));
        
        setStatChanges(prev => [...prev, ...newChanges]);
        
        // Удаляем уведомления через 5 секунд
        setTimeout(() => {
          setStatChanges(prev => prev.filter(change => 
            !newChanges.some(newChange => newChange.timestamp === change.timestamp)
          ));
        }, 5000);
      }
    } catch (error) {
      console.error('Ошибка AI-системы:', error)
      
      // Fallback на заглушку
      const contextData = generateTalentContext(selectedTalent)
      const fallbackMessage = `Понимаю вас, ${selectedTalent.name}. Ваши текущие показатели: интеллект ${contextData.effectiveStats.intelligence}, креативность ${contextData.effectiveStats.creativity}. Как могу помочь?`
      
      const assistantMessage = {
        id: generateUniqueId(),
        role: "assistant" as const,
        content: fallbackMessage,
        timestamp: new Date(),
      }

      setChatMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const generateRandomChanges = () => {
    const possibleChanges = [
      { type: "stat", stat: "mood", change: Math.floor(Math.random() * 20) + 5 },
      { type: "stat", stat: "anxiety", change: -(Math.floor(Math.random() * 15) + 5) },
      { type: "stat", stat: "engagement", change: Math.floor(Math.random() * 15) + 5 },
      { type: "stat", stat: "creativity", change: Math.floor(Math.random() * 10) + 3 },
      {
        type: "status_effect",
        effect: {
          id: "llm-inspiration",
          name: "Вдохновение от ИИ",
          type: "buff" as const,
          duration: 2,
          effects: { creativity: 15, mood: 10 },
          description: "Мотивация от взаимодействия с ИИ-помощником",
          icon: "🤖",
          removable: true,
          source: "llm-chat",
        },
      },
      { type: "memory", memory: `Продуктивная сессия ${selectedInteractionType} с ИИ` },
    ]

    return possibleChanges[Math.floor(Math.random() * possibleChanges.length)]
  }

  const applyAIChanges = (talentId: string, changes: any) => {
    setTalents((prev) =>
      prev.map((talent) => {
        if (talent.id === talentId) {
          // Если есть обновленный Talent от Character AI, используем его
          if (changes.updatedTalent) {
            return changes.updatedTalent
          }
          
          // Иначе применяем изменения вручную
          const updatedTalent = { ...talent }

          // Применяем изменения характеристик
          if (changes.statChanges) {
            Object.entries(changes.statChanges).forEach(([stat, change]) => {
              // Проверяем, есть ли характеристика в attributes
              if (updatedTalent.attributes && stat in updatedTalent.attributes) {
                const currentValue = updatedTalent.attributes[stat]
                updatedTalent.attributes[stat] = Math.max(0, Math.min(100, currentValue + (change as number)))
              }
              // Проверяем, есть ли характеристика в states
              else if (updatedTalent.states && stat in updatedTalent.states) {
                const currentValue = updatedTalent.states[stat]
                updatedTalent.states[stat] = Math.max(0, Math.min(100, currentValue + (change as number)))
              }
              // Проверяем, есть ли характеристика в корне объекта
              else if (stat in updatedTalent) {
                const currentValue = (updatedTalent as any)[stat]
                ;(updatedTalent as any)[stat] = Math.max(0, Math.min(100, currentValue + (change as number)))
              }
            })
          }

          // Применяем эмоциональные изменения из emotionalContent
          if (changes.emotionalContent) {
            // Обновляем настроение на основе pleasure
            if (changes.emotionalContent.pleasure) {
              const moodChange = Math.round(changes.emotionalContent.pleasure * 20)
              if (updatedTalent.states) {
                updatedTalent.states.mood = Math.max(0, Math.min(100, updatedTalent.states.mood + moodChange))
              }
            }
            
            // Обновляем страх на основе fear
            if (changes.emotionalContent.fear) {
              const fearChange = Math.round(changes.emotionalContent.fear * 20)
              if (updatedTalent.states) {
                updatedTalent.states.anxiety = Math.max(0, Math.min(100, updatedTalent.states.anxiety + fearChange))
              }
            }
            
            // Обновляем возбуждение на основе arousal
            if (changes.emotionalContent.arousal) {
              const arousalChange = Math.round(changes.emotionalContent.arousal * 20)
              if (updatedTalent.states) {
                updatedTalent.states.engagement = Math.max(0, Math.min(100, updatedTalent.states.engagement + arousalChange))
              }
            }
          }

          // Применяем эмоциональные изменения (legacy)
          if (changes.emotionalChange) {
            const moodChange = Math.round(changes.emotionalChange * 10)
            updatedTalent.mood = Math.max(0, Math.min(100, updatedTalent.mood + moodChange))
          }

          // Добавляем фетиши если они активировались
          if (changes.fetishTriggers && changes.fetishTriggers.length > 0) {
            if (!updatedTalent.activeFetishes) {
              updatedTalent.activeFetishes = []
            }
            changes.fetishTriggers.forEach((fetish: string) => {
              if (!updatedTalent.activeFetishes.includes(fetish)) {
                updatedTalent.activeFetishes.push(fetish)
              }
            })
          }

          // Добавляем воспоминание о взаимодействии
          const interactionMemory = `Чат с AI: ${changes.response ? 'получен ответ' : 'взаимодействие'}`
          updatedTalent.memories = [...updatedTalent.memories.slice(-4), interactionMemory]

          return updatedTalent
        }
        return talent
      }),
    )
  }

  // Синхронизируем selectedTalent с обновленными talents
  useEffect(() => {
    if (selectedTalent) {
      const updatedTalent = talents.find((t) => t.id === selectedTalent.id)
      if (updatedTalent) {
        setSelectedTalent(updatedTalent)
      }
    }
  }, [talents, selectedTalent?.id])

  const handleChatMouseDown = (e: React.MouseEvent) => {
    setIsChatDragging(true)
    setChatDragOffset({
      x: e.clientX - chatPosition.x,
      y: e.clientY - chatPosition.y,
    })
  }

  const handleChatMouseMove = (e: MouseEvent) => {
    if (isChatDragging) {
      setChatPosition({
        x: e.clientX - chatDragOffset.x,
        y: e.clientY - chatDragOffset.y,
      })
    }
  }

  const handleChatMouseUp = () => {
    setIsChatDragging(false)
  }

  React.useEffect(() => {
    if (isChatDragging) {
      document.addEventListener("mousemove", handleChatMouseMove)
      document.addEventListener("mouseup", handleChatMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleChatMouseMove)
        document.removeEventListener("mouseup", handleChatMouseUp)
      }
    }
  }, [isChatDragging, chatDragOffset])

  const interactiveTools = [
    { id: "marker", name: "Маркер", icon: "✏️", description: "Рисование и пометки" },
    { id: "scanner", name: "Сканер", icon: "🔍", description: "Анализ состояния" },
    { id: "calibrator", name: "Калибратор", icon: "⚙️", description: "Настройка оборудования" },
    { id: "stimulator", name: "Стимулятор", icon: "⚡", description: "Воздействие на состояние" },
    // Новые инструменты для работы с персонажами
    { id: "communicator", name: "Коммуникатор", icon: "💬", description: "Прямое общение с персонажем" },
    { id: "fetish_analyzer", name: "Анализатор фетишей", icon: "🔬", description: "Анализ предпочтений и чувствительности" },
    { id: "quick_actions", name: "Быстрые действия", icon: "⚡", description: "Быстрые взаимодействия" },
  ]

  const getFetishAreas = (talentId: string) => {
    // Базовые области для фетишей (можно расширить)
    return [
      { id: "neck", name: "Шея", x: 45, y: 30, width: 10, height: 8, description: "Область шеи и горла" },
      { id: "chest", name: "Грудь", x: 40, y: 35, width: 20, height: 12, description: "Область груди" },
      { id: "waist", name: "Талия", x: 42, y: 47, width: 16, height: 8, description: "Область талии" },
      { id: "thighs", name: "Бедра", x: 35, y: 55, width: 30, height: 15, description: "Область бедер" },
    ]
  }

  const getInteractiveAreas = (talent: Talent) => {
    const areas = [
      { id: "head", name: "Голова", x: 45, y: 15, width: 10, height: 15, description: "Нейроинтерфейсы и импланты" },
      { id: "eyes", name: "Глаза", x: 47, y: 18, width: 6, height: 4, description: "AR-очки и визуальные устройства" },
      { id: "hands", name: "Руки", x: 35, y: 45, width: 8, height: 12, description: "Тактильные интерфейсы" },
      {
        id: "tablet",
        name: "Планшет",
        x: 60,
        y: 50,
        width: 15,
        height: 20,
        description: "Рабочая область для рисования",
      },
    ]

    // Добавляем области для фетишей
    const fetishAreas = getFetishAreas(talent.id)
    areas.push(...fetishAreas)

    // Добавляем области в зависимости от экипировки
    const activeEquipment = filteredInventory.filter((item) => item.enabled && item.targetTalents?.includes(talent.id))

    if (activeEquipment.some((eq) => eq.type === "device" && eq.slot === "head")) {
      areas.push({
        id: "ar_display",
        name: "AR-дисплей",
        x: 25,
        y: 25,
        width: 20,
        height: 15,
        description: "Голографический интерфейс",
      })
    }

    return areas
  }

  const handleAreaClick = (areaId: string, talent: Talent) => {
    if (!selectedTool) return

    const area = getInteractiveAreas(talent).find((a) => a.id === areaId)
    if (!area) return

    // Обработка взаимодействия инструмента с областью
    switch (selectedTool) {
      case "marker":
        if (areaId === "tablet") {
          // Имитация рисования
          setInteractiveAreas((prev) => ({ ...prev, [areaId]: !prev[areaId] }))
          // Добавляем состояние "Творческий процесс"
          applyStatusEffect(talent.id, {
            id: generateUniqueId(),
            name: "Творческий процесс",
            description: "Активное творческое взаимодействие",
            type: "buff",
            duration: 3,
            effects: { creativity: 10, engagement: 5 },
          })
        }
        break
      case "scanner":
        // Сканирование области
        console.log(`[v0] Сканирование области ${area.name}`)
        break
      case "calibrator":
        if (areaId === "head" || areaId === "eyes") {
          // Открываем настройки оборудования для этой области
          setShowEquipmentPanel(true)
        }
        break
      case "stimulator":
        // Стимуляция области
        applyStatusEffect(talent.id, {
          id: generateUniqueId(),
          name: "Нейростимуляция",
          description: "Активация нейронных путей",
          type: "buff",
          duration: 2,
          effects: { intelligence: 8, anxiety: -3 },
        })
        break
      case "communicator":
        // Прямое общение с персонажем через область
        if (selectedInteractionType) {
          const contextData = generateTalentContext(talent)
          const message = `Взаимодействие с областью ${area.name}`
          
          // Используем Character AI для анализа взаимодействия
          if (characterAI) {
            characterAI?.analyzeMessage(message).then(analysis => {
              console.log('Character AI анализ взаимодействия:', analysis)
            }).catch(error => {
              console.log('Character AI недоступен для анализа')
            })
          }
          
          // Используем AI-систему для генерации ответа
          personalWorkIntegration.processMessage({
            talentId: talent.id,
            message,
            context: contextData,
            interactionType: selectedInteractionType,
            selectedTool,
            equipment: filteredInventory.filter(item =>
              item.enabled && item.targetTalents?.includes(talent.id)
            )
          }).then(response => {
            if (response.changes) {
              applyAIChanges(talent.id, response.changes)
            }
          }).catch(error => {
            console.error('Ошибка коммуникации:', error)
          })
        }
        break
      case "fetish_analyzer":
        // Анализ фетишей для области
        console.log(`[v0] Анализ фетишей для области ${area.name}`)
        // Интеграция с Character AI для анализа фетишей
        if (characterAI) {
          characterAI.analyzeMessage(`Анализ фетишей в области ${area.name}`).then(analysis => {
            console.log('Character AI анализ фетишей:', analysis)
          }).catch(error => {
            console.log('Character AI недоступен для анализа фетишей')
          })
        }
        break
      case "quick_actions":
        // Быстрые действия для области
        console.log(`[v0] Быстрые действия для области ${area.name}`)
        // Интеграция с Character AI для быстрых действий
        if (characterAI) {
          characterAI.executeQuickAction("area_interaction").catch(error => {
            console.log('Character AI недоступен для быстрых действий')
          })
        }
        break
    }
  }

  const [marketTalents, setMarketTalents] = useState<Talent[]>([])
  const [selectedMarketSection, setSelectedMarketSection] = useState<string>("")
  const [showMarketModal, setShowMarketModal] = useState(false)
  const [marketMode, setMarketMode] = useState<"random" | "selection" | "trade">("random")
  const [availableForTrade, setAvailableForTrade] = useState<string[]>([])

  const generateRandomTalent = () => {
    const names = ["Кира Нова", "Джек Райдер", "Мия Стар", "Рекс Вольт", "Лина Код", "Макс Блейд"]
    const roles = ["Техник", "Аналитик", "Хакер", "Инженер", "Дизайнер", "Специалист"]
    const section = selectedMarketSection

    const baseStats =
      section === "void-rescues"
        ? { min: 60, max: 95, risk: true }
        : section === "corporate-contracts"
          ? { min: 40, max: 80, risk: false }
          : { min: 30, max: 90, risk: false }

    const talent: Talent = {
      id: `market-${generateUniqueId()}`,
      name: names[Math.floor(Math.random() * names.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
      level: Math.floor(Math.random() * 6) + 1,
      attributes: {
        strength: Math.floor(Math.random() * (baseStats.max - baseStats.min)) + baseStats.min,
        empathy: Math.floor(Math.random() * (baseStats.max - baseStats.min)) + baseStats.min,
        intelligence: Math.floor(Math.random() * (baseStats.max - baseStats.min)) + baseStats.min,
        creativity: Math.floor(Math.random() * (baseStats.max - baseStats.min)) + baseStats.min,
        temperament: Math.floor(Math.random() * (baseStats.max - baseStats.min)) + baseStats.min,
        grit: Math.floor(Math.random() * (baseStats.max - baseStats.min)) + baseStats.min,
        ego: Math.floor(Math.random() * (baseStats.max - baseStats.min)) + baseStats.min,
      },
      states: {
        mood: Math.floor(Math.random() * 60) + 40,
        anxiety: Math.floor(Math.random() * 40) + 10,
        burnout: Math.floor(Math.random() * 30) + 5,
        engagement: Math.floor(Math.random() * 50) + 50,
        entitlement: Math.floor(Math.random() * 40) + 10,
        insight: Math.floor(Math.random() * 60) + 40,
        routine: Math.floor(Math.random() * 80) + 20,
        compliance: Math.floor(Math.random() * 80) + 20,
        neuroplasticity: Math.floor(Math.random() * 60) + 40,
        endurance: Math.floor(Math.random() * 80) + 20,
        cognitiveLoad: Math.floor(Math.random() * 40) + 10,
      },
      skills: {
        office: Math.floor(Math.random() * 80) + 20,
        negotiation: Math.floor(Math.random() * 80) + 20,
        technical: Math.floor(Math.random() * 80) + 20,
        vr: Math.floor(Math.random() * 80) + 20,
        field: Math.floor(Math.random() * 80) + 20,
        etiquette: Math.floor(Math.random() * 80) + 20,
        logistics: Math.floor(Math.random() * 80) + 20,
        medical: Math.floor(Math.random() * 80) + 20,
        maintenance: Math.floor(Math.random() * 80) + 20,
        data: Math.floor(Math.random() * 80) + 20,
        stage: Math.floor(Math.random() * 80) + 20,
      },
      status: "available",
      memories: [],
      experience: Math.floor(Math.random() * 2000) + 500,
      statusEffects:
        baseStats.risk && Math.random() < 0.3
          ? [
              {
                id: `trauma-${generateUniqueId()}`,
                name: "Void Trauma",
                description: "Психологическая травма от пребывания в Void",
                type: "debuff",
                duration: 7,
                effects: { anxiety: 15, neuroplasticity: -10 },
              },
            ]
          : [],
      affinities: {},
      stressors: {},
      equippedItems: [],
      inventory: [],
    }

    return talent
  }

  const generateRandomTalents = (section: string, count = 3) => {
    const newTalents: Talent[] = []

    for (let i = 0; i < count; i++) {
      newTalents.push(generateRandomTalent())
    }

    return newTalents
  }

  const openMarketSection = (sectionId: string) => {
    setSelectedMarketSection(sectionId)

    if (Math.random() < 0.3) {
      // 30% шанс на сюжетную сцену
      triggerStoryScene(sectionId)
    }

    setMarketMode("random")
    setMarketTalents(generateRandomTalents(sectionId))
    setShowMarketModal(true)
  }

  const openStationEntity = (entityId: string) => {
    // Здесь будет логика открытия сущности станции
    // Пока просто показываем сюжетную сцену
    triggerStoryScene(entityId)
  }

  const refreshMarketTalents = () => {
    if (neuralPulses < 100) {
      alert("Недостаточно Neural Pulses для обновления списка")
      return
    }

    setNeuralPulses((prev) => prev - 100)
    setMarketTalents(generateRandomTalents(selectedMarketSection))
  }

  const hireTalent = (talent: Talent) => {
    const cost = calculateTalentCost(talent)
    if (credits < cost) {
      return
    }

    if (selectedMarketSection === "void-rescues" && Math.random() < 0.4) {
      triggerStoryScene("void-rescues", { talent, cost })
      return
    }

    // Применяем риски в зависимости от секции
    const finalTalent = { ...talent }

    if (selectedMarketSection === "void-rescues" && Math.random() < 0.25) {
      // 25% шанс получить дополнительную травму
      finalTalent.statusEffects = [
        ...finalTalent.statusEffects,
        {
          id: `rescue-trauma-${generateUniqueId()}`,
          name: "Rescue Trauma",
          description: "Дополнительная травма от спасательной операции",
          type: "debuff",
          duration: 5,
          effects: { mood: -20, anxiety: 10 },
        },
      ]
    }

    updateCredits((prev) => prev - cost)
    setTalents((prev) => [...prev, { ...finalTalent, id: `hired-${generateUniqueId()}` }])
    setMarketTalents((prev) => prev.filter((t) => t.id !== talent.id))

    // Добавляем воспоминание о найме
    finalTalent.memories = [`Нанят через ${getMarketSectionName(selectedMarketSection)}`]
  }

  const tradeTalent = (marketTalent: Talent, myTalentId: string) => {
    const myTalent = talents.find((t) => t.id === myTalentId)
    if (!myTalent) return

    // Удаляем своего таланта и добавляем нового
    setTalents((prev) =>
      prev.filter((t) => t.id !== myTalentId).concat({ ...marketTalent, id: `traded-${generateUniqueId()}` }),
    )
    setMarketTalents((prev) => prev.filter((t) => t.id !== marketTalent.id))
    setAvailableForTrade((prev) => prev.filter((id) => id !== myTalentId))
  }

  const calculateTalentCost = (talent: Talent): number => {
    const baseValue = Object.values(talent.attributes).reduce((sum, val) => sum + val, 0)
    const skillValue = Object.values(talent.skills).reduce((sum, val) => sum + val, 0)
    const levelMultiplier = talent.level * 100

    let cost = Math.floor((baseValue + skillValue) * 2 + levelMultiplier)

    // Модификаторы в зависимости от секции
    switch (selectedMarketSection) {
      case "void-rescues":
        cost *= 0.7 // Дешевле из-за рисков
        break
      case "corporate-contracts":
        cost *= 1.3 // Дороже из-за корпоративной подготовки
        break
      case "neural-forge":
        cost *= 2 // Самые дорогие кастомные таланты
        break
    }

    return Math.floor(cost)
  }

  const getMarketSectionName = (sectionId: string): string => {
    const names: { [key: string]: string } = {
      "talent-exchange": "Talent Exchange",
      "void-rescues": "Void Rescues",
      "corporate-contracts": "Corporate Contracts",
      "neural-forge": "Neural Forge",
    }
    return names[sectionId] || sectionId
  }

  const toggleTalentForTrade = (talentId: string) => {
    setAvailableForTrade((prev) =>
      prev.includes(talentId) ? prev.filter((id) => id !== talentId) : [...prev, talentId],
    )
  }

  // Обработка состояния загрузки
  if (configLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Загрузка конфигурации...</h2>
          <p className="text-gray-400">Инициализация игровых данных</p>
        </div>
      </div>
    )
  }

  // Обработка ошибок загрузки
  if (configError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Ошибка загрузки</h2>
          <p className="text-gray-400 mb-4">{configError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    )
  }

  // Проверка наличия конфигурации
  if (!gameConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-yellow-500 text-6xl mb-4">❓</div>
          <h2 className="text-2xl font-bold text-white mb-2">Конфигурация не найдена</h2>
          <p className="text-gray-400">Не удалось загрузить игровые данные</p>
        </div>
      </div>
    )
  }

  // Основной рендер приложения
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center"
        style={{ backgroundImage: "url(/futuristic-space-station.png)" }}
      />

      <div className="relative z-10 flex h-screen">
        {/* Левая панель - Список талантов */}
        <div className="w-80 glass-panel border-r border-cyan-500/30 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Nexus Enslaver
              </h1>
              {currentUser && (
                <p className="text-sm text-gray-300 mt-1">
                  Пользователь: <button
                    onClick={() => setShowLogoutModal(true)}
                    className="text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                  >
                    {currentUser.username}
                  </button>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-cyan-300">{neuralPulses} НП</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap gap-1 p-1 bg-gray-800/50 rounded-lg">
              {[
                { id: "talents", label: "Активы", icon: "👥" },
                { id: "station", label: "Станция", icon: "🏢" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-2 py-2 rounded text-xs font-medium transition-colors ${
                    activeTab === tab.id ? "bg-cyan-600 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <span className="block">{tab.icon}</span>
                  <span className="block mt-1">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {activeTab === "talents" && (
            <div className="space-y-3">
              <div className="text-sm text-gray-400 mb-4">
                Отладка: {talents.length} персонажей загружено
              </div>
              {talents.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>Персонажи не найдены</p>
                  <p className="text-xs mt-2">Возможные причины:</p>
                  <ul className="text-xs mt-1 space-y-1">
                    <li>• Нет привязанных персонажей</li>
                    <li>• Ошибка загрузки данных</li>
                    <li>• Проблема с конфигурацией</li>
                  </ul>
                </div>
              ) : (
                talents.map((talent) => (
                <div
                  key={talent.id}
                  onClick={() => setSelectedTalent(talent)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-cyan-400/50 ${
                    selectedTalent?.id === talent.id
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-gray-600 bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">{talent.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(talent.status)}`}>
                      {talent.status === "available"
                        ? "Доступен"
                        : talent.status === "working"
                          ? "Работает"
                          : "Отдыхает"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{talent.role}</p>
                  <div className="flex justify-between text-xs">
                    <span className={getMoodColor(talent.mood)}>Настроение: {talent.mood}%</span>
                    <span className="text-gray-400">Уровень: {talent.level}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "station" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-cyan-400">Станция</h2>
              <p className="text-sm text-gray-300">Сущности станции и их сюжетные сцены</p>

              <div className="grid grid-cols-1 gap-3">
                {[
                  // Здесь будут отображаться сущности, добавленные через dev панель
                ].length > 0 ? (
                  [
                    // Здесь будут отображаться сущности, добавленные через dev панель
                  ].map((entity) => (
                    <div key={entity.id} className="p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{entity.name}</h3>
                          <span className="text-xs text-gray-400 capitalize">{entity.type}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">{entity.desc}</p>
                      <button
                        onClick={() => openStationEntity(entity.id)}
                        className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm"
                      >
                        Открыть
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 bg-gray-800/30 border border-gray-600 rounded-lg text-center">
                    <div className="text-gray-400 mb-2">🏢</div>
                    <h3 className="text-lg font-semibold text-white mb-2">Нет сущностей станции</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      Сущности станции нужно добавить через панель разработчика
                    </p>
                    <div className="text-xs text-gray-500">
                      Перейдите в dev панель → раздел "Станция" → "Добавить сущность"
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Центральная область */}
        <div className="flex-1 flex flex-col">
          {/* Верхняя панель с характеристиками */}
          {selectedTalent && (
            <div className="glass-panel border-b border-cyan-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedTalent.name}</h2>
                  <p className="text-sm text-cyan-300">
                    {selectedTalent.role} • Уровень {selectedTalent.level}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-300">Опыт</div>
                    <div className="text-sm text-cyan-400">
                      {selectedTalent.experience}/{selectedTalent.maxExperience}
                    </div>
                  </div>
                </div>
              </div>

              {/* Компактная панель основных характеристик */}
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-2">Основные характеристики:</div>
                <div className="grid grid-cols-3 gap-2">
                  {memoizedEffectiveStats && 
                    Object.entries(memoizedEffectiveStats)
                      .filter(([stat]) => ['mood', 'anxiety', 'engagement'].includes(stat))
                      .map(([stat, value]) => (
                        <div key={stat} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-300 truncate">{getAttributeDisplayName(stat)}</div>
                            <div className="w-full bg-gray-600 rounded-full h-1 mt-1">
                              <div
                                className={`h-1 rounded-full transition-all duration-300 ${getBarColor(value)}`}
                                style={{ width: `${Math.min((value / 100) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-xs text-gray-300 font-medium">{value}</div>
                        </div>
                      ))}
                </div>
              </div>

              {/* Воспоминания */}
              <div className="flex flex-wrap gap-2">
                {selectedTalent.memories.slice(-3).map((memory, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300">
                    {memory}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Портрет */}
          {selectedTalent && (
            <div className="flex-1 relative overflow-hidden">
              <img
                src={getPortraitImage(selectedTalent) || "/placeholder.svg"}
                alt={`Портрет ${selectedTalent.name}`}
                className="w-full h-full object-cover"
              />

              {/* Интерактивные области */}
              {selectedTool && (
                <div className="absolute inset-0">
                  {getInteractiveAreas(selectedTalent).map((area) => (
                    <div
                      key={area.id}
                      className={`absolute border-2 border-cyan-400 bg-cyan-400/20 cursor-pointer transition-all hover:bg-cyan-400/40 ${
                        interactiveAreas[area.id] ? "animate-pulse" : ""
                      }`}
                      style={{
                        left: `${area.x}%`,
                        top: `${area.y}%`,
                        width: `${area.width}%`,
                        height: `${area.height}%`,
                      }}
                      onClick={() => handleAreaClick(area.id, selectedTalent)}
                      title={area.description}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Правая панель управления */}
        {selectedTalent && (
          <div className="w-96 glass-panel border-l border-cyan-500/30 p-6 overflow-y-auto">
            {/* Экипировка и состояния */}
            <div className="space-y-6">
              {/* Состояния */}
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-3">Состояния</h3>
                <div className="space-y-2">
                  {selectedTalent.statusEffects.map((effect) => (
                    <div key={effect.id} className={`p-3 rounded border ${getStatusEffectColor(effect.type)}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {effect.icon} {effect.name}
                        </span>
                        {effect.removable && (
                          <button
                            onClick={() => removeStatusEffect(selectedTalent.id, effect.id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            Снять
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 mt-1">{effect.description}</p>
                      <p className="text-xs text-gray-400">Осталось: {effect.duration} дней</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Оборудование */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-purple-400">Оборудование</h3>
                  <button
                    onClick={() => setShowEquipmentPanel(true)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                  >
                    Управление ({filteredInventory.filter((item) => item.enabled).length})
                  </button>
                </div>
                <div className="text-sm text-gray-300 mb-3">
                  Активно:{" "}
                  {
                    filteredInventory.filter((item) => item.enabled && item.targetTalents?.includes(selectedTalent.id))
                      .length
                  }{" "}
                  предметов
                </div>
                
                {/* Список активного оборудования */}
                <div className="space-y-2">
                  {filteredInventory
                    .filter((item) => item.enabled && item.targetTalents?.includes(selectedTalent.id))
                    .map((item) => (
                      <div key={item.id} className="p-3 bg-gray-800/50 border border-gray-600 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white">{item.name}</span>
                          <span className="text-xs text-gray-400">{item.type}</span>
                        </div>
                        <p className="text-xs text-gray-300 mb-2">{item.description}</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-400">Мощность: {item.powerLevel}%</span>
                          {item.mode && <span className="text-purple-400">Режим: {item.mode}</span>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>


            </div>
          </div>
        )}
      </div>

      {/* Плавающая панель в режиме личной работы */}
      {/* Character AI панели */}
      {characterAIConfig && selectedTalent && (
        <>
          {/* Панель действий и инструментов */}
          {showActionToolPanel && (
            <ActionToolPanel
              characterAI={characterAI}
              selectedTalent={selectedTalent}
              onClose={() => setShowActionToolPanel(false)}
            />
          )}
          
          {/* Чат с персонажем */}
          {showCharacterChat && (
            <CharacterChat
              characterAI={characterAI}
              selectedTalent={selectedTalent}
              onClose={() => setShowCharacterChat(false)}
              applyAIChanges={applyAIChanges}
            />
          )}
        </>
      )}

      {/* Панель управления Character AI */}
      {characterAIConfig && selectedTalent && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 glass-panel border border-cyan-500/50 rounded-lg p-4 z-50">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowActionToolPanel(!showActionToolPanel)
                }}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  showActionToolPanel ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                🤖 Действия и инструменты
              </button>
              <button
                onClick={() => {
                  setShowCharacterChat(!showCharacterChat)
                }}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  showCharacterChat ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                💬 Чат с персонажем
              </button>
            </div>
            <div className="border-l border-gray-600 pl-4 flex gap-2">
              <button
                onClick={() => setShowCharacterPanel(!showCharacterPanel)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                {showCharacterPanel ? "Скрыть" : "Показать"} характеристики
              </button>
              <button
                onClick={() => setShowEquipmentPanel(true)}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              >
                Настройки оборудования
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Чат с LLM */}
      {showLLMChat && selectedTalent && (
        <div
          className="fixed glass-panel border border-cyan-500/50 rounded-lg z-50 w-96 h-96 flex flex-col"
          style={{ left: chatPosition.x, top: chatPosition.y }}
        >
          <div
            className="p-3 border-b border-gray-600 cursor-move flex items-center justify-between"
            onMouseDown={handleChatMouseDown}
          >
            <h3 className="font-semibold text-cyan-400">
              ИИ-Помощник: {selectedInteractionType} с {selectedTalent.name}
            </h3>
            <button onClick={() => setShowLLMChat(false)} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`p-2 rounded text-sm ${
                  message.role === "user" ? "bg-cyan-600/20 text-cyan-100 ml-8" : "bg-gray-700/50 text-gray-100 mr-8"
                }`}
              >
                {message.content}
              </div>
            ))}
            {isProcessing && <div className="text-center text-gray-400 text-sm">ИИ обрабатывает запрос...</div>}
          </div>

          <div className="p-3 border-t border-gray-600">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessageToLLM(currentMessage)}
                placeholder="Введите сообщение..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
              />
              <button
                onClick={() => sendMessageToLLM(currentMessage)}
                disabled={!currentMessage.trim() || isProcessing}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded text-white"
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Панель управления оборудованием */}
      {showEquipmentPanel && (
        <div className="fixed right-0 top-0 h-full w-96 glass-panel border-l border-cyan-500/30 z-40 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-purple-400">Управление оборудованием</h2>
              <button onClick={() => setShowEquipmentPanel(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {filteredInventory.map((item) => (
                <div key={item.id} className="border border-gray-600 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className={`font-semibold ${getEquipmentRarityColor(item.rarity || "common")}`}>
                        {item.enabled ? "🟢" : "⚫"} {item.name}
                      </h3>
                      <p className="text-xs text-gray-400 mb-2">
                        {item.type} • {item.slot}
                      </p>
                      <p className="text-sm text-gray-300">{item.description}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Применить к талантам */}
                    <div>
                      <label className="text-sm text-gray-300 block mb-1">Применить к:</label>
                      <div className="flex flex-wrap gap-1">
                        {talents.map((talent) => (
                          <button
                            key={talent.id}
                            onClick={() => toggleTalentTarget(item.id, talent.id)}
                            className={`px-2 py-1 rounded text-xs transition-colors ${
                              item.targetTalents?.includes(talent.id)
                                ? "bg-cyan-600 text-white"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                          >
                            {talent.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Мощность */}
                    {item.maxPowerLevel && (
                      <div>
                        <label className="text-sm text-gray-300 block mb-1">Мощность: {item.powerLevel}%</label>
                        <input
                          type="range"
                          min="0"
                          max={item.maxPowerLevel}
                          value={item.powerLevel || 0}
                          onChange={(e) => updateEquipmentPower(item.id, Number.parseInt(e.target.value))}
                          className="w-full"
                          aria-label="Уровень мощности оборудования"
                          title="Регулировка мощности"
                        />
                      </div>
                    )}

                    {/* Режим */}
                    {item.type === "device" && (
                      <div>
                        <label className="text-sm text-gray-300 block mb-1">Режим:</label>
                        <select
                          value={item.mode || "Eco"}
                          onChange={(e) => updateEquipmentMode(item.id, e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                          aria-label="Выбор режима работы оборудования"
                          title="Режим работы"
                        >
                          <option value="Eco">Eco</option>
                          <option value="Performance">Performance</option>
                          <option value="AR">AR</option>
                          <option value="VR">VR</option>
                        </select>
                      </div>
                    )}

                    {/* Эффекты */}
                    <div className="text-xs text-cyan-300">
                      Эффекты:{" "}
                      {Object.entries(item.effects)
                        .map(([stat, value]) => `${stat} ${value > 0 ? "+" : ""}${value}`)
                        .join(", ")}
                    </div>

                    {/* Кнопка включения/выключения */}
                    <button
                      onClick={() => toggleEquipment(item.id)}
                      className={`w-full py-2 rounded transition-colors ${
                        item.enabled
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                    >
                      {item.enabled ? "Выключить" : "Включить"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Подсказки */}
      {hoveredAction && (
        <div
          className="fixed z-50 glass-panel border border-cyan-500/50 rounded p-3 max-w-xs pointer-events-none"
          style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
        >
          {(() => {
            const content = getTooltipContent(hoveredAction)
            if (!content) return <div className="text-gray-400">Информация недоступна</div>

            return (
              <div className="space-y-2">
                <div className="text-white font-medium">{content.description}</div>
                <div className="text-green-400 text-sm">Эффекты: {content.effects}</div>
                {content.sideEffects && (
                  <div className="text-orange-400 text-sm">Побочные эффекты: {content.sideEffects.join(", ")}</div>
                )}
                {content.risk && <div className="text-red-400 text-sm">Риск: {content.risk}</div>}
              </div>
            )
          })()}
        </div>
      )}

              {/* Аномалии */}
      {currentEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-panel p-12 max-w-lg w-full text-center border border-cyan-500/50 rounded-lg">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">{currentEvent.title}</h2>
            <p className="text-xl text-gray-200 mb-8">{currentEvent.description}</p>

            {currentEvent.choices ? (
              <div className="space-y-4">
                {currentEvent.choices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={() => handleEventChoice(choice)}
                    className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setCurrentEvent(null)}
                className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-semibold"
              >
                Продолжить
              </button>
            )}
          </div>
        </div>
      )}

      {/* Нижняя панель */}
      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t border-cyan-500/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-cyan-400">
              <span className="font-semibold">День {currentDay}</span>
            </div>
            <div className="text-green-400">
              <span className="font-semibold">{credits} кредитов</span>
            </div>
            <div className="text-purple-400">
              <span className="font-semibold">Репутация: {reputation}%</span>
            </div>
          </div>

          <button
            onClick={nextDay}
            className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 rounded-lg text-white font-semibold transition-all"
          >
            Следующий день
          </button>
        </div>
      </div>

      {showMarketModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-cyan-400">{getMarketSectionName(selectedMarketSection)}</h2>
                <button onClick={() => setShowMarketModal(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setMarketMode("random")}
                  className={`px-3 py-1 rounded text-sm ${marketMode === "random" ? "bg-cyan-600" : "bg-gray-700"}`}
                >
                  Случайные
                </button>
                <button
                  onClick={() => setMarketMode("selection")}
                  className={`px-3 py-1 rounded text-sm ${marketMode === "selection" ? "bg-cyan-600" : "bg-gray-700"}`}
                >
                  На выбор
                </button>
                <button
                  onClick={() => setMarketMode("trade")}
                  className={`px-3 py-1 rounded text-sm ${marketMode === "trade" ? "bg-cyan-600" : "bg-gray-700"}`}
                >
                  Обмен
                </button>
                <button
                  onClick={refreshMarketTalents}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm ml-auto"
                >
                  Обновить (100 НП)
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {marketMode === "trade" && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Ваши активы для обмена:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {talents.map((talent) => (
                      <div key={talent.id} className="p-3 bg-gray-800 rounded border">
                        <div className="flex items-center justify-between">
                          <span className="text-white">{talent.name}</span>
                          <button
                            onClick={() => toggleTalentForTrade(talent.id)}
                            className={`px-2 py-1 rounded text-xs ${
                              availableForTrade.includes(talent.id) ? "bg-green-600" : "bg-gray-600"
                            }`}
                          >
                            {availableForTrade.includes(talent.id) ? "Выбран" : "Выбрать"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {marketTalents.map((talent) => (
                  <div key={talent.id} className="p-4 bg-gray-800 border border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{talent.name}</h3>
                        <p className="text-sm text-gray-300">
                          {talent.role} • Уровень {talent.level}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-semibold">{calculateTalentCost(talent)} кредитов</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>Сила: {talent.attributes.strength}</div>
                      <div>Эмпатия: {talent.attributes.empathy}</div>
                      <div>Интеллект: {talent.attributes.intelligence}</div>
                      <div>Креативность: {talent.attributes.creativity}</div>
                    </div>

                    {talent.statusEffects.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-red-400">Эффекты:</div>
                        {talent.statusEffects.map((effect) => (
                          <div key={effect.id} className="text-xs text-red-300">
                            {effect.name} ({effect.duration} дней)
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {marketMode === "trade" ? (
                        <select
                          onChange={(e) => e.target.value && tradeTalent(talent, e.target.value)}
                          className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm"
                          defaultValue=""
                          aria-label="Выбор таланта для обмена"
                          title="Обмен талантами"
                        >
                          <option value="">Обменять на...</option>
                          {availableForTrade.map((talentId) => {
                            const myTalent = talents.find((t) => t.id === talentId)
                            return myTalent ? (
                              <option key={talentId} value={talentId}>
                                {myTalent.name}
                              </option>
                            ) : null
                          })}
                        </select>
                      ) : (
                        <button
                          onClick={() => hireTalent(talent)}
                          className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                          disabled={credits < calculateTalentCost(talent)}
                        >
                          {credits < calculateTalentCost(talent) ? "Недостаточно кредитов" : "Нанять"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showStoryScene && currentScene && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">{currentScene.title}</h2>
                <button onClick={() => setShowStoryScene(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              {currentScene.image && (
                <div className="mb-4">
                  <img
                    src={currentScene.image || "/placeholder.svg"}
                    alt={currentScene.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}

              <p className="text-gray-300 mb-6">{currentScene.description}</p>

              <div className="space-y-3">
                {currentScene.choices.map((choice: any) => (
                  <button
                    key={choice.id}
                    onClick={() => handleSceneChoice(choice)}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-left transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-white">{choice.text}</span>
                      {choice.cost && <span className="text-yellow-400">{choice.cost} кредитов</span>}
                    </div>
                    {choice.outcomes && (
                      <div className="mt-2 text-sm text-gray-400">Возможные исходы: {choice.outcomes.length}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Модальное окно регистрации */}
      <RegistrationModal
        isOpen={showRegistration}
        onClose={() => setShowRegistration(false)}
        onRegister={handleUserRegistration}
      />

      {/* Кнопка отладки OpenRouter */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowOpenRouterDebug(!showOpenRouterDebug)}
          className="bg-black/50 border-white/20 text-white hover:bg-black/70"
        >
          {showOpenRouterDebug ? '🔴' : '🟢'} OpenRouter Debug
        </Button>
      </div>

      {/* Отладочная панель OpenRouter */}
      <OpenRouterDebugPanel 
        isVisible={showOpenRouterDebug}
        onToggle={() => setShowOpenRouterDebug(false)}
      />

      {/* Уведомления об изменениях характеристик */}
      <StatNotification 
        changes={statChanges}
        onRemove={(timestamp) => {
          setStatChanges(prev => prev.filter(change => change.timestamp !== timestamp));
        }}
      />

      {/* Улучшенная перетаскиваемая панель характеристик */}
      <CharacterStatsPanel 
        talent={selectedTalent}
        isVisible={showCharacterPanel}
        onClose={() => setShowCharacterPanel(false)}
      />

      {/* Модалка выхода */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Выход из системы</h3>
            <p className="text-gray-300 mb-6">
              Вы действительно хотите выйти из аккаунта <span className="text-cyan-300">{currentUser?.username}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Выйти
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Система уведомлений */}
      <Toaster />
    </div>
  )
}
