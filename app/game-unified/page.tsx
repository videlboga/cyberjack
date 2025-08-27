"use client"

import React from "react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { loadUnifiedConfigV2 } from "@/lib/unified-config-loader"
import type { GameConfig, GameAction, GameContract, GameEquipment, CharacterAIConfig } from "@/lib/unified-entities"
import { useCharacterAIV2 } from "@/app/prod/hooks/useCharacterAI-v2"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatNotification } from "@/components/ui/stat-notification"
import { CharacterStatsPanel } from "@/components/ui/character-stats-panel"
import { Toaster } from "@/components/ui/toaster"
import Link from "next/link"

// Icons
import { 
  Sun, Moon, Settings, FileCode, Plus, X, Users, Building, FileText, 
  Zap, BarChart, Wrench, User, Cog, BookOpen, Film, Target, Package, 
  Star, Eye, MessageSquare, Heart, Shield, Zap as ZapIcon 
} from "lucide-react"

// Game Components
import { ActionToolPanel } from "@/app/prod/components/ActionToolPanel"
import { CharacterChat } from "@/app/prod/components/CharacterChat"
import CharacterPanel from "@/app/prod/components/CharacterPanel"
import EquipmentPanel from "@/app/prod/components/EquipmentPanel"
import { PoseDisplay } from "@/app/prod/components/PoseDisplay"
import { CategoryDisplay } from "@/app/prod/components/CategoryDisplay"
import { HierarchicalActionMenu } from "@/app/prod/components/HierarchicalActionMenu"
import RegistrationModal from "@/app/prod/components/RegistrationModal"
import { OpenRouterDebugPanel } from "@/app/prod/components/OpenRouterDebugPanel"

// Game UI Components
import { useModal } from "@/app/game/hooks/useModal"
import { useConfigManager } from "@/app/game/hooks/useConfigManager"
import { EnhancedEditModal } from "@/app/game/components/ui/EnhancedEditModal"
import { UserAssetsModal } from "@/app/game/components/ui/UserAssetsModal"
import { EntityList } from "@/app/game/components/ui/EntityList"
import { SyncStatus } from "@/app/game/components/ui/SyncStatus"

// Character AI
import { personalWorkIntegration } from "@/lib/character/personal-work-integration"
import { CharacterAdapter } from "@/lib/character/character-adapter"

// Types
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

interface Character {
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
  equippedItems: GameEquipment[]
  inventory: GameEquipment[]
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
  fetishes: { [key: string]: number }
  currentPose: string
  poseHistory: Array<{ poseId: string; timestamp: number; reason: string }>
}

// Utility functions
let idCounter = 0
const generateUniqueId = (prefix: string = '') => {
  idCounter++
  return `${prefix}${Date.now()}-${idCounter}`
}

