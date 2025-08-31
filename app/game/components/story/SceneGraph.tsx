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

// Узел выбора удалён: выборы редактируются в панели экрана, а на графе представлены рёбрами

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
                const reader = new FileReader()
                reader.onload = () => {
                  const dataUrl = reader.result as string
                  data.onUpdateScreen && data.onUpdateScreen({ content: { ...(data.content || {}), background: dataUrl } })
                }
                reader.readAsDataURL(file)
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
        <Select
          value={data.stationEntityId ?? undefined}
          onValueChange={(v) => {
            if (v !== data.stationEntityId) {
              data.onUpdateScene && data.onUpdateScene({ stationEntityId: v })
            }
          }}
        >
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

  // Парсер источника узла экрана: <sceneId>_screen_<index>
  const parseScreenNodeId = (id: string): { sceneId: string; screenIndex: number } | null => {
    const splitIdx = id.lastIndexOf('_screen_')
    if (splitIdx > 0) {
      const sceneId = id.substring(0, splitIdx)
      const idxStr = id.substring(splitIdx + 8)
      const screenIndex = parseInt(idxStr)
      if (!Number.isNaN(screenIndex)) return { sceneId, screenIndex }
    }
    return null
  }

  // Создание узлов и связей на основе сцен (без useMemo во избежание синтакс. рассинхронизаций)
  const computeGraph = () => {
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

      // Рёбра экран -> экран/сцена по выборов на экране
      ;(screens || []).forEach((screen, screenIdx) => {
        (screen.choices || []).forEach((choice) => {
          const sourceId = `${scene.id}_screen_${screenIdx}`
          if (choice.nextScreenId) {
            const idx = (scene.screens || []).findIndex(s => s.id === choice.nextScreenId)
            if (idx >= 0) {
              edges.push({
                id: `edge_${sourceId}_to_screen_${choice.nextScreenId}`,
                source: sourceId,
                target: `${scene.id}_screen_${idx}`,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#8b5cf6', strokeWidth: 2 },
                label: choice.text.length > 15 ? choice.text.substring(0, 15) + '...' : choice.text,
                data: { choiceId: choice.id }
              })
            }
          } else if (choice.nextScene) {
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
              id: `edge_${sourceId}_to_scene_${choice.nextScene}_${choice.id}`,
              source: sourceId,
              target: choice.nextScene,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#10b981', strokeWidth: 2 },
              label: choice.text.length > 15 ? choice.text.substring(0, 15) + '...' : choice.text,
              data: { choiceId: choice.id }
            })
          }
        })
      })

    })

    // Не отображаем сюжетные точки на графе — редактируются в панели

    return { nodes, edges }
  }

  const { nodes: initialNodes, edges: initialEdges } = React.useMemo(() => computeGraph(), [
    scenes,
    selectedSceneId,
    mode,
    stationEntitiesForSelect,
    onUpdateScene,
    onDeleteScene,
  ])

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
    // Выборы больше не узлы — позиционирование не требуется
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
        if (source.startsWith('sp_')) {
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

  // Удаление рёбер: очищаем цели у выбора, если edge.data.choiceId
  const onEdgesDeleteCb = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => {
        if (edge.data && (edge.data as any).choiceId) {
          const src = parseScreenNodeId(edge.source)
          if (src) {
            const scene = scenes.find(s => s.id === src.sceneId)
            const screenIdx = src.screenIndex
            const choiceId = (edge.data as any).choiceId as string
            const choiceIndex = scene?.screens?.[screenIdx]?.choices.findIndex(c => c.id === choiceId) ?? -1
            if (choiceIndex >= 0) {
              onUpdateChoice && onUpdateChoice(src.sceneId, screenIdx, choiceIndex, { nextScene: undefined, nextScreenId: undefined })
            }
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

  // Обновление ребра перетаскиванием конца: меняем целевую сцену/экран у выбора
  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (oldEdge.data && (oldEdge.data as any).choiceId) {
        const src = parseScreenNodeId(oldEdge.source)
        if (src) {
          const scene = scenes.find(s => s.id === src.sceneId)
          const choiceId = (oldEdge.data as any).choiceId as string
          const choiceIndex = scene?.screens?.[src.screenIndex]?.choices.findIndex(c => c.id === choiceId) ?? -1
          if (choiceIndex >= 0) {
            const newTarget = newConnection.target
            if (newTarget && newTarget.includes('_screen_')) {
              const screenIdx = parseInt(newTarget.split('_screen_')[1])
              const tgtScene = scenes.find(s => s.id === src.sceneId)
              const screen = tgtScene?.screens?.[screenIdx]
              onUpdateChoice && onUpdateChoice(src.sceneId, src.screenIndex, choiceIndex, { nextScreenId: screen?.id, nextScene: undefined })
            } else {
              onUpdateChoice && onUpdateChoice(src.sceneId, src.screenIndex, choiceIndex, { nextScene: newTarget || undefined, nextScreenId: undefined })
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
              const pos = { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
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
