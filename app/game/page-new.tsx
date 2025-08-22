"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sun, Moon, Settings, FileCode, Plus } from "lucide-react"
import { Users, Building, FileText, Zap, BarChart, Wrench, User, Cog, BookOpen, Film, Target, Package, Star } from "lucide-react"

// Импортируем наши новые компоненты и хуки
import { useModal } from "./hooks/useModal"
import { useConfigManager } from "./hooks/useConfigManager"
import { EnhancedEditModal } from "./components/ui/EnhancedEditModal"
import { EntityList } from "./components/ui/EntityList"
import { SyncStatus } from "./components/ui/SyncStatus"

// Импортируем конфигурации и утилиты синхронизации
import { loadConfigsForEnvironment, getConfigStats } from "@/lib/config-sync"
import actionsConfigData from "../../data/actions.json"
import marketConfigData from "../../data/market.json"
import contractsConfigData from "../../data/contracts.json"
import eventsConfigData from "../../data/events.json"
import equipmentConfigData from "../../data/equipment-config.json"
import systemDefinitionsData from "../../data/system-definitions.json"
import storyScenesData from "../../data/story-scenes.json"

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

  // Используем наши новые хуки
  const { modalState, openModal, closeModal } = useModal()
  
  const initialConfigs = {
    actions: actionsConfigData || { categories: {} },
    market: marketConfigData || { talentExchange: [], voidRescues: [], corporateContracts: [] },
    contracts: contractsConfigData || { available: [] },
    events: eventsConfigData || { anomalies: [], crises: [], opportunities: [] },
    equipment: equipmentConfigData || { equipment: [] },
    system: systemDefinitionsData || {},
    scenes: storyScenesData || { scenes: [] },
    storyPoints: { storyPoints: [] }
  }

  const { configs, updateConfigItem, addConfigItem, removeConfigItem, exportConfig } = useConfigManager(initialConfigs)

  // Обновляем статистику при изменении конфигураций
  useEffect(() => {
    const stats = getConfigStats(configs)
    setConfigStats(stats)
  }, [configs])

  // Обработчики для модального окна
  const handleEdit = (entity: any, entityType: keyof typeof configs) => {
    openModal(entityType, entity)
  }

  const handleAdd = (entityType: keyof typeof configs) => {
    openModal(entityType, null, undefined, true)
  }

  const handleDelete = (entityId: string, entityType: keyof typeof configs) => {
    removeConfigItem(entityType, entityId)
  }

  const handleSave = (data: any) => {
    if (modalState.isNew) {
      addConfigItem(modalState.type as keyof typeof configs, data)
    } else {
      updateConfigItem(modalState.type as keyof typeof configs, data.id, data)
    }
  }

  // Получение списка сущностей для каждого типа
  const getEntitiesList = (configType: keyof typeof configs, subType?: string) => {
    const config = configs[configType]
    
    switch (configType) {
      case 'actions':
        // Для активов - возвращаем список всех действий как активов
        const actionsList: any[] = []
        if (config?.categories) {
          Object.entries(config.categories).forEach(([categoryKey, category]: [string, any]) => {
            if (category?.actions) {
              Object.entries(category.actions).forEach(([actionKey, action]: [string, any]) => {
                actionsList.push({
                  id: `${categoryKey}-${actionKey}`,
                  name: action.title,
                  description: action.description,
                  category: categoryKey,
                  cost: action.cost,
                  effects: action.effects,
                  risk: action.risk,
                  riskEffects: action.riskEffects,
                  type: 'asset',
                  ...action
                })
              })
            }
          })
        }
        return actionsList
      case 'market':
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
          config.equipment.forEach((item: any) => {
            equipmentList.push({
              ...item,
              type: item.category || 'device',
              category: item.category || 'device'
            })
          })
        }
        return equipmentList
      case 'scenes':
        return Array.isArray(config?.scenes) ? config.scenes : []
      case 'storyPoints':
        return Array.isArray(config?.storyPoints) ? config.storyPoints : []
      case 'system':
        // Обрабатываем структуру system-definitions.json с категоризацией
        const systemList: any[] = []
        if (config?.attributes) {
          config.attributes.forEach((attr: any) => {
            systemList.push({ ...attr, type: 'attribute', category: 'attributes' })
          })
        }
        if (config?.states) {
          config.states.forEach((state: any) => {
            systemList.push({ ...state, type: 'state', category: 'states' })
          })
        }
        if (config?.skills) {
          config.skills.forEach((skill: any) => {
            systemList.push({ ...skill, type: 'skill', category: 'skills' })
          })
        }
        if (config?.resources) {
          config.resources.forEach((resource: any) => {
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
      systems: 'systems',
      storyPoints: 'storyPoints'
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
      system: 'Системы',
      storyPoints: 'Сюжетные точки'
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
        {/* Header */}
        <div className="border-b">
          <div className="flex h-16 items-center px-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Nexus Enslaver - Dev Panel</h1>
              <SyncStatus isSynced={true} lastSync={new Date()} onSync={() => console.log('Синхронизация...')} />
            </div>
            <div className="ml-auto flex items-center space-x-2">
              {/* Статистика */}
              <div className="flex gap-2">
                {Object.entries(configStats).map(([key, count]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {count}
                  </Badge>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDarkMode(!isDarkMode)}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Улучшенное меню */}
            <TabsList className="grid w-full grid-cols-6 glass-panel mb-6">
              <TabsTrigger value="assets" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Активы
              </TabsTrigger>
              <TabsTrigger value="attributes" className="flex items-center gap-2">
                <User className="h-4 w-4" />
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
              <TabsTrigger value="story" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Сюжет
              </TabsTrigger>
              <TabsTrigger value="interactions" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Взаимодействия
              </TabsTrigger>
            </TabsList>

            {/* Таб Активы */}
            <TabsContent value="assets" className="space-y-6">
              <EntityList
                entities={getEntitiesList('actions')}
                entityType="action"
                configType="actions"
                onEdit={(entity) => handleEdit(entity, 'actions')}
                onDelete={(id) => handleDelete(id, 'actions')}
                onAdd={() => handleAdd('actions')}
                title="Активы"
              />
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

            {/* Таб Сюжет */}
            <TabsContent value="story" className="space-y-6">
              <EntityList
                entities={getEntitiesList('scenes')}
                entityType="scene"
                configType="scenes"
                onEdit={(entity) => handleEdit(entity, 'scenes')}
                onDelete={(id) => handleDelete(id, 'scenes')}
                onAdd={() => handleAdd('scenes')}
                title="Сюжетные сцены"
              />
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
            entity={modalState.entity}
            entityType={getEntityType(modalState.type)}
            onSave={handleSave}
            isNew={modalState.isNew}
          />
        </div>
      </div>
    </div>
  )
}

export default NexusEnslaverGame
