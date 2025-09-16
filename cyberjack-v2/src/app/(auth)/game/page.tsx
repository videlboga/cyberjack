"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { CharacterDisplay } from '@/components/game/CharacterDisplay'
import { SlidingPanels } from '@/components/game/SlidingPanels'
import { TimePanel } from '@/components/game/TimePanel'
import { NotificationSystem } from '@/components/game/NotificationSystem'
import { LocationSelector } from '@/components/game/LocationSelector'
import { ChatPanel } from '@/components/game/ChatPanel'
import { SuperAdminAuthModal } from '@/components/game/SuperAdminAuthModal'

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

interface GameState {
  selectedCharacter: Character | null
  currentLocation: 'laboratory' | 'stations'
  currentPose: string | null
  currentAngle: string | null
  activeZones: boolean
  selectedAction: string | null
  poseData: {
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
  } | null
  gameTime: {
    gameTime: number
    formattedTime: string
    isRunning: boolean
  }
  // Состояние для выполнения действий
  actionInProgress: boolean
}

export default function GameInterface() {
  const { data: session, status } = useSession()
  const [gameState, setGameState] = useState<GameState>({
    selectedCharacter: null,
    currentLocation: 'laboratory',
    currentPose: null,
    currentAngle: null,
    activeZones: false,
    selectedAction: null,
    poseData: null,
    gameTime: { gameTime: 0, formattedTime: '00:00', isRunning: false },
    actionInProgress: false
  })

  const [notifications, setNotifications] = useState<any[]>([])
  const [panels, setPanels] = useState({
    characters: false,
    actions: false,
    characteristics: false,
    equipment: false,
    time: false,
    chat: false
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0)

  // Получаем текущее состояние времени
  useEffect(() => {
    const fetchTimeState = async () => {
      try {
        const response = await fetch('/api/time')
        if (response.ok) {
          const timeState = await response.json()
          setGameState(prev => ({ ...prev, gameTime: timeState }))
        }
      } catch (error) {
        console.error('Error fetching time state:', error)
      }
    }

    fetchTimeState()
    const interval = setInterval(fetchTimeState, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleCharacterSelect = (character: Character) => {
    setGameState(prev => ({ ...prev, selectedCharacter: character }))
    setPanels(prev => ({ ...prev, characters: false }))

    // Загружаем дефолтную позу персонажа
    loadCharacterDefaultPose(character.id)
  }

  const loadCharacterDefaultPose = async (characterId: string) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/poses/default?userId=${session?.user?.id || ''}`)

      if (response.ok) {
        const poseData = await response.json()

        setGameState(prev => ({
          ...prev,
          currentPose: poseData.poseId,
          currentAngle: poseData.defaultAngle,
          poseData: poseData
        }))
      }
    } catch (error) {
      console.error('❌ Error loading default pose:', error)
    }
  }

  const saveCurrentPose = async (characterId: string, poseId: string, angleId: string) => {
    try {
      await fetch(`/api/characters/${characterId}/poses/current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id || '',
          poseId,
          angleId
        })
      })
    } catch (error) {
      console.error('Error saving current pose:', error)
    }
  }

  const handleActionSelect = (actionId: string) => {
    setGameState(prev => ({
      ...prev,
      selectedAction: actionId,
      activeZones: true,
      actionInProgress: true
    }))
  }

  const handleActionDeselect = () => {
    setGameState(prev => ({
      ...prev,
      selectedAction: null,
      activeZones: false,
      actionInProgress: false
    }))
  }

  const executeActionOnZone = async (zoneId: string) => {
    if (!gameState.selectedAction || !gameState.selectedCharacter) {
      return
    }

    try {
      const response = await fetch('/api/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: gameState.selectedCharacter.id,
          actionId: gameState.selectedAction,
          userId: session?.user?.id || '',
          zoneId,
          durationSeconds: 1 // Минимальное время для тестирования
        })
      })

      if (response.ok) {
        const result = await response.json()

        // Показываем уведомление об изменениях
        if (result.effects && result.effects.length > 0) {
          // Получаем названия характеристик по ID
          const characteristicNames = await Promise.all(
            result.effects.map(async (e: any) => {
              try {
                const response = await fetch(`/api/characteristics/definition/${e.characteristicId}`)
                if (response.ok) {
                  const charData = await response.json()
                  return charData.name || e.characteristicId
                }
              } catch (error) {
                console.error('Error fetching characteristic name:', error)
              }
              return e.characteristicId
            })
          )

          setNotifications(prev => [...prev, {
            id: Date.now(),
            type: 'action',
            message: `Действие выполнено. Изменения: ${characteristicNames.join(', ')}`,
            timestamp: new Date()
          }])

          // Обновляем чат для отображения возможных ИИ-ответов
          setChatRefreshTrigger(prev => prev + 1)
        }
      }
    } catch (error) {
      console.error('❌ Error executing action:', error)
    }
  }

  const handleZoneClick = (zoneId: string) => {
    if (!gameState.actionInProgress) {
      return
    }

    executeActionOnZone(zoneId)
  }

  const handleZoneHold = (zoneId: string) => {
    if (!gameState.actionInProgress) {
      return
    }

    executeActionOnZone(zoneId)
  }

  // Сохраняем текущую позу при изменении
  useEffect(() => {
    if (gameState.selectedCharacter && gameState.currentPose && gameState.currentAngle) {
      saveCurrentPose(gameState.selectedCharacter.id, gameState.currentPose, gameState.currentAngle)
    }
  }, [gameState.currentPose, gameState.currentAngle, gameState.selectedCharacter])


  const togglePanel = (panelName: keyof typeof panels) => {
    setPanels(prev => ({
      ...prev,
      [panelName]: !prev[panelName]
    }))
  }

  const getBackgroundImage = () => {
    if (gameState.currentLocation === 'laboratory') {
      return '/images/locations/laboratory-bg.svg'
    }
    return '/images/locations/default-bg.svg'
  }

  // Показываем загрузку, пока сессия не загружена
  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Загрузка игрового интерфейса...</p>
        </div>
      </div>
    )
  }

  // Если сессия не загружена или пользователь не авторизован
  if (status === 'unauthenticated' || !session?.user?.id) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">🎮 CYBERJACK v2.0</h1>
            <p className="text-gray-400 text-lg mb-6">Игровой интерфейс</p>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md mx-auto">
            <p className="text-white text-lg mb-4">🔐 Необходима авторизация</p>
            <p className="text-gray-400 mb-6">Войдите как суперадмин для доступа к игровому интерфейсу</p>

            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Войти в систему
            </button>
          </div>
        </div>

        <SuperAdminAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Основной фон локации */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${getBackgroundImage()})` }}
      />

      {/* Отображение персонажа */}
      {gameState.selectedCharacter && (
        <CharacterDisplay
          character={gameState.selectedCharacter}
          currentPose={gameState.currentPose}
          currentAngle={gameState.currentAngle}
          activeZones={gameState.activeZones}
          onZoneClick={handleZoneClick}
          onZoneHold={handleZoneHold}
          poseData={gameState.poseData}
          actionInProgress={gameState.actionInProgress}
        />
      )}

      {/* Выезжающие панели */}
      <SlidingPanels
        panels={panels}
        gameState={gameState}
        onCharacterSelect={handleCharacterSelect}
        onActionSelect={handleActionSelect}
        onActionDeselect={handleActionDeselect}
        onTogglePanel={togglePanel}
        userId={session.user.id}
      />

      {/* Панель времени */}
      <TimePanel
        isOpen={panels.time}
        gameTime={gameState.gameTime}
        onToggle={() => togglePanel('time')}
        onTimeChange={(newTime) => setGameState(prev => ({ ...prev, gameTime: newTime }))}
      />

      {/* Панель чата */}
      {gameState.selectedCharacter && (
        <div className={`fixed bottom-0 right-0 w-[28rem] max-w-[90vw] h-[32rem] max-h-[70vh] bg-black bg-opacity-90 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-40 ${
          panels.chat ? 'translate-y-0' : 'translate-y-full'
        }`}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Чат с {gameState.selectedCharacter.name}</h2>
              <button
                onClick={() => togglePanel('chat')}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
                   <div className="flex-1 overflow-hidden">
                     <ChatPanel
                       characterId={gameState.selectedCharacter.id}
                       characterName={gameState.selectedCharacter.name}
                       gameContext={{
                         currentPose: gameState.currentPose,
                         currentAngle: gameState.currentAngle,
                         selectedAction: gameState.selectedAction,
                         actionInProgress: gameState.actionInProgress
                       }}
                       onNotification={(notification) => setNotifications(prev => [...prev, notification])}
                       refreshTrigger={chatRefreshTrigger}
                     />
                   </div>
          </div>
        </div>
      )}

      {/* Система уведомлений */}
      <NotificationSystem
        notifications={notifications}
        onRemoveNotification={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
      />

      {/* Кнопки быстрого доступа */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-50">
        <button
          onClick={() => togglePanel('characters')}
          className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm"
        >
          👥 Персонажи
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => togglePanel('actions')}
            className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm"
          >
            ⚡ Действия
          </button>
          <button
            onClick={() => togglePanel('characteristics')}
            className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm"
          >
            📊 Характеристики
          </button>
          <button
            onClick={() => togglePanel('equipment')}
            className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm"
          >
            🎒 Оборудование
          </button>
          {gameState.selectedCharacter && (
            <button
              onClick={() => togglePanel('chat')}
              className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm"
            >
              💬 Чат
            </button>
          )}
        </div>
      </div>

      {/* Индикатор времени */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg backdrop-blur-sm z-50">
        <div className="text-sm">
          ⏰ {gameState.gameTime.formattedTime}
          {gameState.gameTime.isRunning && <span className="ml-2 text-green-400">▶️</span>}
        </div>
      </div>
    </div>
  )
}