'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building,
  Play,
  Clock,
  Users,
  Zap,
  ShoppingCart,
  Gavel,
  AlertTriangle,
  MapPin,
  Calendar
} from 'lucide-react'

interface Station {
  id: string
  name: string
  type: string
  description?: string
  defaultSceneId?: string
  isActive: boolean
  metadata?: {
    [key: string]: any
  }
  availableScenes?: Scene[]
}

interface Scene {
  id: string
  name: string
  description?: string
  probability: number
  triggerConditions?: any
  screens: Screen[]
}

interface Screen {
  id: string
  name: string
  description?: string
  content: any
  choices: Choice[]
}

interface Choice {
  id: string
  text: string
  description?: string
  nextScreenId?: string
  consequences?: any[]
  showConditions?: any[]
}

interface StationsPanelProps {
  userId: string
  onSceneStart?: (sceneId: string, stationId: string) => void
  onNotification?: (notification: any) => void
}

// Иконки для разных типов станций
const getStationIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'market':
    case 'shop':
      return <ShoppingCart className="h-5 w-5" />
    case 'auction':
      return <Gavel className="h-5 w-5" />
    case 'contract':
      return <Users className="h-5 w-5" />
    case 'anomaly':
      return <AlertTriangle className="h-5 w-5" />
    case 'event':
      return <Calendar className="h-5 w-5" />
    case 'location':
      return <MapPin className="h-5 w-5" />
    default:
      return <Building className="h-5 w-5" />
  }
}

// Цвета для разных типов станций
const getStationColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'market':
    case 'shop':
      return 'bg-green-600 hover:bg-green-500'
    case 'auction':
      return 'bg-purple-600 hover:bg-purple-500'
    case 'contract':
      return 'bg-blue-600 hover:bg-blue-500'
    case 'anomaly':
      return 'bg-red-600 hover:bg-red-500'
    case 'event':
      return 'bg-yellow-600 hover:bg-yellow-500'
    case 'location':
      return 'bg-indigo-600 hover:bg-indigo-500'
    default:
      return 'bg-gray-600 hover:bg-gray-500'
  }
}

export function StationsPanel({ userId, onSceneStart, onNotification }: StationsPanelProps) {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [startingScene, setStartingScene] = useState<string | null>(null)

  // Загрузка доступных станций
  const fetchStations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/story/entities?isActive=true')

      if (response.ok) {
        const stationsData = await response.json()

        // Получаем доступные сцены для каждой станции
        const stationsWithScenes = await Promise.all(
          stationsData.map(async (station: Station) => {
            try {
              const scenesResponse = await fetch(`/api/story/scenes?stationId=${station.id}&isActive=true`)
              if (scenesResponse.ok) {
                const scenes = await scenesResponse.json()
                return {
                  ...station,
                  availableScenes: scenes
                }
              }
            } catch (error) {
              console.error(`Ошибка загрузки сцен для станции ${station.id}:`, error)
            }
            return station
          })
        )

        setStations(stationsWithScenes)
      } else {
        console.error('Ошибка загрузки станций:', response.status)
      }
    } catch (error) {
      console.error('Ошибка при загрузке станций:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStations()
  }, [userId])

  // Запуск сцены
  const handleStartScene = async (sceneId: string, stationId: string) => {
    try {
      setStartingScene(sceneId)

      // Уведомляем родительский компонент о запуске сцены
      if (onSceneStart) {
        onSceneStart(sceneId, stationId)
      }

      // Показываем уведомление
      if (onNotification) {
        onNotification({
          id: Date.now(),
          type: 'scene',
          message: 'Сцена запущена',
          timestamp: new Date()
        })
      }

      // Здесь можно добавить дополнительную логику запуска сцены
      console.log(`Запуск сцены ${sceneId} на станции ${stationId}`)

    } catch (error) {
      console.error('Ошибка при запуске сцены:', error)

      if (onNotification) {
        onNotification({
          id: Date.now(),
          type: 'error',
          message: 'Ошибка при запуске сцены',
          timestamp: new Date()
        })
      }
    } finally {
      setStartingScene(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-gray-400">Загрузка станций...</p>
      </div>
    )
  }

  if (stations.length === 0) {
    return (
      <div className="p-4 text-center">
        <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Нет доступных станций</p>
        <Button
          onClick={fetchStations}
          variant="outline"
          className="mt-4"
        >
          Обновить
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Building className="h-5 w-5" />
          Станции
        </h3>
        <Button
          onClick={fetchStations}
          variant="outline"
          size="sm"
        >
          Обновить
        </Button>
      </div>

      <div className="space-y-3">
        {stations.map((station) => (
          <Card key={station.id} className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  {getStationIcon(station.type)}
                  {station.name}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {station.type}
                </Badge>
              </div>
              {station.description && (
                <p className="text-gray-400 text-sm">{station.description}</p>
              )}
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-2">
                {/* Статистика станции */}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    <span>{station.availableScenes?.length || 0} сцен</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    <span>Активна</span>
                  </div>
                </div>

                {/* Кнопки запуска сцен */}
                {station.availableScenes && station.availableScenes.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {station.availableScenes.map((scene) => (
                      <Button
                        key={scene.id}
                        onClick={() => handleStartScene(scene.id, station.id)}
                        disabled={startingScene === scene.id}
                        className={`w-full justify-start ${getStationColor(station.type)}`}
                        size="sm"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {scene.name}
                        {scene.probability && scene.probability < 100 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {scene.probability}%
                          </Badge>
                        )}
                        {startingScene === scene.id && (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-white ml-2"></div>
                        )}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-gray-500 text-sm">Нет доступных сцен</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Информация о системе */}
      <div className="mt-6 p-3 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Информация</span>
        </div>
        <p className="text-xs text-gray-400">
          Станции предоставляют доступ к различным сценам и событиям.
          Каждая станция имеет свои уникальные возможности и условия активации.
        </p>
      </div>
    </div>
  )
}
