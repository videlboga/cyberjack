"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sun, Moon, Settings, FileCode, Plus, X } from "lucide-react"
import { Users, Building, FileText, Zap, BarChart, Wrench, User, Cog, BookOpen, Film, Target, Package, Star, Eye } from "lucide-react"
import Link from "next/link"

// Импортируем наши новые компоненты и хуки
import { useModal } from "./hooks/useModal"
import { useConfigManager } from "./hooks/useConfigManager"
import { EnhancedEditModal } from "./components/ui/EnhancedEditModal"
import { UserAssetsModal } from "./components/ui/UserAssetsModal"
import { EntityList } from "./components/ui/EntityList"
import { SyncStatus } from "./components/ui/SyncStatus"
import { CharacterStatsPanel } from "@/components/ui/character-stats-panel"

// Импортируем конфигурации и утилиты синхронизации
import { loadUnifiedConfigV2 } from "@/lib/unified-config-loader"


// Функция для генерации уникальных ID
let idCounter = 0
const generateUniqueId = (prefix: string = '') => {
  idCounter++
  return `${prefix}${Date.now()}-${idCounter}`
}

const NexusEnslaverGame = () => {
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState("assets")
  const [activeSubTab, setActiveSubTab] = useState("")
  const [configStats, setConfigStats] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  
  // Состояние для отображения характеристик персонажа
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null)
  const [showCharacterStats, setShowCharacterStats] = useState(false)

  // Используем наши новые хуки
  const { modalState, openModal, closeModal } = useModal()
  
  const [userAssetsModalState, setUserAssetsModalState] = useState<{
    isOpen: boolean
    user: any | null
  }>({
    isOpen: false,
    user: null
  })
  
  // Загружаем конфигурации асинхронно
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

  // Состояние для Character AI конфигурации
  const [characterAIConfig, setCharacterAIConfig] = useState<any>(null)

  // Загружаем конфигурации при монтировании компонента
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        console.log('🔄 Загружаем конфигурации...')
        
        const loadedConfigs = await loadUnifiedConfigV2()
        console.log('✅ Конфигурации загружены:', loadedConfigs)
        setConfigs(loadedConfigs)
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигураций:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadConfigs()
  }, [])

  // Загружаем Character AI конфигурацию из unified config (как в prod)
  useEffect(() => {
    if (configs.characterAI) {
      setCharacterAIConfig(configs.characterAI)
      console.log('✅ Character AI конфигурация загружена из unified config:', configs.characterAI)
    }
  }, [configs.characterAI])

  // Функция для просмотра характеристик персонажа
  const handleViewCharacterStats = (character: any) => {
    setSelectedCharacter(character)
    setShowCharacterStats(true)
  }

  // Функция для закрытия панели характеристик
  const handleCloseCharacterStats = () => {
    setShowCharacterStats(false)
    setSelectedCharacter(null)
  }

  // Функция для работы с Character AI конфигурацией (через unified config)
  const saveCharacterAIConfig = async (newConfig: any) => {
    try {
      // Обновляем unified config
      const updatedConfigs = { ...configs, characterAI: newConfig }
      setConfigs(updatedConfigs)
      setCharacterAIConfig(newConfig)
      
      // Синхронизируем с файлом через API
      const response = await fetch('/api/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configType: 'game-config-unified',
          data: { characterAI: newConfig }
        }),
      })
      
      if (response.ok) {
        console.log('✅ Character AI конфигурация сохранена в unified config')
        return true
      } else {
        console.error('❌ Ошибка сохранения Character AI конфигурации')
        return false
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения Character AI конфигурации:', error)
      return false
    }
  }

  const addCharacterAIItem = async (type: 'actions' | 'tools' | 'poses', item: any) => {
    if (!characterAIConfig) return false
    
    const newConfig = { ...characterAIConfig }
    const id = item.id || `new_${type}_${Date.now()}`
    newConfig[type][id] = { ...item, id }
    
    return await saveCharacterAIConfig(newConfig)
  }

  const updateCharacterAIItem = async (type: 'actions' | 'tools' | 'poses', id: string, item: any) => {
    if (!characterAIConfig) return false
    
    const newConfig = { ...characterAIConfig }
    newConfig[type][id] = { ...item, id }
    
    return await saveCharacterAIConfig(newConfig)
  }

  const deleteCharacterAIItem = async (type: 'actions' | 'tools' | 'poses', id: string) => {
    if (!characterAIConfig) return false
    
    const newConfig = { ...characterAIConfig }
    delete newConfig[type][id]
    
    return await saveCharacterAIConfig(newConfig)
  }

  const { configs: managedConfigs, updateConfigItem, addConfigItem, removeConfigItem, exportConfig, updateConfigs } = useConfigManager(configs)

  // Обновляем managedConfigs когда загружаются новые конфигурации
  useEffect(() => {
    if (!isLoading && configs) {
      console.log('🔄 Обновляем managedConfigs с новыми данными:', configs)
      updateConfigs(configs)
    }
  }, [configs, isLoading])

  // Обновляем статистику при изменении конфигураций
  useEffect(() => {
    if (!isLoading) {
      const stats = {
        assets: managedConfigs.assets?.assets?.length || 0,
        contracts: managedConfigs.contracts?.available?.length || 0,
        actions: Object.keys(managedConfigs.actions?.categories || {}).length,
        events: (managedConfigs.events?.anomalies?.length || 0) + (managedConfigs.events?.crises?.length || 0) + (managedConfigs.events?.opportunities?.length || 0),
        equipment: managedConfigs.equipment?.equipment?.length || 0,
        users: managedConfigs.users?.users?.length || 0,
        station: Object.keys(managedConfigs.station?.stationEntities || {}).length
      }
      setConfigStats(stats)
    }
  }, [managedConfigs, isLoading])

  // Обработчики для модального окна
  const handleEdit = (entity: any, entityType: string) => {
    openModal(entityType, entity)
  }

  const handleAdd = (entityType: string, defaultData?: any) => {
    console.log('➕ handleAdd вызван для типа:', entityType, 'с данными:', defaultData)
    
    // Создаем базовый объект в зависимости от типа
    let baseEntity: any = {}
    
    switch (entityType) {
      case 'action-category':
        baseEntity = {
          id: `action-category-${Date.now()}`,
          name: 'Новая категория',
          icon: '⚡',
          description: 'Описание категории',
          color: 'cyan'
        }
        break
      case 'tool-category':
        baseEntity = {
          id: `tool-category-${Date.now()}`,
          name: 'Новая категория',
          icon: '🔧',
          description: 'Описание категории',
          color: 'purple'
        }
        break
      case 'action':
        baseEntity = {
          id: `action-${Date.now()}`,
          name: 'Новое действие',
          icon: '⚡',
          description: 'Описание действия',
          category: defaultData?.category || 'punishment',
          intensity: 5,
          cost: 1,
          cooldown: 0,
          effects: {
            physical: {},
            emotional: {}
          }
        }
        break
      case 'tool':
        baseEntity = {
          id: `tool-${Date.now()}`,
          name: 'Новый инструмент',
          icon: '🔧',
          description: 'Описание инструмента',
          category: defaultData?.category || 'electrical',
          type: 'mechanical',
          intensity: 5,
          duration: 30,
          cooldown: 15,
          effects: {
            physical: {},
            emotional: {},
            fetish: {}
          }
        }
        break
      case 'pose':
        baseEntity = {
          id: `pose-${Date.now()}`,
          name: 'Новая поза',
          icon: '🧘',
          description: 'Описание позы',
          category: 'standing',
          difficulty: 1,
          requirements: {
            flexibility: 1,
            strength: 1
          },
          effects: {
            physical: {},
            emotional: {}
          }
        }
        break
      case 'characters':
        baseEntity = {
          id: `character-${Date.now()}`,
          name: 'Новый персонаж',
          age: 18,
          archetype: 'Базовый архетип',
          description: 'Описание персонажа',
          category: 'Выходцы из трущоб',
          rank: 'Junior',
          price: 100,
          specialization: 'Базовое подчинение',
          avatar: '👤',
          characteristics: {},
          states: {},
          fetishes: {},
          traits: [],
          preferences: {},
          skills: {},
          prompts: {
            base: '',
            characteristicInterpretations: {
              physical: {},
              psychological: {},
              social: {},
              personality: {},
              special: {}
            },
            situational: []
          }
        }
        break
      default:
        baseEntity = {}
    }
    
    // Объединяем с переданными данными
    const entityData = { ...baseEntity, ...defaultData }
    openModal(entityType, entityData, undefined, true)
  }

  const handleDelete = (entityId: string, entityType: string) => {
    console.log('🔴 handleDelete вызван:', { entityId, entityType })
    console.log('📋 Доступные configs:', Object.keys(configs))
    removeConfigItem(entityType as any, entityId)
  }

  const handleSave = (data: any) => {
    console.log('💾 Сохраняем данные:', data)
    console.log('📋 Modal state:', modalState)
    
    if (modalState.isNew) {
      console.log('➕ Добавляем новый элемент')
      addConfigItem(modalState.type as any, data)
    } else {
      console.log('🔄 Обновляем существующий элемент')
      updateConfigItem(modalState.type as any, data.id, data)
    }
  }

  const handleManageUserAssets = (user: any) => {
    setUserAssetsModalState({
      isOpen: true,
      user
    })
  }

  const handleSaveUserAssets = (userId: string, assets: any[], equipment: any[]) => {
    console.log('💾 Сохраняем активы пользователя:', userId, assets, equipment)
    
    // Обновляем пользователя с новыми активами и оборудованием
    const updatedUser = {
      ...userAssetsModalState.user,
      assets,
      equipment
    }
    
    updateConfigItem('users', userId, updatedUser)
  }

  // Получение списка сущностей для каждого типа
  const getEntitiesList = (configType: string, subType?: string) => {
    const config = (managedConfigs as any)[configType]
    
    switch (configType) {
      case 'actions':
        // Для действий - возвращаем список всех действий
        const actionsList: any[] = []
        if (config?.categories) {
          Object.entries(config.categories).forEach(([categoryKey, category]: [string, any]) => {
            if (category?.actions) {
              Object.entries(category.actions).forEach(([actionKey, action]: [string, any]) => {
                if (!action.deleted) {
                  actionsList.push({
                    id: `${categoryKey}-${actionKey}`,
                    name: action.title,
                    description: action.description,
                    category: categoryKey,
                    cost: action.cost,
                    effects: action.effects,
                    risk: action.risk,
                    riskEffects: action.riskEffects,
                    type: 'action',
                    ...action
                  })
                }
              })
            }
          })
        }
        return actionsList
      case 'assets':
        // Для активов - возвращаем список всех активов из assets.json, исключая удаленные
        console.log('🔍 getEntitiesList для assets, config:', config)
        const assetsList = Array.isArray(config?.assets) ? config.assets.filter((asset: any) => !asset.deleted) : []
        console.log('💎 Найдено активов:', assetsList.length)
        console.log('📋 Список активов:', assetsList.map((a: any) => a.name))
        return assetsList
      case 'users':
        // Для пользователей - возвращаем список всех пользователей, исключая удаленные
        console.log('🔍 getEntitiesList для users, config:', config)
        const allUsers = Array.isArray(config?.users) ? config.users : []
        const activeUsers = allUsers.filter((user: any) => !user.deleted)
        console.log('👥 Все пользователи:', allUsers.length)
        console.log('✅ Активные пользователи:', activeUsers.length)
        console.log('🗑️ Удаленные пользователи:', allUsers.filter((user: any) => user.deleted).length)
        console.log('👥 Список активных пользователей:', activeUsers.map((u: any) => u.username))
        return activeUsers
      case 'characters':
        // Для персонажей - возвращаем список всех персонажей из characters-unified.json
        if (!subType) {
          const charactersList: any[] = []
          if (config?.characters) {
            config.characters.filter((character: any) => !character.deleted).forEach((character: any) => {
              charactersList.push({
                id: character.id,
                name: character.name,
                description: character.description,
                archetype: character.archetype,
                stats: character.stats,
                fetishes: character.fetishes,
                emotionalState: character.emotionalState,
                type: 'character',
                ...character
              })
            })
          }
          return charactersList
        }
        return []
      case 'contracts':
        return Array.isArray(config?.available) ? config.available : []
      case 'events':
        // Обрабатываем новую структуру events.json
        const eventsList: any[] = []
        if (config?.anomalies) eventsList.push(...config.anomalies)
        if (config?.crises) eventsList.push(...config.crises)
        if (config?.opportunities) eventsList.push(...config.opportunities)
        return eventsList
      case 'equipment':
        // Для предметов - возвращаем все оборудование с категоризацией
        const equipmentList: any[] = []
        if (Array.isArray(config?.equipment)) {
          config.equipment.filter((item: any) => !item.deleted).forEach((item: any) => {
            equipmentList.push({
              ...item,
              type: item.category || 'device',
              category: item.category || 'device'
            })
          })
        }
        return equipmentList
      case 'station':
        // Для сущностей станции - возвращаем список всех сущностей
        const stationList: any[] = []
        if (config?.stationEntities) {
          Object.entries(config.stationEntities).forEach(([id, entity]: [string, any]) => {
            if (!entity.deleted) {
              stationList.push({
                id,
                name: entity.name,
                description: entity.description,
                type: entity.type,
                isActive: entity.isActive,
                defaultSceneId: entity.defaultSceneId,
                probability: entity.probability,
                customSceneId: entity.customSceneId,
                ...entity
              })
            }
          })
        }
        return stationList
      case 'scenes':
        // Для сюжетной системы - возвращаем сцены, экраны и сюжетные точки
        const storyEntities: any[] = []
        
        // Добавляем сюжетные точки
        if (config?.storyPoints) {
          Object.entries(config.storyPoints).forEach(([pointId, point]: [string, any]) => {
            storyEntities.push({
              id: pointId,
              name: point.name,
              description: point.description,
              defaultValue: point.defaultValue,
              minValue: point.minValue,
              maxValue: point.maxValue,
              type: 'storyPoint',
              category: 'storyPoints',
              ...point
            })
          })
        }
        
        // Добавляем сцены
        if (config?.scenes) {
          config.scenes.forEach((scene: any) => {
            storyEntities.push({
              id: scene.id,
              name: scene.title,
              description: scene.description,
              triggerConditions: scene.triggerConditions,
              probability: scene.probability,
              screens: scene.screens,
              type: 'scene',
              category: 'scenes',
              ...scene
            })
          })
        }
        
        // Добавляем экраны из сцен
        if (config?.scenes) {
          config.scenes.forEach((scene: any) => {
            if (scene.screens) {
              scene.screens.forEach((screen: any) => {
                storyEntities.push({
                  id: `${scene.id}-${screen.id}`,
                  name: screen.title,
                  description: screen.description,
                  background: screen.background,
                  choices: screen.choices,
                  accessConditions: screen.accessConditions,
                  parentScene: scene.id,
                  type: 'screen',
                  category: 'screens',
                  ...screen
                })
              })
            }
          })
        }
        
        return storyEntities
      case 'system':
        // Обрабатываем структуру system-definitions.json с категоризацией
        const systemList: any[] = []
        if (config?.attributes) {
          config.attributes.filter((attr: any) => !attr.deleted).forEach((attr: any) => {
            systemList.push({ ...attr, type: 'attribute', category: 'attributes' })
          })
        }
        if (config?.states) {
          config.states.filter((state: any) => !state.deleted).forEach((state: any) => {
            systemList.push({ ...state, type: 'state', category: 'states' })
          })
        }
        if (config?.fetishes) {
          config.fetishes.filter((fetish: any) => !fetish.deleted).forEach((fetish: any) => {
            systemList.push({ ...fetish, type: 'fetish', category: 'fetishes' })
          })
        }
        if (config?.resources) {
          config.resources.filter((resource: any) => !resource.deleted).forEach((resource: any) => {
            systemList.push({ ...resource, type: 'resource', category: 'resources' })
          })
        }
        return systemList
      default:
        return []
    }
  }

  // Маппинг типов сущностей
  const getEntityType = (configType: keyof typeof configs): string => {
    const mapping: Record<string, string> = {
      actions: 'actions',
      market: 'market',
      contracts: 'contracts',
      events: 'events',
      equipment: 'equipment',
      assets: 'assets',
      characters: 'characters',
      users: 'users',
      scenes: 'scenes',
      categories: 'categories',
      system: 'system',
      systems: 'systems',
      station: 'station'
    }
    return mapping[configType] || String(configType)
  }



  // Заголовки для табов
  const getTabTitle = (configType: keyof typeof configs): string => {
    const titles: Record<string, string> = {
      actions: 'Действия',
      market: 'Рынок',
      contracts: 'Контракты',
      events: 'События',
      equipment: 'Оборудование',
      assets: 'Персонажи',
      characters: 'Персонажи',
      users: 'Пользователи',
      scenes: 'Сцены',
      categories: 'Категории',
      system: 'Системы',
      station: 'Станция'
    }
    return titles[configType] || String(configType)
  }

  // Группировка атрибутов по категориям
  const getGroupedAttributes = () => {
    const allAttributes = getEntitiesList('system')
    const grouped: Record<string, any[]> = {
      attributes: [],
      states: [],
      fetishes: [],
      resources: []
    }
    
    allAttributes.forEach((attr: any) => {
      if (grouped[attr.category]) {
        grouped[attr.category].push(attr)
      }
    })
    
    return grouped
  }

  // Группировка предметов по категориям
  const getGroupedItems = () => {
    const allItems = getEntitiesList('equipment')
    const grouped: Record<string, any[]> = {
      implants: [],
      clothing: [],
      devices: []
    }
    
    allItems.forEach((item: any) => {
      const category = item.category || 'devices'
      if (grouped[category]) {
        grouped[category].push(item)
      } else {
        grouped.devices.push(item)
      }
    })
    
    return grouped
  }



  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-background text-foreground">
        {/* Modern Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">NE</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Nexus Enslaver</h1>
                  <p className="text-xs text-muted-foreground">Development Panel</p>
                </div>
              </div>
              <div className="hidden md:block">
                <SyncStatus isSynced={true} lastSync={new Date()} onSync={() => console.log('Синхронизация...')} />
              </div>
            </div>
            
            <div className="ml-auto flex items-center space-x-3">
              {/* Stats Overview */}
              <div className="hidden lg:flex items-center space-x-2">
                {Object.entries(configStats).slice(0, 3).map(([key, count]) => (
                  <div key={key} className="flex items-center space-x-1 px-2 py-1 rounded-md bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">{key}</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="h-9 w-9 p-0"
                >
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span className="sr-only">Toggle theme</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">Settings</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="container py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Modern Navigation */}
            <div className="flex flex-col space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Game Management</h2>
                  <p className="text-muted-foreground">
                    Управление активами, атрибутами и игровыми системами
                  </p>
                </div>
              </div>
              
              <TabsList className="grid w-full grid-cols-6 lg:grid-cols-7 h-12 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="assets" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Персонажи
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Пользователи
                </TabsTrigger>
                <TabsTrigger value="attributes" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Атрибуты
                </TabsTrigger>
                <TabsTrigger value="station" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Станция
                </TabsTrigger>
                <TabsTrigger value="items" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Предметы
                </TabsTrigger>
                <TabsTrigger value="story-editor" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Сюжетный редактор
                </TabsTrigger>
                <TabsTrigger value="interactions" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Взаимодействия
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Таб Активы */}
            <TabsContent value="assets" className="space-y-6">
              <EntityList
                entities={getEntitiesList('characters')}
                entityType="character"
                configType="characters"
                onEdit={(entity) => handleEdit(entity, 'characters')}
                onDelete={(id) => handleDelete(id, 'characters')}
                onView={(entity) => handleViewCharacterStats(entity)}
                onAdd={() => handleAdd('characters')}
                title="Персонажи (Активы)"
              />
            </TabsContent>

            {/* Таб Пользователи */}
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Пользователи
                  </CardTitle>
                  <CardDescription>
                    Пользователи создаются через регистрацию в prod режиме. Здесь отображаются все зарегистрированные пользователи.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EntityList
                    entities={getEntitiesList('users')}
                    entityType="user"
                    configType="users"
                    onEdit={(entity) => handleEdit(entity, 'users')}
                    onDelete={(id) => handleDelete(id, 'users')}
                    onManageAssets={handleManageUserAssets}
                    onAdd={undefined}
                    title=""
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Таб Атрибуты */}
            <TabsContent value="attributes" className="space-y-6">
              <div className="space-y-6">
                {Object.entries(getGroupedAttributes()).map(([category, entities]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {category === 'attributes' && <User className="h-5 w-5" />}
                        {category === 'states' && <BarChart className="h-5 w-5" />}
                        {category === 'fetishes' && <Star className="h-5 w-5" />}
                        {category === 'resources' && <Cog className="h-5 w-5" />}
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </CardTitle>
                      <CardDescription>
                        {entities.length} элементов
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <EntityList
                        entities={entities}
                        entityType="attribute"
                        configType="system"
                        onEdit={(entity) => handleEdit(entity, 'system')}
                        onDelete={(id) => handleDelete(id, 'system')}
                        onAdd={() => handleAdd('system')}
                        title=""
                        compact
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Таб Станция */}
            <TabsContent value="station" className="space-y-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building className="h-5 w-5" />
                          Сущности станции
                        </CardTitle>
                        <CardDescription>
                          Управление сущностями станции. Добавляйте новые сущности для отображения в prod версии и сюжетном редакторе.
                        </CardDescription>
                      </div>
                      <Button onClick={() => handleAdd('station')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить сущность
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <EntityList
                      entities={getEntitiesList('station')}
                      entityType="station"
                      configType="station"
                      onEdit={(entity) => handleEdit(entity, 'station')}
                      onDelete={(id) => handleDelete(id, 'station')}
                      onAdd={undefined}
                      title=""
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Таб Предметы */}
            <TabsContent value="items" className="space-y-6">
              <div className="space-y-6">
                {Object.entries(getGroupedItems()).map(([category, entities]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {category === 'implants' && <Wrench className="h-5 w-5" />}
                        {category === 'clothing' && <Users className="h-5 w-5" />}
                        {category === 'devices' && <Package className="h-5 w-5" />}
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </CardTitle>
                      <CardDescription>
                        {entities.length} элементов
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <EntityList
                        entities={entities}
                        entityType="equipment"
                        configType="equipment"
                        onEdit={(entity) => handleEdit(entity, 'equipment')}
                        onDelete={(id) => handleDelete(id, 'equipment')}
                        onAdd={() => handleAdd('equipment')}
                        title=""
                        compact
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>



            {/* Таб Сюжетный редактор */}
            <TabsContent value="story-editor" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Сюжетный редактор
                  </CardTitle>
                  <CardDescription>
                    Визуальный редактор для создания и редактирования сюжетных сцен
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Используйте специализированный редактор для создания сложных сюжетных сцен с множественными экранами, 
                      выборами и условиями. Редактор поддерживает визуальное редактирование узлов и связей.
                    </p>
                    <div className="flex gap-2">
                      <Button asChild>
                        <Link href="/game/story-editor">
                          <FileText className="h-4 w-4 mr-2" />
                          Открыть редактор
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/game/story-editor?mode=visual">
                          <Eye className="h-4 w-4 mr-2" />
                          Визуальный режим
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Таб Взаимодействия */}
            <TabsContent value="interactions" className="space-y-6">
              {!characterAIConfig ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Взаимодействия
                    </CardTitle>
                    <CardDescription>Загрузка конфигурации взаимодействий...</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Загружаем конфигурацию взаимодействий...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Статус системы */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Статус системы взаимодействий
                      </CardTitle>
                      <CardDescription>Информация о конфигурации взаимодействий</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 glass-panel border border-cyan-500/30 rounded-lg">
                          <div className="text-2xl font-bold text-cyan-400">
                            {Object.keys(characterAIConfig.actions || {}).length}
                          </div>
                          <div className="text-sm text-cyan-300">Действий</div>
                        </div>
                        <div className="text-center p-4 glass-panel border border-purple-500/30 rounded-lg">
                          <div className="text-2xl font-bold text-purple-400">
                            {Object.keys(characterAIConfig.tools || {}).length}
                          </div>
                          <div className="text-sm text-purple-300">Инструментов</div>
                        </div>
                        <div className="text-center p-4 glass-panel border border-orange-500/30 rounded-lg">
                          <div className="text-2xl font-bold text-orange-400">
                            {Object.keys(characterAIConfig.poses || {}).length}
                          </div>
                          <div className="text-sm text-orange-300">Поз</div>
                        </div>
                        <div className="text-center p-4 glass-panel border border-green-500/30 rounded-lg">
                          <div className="text-2xl font-bold text-green-400">
                            {Object.keys(characterAIConfig.quickActions || {}).length}
                          </div>
                          <div className="text-sm text-green-300">Быстрых действий</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Категории действий */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Категории действий
                      </CardTitle>
                      <CardDescription>Управление категориями действий Character AI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(characterAIConfig.actionCategories || {}).map(([id, category]: [string, any]) => (
                          <div key={id} className="p-3 glass-panel border border-cyan-500/30 rounded-lg hover:border-cyan-500/50 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{category.icon}</span>
                                <span className="font-medium">{category.name}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(category, 'action-category')}
                                  className="h-6 w-6 p-0"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAdd('action', { category: id })}
                                  className="h-6 w-6 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">{category.description}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs" style={{ color: category.color }}>
                                {Object.keys(characterAIConfig.actions || {}).filter((actionId: string) => 
                                  characterAIConfig.actions[actionId]?.category === id
                                ).length} действий
                              </Badge>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => handleAdd('action-category')}
                          className="h-full min-h-[80px] glass-panel border border-dashed border-cyan-500/30 hover:border-cyan-500/50"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Добавить категорию
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Действия по категориям */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Действия по категориям
                      </CardTitle>
                      <CardDescription>Детальное управление действиями Character AI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(characterAIConfig.actionCategories || {}).map(([categoryId, category]: [string, any]) => {
                          const categoryActions = Object.entries(characterAIConfig.actions || {}).filter(([id, action]: [string, any]) => 
                            action.category === categoryId
                          )
                          
                          if (categoryActions.length === 0) return null
                          
                          return (
                            <div key={categoryId} className="space-y-2">
                              <div className="flex items-center gap-2 text-cyan-300 font-medium">
                                <span>{category.icon}</span>
                                <span>{category.name}</span>
                                <Badge variant="outline" className="text-xs">{categoryActions.length} действий</Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
                                {categoryActions.map(([id, action]: [string, any]) => (
                                  <div key={id} className="p-3 glass-panel border border-cyan-500/20 rounded-lg hover:border-cyan-500/40 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">{action.icon}</span>
                                        <span className="font-medium text-sm">{action.name}</span>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEdit(action, 'action')}
                                          className="h-5 w-5 p-0"
                                        >
                                          <Settings className="h-2.5 w-2.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => deleteCharacterAIItem('actions', id)}
                                          className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-2">{action.description}</p>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Интенсивность:</span>
                                        <div className="flex-1 bg-gray-200 rounded-full h-1">
                                          <div 
                                            className="bg-cyan-500 h-1 rounded-full" 
                                            style={{ width: `${(action.intensity / 10) * 100}%` }}
                                          ></div>
                                        </div>
                                        <span className="text-xs text-gray-500">{action.intensity}/10</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Стоимость:</span>
                                        <Badge variant="outline" className="text-xs">{action.cost} НП</Badge>
                                      </div>
                                      {action.cooldown > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-500">КД:</span>
                                          <Badge variant="outline" className="text-xs">{action.cooldown}с</Badge>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Позы */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Позы
                      </CardTitle>
                      <CardDescription>Управление позами персонажей</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(characterAIConfig.poses || {}).map(([id, pose]: [string, any]) => (
                          <div key={id} className="p-3 glass-panel border border-orange-500/30 rounded-lg hover:border-orange-500/50 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{pose.icon || '🧘'}</span>
                                <span className="font-medium">{pose.name}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(pose, 'pose')}
                                  className="h-5 w-5 p-0"
                                >
                                  <Settings className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteCharacterAIItem('poses', id)}
                                  className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">{pose.description}</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Сложность:</span>
                                <div className="flex gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-2 h-2 rounded-full ${i < pose.difficulty ? 'bg-orange-500' : 'bg-gray-200'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              {pose.category && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Категория:</span>
                                  <Badge variant="outline" className="text-xs">{pose.category}</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => handleAdd('pose')}
                          className="h-full min-h-[80px] glass-panel border border-dashed border-orange-500/30 hover:border-orange-500/50"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Добавить позу
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Категории инструментов */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Категории инструментов
                      </CardTitle>
                      <CardDescription>Управление категориями инструментов Character AI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(characterAIConfig.toolCategories || {}).map(([id, category]: [string, any]) => (
                          <div key={id} className="p-3 glass-panel border border-purple-500/30 rounded-lg hover:border-purple-500/50 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{category.icon}</span>
                                <span className="font-medium">{category.name}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(category, 'tool-category')}
                                  className="h-6 w-6 p-0"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAdd('tool', { category: id })}
                                  className="h-6 w-6 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">{category.description}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs" style={{ color: category.color }}>
                                {Object.keys(characterAIConfig.tools || {}).filter((toolId: string) => 
                                  characterAIConfig.tools[toolId]?.category === id
                                ).length} инструментов
                              </Badge>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => handleAdd('tool-category')}
                          className="h-full min-h-[80px] glass-panel border border-dashed border-purple-500/30 hover:border-purple-500/50"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Добавить категорию
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Инструменты по категориям */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Инструменты по категориям
                      </CardTitle>
                      <CardDescription>Детальное управление инструментами Character AI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(characterAIConfig.toolCategories || {}).map(([categoryId, category]: [string, any]) => {
                          const categoryTools = Object.entries(characterAIConfig.tools || {}).filter(([id, tool]: [string, any]) => 
                            tool.category === categoryId
                          )
                          
                          if (categoryTools.length === 0) return null
                          
                          return (
                            <div key={categoryId} className="space-y-2">
                              <div className="flex items-center gap-2 text-purple-300 font-medium">
                                <span>{category.icon}</span>
                                <span>{category.name}</span>
                                <Badge variant="outline" className="text-xs">{categoryTools.length} инструментов</Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
                                {categoryTools.map(([id, tool]: [string, any]) => (
                                  <div key={id} className="p-3 glass-panel border border-purple-500/20 rounded-lg hover:border-purple-500/40 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">{tool.icon}</span>
                                        <span className="font-medium text-sm">{tool.name}</span>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEdit(tool, 'tool')}
                                          className="h-5 w-5 p-0"
                                        >
                                          <Settings className="h-2.5 w-2.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => deleteCharacterAIItem('tools', id)}
                                          className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-2">{tool.description}</p>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Интенсивность:</span>
                                        <div className="flex-1 bg-gray-200 rounded-full h-1">
                                          <div 
                                            className="bg-purple-500 h-1 rounded-full" 
                                            style={{ width: `${(tool.intensity / 10) * 100}%` }}
                                          ></div>
                                        </div>
                                        <span className="text-xs text-gray-500">{tool.intensity}/10</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Тип:</span>
                                        <Badge variant="outline" className="text-xs">{tool.type}</Badge>
                                      </div>
                                      {tool.duration && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-500">Длительность:</span>
                                          <Badge variant="outline" className="text-xs">{tool.duration}с</Badge>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Позы */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Позы ({Object.keys(characterAIConfig.poses || {}).length})
                          </CardTitle>
                          <CardDescription>Позы, которые может принимать персонаж</CardDescription>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAdd('character-ai-pose')}
                          className="glass-panel border border-orange-500/50 text-orange-300 hover:border-orange-400 hover:text-orange-200"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Добавить позу
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(characterAIConfig.poses || {}).slice(0, 9).map(([id, pose]: [string, any]) => (
                          <div key={id} className="p-4 glass-panel border border-orange-500/30 rounded-lg hover:shadow-lg transition-all duration-200 hover:border-orange-500/50">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                <span className="text-lg">🧘</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{pose.name}</h4>
                                    <Badge variant="outline" className="text-xs">{pose.category}</Badge>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEdit(pose, 'character-ai-pose')}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => deleteCharacterAIItem('poses', id)}
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{pose.description}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Сложность:</span>
                                  <div className="flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <div 
                                        key={i} 
                                        className={`w-2 h-2 rounded-full ${i < pose.difficulty ? 'bg-orange-500' : 'bg-gray-200'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {Object.keys(characterAIConfig.poses || {}).length > 9 && (
                        <div className="text-center mt-4">
                          <Badge variant="outline">
                            И ещё {Object.keys(characterAIConfig.poses || {}).length - 9} поз...
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Модальное окно редактирования */}
          <EnhancedEditModal
            isOpen={modalState.isOpen}
            onClose={closeModal}
            initialData={modalState.data}
            entityType={modalState.type ? getEntityType(modalState.type as keyof typeof configs) : 'entity'}
            onSave={handleSave}
            isNew={modalState.isNew}
          />
                  </div>

        {/* Модальное окно управления активами пользователя */}
        <UserAssetsModal
          isOpen={userAssetsModalState.isOpen}
          onClose={() => setUserAssetsModalState({ isOpen: false, user: null })}
          user={userAssetsModalState.user}
          availableAssets={getEntitiesList('assets')}
          availableEquipment={getEntitiesList('equipment')}
          onSave={handleSaveUserAssets}
        />

        {/* Панель характеристик персонажа */}
        {showCharacterStats && selectedCharacter && (
          <CharacterStatsPanel
            talent={selectedCharacter}
            isVisible={showCharacterStats}
            onClose={handleCloseCharacterStats}
          />
        )}
      </div>
    </div>
  )
}

export default NexusEnslaverGame
