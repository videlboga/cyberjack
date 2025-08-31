'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  FileText, 
  Target, 
  Settings, 
  Play, 
  Save, 
  Download, 
  Upload,
  Eye,
  Edit,
  Zap,
  ArrowLeft,
  Plus,
  FolderOpen,
  Gamepad2,
  Package,
  Building
} from "lucide-react"
import Link from "next/link"
import { SimpleStoryEditor } from "../components/story/SimpleStoryEditor"
import { StationEntitiesManager } from "../components/story/StationEntitiesManager"
import { convertToSimpleFormat } from "@/lib/simple-story-utils"
import { SimpleStoryConfig } from "@/lib/simple-story-types"
import { Character as Asset, User, GameState } from "@/lib/unified-entities"

// Импортируем данные
import storyScenesData from "../../../data/story-scenes-unified.json"
import stationEntitiesData from "../../../data/station-entities.json"

// Тестовые данные для демонстрации системы условий
const demoAssets: Asset[] = [
  {
    id: "demo_asset_1",
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
  },
  {
    id: "demo_asset_2",
    name: "Мария",
    rank: "Middle",
    avatar: "👩‍💼",
    price: 350,
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

const demoUser: User = {
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

export default function StoryEditorPage() {
  const [storyData, setStoryData] = useState<SimpleStoryConfig>(() => {
    // начальное состояние – из json, затем перезапишем из localStorage (клиент)
    const converted = convertToSimpleFormat(storyScenesData)
    return {
      ...converted,
      stationEntities: stationEntitiesData
    }
  })
  const [activeTab, setActiveTab] = useState<'simple' | 'station'>('simple')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Игровые сущности для условий
  const gameEntities = {
    assets: demoAssets,
    users: [demoUser],
    equipment: [],
    stationEntities: storyData.stationEntities || {}
  }

  // Подхватываем сохранённые данные из localStorage при монтировании на клиенте
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('cyberjack-simple-story-data') : null
      if (raw) {
        const parsed = JSON.parse(raw)
        setStoryData(parsed)
        setHasUnsavedChanges(false)
      }
    } catch (e) {
      console.error('Ошибка чтения localStorage:', e)
    }
  }, [])

  // Обработчики изменений
  const handleStoryDataChange = (newData: SimpleStoryConfig) => {
    setStoryData(newData)
    setHasUnsavedChanges(true)
  }





  const handleSave = () => {
    try {
      console.log('Сохранение данных:', storyData)
      
      // Симуляция сохранения - в реальном приложении здесь был бы API вызов
      localStorage.setItem('cyberjack-simple-story-data', JSON.stringify(storyData))
      setHasUnsavedChanges(false)
      
      // Показываем уведомление об успешном сохранении
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50'
      notification.textContent = 'Данные успешно сохранены!'
      document.body.appendChild(notification)
      setTimeout(() => {
        document.body.removeChild(notification)
      }, 3000)
      
    } catch (error) {
      console.error('Ошибка при сохранении:', error)
      alert('Ошибка при сохранении данных')
    }
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(storyData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'simple-story-data.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string)
          setStoryData(importedData)
          setHasUnsavedChanges(true)
        } catch (error) {
          console.error('Ошибка при импорте файла:', error)
        }
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <div className="flex items-center space-x-4">
            <Link href="/game">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к игре
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Упрощенный сюжетный редактор</h1>
              <p className="text-sm text-muted-foreground">
                Создавайте сцены, используя существующие сущности игры
              </p>
            </div>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Несохраненные изменения
              </Badge>
            )}
          </div>
          
          <div className="ml-auto flex items-center space-x-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
              >
                <Save className="h-3 w-3 mr-1" />
                Сохранить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
              >
                <Download className="h-3 w-3 mr-1" />
                Экспорт
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Импортировать файл JSON"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="pointer-events-none"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Импорт
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100vh-4rem)]">
          <div className="border-b px-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simple" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Редактор сцен
              </TabsTrigger>
              <TabsTrigger value="station" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Станция
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="simple" className="h-full m-0">
            <SimpleStoryEditor
              storyData={storyData}
              onSave={(newData) => {
                // Сохраняем немедленно и снимаем флаг несохранённых изменений
                try {
                  setStoryData(newData)
                  localStorage.setItem('cyberjack-simple-story-data', JSON.stringify(newData))
                  setHasUnsavedChanges(false)
                  // Небольшой тост
                  const notification = document.createElement('div')
                  notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50'
                  notification.textContent = 'Изменения сохранены'
                  document.body.appendChild(notification)
                  setTimeout(() => document.body.removeChild(notification), 2000)
                } catch (e) {
                  console.error('Ошибка при сохранении данных:', e)
                }
              }}
              gameEntities={gameEntities}
            />
          </TabsContent>

          <TabsContent value="station" className="h-full m-0">
            <StationEntitiesManager
              entities={storyData.stationEntities || {}}
              onUpdate={(stationEntities) => {
                setStoryData(prev => ({
                  ...prev,
                  stationEntities
                }))
                setHasUnsavedChanges(true)
              }}
              scenes={storyData.scenes.map(scene => ({ id: scene.id, title: scene.title }))}
            />
          </TabsContent>


        </Tabs>
      </div>
    </div>
  )
}
