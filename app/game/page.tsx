"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Sun, Moon, Settings, X, Edit, Plus, ChevronDown, Film, Trash, Trash2 } from "lucide-react"
import { Users, Building, FileText, Zap, BarChart, Wrench, User, Cog, Code } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Функция для генерации уникальных ID
let idCounter = 0
const generateUniqueId = (prefix: string = '') => {
  idCounter++
  return `${prefix}${Date.now()}-${idCounter}`
}

import actionsConfigData from "../../data/actions-config.json"
import marketConfigData from "../../data/market-config.json"
import contractsConfigData from "../../data/contracts-config.json"
import eventsConfigData from "../../data/events-config.json"
import equipmentConfigData from "../../data/equipment-config.json"
import systemDefinitionsData from "../../data/system-definitions.json"
import storyScenesData from "../../data/story-scenes.json"

// Импортируем основные конфиги для сравнения
import actionsData from "../../data/actions.json"
import marketData from "../../data/market.json"
import contractsData from "../../data/contracts.json"
import eventsData from "../../data/events.json"

// Типы данных
interface Talent {
  id: string
  name: string
  rank: string
  avatar: string
  attributes: {
    strength: number
    empathy: number
    intelligence: number
    temperament: number
    grit: number
    ego: number
  }
  states: {
    mood: number
    anxiety: number
    burnout: number
    entitlement: number
    insight: number
    routine: number
    compliance: number
    neuroplasticity: number
    engagement: number
    endurance: number
    cognitiveLoad: number
  }
  skills: {
    office: number
    negotiation: number
    technical: number
    vr: number
    field: number
    etiquette: number
    logistics: number
    medical: number
    maintenance: number
    data: number
    stage: number
  }
  affinities: { [key: string]: number }
  stressors: { [key: string]: number }
  memories: Memory[]
  statusEffects: any[]
  isActive: boolean
  dailyActionsUsed: number
  maxDailyActions: number
  specialization?: string
}

interface Memory {
  id: string
  type: "positive" | "traumatic" | "professional"
  summary: string
  intensity: number
  tags: string[]
  effects: { [key: string]: number }
  createdDay: number
}

interface Contract {
  id: string
  client: string
  title: string
  description: string
  requirements: {
    skills: { [key: string]: number }
    minRank: string
  }
  reward: number
  deadline: number
  kpi: Array<{
    name: string
    weight: number
    current: number
    target: number
  }>
  assignedTalents: string[]
  status: "available" | "active" | "completed" | "failed"
  storyScenes?: {
    onAccept?: string[]
    onProgress?: string[]
    onComplete?: string[]
    onFail?: string[]
  }
}

interface GameEvent {
  id: string
  type: "anomaly" | "audit" | "crisis" | "opportunity"
  title: string
  description: string
  effects: { [key: string]: any }
  choices?: Array<{
    text: string
    effects: { [key: string]: any }
  }>
  storyScenes?: string[]
}

interface GameState {
  day: number
  credits: number
  reputation: number
  neuralPulses: number
  maxNeuralPulses: number

  talents: Talent[]
  contracts: Contract[]
  activeEvents: GameEvent[]

  // Настройки агентства
  policies: {
    workHours: number
    housingQuality: number
    therapyAccess: boolean
    bonusTransparency: boolean
  }

  // Статистика
  stats: {
    totalEarned: number
    contractsCompleted: number
    talentsHired: number
    averageMood: number
    turnoverRate: number
  }

  marketTalents: MarketTalent[]
  voidRescues: VoidRescue[]
  corporateContracts: CorporateContract[]
  neuralForgeTemplates: NeuralForgeTemplate[]
  activeContracts: any[]
  completedContracts: any[]
  eventLog: any[]
}

interface MarketTalent {
  id: string
  name: string
  rank: string
  avatar: string
  price: number
  attributes: {
    strength: number
    empathy: number
    intelligence: number
    temperament: number
    grit: number
    ego: number
  }
  skills: {
    office: number
    negotiation: number
    technical: number
    vr: number
    field: number
    etiquette: number
    logistics: number
    medical: number
    maintenance: number
    data: number
    stage: number
  }
  specialization: string
  description: string
  cost?: number
}

interface VoidRescue {
  id: string
  name: string
  avatar: string
  cost: number
  risk: number
  description: string
  potentialReward: string
  attributes: {
    strength: number
    empathy: number
    intelligence: number
    temperament: number
    grit: number
    ego: number
  }
  skills: {
    [key: string]: number
  }
  anomaly?: string
}

interface CorporateContract {
  id: string
  companyName: string
  programName: string
  cost: number
  duration: number
  description: string
  requirements: string[]
  benefits: string[]
  talentTemplate: {
    name: string
    avatar: string
    rank: string
    attributes: {
      strength: number
      empathy: number
      intelligence: number
      temperament: number
      grit: number
      ego: number
    }
    skills: {
      [key: string]: number
    }
  }
}

interface NeuralForgeTemplate {
  id: string
  name: string
  cost: number
  description: string
  baseAttributes: {
    strength: number
    empathy: number
    intelligence: number
    temperament: number
    grit: number
    ego: number
  }
  customizationPoints: number
  specializations: string[]
}

// Утилиты для расчетов
const getStateColor = (value: number, type: "mood" | "anxiety" | "burnout" | "engagement") => {
  if (type === "anxiety" || type === "burnout") {
    return value >= 4 ? "text-red-500" : value >= 2 ? "text-yellow-500" : "text-green-500"
  }
  return value >= 4 ? "text-green-500" : value >= 2 ? "text-yellow-500" : "text-red-500"
}

const getRankColor = (rank: string) => {
  const colors = {
    S: "bg-purple-500 text-white",
    A: "bg-blue-500 text-white",
    B: "bg-green-500 text-white",
    C: "bg-yellow-500 text-white",
    D: "bg-orange-500 text-white",
    F: "bg-red-500 text-white",
  }
  return colors[rank as keyof typeof colors] || "bg-gray-500 text-white"
}

