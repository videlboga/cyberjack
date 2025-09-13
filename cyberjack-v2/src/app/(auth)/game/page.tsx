// app/(auth)/game/page.tsx
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GameCharacterList } from '@/components/game/GameCharacterList'
import { ChatPanel } from '@/components/game/ChatPanel'

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
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [currentPose, setCurrentPose] = useState<string | null>(null)
  const [isActionHolding, setIsActionHolding] = useState(false)

  return (
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
              <div className="bg-white rounded-lg shadow-md p-6 border">
                <h2 className="text-xl font-semibold mb-4">Панель действий</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    className="h-20 flex flex-col items-center justify-center"
                    onMouseDown={() => setIsActionHolding(true)}
                    onMouseUp={() => setIsActionHolding(false)}
                    onMouseLeave={() => setIsActionHolding(false)}
                  >
                    <span className="text-2xl mb-1">👋</span>
                    <span className="text-xs">Действие 1</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center"
                    onMouseDown={() => setIsActionHolding(true)}
                    onMouseUp={() => setIsActionHolding(false)}
                    onMouseLeave={() => setIsActionHolding(false)}
                  >
                    <span className="text-2xl mb-1">💕</span>
                    <span className="text-xs">Действие 2</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center"
                    onMouseDown={() => setIsActionHolding(true)}
                    onMouseUp={() => setIsActionHolding(false)}
                    onMouseLeave={() => setIsActionHolding(false)}
                  >
                    <span className="text-2xl mb-1">🔥</span>
                    <span className="text-xs">Действие 3</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center"
                    onMouseDown={() => setIsActionHolding(true)}
                    onMouseUp={() => setIsActionHolding(false)}
                    onMouseLeave={() => setIsActionHolding(false)}
                  >
                    <span className="text-2xl mb-1">⚡</span>
                    <span className="text-xs">Действие 4</span>
                  </Button>
                </div>
                {isActionHolding && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-blue-800 text-sm">
                      ⏱️ Действие выполняется... Время идет в 60 раз быстрее
                    </p>
                  </div>
                )}
              </div>

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
              ⏰ Игровое время: <span className="font-bold">00:00</span>
            </div>
            <div className="text-sm text-gray-500">
              {isActionHolding ? '⏱️ Время ускорено' : '⏸️ Время остановлено'}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              +1 час
            </Button>
            <Button variant="outline" size="sm">
              +1 день
            </Button>
            <Button variant="outline" size="sm">
              Сбросить
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
