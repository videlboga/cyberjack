"use client"

import { CharacterPanel } from './CharacterPanel'
import { ActionsPanel } from './ActionsPanel'
import { CharacteristicsPanel } from './CharacteristicsPanel'
import { EquipmentPanel } from './EquipmentPanel'

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
  gameTime: {
    gameTime: number
    formattedTime: string
    isRunning: boolean
  }
}

interface SlidingPanelsProps {
  panels: {
    characters: boolean
    actions: boolean
    characteristics: boolean
    equipment: boolean
    time: boolean
    chat: boolean
  }
  gameState: GameState
  onCharacterSelect: (character: Character) => void
  onActionSelect: (actionId: string) => void
  onActionDeselect: () => void
  onTogglePanel: (panelName: keyof typeof panels) => void
  userId: string
}

export function SlidingPanels({
  panels,
  gameState,
  onCharacterSelect,
  onActionSelect,
  onActionDeselect,
  onTogglePanel,
  userId
}: SlidingPanelsProps) {
  return (
    <>
      {/* Панель персонажей - выезжает слева */}
      <div className={`fixed top-0 left-0 h-full w-96 max-w-[95vw] mobile-panel bg-black bg-opacity-90 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-40 ${
        panels.characters ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Персонажи</h2>
            <button
              onClick={() => onTogglePanel('characters')}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <CharacterPanel
              onCharacterSelect={onCharacterSelect}
              selectedId={gameState.selectedCharacter?.id}
            />
          </div>
        </div>
      </div>

      {/* Панель действий - выезжает справа */}
      <div className={`fixed top-0 right-0 h-full w-96 max-w-[95vw] mobile-panel bg-black bg-opacity-90 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-40 ${
        panels.actions ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Действия</h2>
            <button
              onClick={() => onTogglePanel('actions')}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {gameState.selectedCharacter ? (
              <ActionsPanel
                characterId={gameState.selectedCharacter.id}
                userId={userId}
                selectedAction={gameState.selectedAction}
                onActionSelect={onActionSelect}
                onActionDeselect={onActionDeselect}
              />
            ) : (
              <div className="p-4 text-center text-gray-400">
                <p>Выберите персонажа для просмотра действий</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Панель характеристик - выезжает снизу */}
      <div className={`fixed bottom-0 left-0 right-0 h-80 max-h-[60vh] bg-black bg-opacity-90 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-40 ${
        panels.characteristics ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Характеристики</h2>
            <button
              onClick={() => onTogglePanel('characteristics')}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {gameState.selectedCharacter ? (
              <CharacteristicsPanel
                character={gameState.selectedCharacter}
                userId={userId}
              />
            ) : (
              <div className="p-4 text-center text-gray-400">
                <p>Выберите персонажа для просмотра характеристик</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Панель оборудования - выезжает сверху */}
      <div className={`fixed top-0 left-0 right-0 h-80 max-h-[60vh] bg-black bg-opacity-90 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-40 ${
        panels.equipment ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Оборудование</h2>
            <button
              onClick={() => onTogglePanel('equipment')}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EquipmentPanel userId={userId} />
          </div>
        </div>
      </div>

      {/* Невидимая область для закрытия панелей при клике вне их */}
      {(panels.characters || panels.actions || panels.characteristics || panels.equipment || panels.chat) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            if (panels.characters) onTogglePanel('characters')
            if (panels.actions) onTogglePanel('actions')
            if (panels.characteristics) onTogglePanel('characteristics')
            if (panels.equipment) onTogglePanel('equipment')
            if (panels.chat) onTogglePanel('chat')
          }}
        />
      )}
    </>
  )
}
