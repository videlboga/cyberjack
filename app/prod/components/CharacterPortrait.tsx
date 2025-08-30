"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, ZoomIn, RotateCcw } from "lucide-react"
import { Pose, PoseAngle, ActiveZone } from "@/lib/unified-entities"

interface CharacterPortraitProps {
  characterId: string
  characterName: string
  currentPose?: Pose
  currentAngle?: PoseAngle
  availableAngles?: PoseAngle[]
  onAngleChange?: (angle: PoseAngle) => void
  onZoneClick?: (zone: ActiveZone) => void
  showControls?: boolean
  className?: string
}

export const CharacterPortrait: React.FC<CharacterPortraitProps> = ({
  characterId,
  characterName,
  currentPose,
  currentAngle,
  availableAngles = [],
  onAngleChange,
  onZoneClick,
  showControls = true,
  className = ""
}) => {
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)
  const [hoveredZone, setHoveredZone] = useState<ActiveZone | null>(null)

  // Обновляем индекс при изменении текущего ракурса
  useEffect(() => {
    if (currentAngle && availableAngles.length > 0) {
      const index = availableAngles.findIndex(angle => angle.id === currentAngle.id)
      if (index >= 0) {
        setCurrentAngleIndex(index)
      }
    }
  }, [currentAngle, availableAngles])

  // Получаем текущий отображаемый ракурс
  const displayAngle = currentAngle || (availableAngles.length > 0 ? availableAngles[currentAngleIndex] : null)

  // Функции для переключения ракурсов
  const nextAngle = () => {
    if (availableAngles.length === 0) return
    const newIndex = (currentAngleIndex + 1) % availableAngles.length
    setCurrentAngleIndex(newIndex)
    if (onAngleChange) {
      onAngleChange(availableAngles[newIndex])
    }
  }

  const prevAngle = () => {
    if (availableAngles.length === 0) return
    const newIndex = currentAngleIndex === 0 ? availableAngles.length - 1 : currentAngleIndex - 1
    setCurrentAngleIndex(newIndex)
    if (onAngleChange) {
      onAngleChange(availableAngles[newIndex])
    }
  }

  // Обработчик клика по зоне
  const handleZoneClick = (zone: ActiveZone) => {
    if (onZoneClick) {
      onZoneClick(zone)
    }
  }

  // Если нет ракурсов, показываем плейсхолдер
  if (!displayAngle) {
    return (
      <Card className={`${className}`}>
        <CardHeader>
          <CardTitle className="text-center">{characterName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-[3/4] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="text-4xl mb-2">👤</div>
              <p>Портрет не настроен</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {characterName}
            {currentPose && (
              <Badge variant="outline" className="text-xs">
                {currentPose.name}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showControls && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsZoomed(!isZoomed)}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isZoomed ? "Уменьшить" : "Увеличить"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={prevAngle}
                        disabled={availableAngles.length <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Предыдущий ракурс</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={nextAngle}
                        disabled={availableAngles.length <= 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Следующий ракурс</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Контейнер с изображением */}
          <div className={`relative aspect-[3/4] bg-muted rounded-lg overflow-hidden ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}>
            {displayAngle.mediaUrl ? (
              <>
                {displayAngle.mediaType === 'video' ? (
                  <video
                    src={displayAngle.mediaUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                  />
                ) : (
                  <img
                    src={displayAngle.mediaUrl}
                    alt={`${characterName} - ${displayAngle.name}`}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Активные зоны */}
                {displayAngle.activeZones.map((zone) => (
                  <TooltipProvider key={zone.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`
                            absolute border-2 border-dashed rounded cursor-pointer transition-all duration-200
                            ${hoveredZone?.id === zone.id
                              ? 'border-primary bg-primary/20 scale-105'
                              : 'border-transparent hover:border-primary/50 hover:bg-primary/10'
                            }
                          `}
                          style={{
                            left: `${zone.x}%`,
                            top: `${zone.y}%`,
                            width: `${zone.width}%`,
                            height: `${zone.height}%`,
                          }}
                          onMouseEnter={() => setHoveredZone(zone)}
                          onMouseLeave={() => setHoveredZone(null)}
                          onClick={() => handleZoneClick(zone)}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div>
                          <p className="font-medium">{zone.name}</p>
                          <p className="text-sm text-muted-foreground">{zone.description}</p>
                          <div className="mt-2 text-xs">
                            <div>Категория: {zone.category}</div>
                            <div>Чувствительность: {zone.sensitivity}/10</div>
                            {zone.availableActions.length > 0 && (
                              <div>Действий: {zone.availableActions.length}</div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="text-4xl mb-2">📷</div>
                  <p>Изображение не загружено</p>
                  <p className="text-xs mt-1">{displayAngle.name}</p>
                </div>
              </div>
            )}

            {/* Индикатор текущего ракурса */}
            {availableAngles.length > 1 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                {availableAngles.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentAngleIndex ? 'bg-primary' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Информация о текущем ракурсе */}
          <div className="text-center">
            <h4 className="font-medium">{displayAngle.name}</h4>
            <p className="text-sm text-muted-foreground">{displayAngle.description}</p>

            {availableAngles.length > 1 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Ракурс {currentAngleIndex + 1} из {availableAngles.length}
              </div>
            )}

            {displayAngle.activeZones.length > 0 && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  {displayAngle.activeZones.length} активных зон
                </Badge>
              </div>
            )}
          </div>

          {/* Кнопки быстрого доступа к ракурсам */}
          {availableAngles.length > 1 && showControls && (
            <div className="flex flex-wrap gap-2 justify-center">
              {availableAngles.map((angle, index) => (
                <TooltipProvider key={angle.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={index === currentAngleIndex ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setCurrentAngleIndex(index)
                          if (onAngleChange) {
                            onAngleChange(angle)
                          }
                        }}
                        className="text-xs"
                      >
                        {angle.name}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {angle.description}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