const TalentArchitectGame = () => {
  const [isEditMode, setIsEditMode] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [editingActions, setEditingActions] = useState(actionsConfigData || { categories: {} })
  const [editingMarket, setEditingMarket] = useState(() => {
    const defaultMarket = { talentExchange: [], voidRescues: [], corporateContracts: [], neuralForge: {} }
    if (!marketConfigData || typeof marketConfigData !== "object") {
      return defaultMarket
    }
    return {
      talentExchange: Array.isArray(marketConfigData.talentExchange) ? marketConfigData.talentExchange : [],
      voidRescues: Array.isArray(marketConfigData.voidRescues) ? marketConfigData.voidRescues : [],
      corporateContracts: Array.isArray(marketConfigData.corporateContracts) ? marketConfigData.corporateContracts : [],
      neuralForge: marketConfigData.neuralForge || {},
    }
  })
  const [editingContracts, setEditingContracts] = useState(contractsConfigData || { available: [] })
  const [editingEvents, setEditingEvents] = useState(eventsConfigData || { events: [] })
  const [editingEquipment, setEditingEquipment] = useState(equipmentConfigData || { equipment: [] })
  const [editDialog, setEditDialog] = useState<{
    type: string
    item: any
    category?: string
    isNew?: boolean
    categoryKey?: string
  } | null>(null)

  const [gameState, setGameState] = useState<GameState>({
    day: 1,
    neuralPulses: 10,
    credits: 1000,
    reputation: 50,
    maxNeuralPulses: 10,
    talents: [
      {
        id: "tal_001",
        name: "Алекс Коваленко",
        rank: "C",
        avatar: "👨‍💼",
        specialization: "Офисная работа",
        attributes: { strength: 2, empathy: 4, intelligence: 3, temperament: 2, grit: 3, ego: 2 },
        states: {
          mood: 3,
          anxiety: 1,
          burnout: 0,
          entitlement: 1,
          insight: 2,
          routine: 3,
          compliance: 3,
          neuroplasticity: 2,
          engagement: 4,
          endurance: 3,
          cognitiveLoad: 1,
        },
        skills: {
          office: 3,
          negotiation: 2,
          technical: 1,
          vr: 1,
          field: 0,
          etiquette: 2,
          logistics: 1,
          medical: 0,
          maintenance: 0,
          data: 2,
          stage: 1,
        },
        affinities: {},
        stressors: {},
        memories: [],
        statusEffects: [],
        isActive: true,
        dailyActionsUsed: 0,
        maxDailyActions: 2,
      },
      {
        id: "tal_002",
        name: "София Иванова",
        rank: "B",
        avatar: "👩‍🎨",
        specialization: "Креативные решения",
        attributes: { strength: 3, empathy: 5, intelligence: 4, temperament: 3, grit: 4, ego: 1 },
        states: {
          mood: 4,
          anxiety: 1,
          burnout: 0,
          entitlement: 1,
          insight: 3,
          routine: 2,
          compliance: 4,
          neuroplasticity: 4,
          engagement: 4,
          endurance: 2,
          cognitiveLoad: 1,
        },
        skills: {
          office: 2,
          negotiation: 1,
          technical: 4,
          vr: 3,
          field: 1,
          etiquette: 1,
          logistics: 2,
          medical: 2,
          maintenance: 1,
          data: 4,
          stage: 0,
        },
        affinities: {},
        stressors: {},
        memories: [],
        statusEffects: [],
        isActive: true,
        dailyActionsUsed: 0,
        maxDailyActions: 2,
      },
    ],
    contracts: [],
    activeEvents: [],
    policies: {
      workHours: 8,
      housingQuality: 2,
      therapyAccess: false,
      bonusTransparency: true,
    },
    stats: {
      totalEarned: 0,
      contractsCompleted: 0,
      talentsHired: 2,
      averageMood: 3.5,
      turnoverRate: 0,
    },
    marketTalents: [],
    voidRescues: [],
    corporateContracts: [],
    neuralForgeTemplates: [],
    activeContracts: [],
    completedContracts: [],
    eventLog: [],
  })

  const [storyPoints, setStoryPoints] = useState({
    market_reputation: 0,
    void_experience: 0,
    negotiation_skill: 1,
    corporate_connections: 0,
  })

  const [activeTab, setActiveTab] = useState("talents")
  const [systemConfig, setSystemConfig] = useState(systemDefinitionsData)
  const [editingSystemItem, setEditingSystemItem] = useState<any>(null)
  const [editingSystemType, setEditingSystemType] = useState<"attributes" | "states" | "skills" | null>(null)

  const [editingScenes, setEditingScenes] = useState(() => {
    const defaultScenes = { scenes: [] }
    if (!storyScenesData || typeof storyScenesData !== "object") {
      return defaultScenes
    }
    return {
      scenes: Array.isArray(storyScenesData.scenes) ? storyScenesData.scenes : [],
    }
  })
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [editingStoryScenes, setEditingStoryScenes] = useState(storyScenesData || {})
  
  // Состояния для основных конфигов
  const [editingMainActions, setEditingMainActions] = useState(actionsData || { categories: {} })
  const [editingMainMarket, setEditingMainMarket] = useState(marketData || {})
  const [editingMainContracts, setEditingMainContracts] = useState(contractsData || { available: [] })
  const [editingMainEvents, setEditingMainEvents] = useState(eventsData || { events: [] })
  
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editingType, setEditingType] = useState<string | null>(null)
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null)
  const [showScenePreview, setShowScenePreview] = useState(false)
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null)
  // Добавляем состояние для управления видимостью менеджера сюжетных точек
  const [showStoryPointsManager, setShowStoryPointsManager] = useState(false)

  const updateDependencies = (oldId: string, newId: string, type: "attributes" | "states" | "skills") => {
    // Обновляем в оборудовании
    const updatedEquipment = equipmentConfigData.equipment.map((item) => {
      const updatedItem = { ...item }

      if (updatedItem.effects) {
        const newEffects = { ...updatedItem.effects }
        if (newEffects[oldId] !== undefined) {
          newEffects[newId] = newEffects[oldId]
          delete newEffects[oldId]
        }
        updatedItem.effects = newEffects
      }

      return updatedItem
    })
    setEditingEquipment({ equipment: updatedEquipment })

    // Обновляем в действиях
    const updatedActions = Object.entries(editingActions.categories).map(([categoryKey, category]) => ({
      ...category,
      actions: Object.entries(category.actions).map(([actionKey, action]) => {
        const updatedAction = { ...action }

        if (updatedAction.effects && updatedAction.effects[oldId] !== undefined) {
          updatedAction.effects[newId] = updatedAction.effects[oldId]
          delete updatedAction.effects[oldId]
        }

        if (updatedAction.riskEffects && updatedAction.riskEffects[oldId] !== undefined) {
          updatedAction.riskEffects[newId] = updatedAction.riskEffects[oldId]
          delete updatedAction.riskEffects[oldId]
        }

        return updatedAction
      }),
    }))
    setEditingActions((prev) => ({
      ...prev,
      categories: Object.fromEntries(
        Object.entries(editingActions.categories).map(([key, value], index) => [key, updatedActions[index]]),
      ),
    }))
  }

  const removeDependencies = (id: string, type: "attributes" | "states" | "skills") => {
    // Удаляем из оборудования
    const updatedEquipment = equipmentConfigData.equipment.map((item) => {
      const updatedItem = { ...item }

      if (updatedItem.effects && updatedItem.effects[id] !== undefined) {
        delete updatedItem.effects[id]
      }

      return updatedItem
    })
    setEditingEquipment({ equipment: updatedEquipment })

    // Удаляем из действий
    const updatedActions = Object.entries(editingActions.categories).map(([categoryKey, category]) => ({
      ...category,
      actions: Object.entries(category.actions).map(([actionKey, action]) => {
        const updatedAction = { ...action }

        if (updatedAction.effects && updatedAction.effects[id] !== undefined) {
          delete updatedAction.effects[id]
        }

        if (updatedAction.riskEffects && updatedAction.riskEffects[id] !== undefined) {
          delete updatedAction.effects[id]
        }

        return updatedAction
      }),
    }))
    setEditingActions((prev) => ({
      ...prev,
      categories: Object.fromEntries(
        Object.entries(editingActions.categories).map(([key, value], index) => [key, updatedActions[index]]),
      ),
    }))
  }

  const performAction = (talentId: string, categoryKey: string, actionKey: string) => {
    const category = editingActions.categories[categoryKey]
    if (!category) return

    const action = category.actions[actionKey]
    if (!action) return

    if (gameState.neuralPulses < action.cost) {
      alert("Недостаточно Neural Pulses!")
      return
    }

    setGameState((prev) => {
      const newState = { ...prev }
      newState.neuralPulses -= action.cost

      const talentIndex = newState.talents.findIndex((t) => t.id === talentId)
      if (talentIndex === -1) return prev

      const talent = { ...newState.talents[talentIndex] }

      // Применяем основные эффекты
      if (action.effects) {
        if (action.effects.states) {
          Object.entries(action.effects.states).forEach(([key, value]) => {
            talent.states[key as keyof typeof talent.states] = Math.max(
              0,
              Math.min(5, talent.states[key as keyof typeof talent.states] + (value as number)),
            )
          })
        }
        if (action.effects.skills) {
          Object.entries(action.effects.skills).forEach(([key, value]) => {
            talent.skills[key as keyof typeof talent.skills] = Math.max(
              0,
              Math.min(5, talent.skills[key as keyof typeof talent.skills] + (value as number)),
            )
          })
        }
        if (action.effects.attributes) {
          Object.entries(action.effects.attributes).forEach(([key, value]) => {
            talent.attributes[key as keyof typeof talent.attributes] = Math.max(
              0,
              Math.min(5, talent.attributes[key as keyof typeof talent.attributes] + (value as number)),
            )
          })
        }
      }

      // Проверяем риск
      if (action.risk && Math.random() * 100 < action.risk && action.riskEffects) {
        if (action.riskEffects.states) {
          Object.entries(action.riskEffects.states).forEach(([key, value]) => {
            talent.states[key as keyof typeof talent.states] = Math.max(
              0,
              Math.min(5, talent.states[key as keyof typeof talent.states] + (value as number)),
            )
          })
        }
        if (action.riskEffects.skills) {
          Object.entries(action.riskEffects.skills).forEach(([key, value]) => {
            talent.skills[key as keyof typeof talent.skills] = Math.max(
              0,
              Math.min(5, talent.skills[key as keyof typeof talent.skills] + (value as number)),
            )
          })
        }
        if (action.riskEffects.attributes) {
          Object.entries(action.riskEffects.attributes).forEach(([key, value]) => {
            talent.attributes[key as keyof typeof talent.attributes] = Math.max(
              0,
              Math.min(5, talent.attributes[key as keyof typeof talent.attributes] + (value as number)),
            )
          })
        }
      }

      // Добавляем воспоминание
      const memory = {
        id: `mem_${generateUniqueId()}`,
        type: talent.states.mood > 2 ? "positive" : ("professional" as const),
        summary: `${action.title}: ${action.description}`,
        intensity: 1,
        tags: [action.title],
        effects: {},
        createdDay: newState.day,
      }
      talent.memories = [...talent.memories, memory].slice(-10)

      newState.talents[talentIndex] = talent
      return newState
    })
  }

  const handleAddItem = (type: string, category?: string) => {
    let newItem: any = {}

    switch (type) {
      case "action":
        newItem = {
          title: "Новое действие",
          description: "Описание нового действия",
          cost: 1,
          risk: 0,
          effects: { states: {}, attributes: {}, skills: {} },
        }
        break
      case "category":
        newItem = {
          title: "Новая категория",
          description: "Описание новой категории",
        }
        break
      case "talent":
        newItem = {
          name: "Новый талант",
          avatar: "👤",
          rank: "Новичок",
          cost: 100,
          description: "Описание нового таланта",
          attributes: { strength: 1, empathy: 1, intelligence: 1, temperament: 1, grit: 1, ego: 1 },
          skills: {
            office: 1,
            negotiation: 1,
            technical: 1,
            vr: 1,
            field: 1,
            etiquette: 1,
            logistics: 1,
            medical: 1,
            maintenance: 1,
            data: 1,
            stage: 1,
          },
        }
        break
      case "contract":
        newItem = {
          title: "Новый контракт",
          client: "Новый клиент",
          description: "Описание нового контракта",
          duration: 7,
          reward: 500,
          reputation: 10,
          requirements: { minRank: "Новичок" },
        }
        break
      case "event":
        newItem = {
          title: "Новое событие",
          type: "neutral",
          description: "Описание нового события",
          probability: 50,
          duration: 1,
        }
        break
      case "equipment":
        newItem = {
          name: "Новое оборудование",
          type: "clothing",
          slot: "body",
          description: "Описание нового оборудования",
          removable: true,
          effects: {},
          powerSettings: { min: 0, max: 100, default: 100 },
          modes: [],
        }
        break
      case "scene":
        newItem = {
          id: `scene-${generateUniqueId()}`,
          title: "Новая сцена",
          category: "market",
          image: "/placeholder.svg",
          description: "Описание новой сцены",
          choices: [],
          outcomes: [],
        }
        break
      case "market-section":
        newItem = {
          id: `section-${generateUniqueId()}`,
          name: "Новая секция рынка",
          description: "Описание новой секции",
          icon: "🏪",
          baseCost: 1000,
          costMultiplier: 1.0,
          riskLevel: 0,
          availableActions: ["hire", "trade"],
          requirements: {},
          specialFeatures: [],
        }
        break
      case "market-talent":
        newItem = {
          id: `talent-${generateUniqueId()}`,
          name: "Новый рыночный талант",
          role: "Специалист",
          level: 1,
          baseCost: 500,
          riskFactors: [],
          attributes: {
            strength: 50,
            empathy: 50,
            intelligence: 50,
            creativity: 50,
            temperament: 50,
            grit: 50,
            ego: 50,
          },
          skills: {
            office: 50,
            negotiation: 50,
            technical: 50,
            vr: 50,
            field: 50,
            etiquette: 50,
            logistics: 50,
            medical: 50,
            maintenance: 50,
            data: 50,
            stage: 50,
          },
          statusEffects: [],
          availability: { minDay: 1, maxDay: 365, probability: 0.5 },
        }
        break
      case "market-condition":
        newItem = {
          id: `condition-${generateUniqueId()}`,
          name: "Новое условие",
          type: "requirement",
          description: "Описание условия",
          parameters: {},
          effects: {},
        }
        break
    }

    setEditDialog({
      type: type,
      item: newItem,
      isNew: true,
      category: category,
    })
  }

  const handleEditItem = (type: string, item: any, category?: string) => {
    setEditDialog({
      type: type,
      item: { ...item },
      isNew: false,
      category: category,
    })
    setEditingItem(item)
    setEditingType(type)
  }

  const handleAddCategory = () => {
    const newCategory = {
      title: "Новая категория",
      description: "Описание новой категории",
      actions: {},
    }
    setEditDialog({
      type: "category",
      item: newCategory,
      isNew: true,
    })
  }

  const handleEditCategory = (categoryKey: string, category: any) => {
    setEditDialog({
      type: "category",
      item: { ...category, key: categoryKey },
      isNew: false,
      categoryKey,
    })
  }

  const getItemTypeName = (type: string) => {
    const names = {
      action: "действие",
      category: "категорию",
      talent: "талант",
      contract: "контракт",
      event: "событие",
      equipment: "оборудование",
      "market-section": "секцию рынка",
      scene: "сцену",
    }
    return names[type as keyof typeof names] || type
  }

  const handleSaveItem = () => {
    if (!editDialog) return

    const { type, item, categoryKey, isNew } = editDialog

    switch (type) {
      case "category":
        setEditingActions((prev) => {
          const updatedCategories = { ...prev.categories }
          if (isNew) {
            const newKey = `category_${generateUniqueId()}`
            updatedCategories[newKey] = {
              title: item.title,
              description: item.description,
              actions: {},
            }
          } else if (categoryKey) {
            updatedCategories[categoryKey] = {
              title: item.title,
              description: item.description,
              actions: prev.categories[categoryKey]?.actions || {},
            }
          }
          return { ...prev, categories: updatedCategories }
        })
        break

      case "action":
        if (categoryKey) {
          setEditingActions((prev) => {
            const updatedCategories = { ...prev.categories }
            updatedCategories[categoryKey] = {
              ...updatedCategories[categoryKey],
              actions: {
                ...updatedCategories[categoryKey]?.actions,
                [item.key || `action_${generateUniqueId()}`]: item,
              },
            }
            return { ...prev, categories: updatedCategories }
          })
        }
        break

      case "talent":
        setEditingMarket((prev) => ({
          ...prev,
          talentExchange: prev.talentExchange.map((t: any) => (t.id === item.id ? item : t)),
        }))
        break

      case "contract":
        setEditingContracts((prev) => ({
          ...prev,
          available: prev.available.map((c: any) => (c.id === item.id ? item : c)),
        }))
        break

      case "event":
        setEditingEvents((prev) => ({
          ...prev,
          events: prev.events.map((e: any) => (e.id === item.id ? item : e)),
        }))
        break

      case "equipment":
        setEditingEquipment((prev) => ({
          ...prev,
          equipment: prev.equipment.map((e: any) => (e.id === item.id ? item : e)),
        }))
        break
    }

    setEditDialog(null)
  }

  const handleDeleteItem = (type: string, itemId: string) => {
    if (type === "contract") {
      setEditingContracts((prev) => ({
        ...prev,
        available: prev.available.filter((c: any) => c.id !== itemId),
      }))
    } else if (type === "event") {
      setEditingEvents((prev) => ({
        ...prev,
        events: prev.events.filter((e: any) => e.id !== itemId),
      }))
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground cyber-grid">
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between glass-panel p-6 rounded-lg">
          <div>
            <h1 className="text-4xl font-bold text-primary pulse-neon">🚀 Talent Architect</h1>
            <p className="mt-2 text-muted-foreground">Этичное управление талантами на станции Nexus Prime</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setIsDarkMode(!isDarkMode)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 glass-panel"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDarkMode ? "Светлая" : "Темная"}
            </Button>
            <Button
              onClick={() => setIsEditMode(!isEditMode)}
              variant={isEditMode ? "destructive" : "outline"}
              className="flex items-center gap-2 glass-panel"
            >
              {isEditMode ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              {isEditMode ? "Выйти из редактирования" : "Режим редактирования"}
            </Button>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">День {gameState.day}</div>
              <div className="text-sm text-muted-foreground">Текущий цикл</div>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-accent">{gameState.neuralPulses} НП</div>
              <div className="text-sm text-muted-foreground">Neural Pulses</div>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-chart-4">{gameState.credits} ₵</div>
              <div className="text-sm text-muted-foreground">Кредиты</div>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-chart-5">{gameState.reputation}</div>
              <div className="text-sm text-muted-foreground">Репутация</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-10 glass-panel">
            <TabsTrigger value="talents" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Таланты
            </TabsTrigger>
            <TabsTrigger value="attributes" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Атрибуты
            </TabsTrigger>
            <TabsTrigger value="market" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Рынок
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Контракты
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              События
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Оборудование
            </TabsTrigger>
            <TabsTrigger value="scenes" className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              Сцены
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Cog className="h-4 w-4" />
              Система
            </TabsTrigger>
            <TabsTrigger value="main-actions" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Основные действия
            </TabsTrigger>
            <TabsTrigger value="main-market" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Основной рынок
            </TabsTrigger>
            <TabsTrigger value="main-contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Основные контракты
            </TabsTrigger>
            <TabsTrigger value="main-events" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Основные события
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Настройки
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Статистика
            </TabsTrigger>
          </TabsList>

          <TabsContent value="talents" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {gameState.talents.map((talent) => (
                <Card key={talent.id} className="glass-panel hologram-shimmer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-primary">{talent.name}</CardTitle>
                      <Badge className={getRankColor(talent.rank)} variant="secondary">
                        {talent.rank}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{talent.specialization}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      {/* Базовые атрибуты */}
                      <div>
                        <h4 className="font-semibold mb-3 text-primary">Базовые атрибуты</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {Object.entries(talent.attributes || {}).map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <div className="text-sm text-muted-foreground capitalize">{key}</div>
                              <Progress value={(value / 5) * 100} className="h-2" />
                              <div className="text-xs text-center text-foreground">{value}/5</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Состояния */}
                      <div>
                        <h4 className="font-semibold mb-3 text-chart-4">Текущие состояния</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(talent.states || {}).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between p-2 bg-muted/20 rounded glass-panel"
                            >
                              <span className="text-sm capitalize text-foreground">{key}</span>
                              <span className={`font-semibold ${getStateColor(value, key as any)}`}>{value}/5</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Навыки */}
                      <div>
                        <h4 className="font-semibold mb-3 text-accent">Профессиональные навыки</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {Object.entries(talent.skills || {}).map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <div className="text-sm text-muted-foreground capitalize">{key}</div>
                              <Progress value={(value / 5) * 100} className="h-2" />
                              <div className="text-xs text-center text-foreground">{value}/5</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-chart-5">Взаимодействия</h4>
                          <Badge variant="outline" className="text-xs">
                            {gameState.neuralPulses} НП доступно
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          {Object.entries(editingActions.categories || {}).map(([categoryKey, category]) => (
                            <Collapsible key={categoryKey}>
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" className="w-full justify-between bg-transparent">
                                  <span>{category.title}</span>
                                  <div className="flex items-center gap-2">
                                    {isEditMode && (
                                      <>
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleEditCategory(categoryKey, category)
                                          }}
                                          size="sm"
                                          variant="ghost"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleAddItem("action", categoryKey)
                                          }}
                                          size="sm"
                                          variant="ghost"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                    <ChevronDown className="h-4 w-4" />
                                  </div>
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 mt-2">
                                <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                                {Object.entries(category.actions || {}).map(([actionKey, action]) => (
                                  <div
                                    key={actionKey}
                                    className="flex items-center justify-between p-3 bg-muted/10 rounded-lg glass-panel"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-foreground">{action.title}</span>
                                        <Badge variant="secondary">{action.cost} НП</Badge>
                                        {action.risk && <Badge variant="destructive">Риск {action.risk}%</Badge>}
                                      </div>
                                      <p className="text-sm text-muted-foreground mb-2">{action.description}</p>
                                      {action.effects && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Эффекты:{" "}
                                          {Object.entries(action.effects || {})
                                            .filter(([key, value]) => value !== undefined && value !== null)
                                            .map(
                                              ([key, value]) =>
                                                `${key} ${typeof value === "number" && value > 0 ? "+" : ""}${value}`,
                                            )
                                            .join(", ")}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isEditMode && (
                                        <Button
                                          onClick={() =>
                                            handleEditItem("action", { ...action, key: actionKey }, categoryKey)
                                          }
                                          size="sm"
                                          variant="outline"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      )}
                                      <Button
                                        onClick={() => performAction(talent.id, categoryKey, actionKey)}
                                        disabled={gameState.neuralPulses < action.cost}
                                        size="sm"
                                      >
                                        Выполнить
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </div>
                      </div>

                      {/* Воспоминания */}
                      <div>
                        <h4 className="font-semibold mb-3 text-chart-5">Воспоминания</h4>
                        <div className="space-y-2">
                          {talent.memories.slice(-3).map(
                            (memory) =>
                              memory && (
                                <div key={memory.id} className="p-3 bg-muted/10 rounded-lg glass-panel">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge
                                      variant={
                                        memory.type === "positive"
                                          ? "default"
                                          : memory.type === "traumatic"
                                            ? "destructive"
                                            : "secondary"
                                      }
                                    >
                                      День {memory.createdDay}
                                    </Badge>
                                    <span className="text-sm font-medium text-foreground">
                                      {memory.summary.split(":")[0]}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{memory.summary}</p>
                                </div>
                              ),
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="attributes" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Редактирование атрибутов талантов</h2>
            </div>

            <div className="grid gap-6">
              {gameState.talents.map((talent) => (
                <Card key={talent.id} className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <span className="text-2xl">{talent.avatar}</span>
                      {talent.name}
                      <Badge className={getRankColor(talent.rank)} variant="secondary">
                        {talent.rank}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{talent.specialization}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Базовые атрибуты */}
                    <div>
                      <h4 className="font-semibold mb-4 text-primary">Базовые атрибуты</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(talent.attributes || {}).map(([key, value]) => (
                          <div key={key} className="space-y-2">
                            <label className="text-sm font-medium capitalize">{key}</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={value}
                                onChange={(e) => {
                                  const newValue = Number.parseInt(e.target.value)
                                  setGameState((prev) => ({
                                    ...prev,
                                    talents: prev.talents.map((t) =>
                                      t.id === talent.id
                                        ? { ...t, attributes: { ...t.attributes, [key]: newValue } }
                                        : t,
                                    ),
                                  }))
                                }}
                                className="flex-1"
                              />
                              <span className="text-sm font-semibold w-8 text-center">{value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Состояния */}
                    <div>
                      <h4 className="font-semibold mb-4 text-chart-4">Текущие состояния</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(talent.states || {}).map(([key, value]) => (
                          <div key={key} className="space-y-2">
                            <label className="text-sm font-medium capitalize">{key}</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="5"
                                value={value}
                                onChange={(e) => {
                                  const newValue = Number.parseInt(e.target.value)
                                  setGameState((prev) => ({
                                    ...prev,
                                    talents: prev.talents.map((t) =>
                                      t.id === talent.id ? { ...t, states: { ...t.states, [key]: newValue } } : t,
                                    ),
                                  }))
                                }}
                                className="flex-1"
                              />
                              <span className="text-sm font-semibold w-8 text-center">{value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Навыки */}
                    <div>
                      <h4 className="font-semibold mb-4 text-accent">Профессиональные навыки</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(talent.skills || {}).map(([key, value]) => (
                          <div key={key} className="space-y-2">
                            <label className="text-sm font-medium capitalize">{key}</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={value}
                                onChange={(e) => {
                                  const newValue = Number.parseInt(e.target.value)
                                  setGameState((prev) => ({
                                    ...prev,
                                    talents: prev.talents.map((t) =>
                                      t.id === talent.id ? { ...t, skills: { ...t.skills, [key]: newValue } } : t,
                                    ),
                                  }))
                                }}
                                className="flex-1"
                              />
                              <span className="text-sm font-semibold w-8 text-center">{value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Основная информация */}
                    <div>
                      <h4 className="font-semibold mb-4">Основная информация</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Имя</label>
                          <input
                            type="text"
                            value={talent.name}
                            onChange={(e) => {
                              setGameState((prev) => ({
                                ...prev,
                                talents: prev.talents.map((t) =>
                                  t.id === talent.id ? { ...t, name: e.target.value } : t,
                                ),
                              }))
                            }}
                            className="w-full px-3 py-2 bg-muted/20 border border-border rounded-md"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Специализация</label>
                          <input
                            type="text"
                            value={talent.specialization || ""}
                            onChange={(e) => {
                              setGameState((prev) => ({
                                ...prev,
                                talents: prev.talents.map((t) =>
                                  t.id === talent.id ? { ...t, specialization: e.target.value } : t,
                                ),
                              }))
                            }}
                            className="w-full px-3 py-2 bg-muted/20 border border-border rounded-md"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Ранг</label>
                          <select
                            value={talent.rank}
                            onChange={(e) => {
                              setGameState((prev) => ({
                                ...prev,
                                talents: prev.talents.map((t) =>
                                  t.id === talent.id ? { ...t, rank: e.target.value } : t,
                                ),
                              }))
                            }}
                            className="w-full px-3 py-2 bg-muted/20 border border-border rounded-md"
                          >
                            <option value="F">F</option>
                            <option value="D">D</option>
                            <option value="C">C</option>
                            <option value="B">B</option>
                            <option value="A">A</option>
                            <option value="S">S</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Аватар</label>
                          <input
                            type="text"
                            value={talent.avatar}
                            onChange={(e) => {
                              setGameState((prev) => ({
                                ...prev,
                                talents: prev.talents.map((t) =>
                                  t.id === talent.id ? { ...t, avatar: e.target.value } : t,
                                ),
                              }))
                            }}
                            className="w-full px-3 py-2 bg-muted/20 border border-border rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="market" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Рынок талантов</h2>
              {isEditMode && (
                <div className="flex gap-2">
                  <Button onClick={() => handleAddItem("market-section")} size="sm">
                    <Plus className="h-4 w-4" />
                    Добавить секцию
                  </Button>
                  <Button onClick={() => handleAddItem("market-talent")} size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                    Добавить талант
                  </Button>
                </div>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-300">Источники новых талантов и услуг</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Talent Exchange */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        🏢 Talent Exchange (Core)
                        {isEditMode && (
                          <Button
                            onClick={() =>
                              handleEditItem("market-section", {
                                id: "talent-exchange",
                                name: "Talent Exchange (Core)",
                                description:
                                  "Биржа талантов в Core Sector. Высококачественные кандидаты с низкой тревожностью.",
                                icon: "🏢",
                                baseCost: 1000,
                                costMultiplier: 1.0,
                                riskLevel: 5,
                                availableActions: ["hire", "browse", "refresh"],
                                requirements: { minReputation: 0 },
                                specialFeatures: ["quality_guarantee", "low_anxiety"],
                              })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Биржа талантов в Core Sector. Высококачественные кандидаты с низкой тревожностью.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Базовая стоимость: 1000 ₵</div>
                      <div>Уровень риска: 5%</div>
                      <div>Качество: Высокое</div>
                      <div>Доступность: Всегда</div>
                    </div>

                    {isEditMode && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Доступные таланты:</h4>
                        {/* Добавляю дополнительную проверку для editingMarket */}
                        {(editingMarket?.talentExchange || []).map((talent: any, index: number) => (
                          <div
                            key={talent.id || index}
                            className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded"
                          >
                            <span className="text-sm">{talent.name}</span>
                            <div className="flex gap-1">
                              <Button onClick={() => handleEditItem("market-talent", talent)} size="sm" variant="ghost">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingMarket((prev) => ({
                                    ...prev,
                                    talentExchange: prev?.talentExchange?.filter((_, i) => i !== index) || [],
                                  }))
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                <Trash className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          onClick={() => handleAddItem("market-talent")}
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          <Plus className="h-4 w-4" />
                          Добавить талант
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Void Rescues */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        🌌 Void Rescues
                        {isEditMode && (
                          <Button
                            onClick={() =>
                              handleEditItem("market-section", {
                                id: "void-rescues",
                                name: "Void Rescues",
                                description:
                                  "Спасательные операции в Void Border. Риск аномалий, но уникальные таланты.",
                                icon: "🌌",
                                baseCost: 800,
                                costMultiplier: 0.7,
                                riskLevel: 40,
                                availableActions: ["rescue", "scan", "emergency"],
                                requirements: { minLevel: 3 },
                                specialFeatures: ["unique_talents", "high_risk", "story_scenes"],
                              })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Спасательные операции в Void Border. Риск аномалий, но уникальные таланты.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Базовая стоимость: 800 ₵</div>
                      <div>Уровень риска: 40%</div>
                      <div>Скидка: 30%</div>
                      <div>Сюжетные сцены: Да</div>
                    </div>

                    {isEditMode && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Условия и риски:</h4>
                        <div className="space-y-1 text-xs">
                          <div>• 40% шанс получить травму</div>
                          <div>• 25% шанс провала операции</div>
                          <div>• 15% шанс найти уникальный талант</div>
                          <div>• Требуется минимум 3 уровень</div>
                        </div>
                        <Button
                          onClick={() => handleAddItem("market-condition")}
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          <Plus className="h-4 w-4" />
                          Добавить условие
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Corporate Contracts */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        🏛️ Corporate Contracts
                        {isEditMode && (
                          <Button
                            onClick={() =>
                              handleEditItem("market-section", {
                                id: "corporate-contracts",
                                name: "Corporate Contracts",
                                description: "Корпоративные программы развития. Кандидаты прикреплены к проектам.",
                                icon: "🏛️",
                                baseCost: 1200,
                                costMultiplier: 1.3,
                                riskLevel: 10,
                                availableActions: ["hire", "negotiate", "review"],
                                requirements: { minReputation: 50 },
                                specialFeatures: ["corporate_training", "project_attached", "high_cost"],
                              })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Корпоративные программы развития. Кандидаты прикреплены к проектам.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Базовая стоимость: 1200 ₵</div>
                      <div>Уровень риска: 10%</div>
                      <div>Наценка: 30%</div>
                      <div>Мин. репутация: 50</div>
                    </div>

                    {isEditMode && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Особенности:</h4>
                        <div className="space-y-1 text-xs">
                          <div>• Таланты с корпоративной подготовкой</div>
                          <div>• Привязаны к долгосрочным проектам</div>
                          <div>• Высокая стоимость, но гарантированное качество</div>
                          <div>• Возможность переговоров о цене</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Neural Forge */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        🧠 Neural Forge
                        {isEditMode && (
                          <Button
                            onClick={() =>
                              handleEditItem("market-section", {
                                id: "neural-forge",
                                name: "Neural Forge",
                                description: "Кастомизация талантов. Настройка аффинностей и базовых навыков.",
                                icon: "🧠",
                                baseCost: 2000,
                                costMultiplier: 2.0,
                                riskLevel: 20,
                                availableActions: ["customize", "forge", "enhance"],
                                requirements: { minLevel: 5, minCredits: 5000 },
                                specialFeatures: ["custom_creation", "attribute_selection", "skill_allocation"],
                              })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Кастомизация талантов. Настройка аффинностей и базовых навыков.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Базовая стоимость: 2000 ₵</div>
                      <div>Уровень риска: 20%</div>
                      <div>Множитель: x2.0</div>
                      <div>Мин. уровень: 5</div>
                    </div>

                    {isEditMode && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Параметры кастомизации:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Очки атрибутов: 300</div>
                          <div>Очки навыков: 400</div>
                          <div>Макс. атрибут: 95</div>
                          <div>Макс. навык: 90</div>
                        </div>
                        <Button
                          onClick={() =>
                            handleEditItem("market-condition", {
                              id: "forge-params",
                              name: "Параметры Neural Forge",
                              type: "customization",
                              parameters: {
                                attributePoints: 300,
                                skillPoints: 400,
                                maxAttribute: 95,
                                maxSkill: 90,
                                riskOfFailure: 20,
                              },
                            })
                          }
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          <Settings className="h-4 w-4" />
                          Настроить параметры
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {isEditMode && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Глобальные настройки рынка</CardTitle>
                  <CardDescription>Общие параметры, влияющие на все секции рынка</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Экономические параметры</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Базовая инфляция:</label>
                          <Input type="number" defaultValue="2" className="w-16" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Множитель репутации:</label>
                          <Input type="number" step="0.1" defaultValue="1.0" className="w-16" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Скидка за лояльность:</label>
                          <Input type="number" defaultValue="5" className="w-16" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Временные параметры</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Обновление списка:</label>
                          <Input type="number" defaultValue="3" className="w-16" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Время сделки:</label>
                          <Input type="number" defaultValue="1" className="w-16" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Кулдаун секции:</label>
                          <Input type="number" defaultValue="7" className="w-16" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Вероятности событий</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Сюжетная сцена:</label>
                          <Input type="number" defaultValue="30" className="w-16" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Особый талант:</label>
                          <Input type="number" defaultValue="15" className="w-16" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm">Скидка дня:</label>
                          <Input type="number" defaultValue="20" className="w-16" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Контракты</h2>
              {isEditMode && (
                <Button onClick={() => handleAddItem("contract")} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить контракт
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(editingContracts.available || []).map((contract: any) => (
                <Card key={contract.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{contract.title}</CardTitle>

                        <CardDescription className="text-gray-400">{contract.client}</CardDescription>
                      </div>
                      {isEditMode && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditItem("contract", contract)}>
                            Редактировать
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteItem("contract", contract.id)}
                          >
                            Удалить
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-300">{contract.description}</p>

                    {contract.storyScenes && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-200">Сюжетные сцены:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {contract.storyScenes.onAccept && (
                            <div>
                              <span className="text-green-400">При принятии:</span>
                              <div className="text-gray-400">{contract.storyScenes.onAccept.join(", ")}</div>
                            </div>
                          )}
                          {contract.storyScenes.onProgress && (
                            <div>
                              <span className="text-blue-400">В процессе:</span>
                              <div className="text-gray-400">{contract.storyScenes.onProgress.join(", ")}</div>
                            </div>
                          )}
                          {contract.storyScenes.onComplete && (
                            <div>
                              <span className="text-green-400">При завершении:</span>
                              <div className="text-gray-400">{contract.storyScenes.onComplete.join(", ")}</div>
                            </div>
                          )}
                          {contract.storyScenes.onFail && (
                            <div>
                              <span className="text-red-400">При провале:</span>
                              <div className="text-gray-400">{contract.storyScenes.onFail.join(", ")}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Button className="w-full">Принять контракт</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">События</h2>
              {isEditMode && (
                <Button onClick={() => handleAddItem("event")} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить событие
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(editingEvents).map(([category, events]) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-lg font-semibold capitalize">{category}</h3>
                  {(events as any[]).map((event: any) => (
                    <Card key={event.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                          {isEditMode && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEditItem("event", event)}>
                                Редактировать
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteItem("event", event.id)}
                              >
                                Удалить
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-300 text-sm mb-3">{event.description}</p>

                        {event.storyScenes && event.storyScenes.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-200">Сюжетные сцены:</h4>
                            <div className="flex flex-wrap gap-1">
                              {event.storyScenes.map((sceneId: string) => (
                                <span
                                  key={sceneId}
                                  className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded"
                                >
                                  {sceneId}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-400 mt-2">Вероятность: {event.probability * 100}%</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Оборудование</h2>
              {isEditMode && (
                <Button onClick={() => handleAddItem("equipment")} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить оборудование
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              {editingEquipment.equipment?.map((item: any, index: number) => (
                <Card key={item.id || index} className="glass-panel">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{item.name}</h3>
                          <Badge
                            variant={
                              item?.type === "implant"
                                ? "destructive"
                                : item?.type === "device"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {item?.type || "unknown"}
                          </Badge>
                          <Badge variant="outline">{item.slot}</Badge>
                          {!item.removable && <Badge variant="destructive">Несъемный</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{item.description}</p>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Эффекты:</span>
                            <div className="mt-1">
                              {Object.entries(item.effects || {}).map(([stat, value]: [string, any]) => (
                                <div key={stat} className="text-xs">
                                  {stat}: {value > 0 ? "+" : ""}
                                  {value}
                                </div>
                              ))}
                            </div>
                          </div>

                          {item.powerSettings && (
                            <div>
                              <span className="font-medium">Настройки мощности:</span>
                              <div className="mt-1 text-xs">
                                <div>Мин: {item.powerSettings.min}%</div>
                                <div>Макс: {item.powerSettings.max}%</div>
                                <div>По умолчанию: {item.powerSettings.default}%</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {item.modes && item.modes.length > 0 && (
                          <div className="mt-3">
                            <span className="font-medium text-sm">Режимы:</span>
                            <div className="flex gap-1 mt-1">
                              {item.modes.map((mode: string) => (
                                <Badge key={mode} variant="outline" className="text-xs">
                                  {mode}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {isEditMode && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditItem("equipment", item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setEditingEquipment((prev) => ({
                                ...prev,
                                equipment: prev.equipment.filter((_: any, i: number) => i !== index),
                              }))
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {activeTab === "scenes" && (
            <TabsContent value="scenes" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Сюжетные сцены</h2>
                <div className="space-x-2">
                  <Button onClick={() => setShowStoryPointsManager(true)} variant="outline">
                    Сюжетные точки
                  </Button>
                  <Button
                    onClick={() => {
                      const newScene = {
                        id: `scene_${generateUniqueId()}`,
                        title: "Новая сцена",
                        description: "Описание новой сцены",
                        triggerConditions: [],
                        probability: 100,
                        screens: [
                          {
                            id: "start",
                            title: "Начальный экран",
                            background: "",
                            description: "",
                            choices: [],
                          },
                        ],
                      }
                      setEditingScenes((prev) => ({
                        ...prev,
                        scenes: [...prev.scenes, newScene],
                      }))
                    }}
                  >
                    Добавить сцену
                  </Button>
                  <Button
                    onClick={() => {
                      const dataStr = JSON.stringify(editingScenes, null, 2)
                      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
                      const exportFileDefaultName = "story-scenes.json"
                      const linkElement = document.createElement("a")
                      linkElement.setAttribute("href", dataUri)
                      linkElement.setAttribute("download", exportFileDefaultName)
                      linkElement.click()
                    }}
                    variant="outline"
                  >
                    Экспорт JSON
                  </Button>
                </div>
              </div>

              {showStoryPointsManager && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                  <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-gray-900 border-gray-700">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-white">Управление сюжетными точками</CardTitle>
                        <Button variant="ghost" onClick={() => setShowStoryPointsManager(false)}>
                          ×
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(editingScenes.storyPoints || {}).map(([pointId, point]) => (
                          <Card key={pointId} className="p-4 bg-gray-800 border-gray-600">
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-white">{point.name}</h3>
                                <span className="text-cyan-400 font-mono">
                                  {storyPoints[pointId] || point.defaultValue}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">{point.description}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  {point.minValue} - {point.maxValue}
                                </span>
                                <input
                                  type="range"
                                  min={point.minValue}
                                  max={point.maxValue}
                                  value={storyPoints[pointId] || point.defaultValue}
                                  onChange={(e) => {
                                    setStoryPoints((prev) => ({
                                      ...prev,
                                      [pointId]: Number.parseInt(e.target.value),
                                    }))
                                  }}
                                  className="flex-1"
                                />
                                <Input
                                  type="number"
                                  min={point.minValue}
                                  max={point.maxValue}
                                  value={storyPoints[pointId] || point.defaultValue}
                                  onChange={(e) => {
                                    const value = Math.max(
                                      point.minValue,
                                      Math.min(point.maxValue, Number.parseInt(e.target.value) || 0),
                                    )
                                    setStoryPoints((prev) => ({
                                      ...prev,
                                      [pointId]: value,
                                    }))
                                  }}
                                  className="w-20 bg-gray-700 border-gray-600 text-white"
                                />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                      <Button
                        onClick={() => {
                          // Сброс всех сюжетных точек к значениям по умолчанию
                          const resetPoints = {}
                          Object.entries(editingScenes.storyPoints || {}).forEach(([pointId, point]) => {
                            resetPoints[pointId] = point.defaultValue
                          })
                          setStoryPoints(resetPoints)
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Сбросить к значениям по умолчанию
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedSceneId && selectedScreenId ? "Экраны сцены" : "Список сцен"}
                      {selectedSceneId && !selectedScreenId && (
                        <Button size="sm" variant="ghost" onClick={() => setSelectedSceneId(null)} className="ml-2">
                          ← Назад к сценам
                        </Button>
                      )}
                      {selectedScreenId && (
                        <Button size="sm" variant="ghost" onClick={() => setSelectedScreenId(null)} className="ml-2">
                          ← Назад к экранам
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedSceneId
                      ? // Список сцен
                        editingScenes.scenes?.map((scene) => (
                          <div
                            key={scene.id}
                            className="p-4 border border-gray-600 rounded-lg cursor-pointer transition-colors hover:border-gray-500 bg-gray-800"
                            onClick={() => setSelectedSceneId(scene.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold text-white">{scene.title}</h3>
                                <p className="text-sm text-gray-400">ID: {scene.id}</p>
                                <p className="text-sm text-gray-300 mt-1">{scene.description}</p>
                                <p className="text-xs text-gray-400 mt-1">Экранов: {scene.screens?.length || 0}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingScenes((prev) => ({
                                    ...prev,
                                    scenes: prev.scenes.filter((s) => s.id !== scene.id),
                                  }))
                                  if (selectedSceneId === scene.id) {
                                    setSelectedSceneId(null)
                                  }
                                }}
                              >
                                Удалить
                              </Button>
                            </div>
                          </div>
                        ))
                      : // Список экранов выбранной сцены
                        (() => {
                          const scene = editingScenes.scenes?.find((s) => s.id === selectedSceneId)
                          return scene?.screens?.map((screen) => (
                            <div
                              key={screen.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                selectedScreenId === screen.id
                                  ? "border-cyan-500 bg-cyan-900/20"
                                  : "border-gray-600 hover:border-gray-500 bg-gray-800"
                              }`}
                              onClick={() => setSelectedScreenId(screen.id)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold text-white">{screen.title}</h3>
                                  <p className="text-sm text-gray-400">ID: {screen.id}</p>
                                  <p className="text-sm text-gray-300 mt-1">{screen.description}</p>
                                  <p className="text-xs text-gray-400 mt-1">Выборов: {screen.choices?.length || 0}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const newScreen = {
                                        id: `screen_${generateUniqueId()}`,
                                        title: "Новый экран",
                                        background: "",
                                        description: "",
                                        choices: [],
                                      }
                                      setEditingScenes((prev) => ({
                                        ...prev,
                                        scenes: prev.scenes.map((s) =>
                                          s.id === selectedSceneId
                                            ? { ...s, screens: [...(s.screens || []), newScreen] }
                                            : s,
                                        ),
                                      }))
                                    }}
                                  >
                                    + Экран
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingScenes((prev) => ({
                                        ...prev,
                                        scenes: prev.scenes.map((s) =>
                                          s.id === selectedSceneId
                                            ? { ...s, screens: s.screens?.filter((sc) => sc.id !== screen.id) || [] }
                                            : s,
                                        ),
                                      }))
                                      if (selectedScreenId === screen.id) {
                                        setSelectedScreenId(null)
                                      }
                                    }}
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        })()}
                  </CardContent>
                </Card>

                {selectedSceneId && selectedScreenId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Редактирование экрана</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const scene = editingScenes.scenes?.find((s) => s.id === selectedSceneId)
                        const screen = scene?.screens?.find((sc) => sc.id === selectedScreenId)
                        if (!screen) return <p>Экран не найден</p>

                        return (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-200">Название экрана</label>
                              <Input
                                value={screen.title}
                                className="bg-gray-800 border-gray-600 text-white"
                                onChange={(e) => {
                                  setEditingScenes((prev) => ({
                                    ...prev,
                                    scenes: prev.scenes.map((s) =>
                                      s.id === selectedSceneId
                                        ? {
                                            ...s,
                                            screens: s.screens?.map((sc) =>
                                              sc.id === selectedScreenId ? { ...sc, title: e.target.value } : sc,
                                            ),
                                          }
                                        : s,
                                    ),
                                  }))
                                }}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-200">Фон (PNG/GIF)</label>
                              <Input
                                value={screen.background}
                                placeholder="/path/to/background.png"
                                className="bg-gray-800 border-gray-600 text-white"
                                onChange={(e) => {
                                  setEditingScenes((prev) => ({
                                    ...prev,
                                    scenes: prev.scenes.map((s) =>
                                      s.id === selectedSceneId
                                        ? {
                                            ...s,
                                            screens: s.screens?.map((sc) =>
                                              sc.id === selectedScreenId ? { ...sc, background: e.target.value } : sc,
                                            ),
                                          }
                                        : s,
                                    ),
                                  }))
                                }}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-200">Описание</label>
                              <textarea
                                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                rows={3}
                                value={screen.description}
                                onChange={(e) => {
                                  setEditingScenes((prev) => ({
                                    ...prev,
                                    scenes: prev.scenes.map((s) =>
                                      s.id === selectedSceneId
                                        ? {
                                            ...s,
                                            screens: s.screens?.map((sc) =>
                                              sc.id === selectedScreenId ? { ...sc, description: e.target.value } : sc,
                                            ),
                                          }
                                        : s,
                                    ),
                                  }))
                                }}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-200">Варианты выбора</label>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const newChoice = {
                                      id: `choice_${generateUniqueId()}`,
                                      text: "Новый выбор",
                                      consequences: [],
                                      navigation: { type: "end_scene" },
                                    }
                                    setEditingScenes((prev) => ({
                                      ...prev,
                                      scenes: prev.scenes.map((s) =>
                                        s.id === selectedSceneId
                                          ? {
                                              ...s,
                                              screens: s.screens?.map((sc) =>
                                                sc.id === selectedScreenId
                                                  ? { ...sc, choices: [...(sc.choices || []), newChoice] }
                                                  : sc,
                                              ),
                                            }
                                          : s,
                                      ),
                                    }))
                                  }}
                                >
                                  Добавить выбор
                                </Button>
                              </div>

                              {screen.choices?.map((choice) => (
                                <Card key={choice.id} className="p-4 bg-gray-800 border-gray-600">
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                      <Input
                                        value={choice.text}
                                        placeholder="Текст выбора"
                                        className="bg-gray-700 border-gray-600 text-white"
                                        onChange={(e) => {
                                          setEditingScenes((prev) => ({
                                            ...prev,
                                            scenes: prev.scenes.map((s) =>
                                              s.id === selectedSceneId
                                                ? {
                                                    ...s,
                                                    screens: s.screens?.map((sc) =>
                                                      sc.id === selectedScreenId
                                                        ? {
                                                            ...sc,
                                                            choices: sc.choices?.map((c) =>
                                                              c.id === choice.id ? { ...c, text: e.target.value } : c,
                                                            ),
                                                          }
                                                        : sc,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          }))
                                        }}
                                      />
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          setEditingScenes((prev) => ({
                                            ...prev,
                                            scenes: prev.scenes.map((s) =>
                                              s.id === selectedSceneId
                                                ? {
                                                    ...s,
                                                    screens: s.screens?.map((sc) =>
                                                      sc.id === selectedScreenId
                                                        ? {
                                                            ...sc,
                                                            choices: sc.choices?.filter((c) => c.id !== choice.id),
                                                          }
                                                        : sc,
                                                    ),
                                                  }
                                                : s,
                                            ),
                                          }))
                                        }}
                                      >
                                        Удалить
                                      </Button>
                                    </div>

                                    <div>
                                      <label className="text-sm font-medium text-gray-200">
                                        Навигация (обязательно)
                                      </label>
                                      <div className="flex gap-2 mt-1">
                                        <Select
                                          value={choice.navigation?.type || "end_scene"}
                                          onValueChange={(value) => {
                                            setEditingScenes((prev) => ({
                                              ...prev,
                                              scenes: prev.scenes.map((s) =>
                                                s.id === selectedSceneId
                                                  ? {
                                                      ...s,
                                                      screens: s.screens?.map((sc) =>
                                                        sc.id === selectedScreenId
                                                          ? {
                                                              ...sc,
                                                              choices: sc.choices?.map((c) =>
                                                                c.id === choice.id
                                                                  ? {
                                                                      ...c,
                                                                      navigation: {
                                                                        type: value,
                                                                        screenId:
                                                                          value === "goto_screen" ? "" : undefined,
                                                                      },
                                                                    }
                                                                  : c,
                                                              ),
                                                            }
                                                          : sc,
                                                      ),
                                                    }
                                                  : s,
                                              ),
                                            }))
                                          }}
                                        >
                                          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="end_scene">Завершить сцену</SelectItem>
                                            <SelectItem value="goto_screen">Перейти к экрану</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        {choice.navigation?.type === "goto_screen" && (
                                          <Input
                                            placeholder="ID экрана"
                                            value={choice.navigation.screenId || ""}
                                            className="bg-gray-700 border-gray-600 text-white"
                                            onChange={(e) => {
                                              setEditingScenes((prev) => ({
                                                ...prev,
                                                scenes: prev.scenes.map((s) =>
                                                  s.id === selectedSceneId
                                                    ? {
                                                        ...s,
                                                        screens: s.screens?.map((sc) =>
                                                          sc.id === selectedScreenId
                                                            ? {
                                                                ...sc,
                                                                choices: sc.choices?.map((c) =>
                                                                  c.id === choice.id
                                                                    ? {
                                                                        ...c,
                                                                        navigation: {
                                                                          ...c.navigation,
                                                                          screenId: e.target.value,
                                                                        },
                                                                      }
                                                                    : c,
                                                                ),
                                                              }
                                                            : sc,
                                                        ),
                                                      }
                                                    : s,
                                                ),
                                              }))
                                            }}
                                          />
                                        )}
                                      </div>
                                    </div>

                                    {/* Последствия остаются такими же */}
                                    <div>
                                      <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-200">Последствия</label>
                                        <Select
                                          onValueChange={(value) => {
                                            let newConsequence
                                            switch (value) {
                                              case "gain_credits":
                                                newConsequence = { type: "gain_credits", amount: 100 }
                                                break
                                              case "lose_credits":
                                                newConsequence = { type: "lose_credits", amount: 50 }
                                                break
                                              case "story_point_change":
                                                newConsequence = {
                                                  type: "story_point_change",
                                                  pointId: "market_reputation",
                                                  change: 1,
                                                }
                                                break
                                              case "gain_talent":
                                                newConsequence = {
                                                  type: "gain_talent",
                                                  talentData: {
                                                    name: "Новый талант",
                                                    specialization: "Специалист",
                                                    rank: 1,
                                                  },
                                                }
                                                break
                                              case "lose_talent":
                                                newConsequence = { type: "lose_talent", talentId: "" }
                                                break
                                              case "talent_stat_change":
                                                newConsequence = {
                                                  type: "talent_stat_change",
                                                  talentId: "current",
                                                  stat: "mood",
                                                  change: 10,
                                                }
                                                break
                                              case "gain_equipment":
                                                newConsequence = { type: "gain_equipment", equipmentId: "" }
                                                break
                                              case "lose_equipment":
                                                newConsequence = { type: "lose_equipment", equipmentId: "" }
                                                break
                                            }

                                            if (newConsequence) {
                                              setEditingScenes((prev) => ({
                                                ...prev,
                                                scenes: prev.scenes.map((s) =>
                                                  s.id === selectedSceneId
                                                    ? {
                                                        ...s,
                                                        screens: s.screens?.map((sc) =>
                                                          sc.id === selectedScreenId
                                                            ? {
                                                                ...sc,
                                                                choices: sc.choices?.map((c) =>
                                                                  c.id === choice.id
                                                                    ? {
                                                                        ...c,
                                                                        consequences: [
                                                                          ...(c.consequences || []),
                                                                          newConsequence,
                                                                        ],
                                                                      }
                                                                    : c,
                                                                ),
                                                              }
                                                            : sc,
                                                        ),
                                                      }
                                                    : s,
                                                ),
                                              }))
                                            }
                                          }}
                                        >
                                          <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                                            <SelectValue placeholder="Добавить последствие" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="gain_credits">Получить кредиты</SelectItem>
                                            <SelectItem value="lose_credits">Потерять кредиты</SelectItem>
                                            <SelectItem value="story_point_change">Изменить сюжетную точку</SelectItem>
                                            <SelectItem value="gain_talent">Получить таланта</SelectItem>
                                            <SelectItem value="lose_talent">Потерять таланта</SelectItem>
                                            <SelectItem value="talent_stat_change">Изменить показатель</SelectItem>
                                            <SelectItem value="gain_equipment">Получить оборудование</SelectItem>
                                            <SelectItem value="lose_equipment">Потерять оборудование</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {choice.consequences?.map((consequence, consIndex) => (
                                        <div
                                          key={consIndex}
                                          className="flex items-center gap-2 p-2 bg-gray-800 border border-gray-600 rounded"
                                        >
                                          <span className="text-sm font-medium min-w-32 text-gray-200">
                                            {consequence?.type === "gain_credits" && "Получить кредиты:"}
                                            {consequence?.type === "lose_credits" && "Потерять кредиты:"}
                                            {consequence?.type === "story_point_change" && "Изменить сюжетную точку:"}
                                            {consequence?.type === "gain_talent" && "Получить таланта:"}
                                            {consequence?.type === "lose_talent" && "Потерять таланта:"}
                                            {consequence?.type === "talent_stat_change" && "Изменить показатель:"}
                                            {consequence?.type === "gain_equipment" && "Получить оборудование:"}
                                            {consequence?.type === "lose_equipment" && "Потерять оборудование:"}
                                          </span>

                                          {(consequence?.type === "gain_credits" ||
                                            consequence?.type === "lose_credits") && (
                                            <Input
                                              type="number"
                                              value={consequence.amount}
                                              className="w-20 bg-gray-700 border-gray-600 text-white"
                                              onChange={(e) => {
                                                setEditingScenes((prev) => ({
                                                  ...prev,
                                                  scenes: prev.scenes.map((s) =>
                                                    s.id === selectedSceneId
                                                      ? {
                                                          ...s,
                                                          screens: s.screens?.map((sc) =>
                                                            sc.id === selectedScreenId
                                                              ? {
                                                                  ...sc,
                                                                  choices: sc.choices?.map((c) =>
                                                                    c.id === choice.id
                                                                      ? {
                                                                          ...c,
                                                                          consequences: c.consequences?.map(
                                                                            (cons, idx) =>
                                                                              idx === consIndex
                                                                                ? {
                                                                                    ...cons,
                                                                                    amount:
                                                                                      Number.parseInt(e.target.value) ||
                                                                                      0,
                                                                                  }
                                                                                : cons,
                                                                          ),
                                                                        }
                                                                      : c,
                                                                  ),
                                                                }
                                                              : sc,
                                                          ),
                                                        }
                                                      : s,
                                                  ),
                                                }))
                                              }}
                                            />
                                          )}

                                          {consequence?.type === "story_point_change" && (
                                            <div className="flex items-center gap-2">
                                              <Select
                                                value={consequence.pointId}
                                                onValueChange={(value) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      pointId: value,
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              >
                                                <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                                                  <SelectValue placeholder="Выберите точку" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {Object.entries(editingScenes.storyPoints || {}).map(
                                                    ([key, point]) => (
                                                      <SelectItem key={key} value={key}>
                                                        {point.name}
                                                      </SelectItem>
                                                    ),
                                                  )}
                                                </SelectContent>
                                              </Select>
                                              <Input
                                                type="number"
                                                value={consequence.change}
                                                className="w-20 bg-gray-700 border-gray-600 text-white"
                                                onChange={(e) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      change:
                                                                                        Number.parseInt(
                                                                                          e.target.value,
                                                                                        ) || 0,
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              />
                                            </div>
                                          )}

                                          {consequence?.type === "gain_talent" && (
                                            <div>
                                              <Input
                                                type="text"
                                                value={consequence.talentData.name}
                                                placeholder="Имя таланта"
                                                className="w-full bg-gray-700 border-gray-600 text-white"
                                                onChange={(e) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      talentData: {
                                                                                        ...cons.talentData,
                                                                                        name: e.target.value,
                                                                                      },
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              />
                                              <Input
                                                type="text"
                                                value={consequence.talentData.specialization}
                                                placeholder="Специализация"
                                                className="w-full bg-gray-700 border-gray-600 text-white"
                                                onChange={(e) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      talentData: {
                                                                                        ...cons.talentData,
                                                                                        specialization: e.target.value,
                                                                                      },
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              />
                                              <Input
                                                type="number"
                                                value={consequence.talentData.rank}
                                                placeholder="Ранг"
                                                className="w-full bg-gray-700 border-gray-600 text-white"
                                                onChange={(e) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      talentData: {
                                                                                        ...cons.talentData,
                                                                                        rank: Number(e.target.value),
                                                                                      },
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              />
                                            </div>
                                          )}

                                          {consequence?.type === "lose_talent" && (
                                            <Input
                                              type="text"
                                              value={consequence.talentId}
                                              placeholder="ID таланта"
                                              className="w-full bg-gray-700 border-gray-600 text-white"
                                              onChange={(e) => {
                                                setEditingScenes((prev) => ({
                                                  ...prev,
                                                  scenes: prev.scenes.map((s) =>
                                                    s.id === selectedSceneId
                                                      ? {
                                                          ...s,
                                                          screens: s.screens?.map((sc) =>
                                                            sc.id === selectedScreenId
                                                              ? {
                                                                  ...sc,
                                                                  choices: sc.choices?.map((c) =>
                                                                    c.id === choice.id
                                                                      ? {
                                                                          ...c,
                                                                          consequences: c.consequences?.map(
                                                                            (cons, idx) =>
                                                                              idx === consIndex
                                                                                ? {
                                                                                    ...cons,
                                                                                    talentId: e.target.value,
                                                                                  }
                                                                                : cons,
                                                                          ),
                                                                        }
                                                                      : c,
                                                                  ),
                                                                }
                                                              : sc,
                                                          ),
                                                        }
                                                      : s,
                                                  ),
                                                }))
                                              }}
                                            />
                                          )}

                                          {consequence?.type === "talent_stat_change" && (
                                            <div className="flex items-center gap-2">
                                              <Select
                                                value={consequence.talentId}
                                                onValueChange={(value) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      talentId: value,
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              >
                                                <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                                                  <SelectValue placeholder="Выберите таланта" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="current">Текущий</SelectItem>
                                                  {gameState.talents.map((talent) => (
                                                    <SelectItem key={talent.id} value={talent.id}>
                                                      {talent.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                              <Select
                                                value={consequence.stat}
                                                onValueChange={(value) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      stat: value,
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              >
                                                <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                                                  <SelectValue placeholder="Выберите показатель" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="mood">Настроение</SelectItem>
                                                  <SelectItem value="anxiety">Тревожность</SelectItem>
                                                  <SelectItem value="burnout">Выгорание</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              <Input
                                                type="number"
                                                value={consequence.change}
                                                className="w-20 bg-gray-700 border-gray-600 text-white"
                                                onChange={(e) => {
                                                  setEditingScenes((prev) => ({
                                                    ...prev,
                                                    scenes: prev.scenes.map((s) =>
                                                      s.id === selectedSceneId
                                                        ? {
                                                            ...s,
                                                            screens: s.screens?.map((sc) =>
                                                              sc.id === selectedScreenId
                                                                ? {
                                                                    ...sc,
                                                                    choices: sc.choices?.map((c) =>
                                                                      c.id === choice.id
                                                                        ? {
                                                                            ...c,
                                                                            consequences: c.consequences?.map(
                                                                              (cons, idx) =>
                                                                                idx === consIndex
                                                                                  ? {
                                                                                      ...cons,
                                                                                      change:
                                                                                        Number.parseInt(
                                                                                          e.target.value,
                                                                                        ) || 0,
                                                                                    }
                                                                                  : cons,
                                                                            ),
                                                                          }
                                                                        : c,
                                                                    ),
                                                                  }
                                                                : sc,
                                                            ),
                                                          }
                                                        : s,
                                                    ),
                                                  }))
                                                }}
                                              />
                                            </div>
                                          )}

                                          {consequence?.type === "gain_equipment" && (
                                            <Input
                                              type="text"
                                              value={consequence.equipmentId}
                                              placeholder="ID оборудования"
                                              className="w-full bg-gray-700 border-gray-600 text-white"
                                              onChange={(e) => {
                                                setEditingScenes((prev) => ({
                                                  ...prev,
                                                  scenes: prev.scenes.map((s) =>
                                                    s.id === selectedSceneId
                                                      ? {
                                                          ...s,
                                                          screens: s.screens?.map((sc) =>
                                                            sc.id === selectedScreenId
                                                              ? {
                                                                  ...sc,
                                                                  choices: sc.choices?.map((c) =>
                                                                    c.id === choice.id
                                                                      ? {
                                                                          ...c,
                                                                          consequences: c.consequences?.map(
                                                                            (cons, idx) =>
                                                                              idx === consIndex
                                                                                ? {
                                                                                    ...cons,
                                                                                    equipmentId: e.target.value,
                                                                                  }
                                                                                : cons,
                                                                          ),
                                                                        }
                                                                      : c,
                                                                  ),
                                                                }
                                                              : sc,
                                                          ),
                                                        }
                                                      : s,
                                                  ),
                                                }))
                                              }}
                                            />
                                          )}

                                          {consequence?.type === "lose_equipment" && (
                                            <Input
                                              type="text"
                                              value={consequence.equipmentId}
                                              placeholder="ID оборудования"
                                              className="w-full bg-gray-700 border-gray-600 text-white"
                                              onChange={(e) => {
                                                setEditingScenes((prev) => ({
                                                  ...prev,
                                                  scenes: prev.scenes.map((s) =>
                                                    s.id === selectedSceneId
                                                      ? {
                                                          ...s,
                                                          screens: s.screens?.map((sc) =>
                                                            sc.id === selectedScreenId
                                                              ? {
                                                                  ...sc,
                                                                  choices: sc.choices?.map((c) =>
                                                                    c.id === choice.id
                                                                      ? {
                                                                          ...c,
                                                                          consequences: c.consequences?.map(
                                                                            (cons, idx) =>
                                                                              idx === consIndex
                                                                                ? {
                                                                                    ...cons,
                                                                                    equipmentId: e.target.value,
                                                                                  }
                                                                                : cons,
                                                                          ),
                                                                        }
                                                                      : c,
                                                                  ),
                                                                }
                                                              : sc,
                                                          ),
                                                        }
                                                      : s,
                                                  ),
                                                }))
                                              }}
                                            />
                                          )}

                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                              setEditingScenes((prev) => ({
                                                ...prev,
                                                scenes: prev.scenes.map((s) =>
                                                  s.id === selectedSceneId
                                                    ? {
                                                        ...s,
                                                        screens: s.screens?.map((sc) =>
                                                          sc.id === selectedScreenId
                                                            ? {
                                                                ...sc,
                                                                choices: sc.choices?.map((c) =>
                                                                  c.id === choice.id
                                                                    ? {
                                                                        ...c,
                                                                        consequences: c.consequences?.filter(
                                                                          (_, i) => i !== consIndex,
                                                                        ),
                                                                      }
                                                                    : c,
                                                                ),
                                                              }
                                                            : sc,
                                                        ),
                                                      }
                                                    : s,
                                                ),
                                              }))
                                            }}
                                          >
                                            Удалить
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>

                            <Button
                              onClick={() => {
                                setShowScenePreview(true)
                                setPreviewScreenId(screen.id)
                              }}
                              variant="outline"
                            >
                              Предпросмотр
                            </Button>
                          </>
                        )
                      })()}
                    </CardContent>
                  </Card>
                )}
              </div>

              {showScenePreview && previewScreenId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                  <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto bg-gray-900 border-gray-700">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-white">Предпросмотр экрана</CardTitle>
                        <Button variant="ghost" onClick={() => setShowScenePreview(false)}>
                          ×
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const scene = editingScenes.scenes?.find((s) => s.id === selectedSceneId)
                        const screen = scene?.screens?.find((sc) => sc.id === previewScreenId)

                        if (!screen) return <p>Экран не найден</p>

                        return (
                          <div className="space-y-4">
                            {screen.background && (
                              <img
                                src={screen.background || "/placeholder.svg"}
                                alt="Background"
                                className="rounded-md"
                              />
                            )}
                            <p className="text-gray-300">{screen.description}</p>
                            <div className="space-y-2">
                              {screen.choices?.map((choice) => (
                                <Button key={choice.id} className="w-full">
                                  {choice.text}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="system">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Системные определения</h2>
              <p className="text-muted-foreground">Настройка базовых атрибутов, состояний и навыков персонажей.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Атрибуты</CardTitle>
                    <CardDescription>Базовые характеристики персонажей</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.keys(systemConfig.attributes).map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-muted/10 rounded-lg glass-panel"
                      >
                        <span className="text-sm font-medium text-foreground">{key}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              setEditingSystemItem(systemConfig.attributes[key])
                              setEditingSystemType("attributes")
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => {
                              const confirmDelete = confirm(
                                `Вы уверены, что хотите удалить атрибут "${key}"? Это действие необратимо.`,
                              )
                              if (confirmDelete) {
                                const { [key]: deleted, ...rest } = systemConfig.attributes
                                setSystemConfig((prev) => ({ ...prev, attributes: rest }))
                                removeDependencies(key, "attributes")
                              }
                            }}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={() => {
                        setEditingSystemItem({ name: "", description: "" })
                        setEditingSystemType("attributes")
                      }}
                      variant="outline"
                    >
                      Добавить атрибут
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Состояния</CardTitle>
                    <CardDescription>Текущие состояния персонажей</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.keys(systemConfig.states).map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-muted/10 rounded-lg glass-panel"
                      >
                        <span className="text-sm font-medium text-foreground">{key}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              setEditingSystemItem(systemConfig.states[key])
                              setEditingSystemType("states")
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => {
                              const confirmDelete = confirm(
                                `Вы уверены, что хотите удалить состояние "${key}"? Это действие необратимо.`,
                              )
                              if (confirmDelete) {
                                const { [key]: deleted, ...rest } = systemConfig.states
                                setSystemConfig((prev) => ({ ...prev, states: rest }))
                                removeDependencies(key, "states")
                              }
                            }}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={() => {
                        setEditingSystemItem({ name: "", description: "" })
                        setEditingSystemType("states")
                      }}
                      variant="outline"
                    >
                      Добавить состояние
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Навыки</CardTitle>
                    <CardDescription>Профессиональные навыки персонажей</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.keys(systemConfig.skills).map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-muted/10 rounded-lg glass-panel"
                      >
                        <span className="text-sm font-medium text-foreground">{key}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              setEditingSystemItem(systemConfig.skills[key])
                              setEditingSystemType("skills")
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => {
                              const confirmDelete = confirm(
                                `Вы уверены, что хотите удалить навык "${key}"? Это действие необратимо.`,
                              )
                              if (confirmDelete) {
                                const { [key]: deleted, ...rest } = systemConfig.skills
                                setSystemConfig((prev) => ({ ...prev, skills: rest }))
                                removeDependencies(key, "skills")
                              }
                            }}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={() => {
                        setEditingSystemItem({ name: "", description: "" })
                        setEditingSystemType("skills")
                      }}
                      variant="outline"
                    >
                      Добавить навык
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {editingSystemItem && editingSystemType && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <Card className="w-full max-w-lg bg-gray-900 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Редактирование{" "}
                        {editingSystemType === "attributes"
                          ? "атрибута"
                          : editingSystemType === "states"
                            ? "состояния"
                            : "навыка"}
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Измените название и описание{" "}
                        {editingSystemType === "attributes"
                          ? "атрибута"
                          : editingSystemType === "states"
                            ? "состояния"
                            : "навыка"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium block mb-2 text-gray-200">Название</label>
                        <Input
                          type="text"
                          value={editingSystemItem.name}
                          onChange={(e) => setEditingSystemItem((prev) => ({ ...prev, name: e.target.value }))}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-2 text-gray-200">Описание</label>
                        <textarea
                          value={editingSystemItem.description}
                          onChange={(e) => setEditingSystemItem((prev) => ({ ...prev, description: e.target.value }))}
                          className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-between">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingSystemItem(null)
                            setEditingSystemType(null)
                          }}
                        >
                          Отмена
                        </Button>
                        <Button
                          onClick={() => {
                            if (editingSystemType === "attributes") {
                              setSystemConfig((prev) => {
                                const updatedAttributes = {
                                  ...prev.attributes,
                                  [editingSystemItem.name]: editingSystemItem,
                                }
                                return { ...prev, attributes: updatedAttributes }
                              })
                            } else if (editingSystemType === "states") {
                              setSystemConfig((prev) => {
                                const updatedStates = {
                                  ...prev.states,
                                  [editingSystemItem.name]: editingSystemItem,
                                }
                                return { ...prev, states: updatedStates }
                              })
                            } else if (editingSystemType === "skills") {
                              setSystemConfig((prev) => {
                                const updatedSkills = {
                                  ...prev.skills,
                                  [editingSystemItem.name]: editingSystemItem,
                                }
                                return { ...prev, skills: updatedSkills }
                              })
                            }
                            setEditingSystemItem(null)
                            setEditingSystemType(null)
                          }}
                        >
                          Сохранить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Новые табы для основных конфигов */}
          <TabsContent value="main-actions">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Основные действия</h2>
              <p className="text-muted-foreground">Редактирование основных действий (actions.json)</p>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Всего категорий: {Object.keys(editingMainActions.categories || {}).length}
                </div>
                <Button onClick={() => {
                  const dataStr = JSON.stringify(editingMainActions, null, 2)
                  const blob = new Blob([dataStr], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'actions.json'
                  a.click()
                }}>
                  Экспорт JSON
                </Button>
              </div>

              <div className="space-y-4">
                {Object.entries(editingMainActions.categories || {}).map(([categoryId, category]) => (
                  <Card key={categoryId} className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{category.title}</span>
                        {isEditMode && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(category.actions || {}).map(([actionId, action]) => (
                          <div key={actionId} className="p-3 bg-muted/10 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold">{action.title}</h4>
                                <p className="text-sm text-muted-foreground">{action.description}</p>
                                <p className="text-xs text-muted-foreground">Стоимость: {action.cost}</p>
                              </div>
                              {isEditMode && (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="main-market">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Основной рынок</h2>
              <p className="text-muted-foreground">Редактирование основного рынка (market.json)</p>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Секций: {editingMainMarket.talentExchange?.length || 0}
                </div>
                <Button onClick={() => {
                  const dataStr = JSON.stringify(editingMainMarket, null, 2)
                  const blob = new Blob([dataStr], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'market.json'
                  a.click()
                }}>
                  Экспорт JSON
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Talent Exchange</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(editingMainMarket.talentExchange || []).map((section, index) => (
                        <div key={index} className="p-2 bg-muted/10 rounded">
                          <h4 className="font-semibold">{section.name}</h4>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                          <p className="text-xs">Талантов: {section.talents?.length || 0}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Void Rescues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(editingMainMarket.voidRescues || []).map((section, index) => (
                        <div key={index} className="p-2 bg-muted/10 rounded">
                          <h4 className="font-semibold">{section.name}</h4>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                          <p className="text-xs">Талантов: {section.talents?.length || 0}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="main-contracts">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Основные контракты</h2>
              <p className="text-muted-foreground">Редактирование основных контрактов (contracts.json)</p>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Контрактов: {(editingMainContracts.available || []).length}
                </div>
                <Button onClick={() => {
                  const dataStr = JSON.stringify(editingMainContracts, null, 2)
                  const blob = new Blob([dataStr], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'contracts.json'
                  a.click()
                }}>
                  Экспорт JSON
                </Button>
              </div>

              <div className="space-y-4">
                {(editingMainContracts.available || []).map((contract) => (
                  <Card key={contract.id} className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{contract.title}</span>
                        {isEditMode && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </CardTitle>
                      <CardDescription>{contract.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><strong>Клиент:</strong> {contract.client}</p>
                          <p><strong>Награда:</strong> {contract.reward} ₵</p>
                          <p><strong>Дедлайн:</strong> {contract.deadline} дней</p>
                        </div>
                        <div>
                          <p><strong>KPI:</strong> {contract.kpi?.length || 0} показателей</p>
                          <p><strong>Требования:</strong> {Object.keys(contract.requirements?.skills || {}).length} навыков</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="main-events">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Основные события</h2>
              <p className="text-muted-foreground">Редактирование основных событий (events.json)</p>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Событий: {(editingMainEvents.events || []).length}
                </div>
                <Button onClick={() => {
                  const dataStr = JSON.stringify(editingMainEvents, null, 2)
                  const blob = new Blob([dataStr], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'events.json'
                  a.click()
                }}>
                  Экспорт JSON
                </Button>
              </div>

              <div className="space-y-4">
                {(editingMainEvents.events || []).map((event) => (
                  <Card key={event.id} className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{event.title}</span>
                        {isEditMode && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </CardTitle>
                      <CardDescription>{event.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><strong>Вероятность:</strong> {event.probability}%</p>
                          <p><strong>Эффекты:</strong> {Object.keys(event.effects || {}).length}</p>
                        </div>
                        <div>
                          <p><strong>Условия:</strong> {Object.keys(event.conditions || {}).length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Настройки</h2>
              <p className="text-muted-foreground">Основные настройки игры и интерфейса.</p>

              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle>Режим редактирования</CardTitle>
                  <CardDescription>Включите или выключите режим редактирования для изменения данных.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Режим редактирования</span>
                    <Button onClick={() => setIsEditMode(!isEditMode)} variant={isEditMode ? "destructive" : "outline"}>
                      {isEditMode ? "Выключить" : "Включить"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle>Темная тема</CardTitle>
                  <CardDescription>Включите или выключите темную тему интерфейса.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Темная тема</span>
                    <Button onClick={() => setIsDarkMode(!isDarkMode)} variant="outline">
                      {isDarkMode ? "Выключить" : "Включить"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stats">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Статистика</h2>
              <p className="text-muted-foreground">Общая статистика по вашей деятельности.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Заработано кредитов</CardTitle>
                    <CardDescription>Общая сумма заработанных кредитов.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{gameState.stats.totalEarned} ₵</div>
                  </CardContent>
                </Card>

                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Выполнено контрактов</CardTitle>
                    <CardDescription>Общее количество успешно выполненных контрактов.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{gameState.stats.contractsCompleted}</div>
                  </CardContent>
                </Card>

                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Нанято талантов</CardTitle>
                    <CardDescription>Общее количество нанятых талантов.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{gameState.stats.talentsHired}</div>
                  </CardContent>
                </Card>

                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Среднее настроение</CardTitle>
                    <CardDescription>Среднее настроение всех талантов.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{gameState.stats.averageMood.toFixed(1)}</div>
                  </CardContent>
                </Card>

                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Текучка кадров</CardTitle>
                    <CardDescription>Процент уволенных талантов.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{gameState.stats.turnoverRate}%</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default TalentArchitectGame
