"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { CharacterDisplay } from '@/components/game/CharacterDisplay'
import { SlidingPanels } from '@/components/game/SlidingPanels'
import { TimeElement } from '@/components/game/TimeElement'
import { NotificationSystem } from '@/components/game/NotificationSystem'
import { ChatPanel } from '@/components/game/ChatPanel'
import { SuperAdminAuthModal } from '@/components/game/SuperAdminAuthModal'
import { StationsPanel } from '@/components/game/StationsPanel'
import { SceneDisplay } from '@/components/game/SceneDisplay'
import { AngleSwitcher } from '@/components/game/AngleSwitcher'

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
    chat: false,
    stations: false
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0)

  // Состояние для сцен
  const [activeScene, setActiveScene] = useState<{
    sceneData: any
    currentScreen: any
    progress: any
  } | null>(null)

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
    // Увеличиваем интервал до 5 секунд, чтобы уменьшить нагрузку
    const interval = setInterval(fetchTimeState, 5000)
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
      console.log('🔄 Загружаем дефолтную позу для персонажа:', characterId)
      const response = await fetch(`/api/characters/${characterId}/poses/default?userId=${session?.user?.id || ''}`)

      if (response.ok) {
        const poseData = await response.json()
        console.log('📊 Загружены данные позы:', poseData)
        console.log('🎯 Зоны в данных позы:', poseData.zones)

        setGameState(prev => ({
          ...prev,
          currentPose: poseData.poseId,
          currentAngle: poseData.defaultAngle,
          poseData: poseData
        }))
        console.log('✅ Поза установлена в состоянии')
      }
    } catch (error) {
      console.error('❌ Error loading default pose:', error)
    }
  }

  // Функция для обновления текущей позы после команды
  const refreshCurrentPose = async (characterId: string) => {
    try {
      console.log('🔄 Обновляем позу для персонажа:', characterId)
      const response = await fetch(`/api/characters/${characterId}/poses/default?userId=${session?.user?.id || ''}`)

      if (response.ok) {
        const poseData = await response.json()
        console.log('📊 Получены данные позы:', poseData)
        console.log('🎯 Зоны в обновленных данных позы:', poseData.zones)

        setGameState(prev => ({
          ...prev,
          currentPose: poseData.poseId,
          currentAngle: poseData.defaultAngle,
          poseData: poseData
        }))
        console.log('✅ Поза обновлена в состоянии')
      }
    } catch (error) {
      console.error('❌ Error refreshing current pose:', error)
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

  const handleZoneHold = (zoneId: string, isHolding: boolean) => {
    if (!gameState.actionInProgress) {
      return
    }

    if (isHolding) {
      executeActionOnZone(zoneId)
    }
  }

  const handleAngleChange = async (angleId: string) => {
    if (!gameState.selectedCharacter || !gameState.currentPose) {
      return
    }

    try {
      // Сохраняем новый ракурс в базе данных
      const response = await fetch(`/api/characters/${gameState.selectedCharacter.id}/poses/current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id || '',
          poseId: gameState.currentPose,
          angleId: angleId
        })
      })

      if (response.ok) {
        // Обновляем состояние
        setGameState(prev => ({
          ...prev,
          currentAngle: angleId
        }))

        // Обновляем данные позы
        await refreshCurrentPose(gameState.selectedCharacter.id)
      }
    } catch (error) {
      console.error('❌ Error changing angle:', error)
    }
  }

  // Запуск сцены
  const handleSceneStart = async (sceneId: string, stationId: string) => {
    try {
      const response = await fetch(`/api/story/scenes/${sceneId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session?.user?.id || '',
          stationId
        }),
      })

      if (response.ok) {
        const sceneData = await response.json()
        setActiveScene({
          sceneData: sceneData.scene,
          currentScreen: sceneData.currentScreen,
          progress: sceneData.progress
        })
      } else {
        const errorData = await response.json()
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'error',
          message: errorData.error || 'Ошибка при запуске сцены',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Ошибка при запуске сцены:', error)
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Ошибка при запуске сцены',
        timestamp: new Date()
      }])
    }
  }

  // Обработка выбора в сцене
  const handleSceneChoice = async (choiceId: string) => {
    if (!activeScene) return

    try {
      // Здесь можно добавить логику обработки выбора
      // Например, применение последствий, переход к следующему экрану и т.д.
      console.log('Выбор сделан:', choiceId)

      // Пока что просто закрываем сцену
      setActiveScene(null)

      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        message: 'Выбор обработан',
        timestamp: new Date()
      }])
    } catch (error) {
      console.error('Ошибка при обработке выбора:', error)
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Ошибка при обработке выбора',
        timestamp: new Date()
      }])
    }
  }

  // Закрытие сцены
  const handleSceneClose = () => {
    setActiveScene(null)
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
    // Всегда используем новое изображение фона
    return '/game-background.png'
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
            <h1 className="text-4xl font-bold neon-text neon-cyan mb-4">🎮 CYBERJACK v2.0</h1>
            <p className="text-white/80 text-lg mb-6">Игровой интерфейс</p>
          </div>

          <div className="glass-modal p-6 max-w-md mx-auto">
            <p className="neon-text neon-cyan text-lg mb-4">🔐 Необходима авторизация</p>
            <p className="text-white/80 mb-6">Войдите как суперадмин для доступа к игровому интерфейсу</p>

            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full glass-button neon-border neon-cyan px-6 py-3 font-medium"
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
      <div className="absolute inset-0 game-background" />

      {/* Отображение персонажа */}
      {gameState.selectedCharacter && (
        <>
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

          {/* Переключатель ракурсов */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
            <AngleSwitcher
              characterId={gameState.selectedCharacter.id}
              currentPoseId={gameState.currentPose}
              currentAngleId={gameState.currentAngle}
              onAngleChange={handleAngleChange}
              userId={session?.user?.id || ''}
              className="glass-panel neon-border neon-cyan px-4 py-2"
            />
          </div>
        </>
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

      {/* Панель станций */}
      <div className={`fixed top-0 left-0 h-full w-96 max-w-[95vw] mobile-panel glass-panel neon-border neon-cyan transform transition-transform duration-300 ease-in-out z-40 ${
        panels.stations ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <h2 className="text-xl font-semibold neon-text neon-cyan">Станции</h2>
            <button
              onClick={() => togglePanel('stations')}
              className="text-white/60 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <StationsPanel
              userId={session.user.id}
              onSceneStart={handleSceneStart}
              onNotification={(notification) => setNotifications(prev => [...prev, notification])}
            />
          </div>
        </div>
      </div>


      {/* Панель чата */}
      {gameState.selectedCharacter && (
        <div className={`fixed bottom-0 right-0 w-[28rem] max-w-[90vw] h-[32rem] max-h-[70vh] glass-panel neon-border neon-blue transform transition-transform duration-300 ease-in-out z-40 ${
          panels.chat ? 'translate-y-0' : 'translate-y-full'
        }`}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/20">
              <h2 className="text-xl font-semibold neon-text neon-blue">Чат с {gameState.selectedCharacter.name}</h2>
              <button
                onClick={() => togglePanel('chat')}
                className="text-white/60 hover:text-white text-2xl transition-colors"
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
                       onPoseChange={() => refreshCurrentPose(gameState.selectedCharacter.id)}
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

      {/* Отображение активной сцены */}
      {activeScene && (
        <SceneDisplay
          sceneData={activeScene.sceneData}
          currentScreen={activeScene.currentScreen}
          onChoiceSelect={handleSceneChoice}
          onClose={handleSceneClose}
          onNotification={(notification) => setNotifications(prev => [...prev, notification])}
        />
      )}

      {/* Кнопки быстрого доступа */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-50">
        <button
          onClick={() => togglePanel('characters')}
          className="glass-button neon-border neon-purple px-4 py-2"
        >
          👥 Персонажи
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => togglePanel('stations')}
            className="glass-button neon-border neon-cyan px-4 py-2"
          >
            🏢 Станции
          </button>
          <button
            onClick={() => togglePanel('actions')}
            className="glass-button neon-border neon-orange px-4 py-2"
          >
            ⚡ Действия
          </button>
          <button
            onClick={() => togglePanel('characteristics')}
            className="glass-button neon-border neon-green px-4 py-2"
          >
            📊 Характеристики
          </button>
          <button
            onClick={() => togglePanel('equipment')}
            className="glass-button neon-border neon-pink px-4 py-2"
          >
            🎒 Оборудование
          </button>
          <TimeElement
            gameTime={gameState.gameTime}
            onTimeChange={(newTime) => setGameState(prev => ({ ...prev, gameTime: newTime }))}
          />
          {gameState.selectedCharacter && (
            <button
              onClick={() => togglePanel('chat')}
              className="glass-button neon-border neon-blue px-4 py-2"
            >
              💬 Чат
            </button>
          )}
        </div>
      </div>

    </div>
  )
}