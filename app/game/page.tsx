"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sun, Moon, Settings, FileCode, Plus } from "lucide-react"
import { Users, Building, FileText, Zap, BarChart, Wrench, User, Cog, BookOpen, Film, Target, Package, Star, Eye } from "lucide-react"
import Link from "next/link"

// Импортируем наши новые компоненты и хуки
import { useModal } from "./hooks/useModal"
import { useConfigManager } from "./hooks/useConfigManager"
import { EnhancedEditModal } from "./components/ui/EnhancedEditModal"
import { EntityList } from "./components/ui/EntityList"
import { SyncStatus } from "./components/ui/SyncStatus"

// Импортируем конфигурации и утилиты синхронизации
import { loadConfigsForEnvironment, getConfigStats, initializeUnifiedDataSource } from "@/lib/config-sync"


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

  // Используем наши новые хуки
  const { modalState, openModal, closeModal } = useModal()
  
  // Загружаем конфигурации асинхронно
  const [configs, setConfigs] = useState<any>({
    actions: { categories: {} },
    market: { talentExchange: [], voidRescues: [], corporateContracts: [] },
    contracts: { available: [] },
    events: { anomalies: [], crises: [], opportunities: [] },
    equipment: { equipment: [] },
    system: {},
    assets: { assets: [], assetTypes: {}, skillCategories: {} },
    users: { users: [], userRoles: {} }
  })

  // Загружаем конфигурации при монтировании компонента
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        console.log('🔄 Загружаем конфигурации...')
        
        // Инициализируем единый источник истины
        initializeUnifiedDataSource()
        
        const loadedConfigs = await loadConfigsForEnvironment('dev')
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

  const { configs: managedConfigs, updateConfigItem, addConfigItem, removeConfigItem, exportConfig } = useConfigManager(configs)

  // Обновляем managedConfigs когда загружаются новые конфигурации
  useEffect(() => {
    if (!isLoading && configs) {
      console.log('🔄 Обновляем managedConfigs с новыми данными:', configs)
    }
  }, [configs, isLoading])

  // Обновляем статистику при изменении конфигураций
  useEffect(() => {
    if (!isLoading) {
      const stats = getConfigStats(managedConfigs)
      setConfigStats(stats)
    }
  }, [managedConfigs, isLoading])

  // Обработчики для модального окна
  const handleEdit = (entity: any, entityType: string) => {
    openModal(entityType, entity)
  }

  const handleAdd = (entityType: string) => {
    console.log('➕ handleAdd вызван для типа:', entityType)
    openModal(entityType, null, undefined, true)
  }

  const handleDelete = (entityId: string, entityType: string) => {
    console.log('🔴 handleDelete вызван:', { entityId, entityType })
    console.log('📋 Доступные configs:', Object.keys(configs))
    removeConfigItem(entityType as any, entityId)
  }

  const handleSave = (data: any) => {
    if (modalState.isNew) {
      addConfigItem(modalState.type as any, data)
    } else {
      updateConfigItem(modalState.type as any, data.id, data)
    }
  }

  // Получение списка сущностей для каждого типа
  const getEntitiesList = (configType: string, subType?: string) => {
    const config = (configs as any)[configType]
    
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
        return Array.isArray(config?.assets) ? config.assets.filter((asset: any) => !asset.deleted) : []
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
      case 'market':
        // Для активов - возвращаем список всех персонажей из market.json
        if (!subType) {
          const assetsList: any[] = []
          if (config?.talentExchange) {
            config.talentExchange.filter((asset: any) => !asset.deleted).forEach((asset: any) => {
              assetsList.push({
                id: asset.id,
                name: asset.name,
                description: asset.description,
                rank: asset.rank,
                avatar: asset.avatar,
                price: asset.price,
                specialization: asset.specialization,
                attributes: asset.attributes,
                skills: asset.skills,
                type: 'asset',
                ...asset
              })
            })
          }
          if (config?.voidRescues) {
            config.voidRescues.filter((asset: any) => !asset.deleted).forEach((asset: any) => {
              assetsList.push({
                id: asset.id,
                name: asset.name,
                description: asset.description,
                avatar: asset.avatar,
                cost: asset.cost,
                risk: asset.risk,
                potentialReward: asset.potentialReward,
                anomaly: asset.anomaly,
                attributes: asset.attributes,
                skills: asset.skills,
                type: 'asset',
                ...asset
              })
            })
          }
          return assetsList
        }
        // Для аукциона - возвращаем настройки 4 активностей
        if (subType === 'activities') {
          return [
            { id: 'talent-exchange', name: 'Asset Exchange (Core)', type: 'activity' },
            { id: 'void-rescues', name: 'Void Rescues', type: 'activity' },
            { id: 'corporate-contracts', name: 'Corporate Contracts', type: 'activity' },
            { id: 'neural-forge', name: 'Neural Forge', type: 'activity' }
          ]
        } else if (subType === 'orders') {
          return Array.isArray(config?.available) ? config.available : []
        } else if (subType === 'anomalies') {
          return Array.isArray(config?.anomalies) ? config.anomalies : []
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
        if (config?.skills) {
          config.skills.filter((skill: any) => !skill.deleted).forEach((skill: any) => {
            systemList.push({ ...skill, type: 'skill', category: 'skills' })
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
      users: 'users',
      scenes: 'scenes',
      categories: 'categories',
      system: 'system',
      systems: 'systems'
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
      assets: 'Активы',
      users: 'Пользователи',
      scenes: 'Сцены',
      categories: 'Категории',
      system: 'Системы'
    }
    return titles[configType] || String(configType)
  }

  // Группировка атрибутов по категориям
  const getGroupedAttributes = () => {
    const allAttributes = getEntitiesList('system')
    const grouped: Record<string, any[]> = {
      attributes: [],
      states: [],
      skills: [],
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
                  Активы
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Пользователи
                </TabsTrigger>
                <TabsTrigger value="attributes" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Атрибуты
                </TabsTrigger>
                <TabsTrigger value="market" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Аукцион
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
                entities={getEntitiesList('assets')}
                entityType="asset"
                configType="assets"
                onEdit={(entity) => handleEdit(entity, 'assets')}
                onDelete={(id) => handleDelete(id, 'assets')}
                onAdd={() => handleAdd('assets')}
                title="Активы"
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
                        {category === 'skills' && <Star className="h-5 w-5" />}
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

            {/* Таб Аукцион */}
            <TabsContent value="market" className="space-y-6">
              <div className="space-y-6">
                {/* Подвкладки для аукциона */}
                <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="activities">Активности</TabsTrigger>
                    <TabsTrigger value="orders">Заказы</TabsTrigger>
                    <TabsTrigger value="anomalies">Аномалии</TabsTrigger>
                  </TabsList>

                  <TabsContent value="activities">
                    <EntityList
                      entities={getEntitiesList('market', 'activities')}
                      entityType="market"
                      configType="market"
                      onEdit={(entity) => handleEdit(entity, 'market')}
                      onDelete={(id) => handleDelete(id, 'market')}
                      onAdd={() => handleAdd('market')}
                      title="Активности аукциона"
                    />
                  </TabsContent>

                  <TabsContent value="orders">
                    <EntityList
                      entities={getEntitiesList('market', 'orders')}
                      entityType="contract"
                      configType="market"
                      onEdit={(entity) => handleEdit(entity, 'market')}
                      onDelete={(id) => handleDelete(id, 'market')}
                      onAdd={() => handleAdd('market')}
                      title="Заказы"
                    />
                  </TabsContent>

                  <TabsContent value="anomalies">
                    <EntityList
                      entities={getEntitiesList('market', 'anomalies')}
                      entityType="event"
                      configType="market"
                      onEdit={(entity) => handleEdit(entity, 'market')}
                      onDelete={(id) => handleDelete(id, 'market')}
                      onAdd={() => handleAdd('market')}
                      title="Аномалии"
                    />
                  </TabsContent>
                </Tabs>
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
              <EntityList
                entities={getEntitiesList('actions')}
                entityType="action"
                configType="actions"
                onEdit={(entity) => handleEdit(entity, 'actions')}
                onDelete={(id) => handleDelete(id, 'actions')}
                onAdd={() => handleAdd('actions')}
                title="Взаимодействия"
              />
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
      </div>
    </div>
  )
}

export default NexusEnslaverGame
