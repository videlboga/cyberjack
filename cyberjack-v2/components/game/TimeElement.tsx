"use client"

import { useState, useRef } from 'react'

interface TimeElementProps {
  gameTime: {
    gameTime: number
    formattedTime: string
  }
  onTimeChange: (newTime: typeof gameTime) => void
}

export function TimeElement({ gameTime, onTimeChange }: TimeElementProps) {
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
      } else {
        const errorData = await response.json()
        console.error('Error advancing time:', errorData)
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
    <div className="glass-button neon-border-blue px-4 py-2 rounded-lg select-none liquid-shimmer">
      <div className="flex items-center gap-3">
        {/* Отображение текущей даты */}
        <div className="flex items-center gap-2">
        <div className="text-lg">📅</div>
        <div className="text-sm font-medium text-white">
          {formatGameDate(gameTime.gameTime)}
        </div>
        </div>

        {/* Разделитель */}
        <div className="w-px h-4 bg-cyan-400 opacity-30"></div>

        {/* Кнопка прокрутки времени */}
        <button
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          disabled={isAdvancing}
          className="flex items-center gap-1 text-sm font-medium text-white hover:text-cyan-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-sm">⏩</span>
          <span>+10 мин</span>
        </button>
      </div>
    </div>
  )
}
