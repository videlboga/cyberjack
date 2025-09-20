"use client"

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

interface Angle {
  id: string
  name: string
  description?: string
  media: {
    files: Array<{
      id: string
      url: string
      filename: string
      type: string
    }>
  }
}

interface AngleSwitcherProps {
  characterId: string
  currentPoseId: string | null
  currentAngleId: string | null
  onAngleChange: (angleId: string) => void
  userId: string
  className?: string
}

export function AngleSwitcher({
  characterId,
  currentPoseId,
  currentAngleId,
  onAngleChange,
  userId,
  className = ""
}: AngleSwitcherProps) {
  const [angles, setAngles] = useState<Angle[]>([])
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (!currentPoseId) {
      setAngles([])
      setCurrentIndex(0)
    }
  }, [currentPoseId])


  // Загружаем доступные ракурсы для текущей позы
  useEffect(() => {
    if (characterId && userId) {
      loadAngles()
    }
  }, [characterId, userId, currentPoseId])

  // Обновляем индекс при изменении текущего ракурса
  useEffect(() => {
    if (currentAngleId && angles.length > 0) {
      const index = angles.findIndex(angle => angle.id === currentAngleId)
      if (index !== -1) {
        setCurrentIndex(index)
      }
    }
  }, [currentAngleId, angles])

  const loadAngles = async () => {
    if (!characterId || !userId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/characters/${characterId}/poses/current/angles?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setAngles(data)

        if (data.length > 0) {
          const currentIdx = currentAngleId
            ? data.findIndex((angle: Angle) => angle.id === currentAngleId)
            : -1

          setCurrentIndex(currentIdx >= 0 ? currentIdx : 0)
        } else {
          setCurrentIndex(0)
        }
      } else {
        console.error('Ошибка загрузки ракурсов:', response.statusText)
      }
    } catch (error) {
      console.error('Ошибка загрузки ракурсов:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrevious = () => {
    if (angles.length === 0) return

    const newIndex = currentIndex > 0 ? currentIndex - 1 : angles.length - 1
    setCurrentIndex(newIndex)
    onAngleChange(angles[newIndex].id)
  }

  const handleNext = () => {
    if (angles.length === 0) return

    const newIndex = currentIndex < angles.length - 1 ? currentIndex + 1 : 0
    setCurrentIndex(newIndex)
    onAngleChange(angles[newIndex].id)
  }

  const handleAngleSelect = (angleId: string) => {
    const index = angles.findIndex(angle => angle.id === angleId)
    if (index !== -1) {
      setCurrentIndex(index)
      onAngleChange(angleId)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-2 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
        <span className="ml-2 text-white">Загрузка ракурсов...</span>
      </div>
    )
  }


  if (angles.length === 0) {
    return (
      <div className={`flex items-center justify-center p-2 ${className}`}>
        <span className="text-gray-400 text-sm">Нет доступных ракурсов (загружено: {angles.length})</span>
      </div>
    )
  }

  if (angles.length === 1) {
    return (
      <div className={`flex items-center justify-center p-2 ${className}`}>
        <div className="text-sm text-gray-400">
          {angles[0].name}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Кнопка "Назад" */}
      <button
        onClick={handlePrevious}
        className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors border border-gray-600 hover:border-cyan-400 group"
        title="Предыдущий ракурс"
      >
        <ChevronLeft className="h-4 w-4 text-gray-400 group-hover:text-cyan-400 transition-colors" />
      </button>

      {/* Информация о текущем ракурсе */}
      <div className="flex-1 text-center">
        <div className="text-sm font-medium text-white">
          {angles[currentIndex]?.name || 'Неизвестный ракурс'}
        </div>
        {angles[currentIndex]?.description && (
          <div className="text-xs text-gray-400">
            {angles[currentIndex].description}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-1">
          {currentIndex + 1} из {angles.length}
        </div>
      </div>

      {/* Кнопка "Вперед" */}
      <button
        onClick={handleNext}
        className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors border border-gray-600 hover:border-cyan-400 group"
        title="Следующий ракурс"
      >
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-cyan-400 transition-colors" />
      </button>

      {/* Дополнительные кнопки для быстрого переключения */}
      {angles.length > 2 && (
        <div className="flex space-x-1">
          {angles.slice(0, Math.min(3, angles.length)).map((angle, index) => (
            <button
              key={angle.id}
              onClick={() => handleAngleSelect(angle.id)}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentIndex === index
                  ? 'bg-cyan-400'
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
              title={angle.name}
            />
          ))}
          {angles.length > 3 && (
            <div className="text-xs text-gray-500 flex items-center">
              +{angles.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
