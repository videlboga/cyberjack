"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sun, Moon, Settings, FileCode, Plus, X, Eye, Search, Zap } from "lucide-react"
import { Users, Building, FileText, BarChart, Wrench, User, Cog, BookOpen, Film, Target, Package, Star } from "lucide-react"
import Link from "next/link"

// Импортируем наши новые компоненты и хуки
import { useModal } from "./hooks/useModal"
import { useConfigManager } from "./hooks/useConfigManager"
import { saveConfigToFile } from '@/lib/config-sync'
import { syncConfigToFiles } from '@/lib/sync-utils'
import { EnhancedEditModal } from "./components/ui/EnhancedEditModal"
import { UserAssetsModal } from "./components/ui/UserAssetsModal"
import { EntityList } from "./components/ui/EntityList"
import { SyncStatus } from "./components/ui/SyncStatus"

import UserKnowledgePanel from "./components/ui/UserKnowledgePanel"



// Импортируем конфигурации и утилиты синхронизации
import { loadUnifiedConfigV2 } from "@/lib/unified-config-loader"



import {
  type PlayerKnowledge,
  type PlayerCharacterKnowledge
} from "@/lib/unified-entities"


// Функция для генерации уникальных ID
let idCounter = 0
const generateUniqueId = (prefix: string = '') => {
  idCounter++
  return `${prefix}${Date.now()}-${idCounter}`
}

