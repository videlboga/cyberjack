'use client'

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  MarkerType,
  Position,
  Handle,
  NodeChange
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  FileText,
  GitBranch,
  Target,
  Settings,
  Zap,
  Package,
  Building,
  AlertTriangle,
  Users,
  Gamepad2,
  Star,
  Monitor
} from "lucide-react"
import { Trash2 } from "lucide-react"

import { SimpleScene, SimpleScreen } from '@/lib/simple-story-types'

type StoryPointsMap = {
  [key: string]: {
    name: string
    description: string
    value: number
    defaultValue: number
    minValue: number
    maxValue: number
  }
}


// Кастомный узел для сцены с тёмным стилем и инлайн-редактированием
const SceneNode = ({ data }: any) => {
  const getIcon = () => {
    if (data.sceneType === 'start') return <Target className="h-4 w-4 mr-2 text-green-600" />
    if (data.sceneType === 'end') return <Star className="h-4 w-4 mr-2 text-red-600" />
    return <FileText className="h-4 w-4 mr-2 text-blue-600" />
  }

  const getBorderColor = () => {
    if (data.sceneType === 'start') return 'border-green-400'
    if (data.sceneType === 'end') return 'border-red-400'
    return 'border-blue-400'
  }

  return (
    <div className={`relative px-4 py-3 shadow-md rounded-xl bg-neutral-800/80 text-neutral-100 border ${getBorderColor()} min-w-[260px] max-w-[360px]`}>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-1 right-1 h-6 w-6 p-0"
        onClick={() => data.onDeleteScene && data.onDeleteScene()}
        aria-label="Удалить сцену"
        title="Удалить сцену"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <div className="flex items-start">
        {getIcon()}
        <div className="ml-2 flex-1">
          <div className="text-xs text-neutral-300 font-semibold truncate" title={data.label}>{data.label || 'Без названия'}</div>
          <div className="text-[11px] text-neutral-400 truncate" title={data.description}>{data.description || '—'}</div>
          <div className="flex gap-2 mt-2 items-center">
            <Badge variant="outline" className="text-xs border-white/20 text-neutral-200">
              {data.choicesCount} выборов
            </Badge>
          </div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-400" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-400" />
      {/* Ручка условий на сцену (для будущих расширений) */}
      <Handle type="target" id="cond" position={Position.Left} className="!w-2 !h-2 !bg-amber-400" style={{ top: 6 }} />
    </div>
  )
}

