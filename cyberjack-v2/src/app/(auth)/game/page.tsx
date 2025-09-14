// app/(auth)/game/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { GameCharacterList } from '@/components/game/GameCharacterList'
import { ChatPanel } from '@/components/game/ChatPanel'
import { ActionsPanel } from '@/components/game/ActionsPanel'
import { Navbar } from '@/components/ui/navbar'

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

export default function GameInterface() {
  const { data: session } = useSession()
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [currentPose, setCurrentPose] = useState<string | null>(null)
  const [isActionHolding, setIsActionHolding] = useState(false)
  const [gameTime, setGameTime] = useState({ gameTime: 0, formattedTime: '00:00', isRunning: false })

  // Получаем текущее состояние времени
  useEffect(() => {
    const fetchTimeState = async () => {
      try {
        const response = await fetch('/api/time')
        if (response.ok) {
          const timeState = await response.json()
          setGameTime(timeState)
        }
      } catch (error) {
        console.error('Error fetching time state:', error)
      }
    }

    fetchTimeState()
    const interval = setInterval(fetchTimeState, 1000) // Обновляем каждую секунду
    return () => clearInterval(interval)
  }, [])

  const handleTimeAction = async (action: string, minutes?: number) => {
    try {
      const response = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, minutes })
      })

      if (response.ok) {
        const timeState = await response.json()
        setGameTime(timeState)
      }
    } catch (error) {
      console.error('Error updating time:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Игровой интерфейс</h1>
        <p className="text-gray-600">Взаимодействие с персонажами, выполнение действий и чат с ИИ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список персонажей */}
        <div className="lg:col-span-1">
          <GameCharacterList
            onSelect={setSelectedCharacter}
            selectedId={selectedCharacter?.id}
          />
        </div>

        {/* Основная область */}
        <div className="lg:col-span-2">
          {selectedCharacter ? (
            <div className="space-y-6">
              {/* Отображение персонажа */}
              <div className="bg-white rounded-lg shadow-md p-6 border">
                <h2 className="text-xl font-semibold mb-4">Отображение персонажа</h2>
                <div className="text-center py-12 text-gray-500">
                  <p>Изображение персонажа будет здесь</p>
                  <p className="text-sm mt-2">Функция в разработке</p>
                </div>
              </div>

              {/* Панель действий */}
              <ActionsPanel
                characterId={selectedCharacter.id}
                userId={session?.user?.id || ''}
                onActionStart={() => setIsActionHolding(true)}
                onActionEnd={() => setIsActionHolding(false)}
                isHolding={isActionHolding}
              />

              {/* Чат */}
              <ChatPanel
                characterId={selectedCharacter.id}
                characterName={selectedCharacter.name}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 border text-center">
              <div className="text-gray-500">
                <div className="text-6xl mb-4">🎮</div>
                <h2 className="text-xl font-semibold mb-2">Выберите персонажа</h2>
                <p>Для начала взаимодействия выберите персонажа из списка слева</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Панель времени */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-4 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-lg font-mono">
              ⏰ Игровое время: <span className="font-bold">{gameTime.formattedTime}</span>
            </div>
            <div className="text-sm text-gray-500">
              {gameTime.isRunning ? '⏱️ Время ускорено' : '⏸️ Время остановлено'}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTimeAction('advance', 60)}
            >
              +1 час
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTimeAction('advance', 1440)}
            >
              +1 день
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTimeAction('reset')}
            >
              Сбросить
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
