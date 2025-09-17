"use client"

import { useState, useRef } from 'react'

interface TimePanelProps {
  isOpen: boolean
  gameTime: {
    gameTime: number
    formattedTime: string
    isRunning: boolean
  }
  onToggle: () => void
  onTimeChange: (newTime: typeof gameTime) => void
}

export function TimePanel({ isOpen, gameTime, onToggle, onTimeChange }: TimePanelProps) {
  const [isAdvancing, setIsAdvancing] = useState(false)
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleTimeAdvance = async (minutes: number) => {
    try {
      setIsAdvancing(true)
      const response = await fetch('/api/time/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          reason: 'manual_advance'
        })
      })

      if (response.ok) {
        const newTimeState = await response.json()
        onTimeChange(newTimeState)
      }
    } catch (error) {
      console.error('Error advancing time:', error)
    } finally {
      setIsAdvancing(false)
    }
  }

  const handleClick = () => {
    handleTimeAdvance(10) // +10 минут по клику
  }

  const handleMouseDown = () => {
    // Начинаем холд - +10 минут каждую секунду
    holdIntervalRef.current = setInterval(() => {
      handleTimeAdvance(10)
    }, 1000)
  }

  const handleMouseUp = () => {
    // Останавливаем холд
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }

  const formatGameDate = (totalMinutes: number) => {
    const days = Math.floor(totalMinutes / (24 * 60))
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
    const minutes = totalMinutes % 60

    // Форматируем как дату (день 1, час 00:00)
    return `День ${days + 1}, ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* Панель времени */}
      <div className={`fixed top-0 left-0 right-0 h-32 bg-black bg-opacity-90 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="h-full flex items-center justify-between px-6">
          {/* Текущая дата */}
          <div className="flex items-center gap-4">
            <div className="text-2xl">📅</div>
            <div>
              <div className="text-lg font-semibold text-white">
                {formatGameDate(gameTime.gameTime)}
              </div>
              <div className="text-sm text-gray-400">
                Игровое время
              </div>
            </div>
          </div>

          {/* Кнопка прокрутки времени */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleClick}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              disabled={isAdvancing}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">⏩</span>
                <span className="font-medium">+10 мин</span>
              </div>
            </button>

            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Затемнение фона */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30"
          onClick={onToggle}
        />
      )}
    </>
  )
}
