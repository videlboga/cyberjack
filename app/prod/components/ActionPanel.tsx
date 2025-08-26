"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Hand, 
  Whip, 
  Vibrate, 
  Zap, 
  Thermometer, 
  Brush,
  Target,
  Zap as ZapIcon
} from 'lucide-react'

import { Action, ToolType, ActionCategory, PREDEFINED_ACTIONS, BODY_AREAS } from '@/lib/unified-entities'

interface ActionPanelProps {
  selectedTool: ToolType | null
  onToolSelect: (tool: ToolType) => void
  onActionExecute: (action: Action, targetArea: string) => void
  availableActions: Action[]
}

const getToolIcon = (tool: ToolType) => {
  switch (tool) {
    case ToolType.HAND:
      return <Hand className="w-5 h-5" />
    case ToolType.WHIP:
      return <Whip className="w-5 h-5" />
    case ToolType.VIBRATOR:
      return <Vibrate className="w-5 h-5" />
    case ToolType.ELECTROSTIM:
      return <Zap className="w-5 h-5" />
    case ToolType.THERMO:
      return <Thermometer className="w-5 h-5" />
    case ToolType.BRUSH:
      return <Brush className="w-5 h-5" />
    default:
      return <Target className="w-5 h-5" />
  }
}

const getToolName = (tool: ToolType) => {
  switch (tool) {
    case ToolType.HAND:
      return 'Рука'
    case ToolType.WHIP:
      return 'Плеть'
    case ToolType.VIBRATOR:
      return 'Вибратор'
    case ToolType.ELECTROSTIM:
      return 'Электро'
    case ToolType.THERMO:
      return 'Термо'
    case ToolType.BRUSH:
      return 'Щетка'
    default:
      return 'Инструмент'
  }
}

const getToolColor = (tool: ToolType) => {
  switch (tool) {
    case ToolType.HAND:
      return 'bg-blue-500'
    case ToolType.WHIP:
      return 'bg-red-500'
    case ToolType.VIBRATOR:
      return 'bg-purple-500'
    case ToolType.ELECTROSTIM:
      return 'bg-yellow-500'
    case ToolType.THERMO:
      return 'bg-orange-500'
    case ToolType.BRUSH:
      return 'bg-green-500'
    default:
      return 'bg-gray-500'
  }
}

const getActionCategoryName = (category: ActionCategory) => {
  switch (category) {
    case ActionCategory.PHYSICAL:
      return 'Физические'
    case ActionCategory.STIMULATION:
      return 'Стимуляция'
    case ActionCategory.RESTRAINT:
      return 'Ограничения'
    case ActionCategory.PSYCHOLOGICAL:
      return 'Психологические'
    default:
      return 'Действия'
  }
}

const getActionCategoryColor = (category: ActionCategory) => {
  switch (category) {
    case ActionCategory.PHYSICAL:
      return 'bg-red-500'
    case ActionCategory.STIMULATION:
      return 'bg-purple-500'
    case ActionCategory.RESTRAINT:
      return 'bg-blue-500'
    case ActionCategory.PSYCHOLOGICAL:
      return 'bg-green-500'
    default:
      return 'bg-gray-500'
  }
}

export default function ActionPanel({
  selectedTool,
  onToolSelect,
  onActionExecute,
  availableActions
}: ActionPanelProps) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null)

  const tools = [
    ToolType.HAND,
    ToolType.WHIP,
    ToolType.VIBRATOR,
    ToolType.ELECTROSTIM,
    ToolType.THERMO,
    ToolType.BRUSH
  ]

  const filteredActions = selectedTool 
    ? availableActions.filter(action => action.tool === selectedTool)
    : availableActions

  const groupedActions = filteredActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = []
    }
    acc[action.category].push(action)
    return acc
  }, {} as Record<ActionCategory, Action[]>)

  const handleActionClick = (action: Action) => {
    if (selectedArea) {
      onActionExecute(action, selectedArea)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-lg shadow-xl">
      <Card className="bg-transparent border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <ZapIcon className="w-5 h-5" />
            Действия
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Выбор инструмента */}
          <div>
            <h3 className="text-white font-medium mb-3">Инструменты</h3>
            <div className="grid grid-cols-6 gap-2">
              {tools.map((tool) => (
                <Button
                  key={tool}
                  variant={selectedTool === tool ? "default" : "outline"}
                  size="sm"
                  className={`flex flex-col items-center gap-1 h-16 ${
                    selectedTool === tool ? getToolColor(tool) : ''
                  }`}
                  onClick={() => onToolSelect(tool)}
                >
                  {getToolIcon(tool)}
                  <span className="text-xs">{getToolName(tool)}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Выбор области тела */}
          <div>
            <h3 className="text-white font-medium mb-3">Области тела</h3>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(BODY_AREAS).map(([areaId, area]) => (
                <Button
                  key={areaId}
                  variant={selectedArea === areaId ? "default" : "outline"}
                  size="sm"
                  className="h-12"
                  onClick={() => setSelectedArea(areaId)}
                >
                  {area.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Доступные действия */}
          {selectedTool && (
            <div>
              <h3 className="text-white font-medium mb-3">
                Действия с {getToolName(selectedTool).toLowerCase()}
                {selectedArea && ` на ${BODY_AREAS[selectedArea as keyof typeof BODY_AREAS]?.name.toLowerCase()}`}
              </h3>
              
              <Tabs defaultValue="physical" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-700">
                  {Object.keys(groupedActions).map((category) => (
                    <TabsTrigger key={category} value={category} className="text-xs">
                      {getActionCategoryName(category as ActionCategory)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(groupedActions).map(([category, actions]) => (
                  <TabsContent key={category} value={category} className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {actions.map((action) => (
                        <ActionButton
                          key={action.id}
                          action={action}
                          onClick={() => handleActionClick(action)}
                          disabled={!selectedArea}
                        />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {/* Информация о выбранном действии */}
          {selectedTool && selectedArea && (
            <div className="bg-slate-700 rounded-lg p-3">
              <h4 className="text-white font-medium mb-2">Информация</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Инструмент: {getToolName(selectedTool)}</p>
                <p>Область: {BODY_AREAS[selectedArea as keyof typeof BODY_AREAS]?.name}</p>
                <p>Доступных действий: {filteredActions.length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface ActionButtonProps {
  action: Action
  onClick: () => void
  disabled: boolean
}

function ActionButton({ action, onClick, disabled }: ActionButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-12 flex flex-col items-center gap-1"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center gap-2">
        <Badge 
          variant="secondary" 
          className={`text-xs ${getActionCategoryColor(action.category)}`}
        >
          {action.intensity}/10
        </Badge>
        <span className="text-sm font-medium">{action.name}</span>
      </div>
      <span className="text-xs text-gray-400">
        {action.duration}с • {action.cooldown}с перезарядка
      </span>
    </Button>
  )
}
