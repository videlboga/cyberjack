'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  MarkerType,
  Position,
  Handle,
  NodeTypes as ReactFlowNodeTypes
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus,
  Save,
  Trash2,
  Monitor,
  GitBranch,
  Settings,
  Upload,
  Download,
  Play
} from 'lucide-react'

import { StoryScreen, StoryChoice, StoryCondition, ChoiceConsequence } from '@/types/screen-based-story'

// Компонент для редактирования выбора
const ChoiceEditor = ({
  choice,
  screens,
  onSave,
  onCancel
}: {
  choice: StoryChoice
  screens: StoryScreen[]
  onSave: (updates: Partial<StoryChoice>) => void
  onCancel: () => void
}) => {
  const [editData, setEditData] = useState({
    text: choice.text || '',
    description: choice.description || '',
    nextScreenId: choice.nextScreenId || 'none',
    isFinal: choice.isFinal || false,
    consequences: Array.isArray(choice.consequences) ? choice.consequences : [],
    showConditions: Array.isArray(choice.showConditions) ? choice.showConditions : []
  })

  const handleSave = () => {
    const dataToSave = {
      ...editData,
      nextScreenId: editData.nextScreenId === 'none' ? null : editData.nextScreenId
    }
    onSave(dataToSave)
  }

  const addConsequence = () => {
    setEditData(prev => ({
      ...prev,
      consequences: [...(Array.isArray(prev.consequences) ? prev.consequences : []), {
        type: 'change_characteristic',
        characterId: '',
        characteristicId: '',
        change: 0
      }]
    }))
  }

  const updateConsequence = (index: number, updates: Partial<ChoiceConsequence>) => {
    setEditData(prev => ({
      ...prev,
      consequences: Array.isArray(prev.consequences)
        ? prev.consequences.map((c, i) =>
            i === index ? { ...c, ...updates } : c
          )
        : []
    }))
  }

  const removeConsequence = (index: number) => {
    setEditData(prev => ({
      ...prev,
      consequences: Array.isArray(prev.consequences)
        ? prev.consequences.filter((_, i) => i !== index)
        : []
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">Редактирование выбора</h3>

        <div className="space-y-4">
          {/* Текст выбора */}
          <div>
            <Label className="text-white">Текст выбора</Label>
            <Input
              value={editData.text}
              onChange={(e) => setEditData(prev => ({ ...prev, text: e.target.value }))}
              className="mt-1 bg-gray-800 border-gray-600 text-white"
              placeholder="Введите текст выбора"
            />
          </div>

          {/* Описание */}
          <div>
            <Label className="text-white">Описание</Label>
            <Textarea
              value={editData.description}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              className="mt-1 bg-gray-800 border-gray-600 text-white"
              placeholder="Описание выбора (необязательно)"
              rows={2}
            />
          </div>

          {/* Следующий экран */}
          <div>
            <Label className="text-white">Следующий экран</Label>
            <Select
              value={editData.nextScreenId}
              onValueChange={(value) => setEditData(prev => ({ ...prev, nextScreenId: value }))}
            >
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Выберите следующий экран" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без перехода</SelectItem>
                {screens.map(screen => (
                  <SelectItem key={screen.id} value={screen.id}>
                    {screen.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Финальный выбор */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`isFinal-${choice.id}-${Date.now()}`}
              checked={editData.isFinal}
              onChange={(e) => setEditData(prev => ({ ...prev, isFinal: e.target.checked }))}
              className="rounded"
              title="Завершает сцену"
            />
            <Label htmlFor={`isFinal-${choice.id}-${Date.now()}`} className="text-white">
              Завершает сцену
            </Label>
          </div>

          {/* Последствия */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-white">Последствия</Label>
              <Button size="sm" onClick={addConsequence} className="bg-green-600 hover:bg-green-500">
                <Plus className="h-3 w-3 mr-1" />
                Добавить
              </Button>
            </div>

            <div className="space-y-2">
              {Array.isArray(editData.consequences) && editData.consequences.map((consequence, index) => (
                <div key={index} className="bg-gray-800 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm">Последствие {index + 1}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeConsequence(index)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-white text-xs">Тип</Label>
                      <Select
                        value={consequence.type}
                        onValueChange={(value) => updateConsequence(index, { type: value })}
                      >
                        <SelectTrigger className="h-8 bg-gray-700 border-gray-600 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="change_characteristic">Изменить характеристику</SelectItem>
                          <SelectItem value="change_credits">Изменить кредиты</SelectItem>
                          <SelectItem value="change_equipment">Изменить оборудование</SelectItem>
                          <SelectItem value="change_story_point">Изменить сюжетную точку</SelectItem>
                          <SelectItem value="trigger_action">Запустить действие</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {consequence.type === 'change_characteristic' && (
                      <>
                        <div>
                          <Label className="text-white text-xs">Изменение</Label>
                          <Input
                            type="number"
                            value={consequence.change || 0}
                            onChange={(e) => updateConsequence(index, { change: parseInt(e.target.value) || 0 })}
                            className="h-8 bg-gray-700 border-gray-600 text-white text-xs"
                          />
                        </div>
                      </>
                    )}

                    {consequence.type === 'change_credits' && (
                      <div>
                        <Label className="text-white text-xs">Изменение кредитов</Label>
                        <Input
                          type="number"
                          value={consequence.creditsChange || 0}
                          onChange={(e) => updateConsequence(index, { creditsChange: parseInt(e.target.value) || 0 })}
                          className="h-8 bg-gray-700 border-gray-600 text-white text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500">
            Сохранить
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  )
}

// Кастомный узел экрана
const ScreenNode = ({ data }: { data: any }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState(data)
  const [editingChoiceId, setEditingChoiceId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Функция для дебаунсинга сохранения
  const debouncedSave = useCallback((updates: Partial<any>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (data.onUpdateScreen) {
        data.onUpdateScreen(updates)
      }
    }, 500) // 500ms дебаунсинг
  }, [data.onUpdateScreen])

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleSave = () => {
    if (data.onUpdateScreen) {
      // Передаем только измененные поля
      const updates: Partial<any> = {}

      if (editData.name !== data.name) {
        updates.name = editData.name
      }
      if (editData.description !== data.description) {
        updates.description = editData.description
      }
      if (JSON.stringify(editData.content) !== JSON.stringify(data.content)) {
        updates.content = editData.content
      }
      if (editData.isFinal !== data.isFinal) {
        updates.isFinal = editData.isFinal
      }

      if (Object.keys(updates).length > 0) {
        data.onUpdateScreen(updates)
      }
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditData(data)
    setIsEditing(false)
  }

  const addChoice = () => {
    if (data.onAddChoice) {
      data.onAddChoice()
    }
  }

  const deleteScreen = () => {
    if (data.onDeleteScreen) {
      data.onDeleteScreen()
    }
  }

  const updateChoice = (choiceId: string, updates: any) => {
    if (data.onUpdateChoice) {
      data.onUpdateChoice(choiceId, updates)
    }
  }

  const deleteChoice = (choiceId: string) => {
    if (data.onDeleteChoice) {
      data.onDeleteChoice(choiceId)
    }
  }

  const handleMediaUpload = async (file: File, type: 'background' | 'music') => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const { url } = await response.json()
        setEditData(prev => ({
          ...prev,
          content: {
            ...prev.content,
            [type]: url
          }
        }))
      }
    } catch (error) {
      console.error('Ошибка загрузки медиа:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleChoiceSave = (choiceId: string, updates: Partial<StoryChoice>) => {
    updateChoice(choiceId, updates)
    setEditingChoiceId(null)
  }

  return (
    <div className="relative px-4 py-3 shadow-lg rounded-xl bg-gradient-to-br from-blue-900/80 to-blue-800/80 text-white border-2 border-blue-400 min-w-[350px] max-w-[500px]">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-blue-300" />
          <span className="text-xs text-blue-200">Экран</span>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0 text-blue-200 hover:text-white"
          >
            <Settings className="h-3 w-3" />
          </Button>
          {data.onSetStartScreen && (
            <Button
              size="sm"
              variant="ghost"
              onClick={data.onSetStartScreen}
              className="h-6 w-6 p-0 text-green-300 hover:text-green-100"
              title="Установить как стартовый экран"
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={deleteScreen}
            className="h-6 w-6 p-0 text-red-300 hover:text-red-100"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Input
            value={editData.name}
            onChange={(e) => {
              const newName = e.target.value
              setEditData({ ...editData, name: newName })

              // Автоматически сохраняем изменения названия с дебаунсингом
              if (newName !== data.name) {
                debouncedSave({ name: newName })
              }
            }}
            className="h-7 text-xs bg-white/10 border-white/20 text-white"
            placeholder="Название экрана"
          />

          <Textarea
            value={editData.description || ''}
            onChange={(e) => {
              const newDescription = e.target.value
              setEditData({ ...editData, description: newDescription })

              // Автоматически сохраняем изменения описания с дебаунсингом
              if (newDescription !== (data.description || '')) {
                debouncedSave({ description: newDescription })
              }
            }}
            className="h-16 text-xs bg-white/10 border-white/20 text-white"
            placeholder="Описание экрана"
            rows={2}
          />

          {/* Контент экрана */}
          <div>
            <Label className="text-xs text-blue-200">Текст экрана</Label>
            <Textarea
              value={editData.content?.text || ''}
              onChange={(e) => setEditData(prev => ({
                ...prev,
                content: { ...prev.content, text: e.target.value }
              }))}
              className="h-16 text-xs bg-white/10 border-white/20 text-white mt-1"
              placeholder="Основной текст экрана"
              rows={3}
            />
          </div>

          {/* Загрузка медиа */}
          <div className="space-y-2">
            <Label className="text-xs text-blue-200">Медиа</Label>

            {/* Фон */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                id={`bg-${data.id}`}
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleMediaUpload(file, 'background')
                }}
                className="hidden"
                title="Загрузить фоновое изображение"
              />
              <Label
                htmlFor={`bg-${data.id}`}
                className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded cursor-pointer"
              >
                {isUploading ? 'Загрузка...' : 'Фон'}
              </Label>
              {editData.content?.background && (
                <span className="text-xs text-green-300">✓ Загружен</span>
              )}
            </div>

            {/* Музыка */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                id={`music-${data.id}`}
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleMediaUpload(file, 'music')
                }}
                className="hidden"
                title="Загрузить фоновую музыку"
              />
              <Label
                htmlFor={`music-${data.id}`}
                className="text-xs bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded cursor-pointer"
              >
                {isUploading ? 'Загрузка...' : 'Музыка'}
              </Label>
              {editData.content?.music && (
                <span className="text-xs text-green-300">✓ Загружен</span>
              )}
            </div>
          </div>

          {/* Настройка финального экрана */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`final-${data.id}`}
              checked={editData.isFinal || false}
              onChange={(e) => setEditData({ ...editData, isFinal: e.target.checked })}
              className="rounded"
              title="Отметить как финальный экран"
            />
            <Label htmlFor={`final-${data.id}`} className="text-xs text-blue-200">
              Финальный экран
            </Label>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="h-6 text-xs">
              Сохранить
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="h-6 text-xs">
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="font-semibold text-sm mb-1">{data.name}</h3>
          {data.description && (
            <p className="text-xs text-blue-200 mb-2">{data.description}</p>
          )}

          {/* Статус экрана */}
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-xs border-blue-300 text-blue-200">
              {data.choicesCount} выборов
            </Badge>
            {data.isFinal && (
              <Badge variant="outline" className="text-xs border-red-300 text-red-200">
                Финальный
              </Badge>
            )}
          </div>

          {/* Список выборов */}
          <div className="space-y-2 mb-3">
            {data.choices && data.choices.map((choice: any) => (
              <div key={choice.id} className="bg-white/10 rounded p-2 text-xs">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-white">{choice.text || 'Без названия'}</p>
                    {choice.nextScreenId && (
                      <p className="text-blue-200 mt-1">
                        → Экран: {choice.nextScreenName || (choice.nextScreenId ? 'Неизвестно' : 'Завершает сцену')}
                      </p>
                    )}
                    {choice.isFinal && (
                      <Badge variant="outline" className="text-xs border-red-300 text-red-200 mt-1">
                        Завершает сцену
                      </Badge>
                    )}
                    {Array.isArray(choice.consequences) && choice.consequences.length > 0 && (
                      <p className="text-green-200 mt-1 text-xs">
                        Последствий: {choice.consequences.length}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingChoiceId(choice.id)}
                      className="h-5 w-5 p-0 text-blue-200 hover:text-white"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteChoice(choice.id)}
                      className="h-5 w-5 p-0 text-red-300 hover:text-red-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            size="sm"
            onClick={addChoice}
            className="h-6 text-xs bg-blue-600 hover:bg-blue-500"
          >
            <Plus className="h-3 w-3 mr-1" />
            Добавить выбор
          </Button>
        </div>
      )}

      {/* Ручки для подключения */}
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-400" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-400" />

      {/* Редактор выбора */}
      {editingChoiceId && (
        <ChoiceEditor
          choice={data.choices.find((c: any) => c.id === editingChoiceId)}
          screens={data.allScreens || []}
          onSave={(updates) => handleChoiceSave(editingChoiceId, updates)}
          onCancel={() => setEditingChoiceId(null)}
        />
      )}
    </div>
  )
}


const nodeTypes: ReactFlowNodeTypes = {
  screen: ScreenNode,
}

interface ScreenBasedStoryGraphProps {
  sceneId: string
  screens: StoryScreen[]
  onUpdateScreen: (screenId: string, updates: Partial<StoryScreen>) => void
  onUpdateChoice: (choiceId: string, updates: Partial<StoryChoice>) => void
  onAddScreen: () => void
  onAddChoice: (screenId: string) => void
  onDeleteScreen: (screenId: string) => void
  onDeleteChoice: (choiceId: string) => void
  onCreateChoiceWithScreen?: (sourceScreenId: string, targetScreenId: string) => void
  onSetStartScreen?: (screenId: string) => void
}

export function ScreenBasedStoryGraph({
  sceneId,
  screens,
  onUpdateScreen,
  onUpdateChoice,
  onAddScreen,
  onAddChoice,
  onDeleteScreen,
  onDeleteChoice,
  onCreateChoiceWithScreen,
  onSetStartScreen
}: ScreenBasedStoryGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({})

  // Инициализация позиций при загрузке экранов
  useEffect(() => {
    if (screens && screens.length > 0) {
      screens.forEach((screen, index) => {
        // Инициализируем позицию только если её еще нет в ref
        if (!nodePositionsRef.current[screen.id]) {
          const hasValidPosition = screen.position &&
            typeof screen.position === 'object' &&
            'x' in screen.position &&
            'y' in screen.position &&
            typeof screen.position.x === 'number' &&
            typeof screen.position.y === 'number' &&
            !isNaN(screen.position.x) &&
            !isNaN(screen.position.y)

          if (hasValidPosition) {
            nodePositionsRef.current[screen.id] = screen.position
          } else {
            // Создаем дефолтную позицию
            nodePositionsRef.current[screen.id] = {
              x: index * 400 + 100,
              y: 200
            }
          }
        }
      })
    }
  }, [screens])

  // Создание узлов и связей на основе экранов
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Защита от пустого массива экранов
    if (!screens || screens.length === 0) {
      return { nodes, edges }
    }

    // Создаем стабильные ID для мемоизации (без position для избежания лишних пересчетов)
    const screensKey = screens.map(s => `${s.id}-${s.name}`).join('|')

    screens.forEach((screen, screenIndex) => {
      // Используем сохраненную позицию из ref в первую очередь
      const savedPosition = nodePositionsRef.current[screen.id]

      // Проверяем, что position из базы данных валидный
      const hasValidDbPosition = screen.position &&
        typeof screen.position === 'object' &&
        'x' in screen.position &&
        'y' in screen.position &&
        typeof screen.position.x === 'number' &&
        typeof screen.position.y === 'number' &&
        !isNaN(screen.position.x) &&
        !isNaN(screen.position.y)

      // Приоритет: сохраненная позиция > позиция из БД > дефолтная позиция
      const screenPosition = savedPosition || (hasValidDbPosition ? screen.position : {
        x: screenIndex * 400 + 100,
        y: 200
      })

      // Убеждаемся, что позиция является валидным числом
      const validScreenPosition = {
        x: typeof screenPosition.x === 'number' && !isNaN(screenPosition.x) ? screenPosition.x : screenIndex * 400 + 100,
        y: typeof screenPosition.y === 'number' && !isNaN(screenPosition.y) ? screenPosition.y : 200
      }

      // Сохраняем позицию в ref только если её там еще нет
      if (!nodePositionsRef.current[screen.id]) {
        nodePositionsRef.current[screen.id] = validScreenPosition
      }

      // Узел экрана
      const screenNode: Node = {
        id: screen.id,
        type: 'screen',
        position: validScreenPosition,
        data: {
          ...screen,
          choicesCount: screen.choices?.length || 0,
          choices: screen.choices || [],
          allScreens: screens, // Передаем все экраны для выбора в ChoiceEditor
          onUpdateScreen: (updates: Partial<StoryScreen>) => onUpdateScreen(screen.id, updates),
          onAddChoice: () => onAddChoice(screen.id),
          onUpdateChoice: (choiceId: string, updates: Partial<StoryChoice>) => onUpdateChoice(choiceId, updates),
          onDeleteChoice: (choiceId: string) => onDeleteChoice(choiceId),
          onDeleteScreen: () => onDeleteScreen(screen.id),
          onSetStartScreen: onSetStartScreen ? () => onSetStartScreen(screen.id) : undefined
        }
      }
      nodes.push(screenNode)

      // Создаем связи между экранами на основе выборов
      if (screen.choices && screen.choices.length > 0) {
        screen.choices.forEach((choice) => {
          // Связь от текущего экрана к следующему экрану (если выбор ведет к другому экрану)
          if (choice.nextScreenId) {
            const nextScreen = screens.find(s => s.id === choice.nextScreenId)
            if (nextScreen) {
              edges.push({
                id: `edge-${screen.id}-${choice.nextScreenId}`,
                source: screen.id,
                target: choice.nextScreenId,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#10b981', strokeWidth: 2 },
                label: choice.text && choice.text.length > 20 ? choice.text.substring(0, 20) + '...' : choice.text || 'Выбор',
                data: {
                  choiceId: choice.id,
                  choiceText: choice.text
                }
              })
            }
          }
        })
      }
    })

    return { nodes, edges }
  }, [screens, onUpdateScreen, onUpdateChoice, onAddChoice, onDeleteScreen, onDeleteChoice, onSetStartScreen])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Синхронизация узлов/рёбер при изменении исходных данных
  useEffect(() => {
    setNodes(prevNodes => {
      // Обновляем только если изменилось количество экранов или их ID
      const currentScreenIds = prevNodes.map(n => n.id).sort()
      const newScreenIds = initialNodes.map(n => n.id).sort()

      if (JSON.stringify(currentScreenIds) !== JSON.stringify(newScreenIds)) {
        // При добавлении/удалении экранов используем initialNodes
        return initialNodes
      } else {
        // Обновляем только данные узлов, сохраняя позиции из ref
        return prevNodes.map(prevNode => {
          const newNode = initialNodes.find(n => n.id === prevNode.id)
          if (newNode) {
            // Всегда используем сохраненную позицию из ref, если она есть
            const savedPosition = nodePositionsRef.current[prevNode.id]
            return {
              ...newNode,
              position: savedPosition || prevNode.position
            }
          }
          return prevNode
        })
      }
    })
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  // Обработчик изменений узлов с сохранением позиций
  const handleNodesChange = useCallback((changes: any[]) => {
    onNodesChange(changes)

    // Сохраняем изменения позиций в базу данных только при завершении перетаскивания
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        const nodeId = change.id
        const newPosition = change.position

        // Всегда сохраняем позицию в ref для предотвращения прыжков
        nodePositionsRef.current[nodeId] = newPosition

        // Сохраняем в базе данных только когда перетаскивание завершено
        if (change.dragging === false) {
          // Находим экран по ID и обновляем его позицию
          const screen = screens.find(s => s.id === nodeId)
          if (screen) {
            // Проверяем, действительно ли позиция изменилась
            const currentPosition = screen.position
            const hasValidCurrentPosition = currentPosition &&
              typeof currentPosition === 'object' &&
              'x' in currentPosition &&
              'y' in currentPosition &&
              typeof currentPosition.x === 'number' &&
              typeof currentPosition.y === 'number'

            // Сохраняем позицию, если она изменилась более чем на 1 пиксель
            const shouldSave = !hasValidCurrentPosition ||
              Math.abs(currentPosition.x - newPosition.x) > 1 ||
              Math.abs(currentPosition.y - newPosition.y) > 1

            if (shouldSave) {
              // Сохраняем позицию немедленно без дебаунсинга
              onUpdateScreen(nodeId, { position: newPosition })
            }
          }
        }
      }
    })
  }, [onNodesChange, screens, onUpdateScreen])

  // Обработчик соединения узлов
  const onConnect = useCallback(
    (params: Connection) => {
      const { source, target } = params
      if (source && target) {
        // Если соединяем экран -> экран, это означает создание нового выбора
        const sourceScreen = screens.find(s => s.id === source)
        if (sourceScreen && onCreateChoiceWithScreen) {
          // Создаем новый выбор, который ведет к целевому экрану
          onCreateChoiceWithScreen(source, target)
        }
      }
      // Добавляем визуальную связь
      setEdges((eds) => addEdge({
        ...params,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#10b981', strokeWidth: 2 }
      }, eds))
    },
    [setEdges, screens, onCreateChoiceWithScreen]
  )

  // Обработчик клика по узлу
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  // Обработчик двойного клика для добавления узлов
  const onDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const targetEl = event.target as Element
    if (
      targetEl.closest('.react-flow__node') ||
      targetEl.closest('.react-flow__handle') ||
      targetEl.closest('.react-flow__edge')
    ) {
      return
    }

    const root = event.currentTarget as HTMLDivElement
    const bounds = root.getBoundingClientRect()
    const viewport = root.querySelector('.react-flow__viewport') as HTMLElement | null

    let translateX = 0, translateY = 0, scale = 1
    if (viewport && viewport.style.transform) {
      const m = viewport.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/)
      if (m) {
        translateX = parseFloat(m[1]) || 0
        translateY = parseFloat(m[2]) || 0
        scale = parseFloat(m[3]) || 1
      }
    }

    const flowX = (event.clientX - bounds.left - translateX) / scale
    const flowY = (event.clientY - bounds.top - translateY) / scale

    // Проверяем, что координаты валидны
    if (isNaN(flowX) || isNaN(flowY) || !isFinite(flowX) || !isFinite(flowY)) {
      console.warn('Invalid flow coordinates:', { flowX, flowY, translateX, translateY, scale })
      return
    }

    // Добавляем новый экран
    onAddScreen()
  }, [onAddScreen])

  return (
    <div className="h-full w-full">
      <Card className="h-full bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-white/10 text-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <Monitor className="h-5 w-5" />
              Граф экранов сцены
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={onAddScreen} size="sm" className="bg-blue-600 hover:bg-blue-500">
                <Plus className="h-4 w-4 mr-2" />
                Добавить экран
              </Button>
            </div>
          </div>
          <div className="text-xs text-gray-300">
            Двойной клик для добавления экрана. Перетаскивайте узлы для лучшего расположения.
          </div>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-80px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDoubleClick={onDoubleClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
              type: 'smoothstep',
              style: { strokeWidth: 2, stroke: '#64748b' }
            }}
            fitView
            attributionPosition="bottom-left"
            className="bg-[radial-gradient(ellipse_at_top,rgba(40,40,50,0.6),rgba(20,20,25,0.85))]"
          >
            <Controls />
            {nodes.length > 0 && (
              <MiniMap
                nodeColor={(node) => {
                  switch (node.type) {
                    case 'screen':
                      return node.data.isFinal ? '#ef4444' : '#3b82f6'
                    default:
                      return '#6b7280'
                  }
                }}
                nodeStrokeWidth={3}
                zoomable
                pannable
              />
            )}
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </CardContent>
      </Card>
    </div>
  )
}
