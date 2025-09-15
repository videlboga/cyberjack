"use client"

import { useState, useEffect } from 'react'

interface Character {
  id: string
  name: string
  description: string | null
  age: number | null
  avatar: string | null
  isActive: boolean
  characteristics: Array<{
    currentValue: number
    baseValue: number
    definition: {
      name: string
      category: string
    }
  }>
}

interface PoseData {
  id: string
  name: string
  angles: Array<{
    id: string
    name: string
    angle: string
    media: {
      images: Array<{
        id: string
        url: string
        filename: string
      }>
    }
    zones: Array<{
      id: string
      name: string
      x: number
      y: number
      width: number
      height: number
      anatomy: {
        id: string
        name: string
      } | null
    }>
  }>
}

interface CharacterDisplayProps {
  character: Character
  currentPose: string | null
  currentAngle: string | null
  activeZones: boolean
  onZoneClick: (zoneId: string) => void
  poseData?: {
    poseId: string
    poseName: string
    defaultAngle: string
    angleName: string
    media: {
      images: Array<{
        id: string
        url: string
        filename: string
      }>
    }
    zones: Array<{
      id: string
      name: string
      x: number
      y: number
      width: number
      height: number
    }>
  }
  onZoneHold?: (zoneId: string) => void // Обработчик холда зоны
  actionInProgress?: boolean // Действие в процессе
}

export function CharacterDisplay({
  character,
  currentPose,
  currentAngle,
  activeZones,
  onZoneClick,
  poseData: externalPoseData,
  onZoneHold,
  actionInProgress = false
}: CharacterDisplayProps) {
  const [poseData, setPoseData] = useState<PoseData | null>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [holdTimers, setHoldTimers] = useState<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    if (externalPoseData) {
      // Используем внешние данные позы
      setPoseData({
        id: externalPoseData.poseId,
        name: externalPoseData.poseName,
        angles: [{
          id: externalPoseData.defaultAngle,
          name: externalPoseData.angleName,
          angle: 'default',
          media: externalPoseData.media,
          zones: externalPoseData.zones
        }]
      })
      setLoading(false)
    } else if (currentPose) {
      loadPoseData(currentPose)
    }
  }, [externalPoseData, currentPose])

  useEffect(() => {
    if (poseData && currentAngle) {
      const angle = poseData.angles.find(a => a.id === currentAngle)
      if (angle && angle.media.images.length > 0) {
        setCurrentImage(angle.media.images[0].url)
      }
    }
  }, [poseData, currentAngle])

  const loadPoseData = async (poseId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/poses/${poseId}`)

      if (response.ok) {
        const data = await response.json()
        setPoseData(data)
      }
    } catch (error) {
      console.error('❌ Error loading pose data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentAngleData = () => {
    if (!poseData || !currentAngle) return null
    return poseData.angles.find(a => a.id === currentAngle)
  }

  const getCurrentZones = () => {
    const angleData = getCurrentAngleData()
    const zones = angleData?.zones || []
    return zones
  }

  const handleZoneMouseDown = (zoneId: string) => {
    if (!actionInProgress || !onZoneHold) return

    // Создаем таймер для повторного выполнения действия каждую секунду
    const timer = setInterval(() => {
      onZoneHold(zoneId)
    }, 1000) // Каждую секунду

    setHoldTimers(prev => new Map(prev).set(zoneId, timer))
  }

  const handleZoneMouseUp = (zoneId: string) => {
    const timer = holdTimers.get(zoneId)
    if (timer) {
      clearInterval(timer)
      setHoldTimers(prev => {
        const newMap = new Map(prev)
        newMap.delete(zoneId)
        return newMap
      })
    }
  }

  const handleZoneMouseLeave = (zoneId: string) => {
    handleZoneMouseUp(zoneId)
  }

  // Очищаем таймеры при размонтировании
  useEffect(() => {
    return () => {
      holdTimers.forEach(timer => clearInterval(timer))
    }
  }, [holdTimers])

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!activeZones) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    // Находим зону, в которую попал клик
    const zones = getCurrentZones()
    const clickedZone = zones.find(zone => {
      return x >= zone.x && x <= zone.x + zone.width &&
             y >= zone.y && y <= zone.y + zone.height
    })

    if (clickedZone) {
      onZoneClick(clickedZone.id)
    }
  }

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-black bg-opacity-50 text-white px-6 py-4 rounded-lg backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p>Загрузка персонажа...</p>
        </div>
      </div>
    )
  }

  if (!currentImage) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-black bg-opacity-50 text-white px-6 py-4 rounded-lg backdrop-blur-sm text-center">
          <div className="text-6xl mb-4">👤</div>
          <p className="text-lg font-semibold">{character.name}</p>
          <p className="text-sm text-gray-300">Изображение загружается...</p>
        </div>
      </div>
    )
  }

  const zones = getCurrentZones()

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Основное изображение персонажа */}
      <div
        className="relative max-w-full max-h-full cursor-pointer"
        onClick={handleImageClick}
        className={`${activeZones ? 'cursor-crosshair' : 'cursor-default'} touch-manipulation`}
      >
        <img
          src={currentImage}
          alt={`${character.name} - ${poseData?.name || 'поза'}`}
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />

        {/* Активные зоны (только при выбранном действии) */}
        {activeZones && zones.map((zone) => {
          return (
            <div
              key={zone.id}
              className="absolute border border-black hover:border-gray-600 transition-all duration-200 cursor-pointer"
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`
              }}
              onClick={(e) => {
                e.stopPropagation()
                onZoneClick(zone.id)
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                handleZoneMouseDown(zone.id)
              }}
              onMouseUp={(e) => {
                e.stopPropagation()
                handleZoneMouseUp(zone.id)
              }}
              onMouseLeave={(e) => {
                e.stopPropagation()
                handleZoneMouseLeave(zone.id)
              }}
              title={`${zone.name} - клик для действия, удержание для повторения`}
            >
              {/* Индикатор зоны */}
              <div className="absolute -top-6 left-0 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {zone.name}
              </div>
            </div>
          )
        })}

        {/* Индикатор активных зон */}
        {activeZones && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white px-3 py-1 rounded-lg text-sm">
            🎯 Активные зоны включены
            <div className="mt-1 text-xs">
              Клик - действие, удержание - повтор
            </div>
          </div>
        )}
      </div>

      {/* Информация о персонаже */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
        <div className="text-lg font-semibold">{character.name}</div>
        {poseData && (
          <div className="text-sm text-gray-300">
            Поза: {poseData.name}
          </div>
        )}
        {character.age && (
          <div className="text-sm text-gray-300">
            Возраст: {character.age}
          </div>
        )}
      </div>

      {/* Переключатель ракурсов */}
      {poseData && poseData.angles.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-2 bg-black bg-opacity-50 backdrop-blur-sm rounded-lg p-2">
            {poseData.angles.map((angle) => (
              <button
                key={angle.id}
                onClick={() => setCurrentImage(
                  angle.media.images.length > 0 ? angle.media.images[0].url : currentImage
                )}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  angle.id === currentAngle
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white hover:bg-opacity-20'
                }`}
              >
                {angle.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
