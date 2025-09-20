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
  onZoneHold?: (zoneId: string, isHolding: boolean) => void // Обработчик холда зоны
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
  const [imageLoaded, setImageLoaded] = useState(false)
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
    // Если есть внешние данные позы (из игрового интерфейса), используем их
    if (externalPoseData?.zones) {
      return externalPoseData.zones
    }

    // Иначе ищем в структуре angles (для админки)
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

    // Получаем элемент изображения
    const imgElement = document.querySelector('img[alt*="поза"]') as HTMLImageElement
    if (!imgElement) return

    const container = imgElement.parentElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()

    // Получаем координаты клика относительно контейнера
    const clickX = event.clientX - containerRect.left
    const clickY = event.clientY - containerRect.top


    // Находим зону, в которую попал клик
    const zones = getCurrentZones()

    const clickedZone = zones.find(zone => {
      // Вычисляем размеры изображения с учетом object-contain (как в рендеринге)
      const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight
      const containerAspect = containerRect.width / containerRect.height

      let displayWidth, displayHeight, offsetX, offsetY

      if (imgAspect > containerAspect) {
        // Изображение шире контейнера - подгоняем по ширине
        displayWidth = containerRect.width
        displayHeight = containerRect.width / imgAspect
        offsetX = 0
        offsetY = (containerRect.height - displayHeight) / 2
      } else {
        // Изображение выше контейнера - подгоняем по высоте
        displayHeight = containerRect.height
        displayWidth = containerRect.height * imgAspect
        offsetX = (containerRect.width - displayWidth) / 2
        offsetY = 0
      }

      // Конвертируем координаты зоны в координаты отображения
      const scaleX = displayWidth / imgElement.naturalWidth
      const scaleY = displayHeight / imgElement.naturalHeight

      const displayX = zone.x * scaleX + offsetX
      const displayY = zone.y * scaleY + offsetY
      const displayZoneWidth = zone.width * scaleX
      const displayZoneHeight = zone.height * scaleY

      // Проверяем, попадает ли клик в зону
      const inZone = clickX >= displayX && clickX <= displayX + displayZoneWidth &&
                     clickY >= displayY && clickY <= displayY + displayZoneHeight


      return inZone
    })

    if (clickedZone) {
      onZoneClick?.(clickedZone)
    }
  }

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="liquid-glass-card text-white px-6 py-4 rounded-lg neon-border">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-2"></div>
          <p>Загрузка персонажа...</p>
        </div>
      </div>
    )
  }

  if (!currentImage) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="liquid-glass-card text-white px-6 py-4 rounded-lg neon-border text-center">
          <div className="text-6xl mb-4">👤</div>
          <p className="text-lg font-semibold">{character.name}</p>
          <p className="text-sm text-cyan-300">Изображение загружается...</p>
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
          onLoad={() => {
            setImageLoaded(true)
            // Принудительно обновляем компонент после загрузки изображения
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'))
            }, 100)
          }}
        />


        {/* Активные зоны (только при выбранном действии) */}
        {activeZones && zones.length > 0 && imageLoaded && zones.map((zone) => {
          // Получаем элемент изображения
          let imgElement = document.querySelector('img[alt*="поза"]') as HTMLImageElement

          // Если не нашли по alt, попробуем по src
          if (!imgElement) {
            imgElement = document.querySelector(`img[src*="${currentImage}"]`) as HTMLImageElement
          }

          // Если все еще не нашли, попробуем просто первый img
          if (!imgElement) {
            imgElement = document.querySelector('img') as HTMLImageElement
          }

          if (!imgElement) {
            return null
          }

          // Проверяем, загружено ли изображение
          if (imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
            return null
          }

          // Получаем размеры отображения изображения (не натуральные!)
          const displayRect = imgElement.getBoundingClientRect()
          const containerRect = imgElement.parentElement?.getBoundingClientRect()

          if (!containerRect) {
            return null
          }

          // Вычисляем размеры изображения с учетом object-contain
          const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight
          const containerAspect = containerRect.width / containerRect.height

          let displayWidth, displayHeight, offsetX, offsetY

          if (imgAspect > containerAspect) {
            // Изображение шире контейнера - подгоняем по ширине
            displayWidth = containerRect.width
            displayHeight = containerRect.width / imgAspect
            offsetX = 0
            offsetY = (containerRect.height - displayHeight) / 2
          } else {
            // Изображение выше контейнера - подгоняем по высоте
            displayHeight = containerRect.height
            displayWidth = containerRect.height * imgAspect
            offsetX = (containerRect.width - displayWidth) / 2
            offsetY = 0
          }

          // Конвертируем координаты зоны (относительно исходного изображения) в координаты отображения
          const scaleX = displayWidth / imgElement.naturalWidth
          const scaleY = displayHeight / imgElement.naturalHeight

          const displayX = zone.x * scaleX + offsetX
          const displayY = zone.y * scaleY + offsetY
          const displayZoneWidth = zone.width * scaleX
          const displayZoneHeight = zone.height * scaleY

          // Конвертируем в проценты от контейнера
          const leftPercent = (displayX / containerRect.width) * 100
          const topPercent = (displayY / containerRect.height) * 100
          const widthPercent = (displayZoneWidth / containerRect.width) * 100
          const heightPercent = (displayZoneHeight / containerRect.height) * 100


          return (
            <div
              key={zone.id}
              className={`absolute border-2 border-blue-400 bg-blue-400 bg-opacity-10 cursor-pointer transition-all duration-200 ${
                actionInProgress ? 'hover:bg-opacity-20' : ''
              }`}
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                width: `${widthPercent}%`,
                height: `${heightPercent}%`,
                zIndex: 10
              } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation()
                onZoneClick?.(zone)
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                if (actionInProgress) {
                  onZoneHold?.(zone.id, true)
                }
              }}
              onMouseUp={() => {
                if (actionInProgress) {
                  onZoneHold?.(zone.id, false)
                }
              }}
              onMouseLeave={() => {
                if (actionInProgress) {
                  onZoneHold?.(zone.id, false)
                }
              }}
              onTouchStart={(e) => {
                e.preventDefault()
                if (actionInProgress) {
                  onZoneHold?.(zone.id, true)
                }
              }}
              onTouchEnd={() => {
                if (actionInProgress) {
                  onZoneHold?.(zone.id, false)
                }
              }}
              title={`${zone.name} - клик для действия, удержание для повторения`}
            >
              <div className="text-blue-400 text-xs p-1 font-medium">
                {zone.name}
              </div>
            </div>
          )
        })}

      </div>

      {/* Информация о персонаже */}
      <div className="absolute top-4 right-4 liquid-glass-card text-white px-4 py-2 rounded-xl neon-border">
        <div className="text-lg font-semibold">{character.name}</div>
        {poseData && (
          <div className="text-sm text-cyan-300">
            Поза: {poseData.name}
          </div>
        )}
        {character.age && (
          <div className="text-sm text-cyan-300">
            Возраст: {character.age}
          </div>
        )}
      </div>

      {/* Переключатель ракурсов */}
      {poseData && poseData.angles.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-2 liquid-glass-card rounded-xl p-2 neon-border">
            {poseData.angles.map((angle) => (
              <button
                key={angle.id}
                onClick={() => setCurrentImage(
                  angle.media.images.length > 0 ? angle.media.images[0].url : currentImage
                )}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  angle.id === currentAngle
                    ? 'bg-cyan-400 text-black'
                    : 'text-white hover:bg-cyan-400 hover:bg-opacity-20 hover:text-cyan-300'
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
