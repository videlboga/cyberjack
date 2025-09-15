"use client"

import { useState } from 'react'

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

  const handleTimeReset = async () => {
    try {
      setIsAdvancing(true)
      const response = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })

      if (response.ok) {
        const newTimeState = await response.json()
        onTimeChange(newTimeState)
      }
    } catch (error) {
      console.error('Error resetting time:', error)
    } finally {
      setIsAdvancing(false)
    }
  }

  const formatTimeDisplay = (totalMinutes: number) => {
    const days = Math.floor(totalMinutes / (24 * 60))
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
    const minutes = totalMinutes % 60

    if (days > 0) {
      return `${days}д ${hours}ч ${minutes}м`
    } else if (hours > 0) {
      return `${hours}ч ${minutes}м`
    } else {
      return `${minutes}м`
    }
  }

  const quickAdvanceOptions = [
    { minutes: 5, label: '5 мин', icon: '⏰' },
    { minutes: 30, label: '30 мин', icon: '⏰' },
    { minutes: 60, label: '1 час', icon: '⏰' },
    { minutes: 240, label: '4 часа', icon: '⏰' },
    { minutes: 480, label: '8 часов', icon: '⏰' },
    { minutes: 1440, label: '1 день', icon: '📅' }
  ]

  return (
    <>
      {/* Кнопка открытия панели времени */}
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm z-50 hover:bg-opacity-70 transition-all"
      >
        <div className="flex items-center gap-2">
          <span>⏰</span>
          <span className="text-sm">{gameTime.formattedTime}</span>
          {gameTime.isRunning && <span className="text-green-400">▶️</span>}
        </div>
      </button>

      {/* Панель времени */}
      <div className={`fixed bottom-0 left-0 right-0 h-80 max-h-[60vh] bg-black bg-opacity-90 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Заголовок */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-white">Управление временем</h2>
              <p className="text-sm text-gray-400">
                Текущее время: {formatTimeDisplay(gameTime.gameTime)}
              </p>
            </div>
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {/* Содержимое */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Статус времени */}
            <div className="mb-6 p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold text-white">
                  ⏰ {gameTime.formattedTime}
                </span>
                <div className="flex items-center gap-2">
                  {gameTime.isRunning ? (
                    <span className="text-green-400 text-sm">▶️ Время ускорено</span>
                  ) : (
                    <span className="text-gray-400 text-sm">⏸️ Время остановлено</span>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-400">
                Общее время: {formatTimeDisplay(gameTime.gameTime)}
              </div>
            </div>

            {/* Быстрое продвижение времени */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Быстрое продвижение</h3>
              <div className="grid grid-cols-2 gap-3">
                {quickAdvanceOptions.map((option) => (
                  <button
                    key={option.minutes}
                    onClick={() => handleTimeAdvance(option.minutes)}
                    disabled={isAdvancing}
                    className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{option.icon}</span>
                      <div className="text-left">
                        <div className="text-white font-medium">{option.label}</div>
                        <div className="text-xs text-gray-400">+{option.minutes} мин</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Дополнительные опции */}
            <div className="space-y-3">
              <button
                onClick={handleTimeReset}
                disabled={isAdvancing}
                className="w-full p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>🔄</span>
                  <span>Сбросить время</span>
                </div>
              </button>

              {isAdvancing && (
                <div className="text-center text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                  <p>Обновление времени...</p>
                </div>
              )}
            </div>

            {/* Информация */}
            <div className="mt-6 p-3 bg-blue-600 bg-opacity-20 rounded-lg">
              <div className="text-sm text-blue-300">
                <div className="font-semibold mb-1">ℹ️ Информация о времени</div>
                <ul className="space-y-1 text-xs">
                  <li>• Время ускоряется только при выполнении действий</li>
                  <li>• 1 секунда реального времени = 1 минута игрового времени</li>
                  <li>• Характеристики восстанавливаются каждую минуту игрового времени</li>
                </ul>
              </div>
            </div>
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