// Кастомный узел для выбора с тёмным стилем, инлайн-редактированием и условными ручками
const ChoiceNode = ({ data }: any) => {
  const isStoryPoint = data.isStoryPoint
  const borderClass = isStoryPoint ? 'border-amber-400' : 'border-purple-400'
  const iconColor = isStoryPoint ? 'text-amber-300' : 'text-purple-300'

  return (
    <div className={`relative px-3 py-2 shadow-md rounded-lg bg-neutral-800/80 text-neutral-100 border-2 ${borderClass} min-w-[240px] max-w-[360px]`}>
      <div className="flex items-center">
        <GitBranch className={`h-3 w-3 mr-2 ${iconColor}`} />
        <div className="ml-1 flex-1">
          <Input
            value={data.label}
            onChange={(e) => {
              if (isStoryPoint) return
              data.onUpdateChoice && data.onUpdateChoice({ text: e.target.value })
            }}
            className={`h-7 text-xs bg-white/10 border-white/20 text-neutral-100 ${isStoryPoint ? 'opacity-80 pointer-events-none' : ''}`}
            placeholder={isStoryPoint ? 'Сюжетная точка' : 'Текст выбора'}
          />
          {!isStoryPoint && data.effectsCount > 0 && (
            <div className="text-xs text-neutral-400 mt-1">
              {data.effectsCount} эффектов
            </div>
          )}
        </div>
      </div>

      {!isStoryPoint && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-neutral-400">Переход</span>
          <Select
            value={data.nextScene && data.nextScene.length > 0 ? data.nextScene : '__none__'}
            onValueChange={(value) =>
              data.onUpdateChoice &&
              data.onUpdateChoice({ nextScene: value === '__none__' ? undefined : value })
            }
          >
            <SelectTrigger className="h-7 text-xs w-48 bg-white/10 border-white/20 text-neutral-100">
              <SelectValue placeholder="Нет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Нет</SelectItem>
              {data.scenesForSelect?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Инлайн-условия для выбора */}
      {!isStoryPoint && (
        <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-neutral-400">Условия выбора</div>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
              onClick={() => data.onUpdateChoice && data.onUpdateChoice({ conditions: [...(data.conditions || []), { entityType: 'story_point', property: 'value', operator: '>=', value: 1 }] })}>
              Добавить
            </Button>
          </div>
          {(data.conditions || []).length === 0 ? (
            <div className="text-[11px] text-neutral-500 mt-1">Нет условий</div>
          ) : (
            <div className="mt-2 space-y-1">
              {(data.conditions || []).map((cond: any, idx: number) => (
                <div key={idx} className="grid grid-cols-3 gap-1 items-center">
                  <Select value={cond.entityType} onValueChange={(v: any) => {
                    const next = [...data.conditions]
                    next[idx] = { ...cond, entityType: v }
                    data.onUpdateChoice && data.onUpdateChoice({ conditions: next })
                  }}>
                    <SelectTrigger className="h-7 text-[11px] bg-white/10 border-white/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="story_point">Сюжетная точка</SelectItem>
                      <SelectItem value="asset">Актив</SelectItem>
                      <SelectItem value="user">Пользователь</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Свойство/точка */}
                  {cond.entityType === 'story_point' ? (
                    <Select value={cond.entityId || ''} onValueChange={(v) => {
                      const next = [...data.conditions]
                      next[idx] = { ...cond, entityId: v }
                      data.onUpdateChoice && data.onUpdateChoice({ conditions: next })
                    }}>
                      <SelectTrigger className="h-7 text-[11px] bg-white/10 border-white/20">
                        <SelectValue placeholder="Точка" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.storyPointsForSelect?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={cond.property || ''}
                      onChange={(e) => {
                        const next = [...data.conditions]
                        next[idx] = { ...cond, property: e.target.value }
                        data.onUpdateChoice && data.onUpdateChoice({ conditions: next })
                      }}
                      className="h-7 text-[11px] bg-white/10 border-white/20 text-neutral-100"
                      placeholder="property"
                    />
                  )}

                  <div className="flex items-center gap-1">
                    <Select value={cond.operator} onValueChange={(v: any) => {
                      const next = [...data.conditions]
                      next[idx] = { ...cond, operator: v }
                      data.onUpdateChoice && data.onUpdateChoice({ conditions: next })
                    }}>
                      <SelectTrigger className="h-7 w-16 text-[11px] bg-white/10 border-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">=">&gt;=</SelectItem>
                        <SelectItem value="<=">&lt;=</SelectItem>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value="==">==</SelectItem>
                        <SelectItem value="!=">!=</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={String(cond.value ?? '')}
                      onChange={(e) => {
                        const next = [...data.conditions]
                        next[idx] = { ...cond, value: e.target.value }
                        data.onUpdateChoice && data.onUpdateChoice({ conditions: next })
                      }}
                      className="h-7 w-16 text-[11px] bg-white/10 border-white/20 text-neutral-100"
                      placeholder="val"
                    />
                    <Button size="sm" variant="ghost" className="h-6 px-2"
                      onClick={() => {
                        const next = (data.conditions || []).filter((_: any, i: number) => i !== idx)
                        data.onUpdateChoice && data.onUpdateChoice({ conditions: next })
                      }}>×</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ручки: для условий отдельная ручка cond (янтарная) слева сверху */}
      {isStoryPoint ? (
        <>
          <Handle type="source" id="cond" position={Position.Right} className="!w-2 !h-2 !bg-amber-400" />
        </>
      ) : (
        <>
          <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-purple-400" />
          <Handle type="target" id="cond" position={Position.Left} className="!w-2 !h-2 !bg-amber-400" style={{ top: 6 }} />
          <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-purple-400" />
        </>
      )}
    </div>
  )
}

// Узел экрана
const ScreenNode = ({ data }: any) => {
  return (
    <div className="relative px-3 py-2 shadow-md rounded-lg bg-neutral-800/80 text-neutral-100 border-2 border-blue-400 min-w-[260px] max-w-[380px]">
      <div className="text-xs text-neutral-300 mb-1">Экран</div>
      <Input
        value={data.title || ''}
        onChange={(e) => data.onUpdateScreen && data.onUpdateScreen({ title: e.target.value })}
        className="h-7 text-xs bg-white/10 border-white/20 text-neutral-100"
        placeholder="Заголовок экрана"
      />
      <Input
        value={data.text || ''}
        onChange={(e) => data.onUpdateScreen && data.onUpdateScreen({ content: { ...(data.content || {}), text: e.target.value } })}
        className="h-7 mt-2 text-xs bg-white/10 border-white/20 text-neutral-100"
        placeholder="Текст"
      />
      {/* Инлайн загрузка медиа */}
      <div className="mt-2">
        <div className="text-[11px] text-neutral-400 mb-1">Фон (фото/видео)</div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const url = URL.createObjectURL(file)
                data.onUpdateScreen && data.onUpdateScreen({ content: { ...(data.content || {}), backgroundFile: file, background: url } })
              }
            }}
            className="hidden"
            id={`screen-bg-upload-${data.id}`}
            aria-label="Выберите фон"
          />
          <Button size="sm" variant="outline" onClick={() => document.getElementById(`screen-bg-upload-${data.id}`)?.click()}>Выбрать</Button>
          {data.content?.background && (
            <Button size="sm" variant="destructive" onClick={() => data.onUpdateScreen && data.onUpdateScreen({ content: { ...(data.content || {}), background: undefined, backgroundFile: undefined } })}>Очистить</Button>
          )}
        </div>
        {data.content?.background && (
          <div className="mt-2 rounded overflow-hidden bg-black/30">
            {String(data.content.background).match(/\.(mp4|webm|ogg)$/i) ? (
              <video src={data.content.background} className="w-full h-28 object-cover" controls />
            ) : (
              <img src={data.content.background} alt="Фон" className="w-full h-28 object-cover" />
            )}
          </div>
        )}
      </div>
      <div className="text-[10px] text-neutral-400 mt-2">Выборов: {data.choicesCount || 0}</div>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-400" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-400" />
    </div>
  )
}

const EntryNode = ({ data }: any) => {
  return (
    <div className="relative px-3 py-2 shadow-md rounded-lg bg-neutral-900/80 text-neutral-100 border-2 border-amber-400 min-w-[260px] max-w-[420px]">
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs text-neutral-300">Точка входа</div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => data.onDeleteScene && data.onDeleteScene()} title="Удалить сцену" aria-label="Удалить сцену">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Input
        value={data.title || ''}
        onChange={(e) => data.onUpdateScene && data.onUpdateScene({ title: e.target.value })}
        className="h-7 text-xs bg-white/10 border-white/20 text-neutral-100"
        placeholder="Название сцены"
      />
      <Input
        value={data.description || ''}
        onChange={(e) => data.onUpdateScene && data.onUpdateScene({ description: e.target.value })}
        className="h-7 mt-2 text-xs bg-white/10 border-white/20 text-neutral-100"
        placeholder="Описание"
      />
      <div className="mt-2">
        <div className="text-[11px] text-neutral-400">Вероятность</div>
        <Input value={data.probability ?? ''} type="number" min={0} max={100} onChange={(e) => data.onUpdateScene && data.onUpdateScene({ probability: e.target.value ? parseInt(e.target.value) : undefined })} className="h-7 text-xs bg-white/10 border-white/20 text-neutral-100" />
      </div>
      <div className="mt-2">
        <Label className="text-[11px] text-neutral-400">Сущность станции</Label>
        <Select value={data.stationEntityId || ''} onValueChange={(v) => data.onUpdateScene && data.onUpdateScene({ stationEntityId: v })}>
          <SelectTrigger className="h-7 text-xs bg-white/10 border-white/20 text-neutral-100">
            <SelectValue placeholder="Не выбрано" />
          </SelectTrigger>
          <SelectContent>
            {(data.stationEntitiesForSelect || []).map((e: any) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="text-[11px] text-neutral-400 mt-2">Условия запуска</div>
      <div className="text-[11px] text-neutral-500">Подключите сюжетные точки к этой ноде для условий</div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-400" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  scene: SceneNode,
  choice: ChoiceNode,
  screen: ScreenNode,
  entry: EntryNode,
}

interface SceneGraphProps {
  scenes: SimpleScene[]
  onSceneSelect: (scene: SimpleScene) => void
  selectedSceneId: string
  onUpdateScene?: (sceneId: string, updates: Partial<SimpleScene>) => void
  onUpdateChoice?: (sceneId: string, screenIndex: number, choiceIndex: number, updates: any) => void
  onChoiceSelect?: (sceneId: string, screenIndex: number, choiceIndex: number) => void
  onEntrySelect?: (sceneId: string) => void
  onScreenSelect?: (sceneId: string, screenIndex: number) => void
  storyPoints?: StoryPointsMap
  mode?: 'global' | 'scene'
  onAddScene?: (position: { x: number; y: number }) => void
  onAddScreen?: (sceneId: string, position: { x: number; y: number }) => void
  onDeleteScene?: (sceneId: string) => void
  stationEntitiesForSelect?: Array<{ id: string; name: string }>
}

export function SceneGraph({ scenes, onSceneSelect, selectedSceneId, onUpdateScene, onUpdateChoice, onChoiceSelect, onEntrySelect, onScreenSelect, storyPoints, mode = 'scene', onAddScene, onAddScreen, onDeleteScene, stationEntitiesForSelect = [] }: SceneGraphProps): JSX.Element {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const parseChoiceNodeId = (id: string): { sceneId: string; screenIndex: number; choiceIndex: number } | null => {
    const parts = id.split('_')
    const screenIdxPos = parts.lastIndexOf('screen')
    const choiceIdxPos = parts.lastIndexOf('choice')
    if (screenIdxPos !== -1 && choiceIdxPos !== -1 && choiceIdxPos === screenIdxPos + 2) {
      const sceneId = parts.slice(0, screenIdxPos).join('_')
      const screenIndex = parseInt(parts[screenIdxPos + 1])
      const choiceIndex = parseInt(parts[choiceIdxPos + 1])
      if (!Number.isNaN(screenIndex) && !Number.isNaN(choiceIndex)) {
        return { sceneId, screenIndex, choiceIndex }
      }
    }
    return null
  }

  // Создание узлов и связей на основе сцен
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    const scenesToRender = mode === 'scene' && selectedSceneId
      ? scenes.filter((s) => s.id === selectedSceneId)
      : scenes

    // Создаем узлы для сцен
    scenesToRender.forEach((scene, sceneIndex) => {
      const sceneNode: Node = {
        id: scene.id,
        type: 'scene',
        position: {
          x: scene.layout?.x ?? (sceneIndex * 480 + 120),
          y: scene.layout?.y ?? 220
        },
        data: {
          id: scene.id,
          label: scene.title,
          description: scene.description,
          choicesCount: scene.choices.length,
          probability: scene.probability,
          sceneType: sceneIndex === 0 ? 'start' : scene.choices.some(choice => !choice.nextScene) ? 'end' : 'normal',
          onUpdateScene: (updates: Partial<SimpleScene>) => onUpdateScene && onUpdateScene(scene.id, updates),
          onDeleteScene: () => onDeleteScene && onDeleteScene(scene.id)
        }
      }
      // Показываем узел сцены и в режиме scene, и в глобальном
      nodes.push(sceneNode)

      // Точка входа сцены (показываем всегда в режиме scene; в глобальном тоже допустимо)
      nodes.push({
        id: `${scene.id}_entry`,
        type: 'entry',
        position: {
          x: scene.layout?.entryPosition?.x ?? (sceneNode.position.x - 220),
          y: scene.layout?.entryPosition?.y ?? (sceneNode.position.y - 80),
        },
        data: {
          probability: scene.probability,
          title: scene.title,
          description: scene.description,
          stationEntityId: (scene as any).stationEntityId,
          stationEntitiesForSelect,
          onUpdateScene: (updates: Partial<SimpleScene>) => onUpdateScene && onUpdateScene(scene.id, updates),
          onDeleteScene: () => onDeleteScene && onDeleteScene(scene.id),
        }
      })

      // Экраны сцены
      const screens = scene.screens && scene.screens.length > 0 ? scene.screens : undefined
      if (screens) {
        screens.forEach((screen, idx) => {
          const screenNodeId = `${scene.id}_screen_${idx}`
          nodes.push({
            id: screenNodeId,
            type: 'screen',
            position: {
              x: scene.layout?.screenPositions?.[screen.id]?.x ?? (sceneNode.position.x + 260 + idx * 260),
              y: scene.layout?.screenPositions?.[screen.id]?.y ?? sceneNode.position.y,
            },
            data: {
              id: screen.id,
              title: screen.title,
              text: screen.content?.text,
              content: screen.content,
              choicesCount: screen.choices.length,
              onUpdateScreen: (updates: Partial<SimpleScreen>) => {
                if (!onUpdateScene) return
                const updatedScreens = (scene.screens || []).map((s, i) => i === idx ? { ...s, ...updates, content: { ...s.content, ...(updates as any).content } } : s)
                onUpdateScene(scene.id, { screens: updatedScreens })
              }
            }
          })
        })

        // Связь от точки входа к первому экрану
        edges.push({
          id: `edge_${scene.id}_entry_to_screen_0`,
          source: `${scene.id}_entry`,
          target: `${scene.id}_screen_0`,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#f59e0b', strokeWidth: 2 }
        })
      }

      // Создаем узлы для выборов и связь экран -> выбор, вместо глобального списка сценических выборов
      (screens || []).forEach((screen, screenIdx) => {
        (screen.choices || []).forEach((choice, choiceIndex) => {
          const choiceNodeId = `${scene.id}_screen_${screenIdx}_choice_${choiceIndex}`
          const baseX = scene.layout?.screenPositions?.[screen.id]?.x ?? (sceneNode.position.x + 260 + screenIdx * 260)
          const baseY = scene.layout?.screenPositions?.[screen.id]?.y ?? sceneNode.position.y
          const savedChoicePos = scene.layout?.choicePositions?.[choice.id]
          const posX = savedChoicePos?.x ?? (baseX + 220)
          const posY = savedChoicePos?.y ?? (baseY + choiceIndex * 80)

          const choiceNode: Node = {
            id: choiceNodeId,
            type: 'choice',
            position: { x: posX, y: posY },
            data: {
              id: choiceNodeId,
              label: choice.text,
              effectsCount: (choice.effects || []).length,
              nextScene: choice.nextScene,
              scenesForSelect: scenes.map(s => ({ id: s.id, title: s.title })),
              storyPointsForSelect: storyPoints ? Object.entries(storyPoints).map(([id, sp]) => ({ id, name: sp.name })) : [],
              onUpdateChoice: (updates: any) => onUpdateChoice && onUpdateChoice(scene.id, screenIdx, choiceIndex, updates)
            }
          }
          nodes.push(choiceNode)

          // Связь экран -> выбор
          edges.push({
            id: `edge_${scene.id}_screen_${screenIdx}_to_${choiceNodeId}`,
            source: `${scene.id}_screen_${screenIdx}`,
            target: choiceNodeId,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#8b5cf6', strokeWidth: 2 }
          })

          // Связь от выбора к следующей сцене
          if (choice.nextScene) {
            if (mode === 'scene' && selectedSceneId && choice.nextScene !== scene.id) {
              const targetScene = scenes.find((s) => s.id === choice.nextScene)
              if (targetScene && !nodes.find((n) => n.id === targetScene.id)) {
                nodes.push({
                  id: targetScene.id,
                  type: 'scene',
                  position: { x: sceneNode.position.x + 520, y: sceneNode.position.y },
                  data: {
                    id: targetScene.id,
                    label: targetScene.title,
                    description: targetScene.description,
                    choicesCount: targetScene.choices.length,
                    probability: targetScene.probability,
                    sceneType: 'normal',
                    onUpdateScene: undefined,
                  },
                  style: { opacity: 0.6 }
                })
              }
            }
            edges.push({
              id: `edge_${choiceNodeId}_to_${choice.nextScene}`,
              source: choiceNodeId,
              target: choice.nextScene,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#10b981', strokeWidth: 2 },
              label: choice.text.length > 15 ? choice.text.substring(0, 15) + '...' : choice.text
            })
          }

          // Связь от выбора к экрану
          if (choice.nextScreenId) {
            const idx = (scene.screens || []).findIndex(s => s.id === choice.nextScreenId)
            if (idx >= 0) {
              edges.push({
                id: `edge_${choiceNodeId}_to_screen_${choice.nextScreenId}`,
                source: choiceNodeId,
                target: `${scene.id}_screen_${idx}`,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#22c55e', strokeWidth: 2 }
              })
            }
          }
        })
      })

    // Не отображаем сюжетные точки на графе — редактируются в панели

    return { nodes, edges }
  }, [scenes, mode, storyPoints])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const isDraggingRef = useRef(false)

  // Обработчик перемещения узлов: не сохраняем на каждый тик, только отражаем локально
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
  }, [onNodesChange])

  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  const onNodeDragStop = useCallback((event: any, node: Node) => {
    isDraggingRef.current = false
    const nodeId = node.id
    const pos = node.position
    const scene = scenes.find((s) => s.id === nodeId)
    if (scene) {
      const newLayout = { ...(scene.layout || {}), x: pos.x, y: pos.y }
      onUpdateScene && onUpdateScene(scene.id, { layout: newLayout } as any)
      return
    }
    if (nodeId.includes('_choice_')) {
      // формат: <sceneId>_screen_<screenIdx>_choice_<choiceIdx>
      const parts = nodeId.split('_')
      const screenIdxPos = parts.lastIndexOf('screen')
      const choiceIdxPos = parts.lastIndexOf('choice')
      if (screenIdxPos !== -1 && choiceIdxPos !== -1 && choiceIdxPos === screenIdxPos + 2) {
        const screenIndex = parseInt(parts[screenIdxPos + 1])
        const choiceIndex = parseInt(parts[choiceIdxPos + 1])
        const sceneId = parts.slice(0, screenIdxPos).join('_')
        if (!Number.isNaN(screenIndex) && !Number.isNaN(choiceIndex)) {
          const sceneOfChoice = scenes.find((s) => s.id === sceneId)
          const screen = sceneOfChoice?.screens?.[screenIndex]
          const choice = screen?.choices?.[choiceIndex]
          if (sceneOfChoice && screen && choice) {
            const layout = sceneOfChoice.layout || {}
            const choicePositions = { ...(layout.choicePositions || {}) }
            choicePositions[choice.id] = { x: pos.x, y: pos.y }
            const newLayout = { ...layout, choicePositions }
            onUpdateScene && onUpdateScene(sceneId, { layout: newLayout } as any)
          }
        }
      }
      return
    }
    // Экран узла: <sceneId>_screen_<index>
    if (nodeId.includes('_screen_')) {
      const splitIdx = nodeId.lastIndexOf('_screen_')
      if (splitIdx > 0) {
        const sceneId = nodeId.substring(0, splitIdx)
        const idxStr = nodeId.substring(splitIdx + 8)
        const screenIndex = parseInt(idxStr)
        if (!Number.isNaN(screenIndex)) {
          const sceneOfScreen = scenes.find((s) => s.id === sceneId)
          const screen = sceneOfScreen?.screens?.[screenIndex]
          if (sceneOfScreen && screen) {
            const layout = sceneOfScreen.layout || {}
            const screenPositions = { ...(layout.screenPositions || {}) }
            screenPositions[screen.id] = { x: pos.x, y: pos.y }
            const newLayout = { ...layout, screenPositions }
            onUpdateScene && onUpdateScene(sceneId, { layout: newLayout } as any)
          }
        }
      }
      return
    }
    // Точка входа: <sceneId>_entry
    if (nodeId.endsWith('_entry')) {
      const sceneId = nodeId.slice(0, -6)
      const sceneOfEntry = scenes.find((s) => s.id === sceneId)
      if (sceneOfEntry) {
        const layout = sceneOfEntry.layout || {}
        const newLayout = { ...layout, entryPosition: { x: pos.x, y: pos.y } }
        onUpdateScene && onUpdateScene(sceneId, { layout: newLayout } as any)
      }
    }
  }, [onUpdateScene, scenes])

  // Синхронизация узлов/рёбер при изменении исходных данных
  useEffect(() => {
    if (!isDraggingRef.current) setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    if (!isDraggingRef.current) setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      const { source, target } = params
      if (source && target) {
        // Условные ручки: story_point -> choice (условие выбора)
        if (params.targetHandle === 'cond' && target.includes('_choice_') && source.startsWith('sp_')) {
          const spId = source.substring(3)
          const parsed = parseChoiceNodeId(target)
          if (parsed) {
            const scene = scenes.find(s => s.id === parsed.sceneId)
            const choice = scene?.screens?.[parsed.screenIndex]?.choices?.[parsed.choiceIndex]
            const existing = (choice?.conditions || []).some((c: any) => c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId))
            if (!existing) {
              const newConds = [...(choice?.conditions || []), { entityType: 'story_point', entityId: spId, property: 'value', operator: '>=', value: 1 }]
              onUpdateChoice && onUpdateChoice(parsed.sceneId, parsed.screenIndex, parsed.choiceIndex, { conditions: newConds })
            }
          }
        }
        // Если соединяем выбор -> сцена, обновляем nextScene
        if (source.includes('_choice_')) {
          const parsed = parseChoiceNodeId(source)
          if (parsed) {
            if (target.includes('_screen_')) {
              const screenIdx = parseInt(target.split('_screen_')[1])
              const scene = scenes.find(s => s.id === parsed.sceneId)
              const screen = scene?.screens?.[screenIdx]
              onUpdateChoice && onUpdateChoice(parsed.sceneId, parsed.screenIndex, parsed.choiceIndex, { nextScreenId: screen?.id, nextScene: undefined })
            } else {
              onUpdateChoice && onUpdateChoice(parsed.sceneId, parsed.screenIndex, parsed.choiceIndex, { nextScene: target, nextScreenId: undefined })
            }
          }
        } else if (source.startsWith('sp_')) {
          // Соединение сюжетная точка -> сцена: добавляем условие в сцену
          const spId = source.substring(3)
          const targetSceneId = target
          const targetScene = scenes.find((s) => s.id === targetSceneId)
          if (targetScene) {
            const existing = (targetScene.conditions || []).some((c: any) => c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId))
            if (!existing) {
              const newCond = { entityType: 'story_point', entityId: spId, property: 'value', operator: '>=', value: 1 }
              const newConds = [...(targetScene.conditions || []), newCond]
              onUpdateScene && onUpdateScene(targetScene.id, { conditions: newConds } as any)
            }
          }
        }
      }
      // Добавляем визуальную связь сразу, затем она будет синхронизирована из данных сцен
      setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds))
    },
    [setEdges, onUpdateChoice, onUpdateScene, scenes]
  )

  // Удаление рёбер: если удаляется выбор -> сцена, очищаем nextScene
  const onEdgesDeleteCb = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => {
        if (edge.source && edge.source.includes('_choice_')) {
          const parsed = parseChoiceNodeId(edge.source)
          if (parsed) {
            onUpdateChoice && onUpdateChoice(parsed.sceneId, parsed.screenIndex, parsed.choiceIndex, { nextScene: undefined, nextScreenId: undefined })
          }
        } else if (edge.source && edge.source.startsWith('sp_') && edge.target && edge.target.includes('_choice_')) {
          // Удаление связи sp -> choice: удаляем условие у выбора
          const spId = edge.source.substring(3)
          const parsed = parseChoiceNodeId(edge.target)
          if (parsed) {
            const scene = scenes.find(s => s.id === parsed.sceneId)
            const choice = scene?.screens?.[parsed.screenIndex]?.choices?.[parsed.choiceIndex]
            const filtered = (choice?.conditions || []).filter((c: any) => !(c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId)))
            onUpdateChoice && onUpdateChoice(parsed.sceneId, parsed.screenIndex, parsed.choiceIndex, { conditions: filtered })
          }
        } else if (edge.source && edge.source.startsWith('sp_')) {
          // Удаление связи сюжетная точка -> сцена: убираем условие из сцены
          const spId = edge.source.substring(3)
          const targetSceneId = edge.target
          const targetScene = scenes.find((s) => s.id === targetSceneId)
          if (targetScene) {
            const newConds = (targetScene.conditions || []).filter((c: any) => !(c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId)))
            if (newConds.length !== (targetScene.conditions || []).length) {
              onUpdateScene && onUpdateScene(targetScene.id, { conditions: newConds } as any)
            }
          }
        }
      })
    },
    [onUpdateChoice, onUpdateScene, scenes]
  )

  // Обновление ребра перетаскиванием конца: меняем целевую сцену у выбора
  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (oldEdge.source && oldEdge.source.includes('_choice_')) {
        const parsed = parseChoiceNodeId(oldEdge.source)
        if (parsed) {
          const newTarget = newConnection.target
          if (newTarget && newTarget.includes('_screen_')) {
            const screenIdx = parseInt(newTarget.split('_screen_')[1])
            const scene = scenes.find(s => s.id === parsed.sceneId)
            const screen = scene?.screens?.[screenIdx]
            onUpdateChoice && onUpdateChoice(parsed.sceneId, parsed.screenIndex, parsed.choiceIndex, { nextScreenId: screen?.id, nextScene: undefined })
          } else {
            onUpdateChoice && onUpdateChoice(parsed.sceneId, parsed.screenIndex, parsed.choiceIndex, { nextScene: newTarget || undefined, nextScreenId: undefined })
          }
        }
      } else if (oldEdge.source && oldEdge.source.startsWith('sp_') && oldEdge.target && oldEdge.target.includes('_choice_')) {
        // Переподключение условия sp -> другой choice
        const spId = oldEdge.source.substring(3)
        const oldParsed = parseChoiceNodeId(oldEdge.target as string)
        if (oldParsed) {
          const oldScene = scenes.find(s => s.id === oldParsed.sceneId)
          const filtered = (oldScene?.screens?.[oldParsed.screenIndex]?.choices?.[oldParsed.choiceIndex]?.conditions || []).filter((c: any) => !(c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId)))
          onUpdateChoice && onUpdateChoice(oldParsed.sceneId, oldParsed.screenIndex, oldParsed.choiceIndex, { conditions: filtered })
        }
        if (newConnection.target && newConnection.target.includes('_choice_')) {
          const newParsed = parseChoiceNodeId(newConnection.target)
          if (newParsed) {
            const newScene = scenes.find(s => s.id === newParsed.sceneId)
            const newChoice = newScene?.screens?.[newParsed.screenIndex]?.choices?.[newParsed.choiceIndex]
            const exists = (newChoice?.conditions || []).some((c: any) => c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId))
            if (!exists) {
              const updated = [...(newChoice?.conditions || []), { entityType: 'story_point', entityId: spId, property: 'value', operator: '>=', value: 1 }]
              onUpdateChoice && onUpdateChoice(newParsed.sceneId, newParsed.screenIndex, newParsed.choiceIndex, { conditions: updated })
            }
          }
        }
      } else if (oldEdge.source && oldEdge.source.startsWith('sp_')) {
        // Переподключение сюжетной точки к другой сцене: переносим условие
        const spId = oldEdge.source.substring(3)
        const oldTargetSceneId = oldEdge.target
        const newTargetSceneId = newConnection.target
        if (!newTargetSceneId) return
        const oldScene = scenes.find((s) => s.id === oldTargetSceneId)
        const newScene = scenes.find((s) => s.id === newTargetSceneId)
        if (oldScene) {
          const filtered = (oldScene.conditions || []).filter((c: any) => !(c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId)))
          if (filtered.length !== (oldScene.conditions || []).length) {
            onUpdateScene && onUpdateScene(oldScene.id, { conditions: filtered } as any)
          }
        }
        if (newScene) {
          const exists = (newScene.conditions || []).some((c: any) => c.entityType === 'story_point' && (c.entityId === spId || c.pointId === spId))
          if (!exists) {
            const newCond = { entityType: 'story_point', entityId: spId, property: 'value', operator: '>=', value: 1 }
            const updated = [...(newScene.conditions || []), newCond]
            onUpdateScene && onUpdateScene(newScene.id, { conditions: updated } as any)
          }
        }
      }
    },
    [onUpdateChoice, onUpdateScene, scenes]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'scene') {
      const scene = scenes.find(s => s.id === node.id)
      if (scene) {
        onSceneSelect(scene)
        setSelectedNodeId(node.id)
      }
    } else if (node.type === 'entry' || node.id.endsWith('_entry')) {
      const id = node.id // format: <sceneId>_entry
      const sceneId = id.replace(/_entry$/, '')
      const scene = scenes.find(s => s.id === sceneId)
      if (scene) {
        onSceneSelect(scene)
        onEntrySelect && onEntrySelect(sceneId)
      }
    } else if (node.type === 'screen' || node.id.includes('_screen_')) {
      const id = node.id // format: <sceneId>_screen_<index>
      const splitIdx = id.lastIndexOf('_screen_')
      if (splitIdx > 0) {
        const sceneId = id.substring(0, splitIdx)
        const idxStr = id.substring(splitIdx + 8)
        const screenIndex = parseInt(idxStr)
        if (!Number.isNaN(screenIndex)) {
          onScreenSelect && onScreenSelect(sceneId, screenIndex)
        }
      }
    } else if (node.type === 'choice') {
      // Узел выбора: формат id теперь <sceneId>_screen_<screenIdx>_choice_<choiceIdx>
      const id = node.id
      const parts = id.split('_')
      // ищем подстроки: ... _screen_<screenIdx>_choice_<choiceIdx>
      const screenIdxPos = parts.lastIndexOf('screen')
      const choiceIdxPos = parts.lastIndexOf('choice')
      if (screenIdxPos !== -1 && choiceIdxPos !== -1 && choiceIdxPos === screenIdxPos + 2) {
        const screenIndex = parseInt(parts[screenIdxPos + 1])
        const choiceIndex = parseInt(parts[choiceIdxPos + 1])
        const sceneId = parts.slice(0, screenIdxPos).join('_')
        if (!Number.isNaN(screenIndex) && !Number.isNaN(choiceIndex)) {
          onChoiceSelect && onChoiceSelect(sceneId, screenIndex, choiceIndex)
        }
      }
    }
  }, [scenes, onSceneSelect, onChoiceSelect, onEntrySelect, onScreenSelect])

  // Обновляем выделение узлов при изменении выбранной сцены
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: node.id === selectedSceneId
      }))
    )
  }, [selectedSceneId, setNodes])

  return (
    <div className="h-[calc(100vh-200px)] w-full">
      <Card className="h-full bg-neutral-900/60 backdrop-blur-xl border border-white/10 text-neutral-100">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-neutral-100">
            <GitBranch className="h-5 w-5" />
            Граф переходов сцен
          </CardTitle>
          <div className="text-sm text-neutral-400">
            Перетащите узлы для лучшего расположения. Синие связи - выборы, зеленые - переходы к сценам.
          </div>
        </CardHeader>
        <CardContent className="p-0 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={(deleted) => {
              deleted.forEach((n) => {
                if (scenes.find((s) => s.id === n.id)) {
                  onDeleteScene && onDeleteScene(n.id)
                }
              })
            }}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onEdgesDelete={onEdgesDeleteCb}
            onConnect={onConnect}
            onEdgeUpdate={onEdgeUpdate}
            onNodeClick={onNodeClick}
            zoomOnDoubleClick={false}
            onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => {
              const targetEl = e.target as Element
              if (
                targetEl.closest('.react-flow__node') ||
                targetEl.closest('.react-flow__handle') ||
                targetEl.closest('.react-flow__edge')
              ) {
                return
              }
              const root = e.currentTarget as HTMLDivElement
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
              const flowX = (e.clientX - bounds.left - translateX) / scale
              const flowY = (e.clientY - bounds.top - translateY) / scale
              const pos = { x: flowX, y: flowY }
              if (mode === 'scene' && selectedSceneId) {
                onAddScreen && onAddScreen(selectedSceneId, pos)
              } else {
                onAddScene && onAddScene(pos)
              }
            }}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, type: 'smoothstep', style: { strokeWidth: 2, stroke: '#64748b' } }}
            fitView
            attributionPosition="bottom-left"
            className="bg-[radial-gradient(ellipse_at_top,rgba(40,40,50,0.6),rgba(20,20,25,0.85))]"
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'scene':
                    return node.data.sceneType === 'start' ? '#10b981' :
                           node.data.sceneType === 'end' ? '#ef4444' : '#3b82f6'
                  case 'choice':
                    return '#8b5cf6'
                  default:
                    return '#6b7280'
                }
              }}
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </CardContent>
      </Card>
    </div>
  )
}
