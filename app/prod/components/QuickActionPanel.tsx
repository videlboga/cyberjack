"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  RefreshCw, 
  MessageSquare, 
  DoorOpen, 
  Shirt, 
  Power,
  Zap as ZapIcon,
  CheckCircle,
  XCircle
} from 'lucide-react'

import { QuickAction, QuickActionCategory, PREDEFINED_QUICK_ACTIONS } from '@/lib/types/actions'
import { CharacterPose, PoseCategory } from '@/lib/types/character'

interface QuickActionPanelProps {
  onQuickActionExecute: (action: QuickAction) => void
  availablePoses: CharacterPose[]
  currentPose: CharacterPose | null
  characterObedience: number
  characterTrust: number
}

const getQuickActionIcon = (category: QuickActionCategory) => {
  switch (category) {
    case QuickActionCategory.POSE:
      return <RefreshCw className="w-4 h-4" />
    case QuickActionCategory.SPEECH:
      return <MessageSquare className="w-4 h-4" />
    case QuickActionCategory.MOVEMENT:
      return <DoorOpen className="w-4 h-4" />
    case QuickActionCategory.CLOTHING:
      return <Shirt className="w-4 h-4" />
    case QuickActionCategory.EQUIPMENT:
      return <Power className="w-4 h-4" />
    default:
      return <ZapIcon className="w-4 h-4" />
  }
}

const getQuickActionCategoryName = (category: QuickActionCategory) => {
  switch (category) {
    case QuickActionCategory.POSE:
      return 'Позы'
    case QuickActionCategory.SPEECH:
      return 'Речь'
    case QuickActionCategory.MOVEMENT:
      return 'Перемещение'
    case QuickActionCategory.CLOTHING:
      return 'Одежда'
    case QuickActionCategory.EQUIPMENT:
      return 'Оборудование'
    default:
      return 'Действия'
  }
}

const getPoseCategoryName = (category: PoseCategory) => {
  switch (category) {
    case PoseCategory.STANDING:
      return 'Стоя'
    case PoseCategory.KNEELING:
      return 'На коленях'
    case PoseCategory.LYING:
      return 'Лежа'
    case PoseCategory.BOUND:
      return 'Связанная'
    case PoseCategory.RESTRAINED:
      return 'Ограниченная'
    case PoseCategory.SUSPENDED:
      return 'Подвешенная'
    default:
      return 'Поза'
  }
}

const getPoseCategoryIcon = (category: PoseCategory) => {
  switch (category) {
    case PoseCategory.STANDING:
      return '🧍'
    case PoseCategory.KNEELING:
      return '🦵'
    case PoseCategory.LYING:
      return '🛏️'
    case PoseCategory.BOUND:
      return '🔗'
    case PoseCategory.RESTRAINED:
      return '⛓️'
    case PoseCategory.SUSPENDED:
      return '🕊️'
    default:
      return '👤'
  }
}

export default function QuickActionPanel({
  onQuickActionExecute,
  availablePoses,
  currentPose,
  characterObedience,
  characterTrust
}: QuickActionPanelProps) {
  const [selectedPose, setSelectedPose] = useState<CharacterPose | null>(null)
  const [showPoseSelector, setShowPoseSelector] = useState(false)

  const handleQuickActionClick = (action: QuickAction) => {
    if (action.category === QuickActionCategory.POSE) {
      setShowPoseSelector(true)
    } else {
      onQuickActionExecute(action)
    }
  }

  const handlePoseSelect = (pose: CharacterPose) => {
    setSelectedPose(pose)
    setShowPoseSelector(false)
    // Здесь можно добавить логику смены позы через LLM
    console.log('Смена позы на:', pose.name)
  }

  const canExecuteAction = (action: QuickAction) => {
    if (action.requirements.characterObedience && characterObedience < action.requirements.characterObedience) {
      return false
    }
    if (action.requirements.characterTrust && characterTrust < action.requirements.characterTrust) {
      return false
    }
    return true
  }

  const groupedActions = PREDEFINED_QUICK_ACTIONS.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = []
    }
    acc[action.category].push(action)
    return acc
  }, {} as Record<QuickActionCategory, QuickAction[]>)

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-lg shadow-xl">
      <Card className="bg-transparent border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <ZapIcon className="w-5 h-5" />
            Быстрые действия
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Информация о персонаже */}
          <div className="bg-slate-700 rounded-lg p-3">
            <h4 className="text-white font-medium mb-2">Состояние персонажа</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-300">Послушание:</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-600 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${characterObedience * 10}%` }}
                    />
                  </div>
                  <span className="text-white">{characterObedience}/10</span>
                </div>
              </div>
              <div>
                <span className="text-gray-300">Доверие:</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-600 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${characterTrust * 10}%` }}
                    />
                  </div>
                  <span className="text-white">{characterTrust}/10</span>
                </div>
              </div>
            </div>
            {currentPose && (
              <div className="mt-2 pt-2 border-t border-slate-600">
                <span className="text-gray-300">Текущая поза:</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl">{getPoseCategoryIcon(currentPose.category)}</span>
                  <span className="text-white">{currentPose.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Быстрые действия */}
          <div>
            <h3 className="text-white font-medium mb-3">Доступные действия</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(groupedActions).map(([category, actions]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-gray-300 text-sm font-medium">
                    {getQuickActionCategoryName(category as QuickActionCategory)}
                  </h4>
                  <div className="space-y-2">
                    {actions.map((action) => {
                      const canExecute = canExecuteAction(action)
                      return (
                        <QuickActionButton
                          key={action.id}
                          action={action}
                          onClick={() => handleQuickActionClick(action)}
                          disabled={!canExecute}
                          canExecute={canExecute}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Селектор поз */}
          {showPoseSelector && (
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Выберите позу</h4>
              <div className="grid grid-cols-3 gap-2">
                {availablePoses.map((pose) => (
                  <Button
                    key={pose.id}
                    variant="outline"
                    size="sm"
                    className="h-16 flex flex-col items-center gap-1"
                    onClick={() => handlePoseSelect(pose)}
                  >
                    <span className="text-2xl">{getPoseCategoryIcon(pose.category)}</span>
                    <span className="text-xs">{pose.name}</span>
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPoseSelector(false)}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {/* Информация о требованиях */}
          <div className="bg-slate-700 rounded-lg p-3">
            <h4 className="text-white font-medium mb-2">Требования к действиям</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p>• Смена позы: Послушание ≥ 3</p>
              <p>• Заставить говорить: Послушание ≥ 5</p>
              <p>• Переместить: Послушание ≥ 4</p>
              <p>• Изменить одежду: Послушание ≥ 3</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface QuickActionButtonProps {
  action: QuickAction
  onClick: () => void
  disabled: boolean
  canExecute: boolean
}

function QuickActionButton({ action, onClick, disabled, canExecute }: QuickActionButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-12 flex items-center gap-2 justify-start"
      onClick={onClick}
      disabled={disabled}
    >
      {getQuickActionIcon(action.category)}
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium">{action.name}</span>
        <span className="text-xs text-gray-400">{action.description}</span>
      </div>
      <div className="ml-auto">
        {canExecute ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        )}
      </div>
    </Button>
  )
}