const NexusEnslaverGame = () => {
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState("entities")
  const [activeSubTab, setActiveSubTab] = useState("assets")
  const [configStats, setConfigStats] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  


  // Состояние для панели знаний пользователя
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserKnowledgePanel, setShowUserKnowledgePanel] = useState(false)

  // Состояние для выбранного персонажа
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null)

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
    station: { stationEntities: {} },
    characterAI: { poses: {}, actions: {}, tools: {}, emotions: {}, fetishes: {} }
  })

  // Состояние для Character AI конфигурации
  const [characterAIConfig, setCharacterAIConfig] = useState<any>(null)

  // Загружаем конфигурации при монтировании компонента
  useEffect(() => {
    const loadConfigs = async () => {
      try {

        
        const loadedConfigs = await loadUnifiedConfigV2()

        // Нормализуем под ожидаемую dev-структуру UI (вложенные разделы)
        const normalized = {
          assets: { assets: Array.isArray((loadedConfigs as any)?.assets?.assets) ? (loadedConfigs as any).assets.assets : [] },
          actions: { categories: (loadedConfigs as any)?.actions?.categories || {} },
          contracts: { available: Array.isArray((loadedConfigs as any)?.contracts) ? (loadedConfigs as any).contracts : ((loadedConfigs as any)?.contracts?.available || []) },
          events: {
            anomalies: (loadedConfigs as any)?.events?.anomalies || [],
            crises: (loadedConfigs as any)?.events?.crises || [],
            opportunities: (loadedConfigs as any)?.events?.opportunities || []
          },
          characters: { characters: Array.isArray((loadedConfigs as any)?.characters) ? (loadedConfigs as any).characters : [] },
          equipment: { equipment: Array.isArray((loadedConfigs as any)?.equipment) ? (loadedConfigs as any).equipment : [] },
          system: (loadedConfigs as any)?.system || {},
          users: { users: Array.isArray((loadedConfigs as any)?.users) ? (loadedConfigs as any).users : [] },
          station: (loadedConfigs as any)?.station || { stationEntities: {} },
          characterAI: (loadedConfigs as any)?.characterAI || null,
          storyScenes: (loadedConfigs as any)?.storyScenes || []
        }

        setConfigs(normalized)
        if ((loadedConfigs as any)?.characterAI) {
          setCharacterAIConfig((loadedConfigs as any).characterAI)
        }
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

    }
  }, [configs.characterAI])

  // Функция для выбора персонажа для настройки
  const handleViewCharacterStats = (character: any) => {
    setSelectedCharacter(character)
  }

  // Функция для сброса выбранного персонажа
  const handleCloseCharacterStats = () => {
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
      case 'station':
        baseEntity = {
          id: `station-${Date.now()}`,
          name: 'Новая сущность станции',
          type: 'market',
          description: 'Описание новой сущности станции',
          icon: '/icons/default-station.svg',
          defaultSceneId: 'default_scene',
          probability: 20,
          customSceneId: 'custom_scene',
          isActive: true,
          metadata: {}
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

    removeConfigItem(entityType as any, entityId)
  }

  const handleSave = (data: any) => {


    if (modalState.isNew) {
      addConfigItem(modalState.type as any, data)

      // Если это новая сущность станции, сохраняем её в station
      if (modalState.type === 'station') {
        setConfigs(prev => ({
          ...prev,
          station: {
            ...prev.station,
            stationEntities: {
              ...prev.station.stationEntities,
              [data.id]: data
            }
          }
        }))
        // Сохраняем stationEntities в файл
        try {
          const updatedStation = {
            ...configs.station,
            stationEntities: {
              ...configs.station.stationEntities,
              [data.id]: data
            }
          }
          saveConfigToFile('station', updatedStation)
          syncConfigToFiles('station', updatedStation)
        } catch (error) {
          console.error('Ошибка сохранения новой stationEntities:', error)
        }
      }
    } else {
      updateConfigItem(modalState.type as any, data.id, data)

      // Если это персонаж и у него есть poses, сохраняем их в characterAI
      if (modalState.type === 'characters' && data.poses) {
        setConfigs(prev => ({
          ...prev,
          characterAI: {
            ...prev.characterAI,
            poses: data.poses
          }
        }))
        // Сохраняем poses в файл
        try {
          const updatedCharacterAI = {
            ...configs.characterAI,
            poses: data.poses
          }
          saveConfigToFile('characterAI', updatedCharacterAI)
          syncConfigToFiles('characterAI', updatedCharacterAI)
        } catch (error) {
          console.error('Ошибка сохранения poses:', error)
        }
      }

      // Если это сущность станции, сохраняем её в station
      if (modalState.type === 'station') {
        setConfigs(prev => ({
          ...prev,
          station: {
            ...prev.station,
            stationEntities: {
              ...prev.station.stationEntities,
              [data.id]: data
            }
          }
        }))
        // Сохраняем stationEntities в файл
        try {
          const updatedStation = {
            ...configs.station,
            stationEntities: {
              ...configs.station.stationEntities,
              [data.id]: data
            }
          }
          saveConfigToFile('station', updatedStation)
          syncConfigToFiles('station', updatedStation)
        } catch (error) {
          console.error('Ошибка сохранения stationEntities:', error)
        }
      }
    }
  }

  // ===== ФУНКЦИИ СИСТЕМЫ АНАЛИЗА ХАРАКТЕРИСТИК =====







  // Функция для выбора персонажа для настройки
  const handleConfigureCharacter = (character: any) => {
    setSelectedCharacter(character)
  }

  // Функция для обновления персонажа
  const handleUpdateCharacter = async (updatedCharacter: any) => {
    try {
      // Обновляем локальное состояние
      setSelectedCharacter(updatedCharacter)

      // Обновляем в конфигурации
      const updatedConfigs = {
        ...configs,
        characters: {
          ...configs.characters,
          characters: configs.characters.characters.map((char: any) =>
            char.id === updatedCharacter.id ? updatedCharacter : char
          )
        }
      }
      setConfigs(updatedConfigs)

      // Сохраняем через API
      const response = await fetch('/api/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'characters',
          data: [updatedCharacter]
        }),
      })

      if (response.ok) {
        console.log('✅ Персонаж успешно сохранен:', updatedCharacter.name)
      } else {
        const errorData = await response.json()
        console.error('❌ Ошибка при сохранении персонажа:', errorData)
      }
    } catch (error) {
      console.error('❌ Ошибка при сохранении персонажа:', error)
    }
  }

  // ===== ФУНКЦИИ ДЛЯ ПАНЕЛИ ЗНАНИЙ ПОЛЬЗОВАТЕЛЯ =====

  const handleViewUserKnowledge = (user: any) => {
    setSelectedUser(user)
    setShowUserKnowledgePanel(true)

    console.log('👁️ Открываем панель знаний пользователя:', user.username)
  }

  const handleCloseUserKnowledgePanel = () => {
    setSelectedUser(null)
    setShowUserKnowledgePanel(false)
  }

  // ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ИНСТРУМЕНТАМИ АНАЛИЗА =====

  const handleStartToolAnalysis = (character: any, tool: any) => {
    if (!character) return

    console.log('🔧 Начат анализ с инструментом:', {
      character: character.name,
      tool: tool.name,
      cost: tool.cost,
      time: tool.speed
    })

    // Имитация использования инструмента
    // В реальной игре здесь будет интеграция с экономикой и временем
    alert(`Инструмент "${tool.name}" использован на персонаже "${character.name}"\n\nСтоимость: ${tool.cost} кредитов\nВремя: ${tool.speed} минут\n\nФункционал в разработке!`)
  }

  const handleManageUserAssets = (user: any) => {
    // Получаем актуальные данные пользователя из конфигурации
    const currentUsers = getEntitiesList('users')
    const currentUserData = currentUsers.find((u: any) => u.id === user.id)

    if (currentUserData) {
      setUserAssetsModalState({
        isOpen: true,
        user: currentUserData
      })
    } else {
      setUserAssetsModalState({
        isOpen: true,
        user
      })
    }
  }

  const handleSaveUserAssets = (userId: string, assets: any[], equipment: any[]) => {
    console.log('🎯 handleSaveUserAssets вызван:', {
      userId,
      assetsCount: assets.length,
      equipmentCount: equipment.length,
      equipmentDetails: equipment.map(e => ({ itemId: e.itemId, name: e.name }))
    })

    // Получаем актуальные данные пользователя перед сохранением
    const currentUsers = getEntitiesList('users')
    const currentUserData = currentUsers.find((u: any) => u.id === userId)
    console.log('👤 Текущие данные пользователя:', {
      id: currentUserData?.id,
      characters: currentUserData?.characters,
      userEquipment: currentUserData?.userEquipment
    })


    // Извлекаем ID персонажей из активов для обновления массива characters
    const characterIds = assets.map(asset => asset.assetId)
    console.log('👥 ID персонажей:', characterIds)

    // Извлекаем ID оборудования для обновления массива userEquipment
    const equipmentIds = equipment.map(item => item.itemId)
    console.log('🎯 Извлеченные ID оборудования:', equipmentIds)

    // Обновляем пользователя с новыми активами, оборудованием и персонажами
    // Используем текущие данные из БД как базу, а не из модала
    const updatedUser = {
      ...(currentUserData || userAssetsModalState.user),
      assets,
      equipment,
      characters: characterIds, // Синхронизируем characters с assets
      userEquipment: equipmentIds // Синхронизируем userEquipment с equipment
    }



    try {
      console.log('💾 Сохраняем пользователя локально:', {
        id: updatedUser.id,
        characters: updatedUser.characters,
        userEquipment: updatedUser.userEquipment,
        assetsCount: updatedUser.assets?.length,
        equipmentCount: updatedUser.equipment?.length
      })

      updateConfigItem('users', userId, updatedUser)
      console.log('✅ updateConfigItem выполнен')

      // Немедленно проверяем, что данные дошли до сервера
      console.log('🌐 Отправляем на сервер:', {
        configType: 'users',
        userCount: 1,
        userEquipment: updatedUser.userEquipment
      })

      fetch('/api/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configType: 'users',
          data: {
            users: [updatedUser] // API ожидает массив пользователей
          }
        })
      })
      .then(response => response.json())
      .then(result => {
        // Конфигурация обновляется автоматически через updateConfigItem
      })
      .catch(error => {
        console.error('Ошибка синхронизации с сервером:', error)
      })

    } catch (error) {
      console.error('Ошибка сохранения данных пользователя:', error)
    }
  }



  // Получение списка сущностей для каждого типа
  const getEntitiesList = (configType: string, subType?: string) => {
    // Берём данные сначала из managedConfigs, если они ещё не обновились — из raw configs
    const config = (managedConfigs as any)[configType] ?? (configs as any)[configType]
    
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
        // Для активов - возвращаем список из assets.json; если пусто, используем персонажей как источник активов
        const assetsList = Array.isArray(config?.assets) ? config.assets.filter((asset: any) => !asset.deleted) : []
        if (assetsList.length > 0) return assetsList
        // Fallback: берем из characters-unified.json
        const charactersCfg = (managedConfigs as any)?.characters
        const charactersArr: any[] = Array.isArray(charactersCfg?.characters) ? charactersCfg.characters : []
        return charactersArr
          .filter((character: any) => !character.deleted)
          .map((character: any) => ({
            id: character.id,
            name: character.name,
            rank: character.rank,
            type: 'character',
            ...character
          }))
      case 'users':
        // Для пользователей - возвращаем список всех пользователей, исключая удаленные
        const allUsers = Array.isArray(config?.users) ? config.users : []
        const activeUsers = allUsers.filter((user: any) => !user.deleted)


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
                attributes: character.attributes,
                states: character.states,
                fetishes: character.fetishes,
                knowledge: character.knowledge,
                analysisHistory: character.analysisHistory,
                availableAnalysisMethods: character.availableAnalysisMethods,
                type: 'character',
                poses: configs.characterAI?.poses || {},
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
        const eqArray: any[] = Array.isArray(config?.equipment)
          ? config.equipment
          : (Array.isArray((configs as any)?.equipment?.equipment) ? (configs as any).equipment.equipment : [])
        if (Array.isArray(eqArray)) {
          eqArray.filter((item: any) => !item.deleted).forEach((item: any) => {
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
        // Сначала пробуем managedConfigs, потом configs
        const stationData = config?.station || (configs as any)?.station || {}
        if (stationData.stationEntities) {
          Object.entries(stationData.stationEntities).forEach(([id, entity]: [string, any]) => {
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
                icon: entity.icon,
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
        // Обрабатываем system из разных источников (unified или system-definitions.json)
        const sys = config ?? (configs as any)?.system ?? {}
        const attributes = Array.isArray(sys.attributes) ? sys.attributes : ((sys?.definitions?.attributes) || [])
        const states = Array.isArray(sys.states) ? sys.states : ((sys?.definitions?.states) || [])
        const fetishes = Array.isArray(sys.fetishes) ? sys.fetishes : ((sys?.definitions?.fetishes) || [])
        const resources = Array.isArray(sys.resources) ? sys.resources : ((sys?.definitions?.resources) || [])
        const systemList: any[] = []
        attributes.filter((a: any) => !a?.deleted).forEach((a: any) => systemList.push({ ...a, type: 'attribute', category: 'attributes' }))
        states.filter((s: any) => !s?.deleted).forEach((s: any) => systemList.push({ ...s, type: 'state', category: 'states' }))
        fetishes.filter((f: any) => !f?.deleted).forEach((f: any) => systemList.push({ ...f, type: 'fetish', category: 'fetishes' }))
        resources.filter((r: any) => !r?.deleted).forEach((r: any) => systemList.push({ ...r, type: 'resource', category: 'resources' }))
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
              
              <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="entities" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Сущности
                </TabsTrigger>
                <TabsTrigger value="config" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Конфигурация
                </TabsTrigger>
                <TabsTrigger value="gameplay" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Игровая логика
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Группа Сущности */}
            <TabsContent value="entities" className="space-y-6">
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-lg mb-4">
                  <TabsTrigger value="assets" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Персонажи
                  </TabsTrigger>
                  <TabsTrigger value="users" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Пользователи
                  </TabsTrigger>
                </TabsList>

                {/* Подтаб Персонажи */}
                <TabsContent value="assets" className="space-y-6">
              <EntityList
                entities={getEntitiesList('characters')}
                entityType="character"
                configType="characters"
                onEdit={(entity) => handleEdit(entity, 'characters')}
                onDelete={(id) => handleDelete(id, 'characters')}
                onView={(entity) => handleViewCharacterStats(entity)}
                onAnalyze={undefined}

                onAdd={() => handleAdd('characters')}
                title="Персонажи (Активы)"
                currentUser={getEntitiesList('users')[0]} // Передаем текущего пользователя
              />
                </TabsContent>

                {/* Подтаб Пользователи */}
                <TabsContent value="users" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Пользователи
                      </CardTitle>
                      <CardDescription>
                        Управление пользователями, их атрибутами и привязкой персонажей. Пользователи создаются через регистрацию в prod режиме.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <EntityList
                        entities={getEntitiesList('users')}
                        entityType="user"
                        configType="users"
                        onEdit={(entity) => handleEdit(entity, 'users')}
                        onDelete={(id) => handleDelete(id, 'users')}
                        onManageAssets={handleManageUserAssets}
                        onViewKnowledge={handleViewUserKnowledge}
                        onAdd={undefined}
                        title=""
                  />
                </CardContent>
              </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Группа Конфигурация */}
            <TabsContent value="config" className="space-y-6">
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-lg mb-4">
                  <TabsTrigger value="attributes" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Атрибуты персонажей
                  </TabsTrigger>
                  <TabsTrigger value="user-attributes" className="flex items-center gap-2">
                    <Cog className="h-4 w-4" />
                    Атрибуты пользователей
                  </TabsTrigger>
                  <TabsTrigger value="items" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Предметы
                  </TabsTrigger>
                </TabsList>

                {/* Подтаб Атрибуты персонажей */}
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

                {/* Подтаб Атрибуты пользователей */}
                <TabsContent value="user-attributes" className="space-y-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cog className="h-5 w-5" />
                      Атрибуты пользователей
                    </CardTitle>
                    <CardDescription>
                      Управление характеристиками пользователей. Эти атрибуты влияют на взаимодействие с персонажами и развитие сюжета.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Лидерские качества */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Лидерские качества</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Лидерство</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Харизма</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Стратегическое мышление</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Принятие решений</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Психологические качества */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Психологические качества</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Эмпатия</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Терпение</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Адаптивность</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Стойкость</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Специфические навыки */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Специфические навыки</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Технические знания</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Бизнес-понимание</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Переговоры</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Оценка рисков</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1</span><span>5</span><span>10</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Личные предпочтения */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Личные предпочтения</CardTitle>
                        <CardDescription>
                          Стиль управления персонажами и подход к их развитию
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Доминирующий стиль</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Мягкий</span><span>Строгий</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Заботливый подход</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Жесткий</span><span>Заботливый</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Строгая дисциплина</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Свободный</span><span>Дисциплинированный</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Творческая свобода</label>
                            <input type="range" min="1" max="10" defaultValue="5" className="w-full" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Консервативный</span><span>Творческий</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </div>
                </TabsContent>

                {/* Подтаб Предметы */}
                <TabsContent value="items" className="space-y-6">
                  <EntityList
                    entities={getEntitiesList('equipment')}
                    entityType="equipment"
                    configType="equipment"
                    onEdit={(entity) => handleEdit(entity, 'equipment')}
                    onDelete={(id) => handleDelete(id, 'equipment')}
                    onAdd={() => handleAdd('equipment')}
                    title="Оборудование и предметы"
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Группа Игровая логика */}
            <TabsContent value="gameplay" className="space-y-6">
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-lg mb-4">
                  <TabsTrigger value="station" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Станция
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

                {/* Подтаб Станция */}
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
                      <Button onClick={(e) => { e.preventDefault(); handleAdd('station'); }}>
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

                {/* Подтаб Сюжетный редактор */}
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

                {/* Подтаб Взаимодействия */}
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
                                  onClick={(e) => { e.preventDefault(); handleEdit(category, 'action-category'); }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.preventDefault(); handleAdd('action', { category: id }); }}
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
                          onClick={(e) => { e.preventDefault(); handleAdd('action-category'); }}
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
                                          onClick={(e) => { e.preventDefault(); handleEdit(action, 'action'); }}
                                          className="h-5 w-5 p-0"
                                        >
                                          <Settings className="h-2.5 w-2.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => { e.preventDefault(); deleteCharacterAIItem('actions', id); }}
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
                                  onClick={(e) => { e.preventDefault(); handleEdit(pose, 'pose'); }}
                                  className="h-5 w-5 p-0"
                                >
                                  <Settings className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.preventDefault(); deleteCharacterAIItem('poses', id); }}
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
                          onClick={(e) => { e.preventDefault(); handleAdd('pose'); }}
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
                                  onClick={(e) => { e.preventDefault(); handleEdit(category, 'tool-category'); }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.preventDefault(); handleAdd('tool', { category: id }); }}
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
                                          onClick={(e) => { e.preventDefault(); deleteCharacterAIItem('tools', id); }}
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
                                      onClick={(e) => { e.preventDefault(); deleteCharacterAIItem('poses', id); }}
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



        {/* Панель знаний пользователя */}
        {showUserKnowledgePanel && selectedUser && (
          <UserKnowledgePanel
            user={selectedUser}
            characters={getEntitiesList('characters')}
            onClose={handleCloseUserKnowledgePanel}
          />
        )}
      </div>
    </div>
  )
}

export default NexusEnslaverGame