const UnifiedGamePage = () => {
  // Theme and UI state
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState("game")
  const [activeSubTab, setActiveSubTab] = useState("")
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  
  // Game state
  const [isLoading, setIsLoading] = useState(true)
  const [configStats, setConfigStats] = useState<Record<string, number>>({})
  
  // Character state
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [showCharacterStats, setShowCharacterStats] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  
  // Equipment and inventory
  const [userEquipment, setUserEquipment] = useState<string[]>([])
  const [equipment, setEquipment] = useState<GameEquipment[]>([])
  
  // Character AI
  const [geminiApiKey, setGeminiApiKey] = useState<string>("")
  const [characterAIConfig, setCharacterAIConfig] = useState<CharacterAIConfig | null>(null)
  
  // Modals
  const { modalState, openModal, closeModal } = useModal()
  const [userAssetsModalState, setUserAssetsModalState] = useState<{
    isOpen: boolean
    user: any | null
  }>({
    isOpen: false,
    user: null
  })
  
  // Registration
  const [isRegistered, setIsRegistered] = useState(false)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  
  // Configurations
  const [configs, setConfigs] = useState<any>({
    assets: { assets: [] },
    actions: { categories: {} },
    contracts: { available: [] },
    events: { anomalies: [], crises: [], opportunities: [] },
    characters: { characters: [] },
    equipment: { equipment: [] },
    system: {},
    users: { users: [] },
    station: { stationEntities: {} }
  })

  // Character AI Hook
  const characterAI = useCharacterAIV2({
    characterId: selectedCharacter?.id,
    characterStates: selectedCharacter?.states || {},
    characterAttributes: selectedCharacter?.attributes || {},
    characterFetishes: selectedCharacter?.fetishes || {},
    userEquipment,
    currentPose: selectedCharacter?.currentPose || "standing_normal",
    geminiApiKey
  })

  // Load configurations
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        console.log('🔄 Загружаем конфигурации...')
        
        const loadedConfigs = await loadUnifiedConfigV2()
        console.log('✅ Конфигурации загружены:', loadedConfigs)
        setConfigs(loadedConfigs)
        
        // Set Character AI config
        if (loadedConfigs.characterAI) {
          setCharacterAIConfig(loadedConfigs.characterAI)
          console.log('✅ Character AI конфигурация загружена:', loadedConfigs.characterAI)
        }
        
        // Initialize characters from config
        if (loadedConfigs.characters?.characters) {
          const initialCharacters = loadedConfigs.characters.characters.map((char: any) => ({
            id: char.id,
            name: char.name,
            role: char.role || "Подчиненный",
            level: 1,
            mood: 50,
            fear: 0,
            despair: 0,
            devotion: 0,
            strength: char.attributes?.strength || 50,
            empathy: char.attributes?.empathy || 50,
            intelligence: char.attributes?.intelligence || 50,
            creativity: char.attributes?.creativity || 50,
            status: "available" as const,
            memories: [],
            experience: 0,
            maxExperience: 100,
            statusEffects: [],
            equippedItems: [],
            inventory: [],
            neuralPulses: 0,
            attributes: {
              strength: char.attributes?.strength || 50,
              empathy: char.attributes?.empathy || 50,
              intelligence: char.attributes?.intelligence || 50,
              creativity: char.attributes?.creativity || 50,
              temperament: char.attributes?.temperament || 50,
              grit: char.attributes?.grit || 50,
              ego: char.attributes?.ego || 50
            },
            states: {
              mood: 50,
              fear: 0,
              despair: 0,
              devotion: 0,
              entitlement: 0,
              awareness: 0,
              routine: 0,
              compliance: 0,
              sensuality: 0,
              endurance: 0,
              sensory_overload: 0
            },
            skills: {
              maid: 0,
              cooking: 0,
              neural_hacking: 0,
              orgasm_control: 0,
              field: 0,
              etiquette: 0,
              logistics: 0,
              medical: 0,
              maintenance: 0,
              data: 0,
              dance: 0
            },
            fetishes: char.fetishes || {},
            currentPose: "standing_normal",
            poseHistory: []
          }))
          setCharacters(initialCharacters)
          console.log('✅ Персонажи инициализированы:', initialCharacters)
        }
        
        // Initialize equipment
        if (loadedConfigs.equipment?.equipment) {
          setEquipment(loadedConfigs.equipment.equipment)
          console.log('✅ Оборудование загружено:', loadedConfigs.equipment.equipment)
        }
        
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигураций:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadConfigs()
  }, [])

  // Character selection handler
  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character)
    console.log('🎭 Выбран персонаж:', character.name)
  }

  // View character stats
  const handleViewCharacterStats = (character: Character) => {
    setSelectedCharacter(character)
    setShowCharacterStats(true)
  }

  // Equipment management
  const handleEquipItem = (itemId: string) => {
    if (!userEquipment.includes(itemId)) {
      setUserEquipment(prev => [...prev, itemId])
      console.log('🔧 Экипирован предмет:', itemId)
    }
  }

  const handleUnequipItem = (itemId: string) => {
    setUserEquipment(prev => prev.filter(id => id !== itemId))
    console.log('🔧 Снят предмет:', itemId)
  }

  // Character AI message handling
  const handleSendMessage = async (message: string) => {
    if (!selectedCharacter || !characterAI.analyzeMessage) {
      console.warn('⚠️ Персонаж не выбран или Character AI недоступен')
      return
    }

    try {
      console.log('💬 Отправляем сообщение:', message)
      const analysis = await characterAI.analyzeMessage(message, selectedCharacter)
      console.log('📥 Получен анализ:', analysis)
      
      // Handle response
      if (analysis.response) {
        console.log('🤖 Ответ персонажа:', analysis.response)
      }
      
      // Handle stat changes
      if (analysis.statChanges && Object.keys(analysis.statChanges).length > 0) {
        console.log('📊 Изменения характеристик:', analysis.statChanges)
        // Update character stats here
      }
      
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения:', error)
    }
  }

  // Action execution
  const handleExecuteAction = async (actionId: string, intensity: number = 5) => {
    if (!selectedCharacter || !characterAI.executeAction) {
      console.warn('⚠️ Персонаж не выбран или Character AI недоступен')
      return
    }

    try {
      console.log('🎯 Выполняем действие:', actionId, 'с интенсивностью:', intensity)
      await characterAI.executeAction(actionId, intensity)
    } catch (error) {
      console.error('❌ Ошибка выполнения действия:', error)
    }
  }

  // Pose change
  const handlePoseChange = async (poseId: string, force: boolean = false) => {
    if (!selectedCharacter || !characterAI.changePose) {
      console.warn('⚠️ Персонаж не выбран или Character AI недоступен')
      return
    }

    try {
      console.log('🎭 Смена позы:', poseId, force ? '(принудительно)' : '')
      const success = await characterAI.changePose(poseId, force)
      if (success && selectedCharacter) {
        setSelectedCharacter(prev => prev ? { ...prev, currentPose: poseId } : null)
      }
    } catch (error) {
      console.error('❌ Ошибка смены позы:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Загрузка игры...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold">CyberJack - Единая Игра</h1>
            <Badge variant="outline" className="text-sm">
              v2.0 Unified
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebugPanel(!showDebugPanel)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegistrationModal(true)}
            >
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="game" className="flex items-center space-x-2">
              <ZapIcon className="h-4 w-4" />
              <span>Игра</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Конфигурация</span>
            </TabsTrigger>
            <TabsTrigger value="debug" className="flex items-center space-x-2">
              <FileCode className="h-4 w-4" />
              <span>Отладка</span>
            </TabsTrigger>
          </TabsList>

          {/* Game Tab */}
          <TabsContent value="game" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Character Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Персонажи</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CharacterPanel
                    characters={characters}
                    selectedCharacter={selectedCharacter}
                    onCharacterSelect={handleCharacterSelect}
                    onViewStats={handleViewCharacterStats}
                  />
                </CardContent>
              </Card>

              {/* Action System */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <span>Действия</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ActionToolPanel
                    characterAI={characterAI}
                    selectedCharacter={selectedCharacter}
                    onExecuteAction={handleExecuteAction}
                    onPoseChange={handlePoseChange}
                  />
                </CardContent>
              </Card>

              {/* Equipment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Оборудование</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EquipmentPanel
                    equipment={equipment}
                    userEquipment={userEquipment}
                    onEquip={handleEquipItem}
                    onUnequip={handleUnequipItem}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Chat and Pose Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>Чат с персонажем</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CharacterChat
                    selectedCharacter={selectedCharacter}
                    onSendMessage={handleSendMessage}
                    characterAI={characterAI}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Heart className="h-5 w-5" />
                    <span>Поза персонажа</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PoseDisplay
                    selectedCharacter={selectedCharacter}
                    characterAI={characterAI}
                    onPoseChange={handlePoseChange}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Entity Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="h-5 w-5" />
                    <span>Управление сущностями</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EntityList
                    configs={configs}
                    onEdit={openModal}
                  />
                </CardContent>
              </Card>

              {/* Story Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Story редактор</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Редактирование сцен, историй и шаблонов для игровых событий
                    </p>
                    <Link href="/game-unified/story-editor">
                      <Button className="w-full">
                        <FileText className="h-4 w-4 mr-2" />
                        Открыть Story редактор
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Condition Builder */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Condition построитель</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Создание и тестирование условий для игровой логики
                    </p>
                    <Link href="/game-unified/condition-builder">
                      <Button className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        Открыть Condition построитель
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Sync Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart className="h-5 w-5" />
                    <span>Статус синхронизации</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SyncStatus configs={configs} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Debug Tab */}
          <TabsContent value="debug" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileCode className="h-5 w-5" />
                  <span>Отладочная панель</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OpenRouterDebugPanel
                  characterAI={characterAI}
                  selectedCharacter={selectedCharacter}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        {modalState.isOpen && (
          <EnhancedEditModal
            isOpen={modalState.isOpen}
            onClose={closeModal}
            entityType={modalState.entityType}
            entity={modalState.entity}
            configs={configs}
          />
        )}

        {userAssetsModalState.isOpen && (
          <UserAssetsModal
            isOpen={userAssetsModalState.isOpen}
            onClose={() => setUserAssetsModalState({ isOpen: false, user: null })}
            user={userAssetsModalState.user}
          />
        )}

        {showCharacterStats && selectedCharacter && (
          <CharacterStatsPanel
            character={selectedCharacter}
            isOpen={showCharacterStats}
            onClose={() => setShowCharacterStats(false)}
          />
        )}

        {showRegistrationModal && (
          <RegistrationModal
            isOpen={showRegistrationModal}
            onClose={() => setShowRegistrationModal(false)}
            onRegister={(userData) => {
              setIsRegistered(true)
              setShowRegistrationModal(false)
              console.log('✅ Пользователь зарегистрирован:', userData)
            }}
          />
        )}

        {/* Toaster for notifications */}
        <Toaster />
      </div>
    </div>
  )
}

export default UnifiedGamePage
