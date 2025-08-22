'use client'

import React, { useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  MarkerType,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  Monitor,
  GitBranch,
  Save,
  Eye,
  Square,
  Play,
  Pause
} from "lucide-react"

// Кастомные узлы для React Flow
const SceneNode = ({ data, isConnectable }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-blue-400">
      <div className="flex items-center">
        <FileText className="h-4 w-4 mr-2 text-blue-600" />
        <div className="ml-2">
          <div className="text-lg font-bold text-blue-600">{data.label}</div>
          <div className="text-gray-500 text-sm">{data.description}</div>
        </div>
      </div>

      <div className="flex">
        <div
          className="w-4 h-4 absolute top-1/2 -left-2 bg-blue-400 border-4 border-white rounded-full"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
        <div
          className="w-4 h-4 absolute top-1/2 -right-2 bg-blue-400 border-4 border-white rounded-full"
          style={{ transform: 'translate(50%, -50%)' }}
        />
      </div>
    </div>
  )
}

const ScreenNode = ({ data, isConnectable }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-green-400">
      <div className="flex items-center">
        <Monitor className="h-4 w-4 mr-2 text-green-600" />
        <div className="ml-2">
          <div className="text-lg font-bold text-green-600">{data.label}</div>
          <div className="text-gray-500 text-sm">{data.description}</div>
        </div>
      </div>

      <div className="flex">
        <div
          className="w-4 h-4 absolute top-1/2 -left-2 bg-green-400 border-4 border-white rounded-full"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
        <div
          className="w-4 h-4 absolute top-1/2 -right-2 bg-green-400 border-4 border-white rounded-full"
          style={{ transform: 'translate(50%, -50%)' }}
        />
      </div>
    </div>
  )
}

const ChoiceNode = ({ data, isConnectable }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-purple-400">
      <div className="flex items-center">
        <GitBranch className="h-4 w-4 mr-2 text-purple-600" />
        <div className="ml-2">
          <div className="text-lg font-bold text-purple-600">{data.label}</div>
          <div className="text-gray-500 text-sm">{data.description}</div>
        </div>
      </div>

      <div className="flex">
        <div
          className="w-4 h-4 absolute top-1/2 -left-2 bg-purple-400 border-4 border-white rounded-full"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
        <div
          className="w-4 h-4 absolute top-1/2 -right-2 bg-purple-400 border-4 border-white rounded-full"
          style={{ transform: 'translate(50%, -50%)' }}
        />
      </div>
    </div>
  )
}

interface StoryEditorProps {
  storyData: any
  onSave: (data: any) => void
  workspaces?: Record<string, any>
  activeWorkspaceId?: string
  onWorkspaceChange?: (workspaceId: string) => void
}

export const StoryEditor: React.FC<StoryEditorProps> = ({ 
  storyData, 
  onSave, 
  workspaces, 
  activeWorkspaceId, 
  onWorkspaceChange 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')

  // Определяем типы узлов
  const nodeTypes: NodeTypes = useMemo(() => ({
    scene: SceneNode,
    screen: ScreenNode,
    choice: ChoiceNode,
  }), [])

  // Инициализация данных из storyData
  React.useEffect(() => {
    if (storyData) {
      const initialNodes: Node[] = []
      const initialEdges: Edge[] = []
      
      // Создаем узлы для сцен
      storyData.scenes?.forEach((scene: any, sceneIndex: number) => {
        initialNodes.push({
          id: `scene-${scene.id}`,
          type: 'scene',
          position: { x: 100 + sceneIndex * 400, y: 100 },
          data: { 
            label: scene.title || 'Новая сцена', 
            description: scene.description || '',
            originalData: scene
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        })

        // Создаем узлы для экранов в сцене
        scene.screens?.forEach((screen: any, screenIndex: number) => {
          const screenId = `screen-${screen.id}`
          initialNodes.push({
            id: screenId,
            type: 'screen',
            position: { 
              x: 100 + sceneIndex * 400, 
              y: 250 + screenIndex * 150 
            },
            data: { 
              label: screen.title || 'Новый экран', 
              description: screen.description || '',
              originalData: screen
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          })

          // Связываем сцену с экраном
          initialEdges.push({
            id: `edge-scene-${scene.id}-${screen.id}`,
            source: `scene-${scene.id}`,
            target: screenId,
            type: 'default',
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            label: 'содержит',
            style: { stroke: '#3b82f6', strokeWidth: 2 },
          })

          // Создаем узлы для выборов
          screen.choices?.forEach((choice: any, choiceIndex: number) => {
            const choiceId = `choice-${choice.id}`
            initialNodes.push({
              id: choiceId,
              type: 'choice',
              position: { 
                x: 400 + sceneIndex * 400 + choiceIndex * 200, 
                y: 250 + screenIndex * 150 + choiceIndex * 100 
              },
              data: { 
                label: choice.text || 'Новый выбор', 
                description: choice.description || '',
                originalData: choice
              },
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            })

            // Связываем экран с выбором
            initialEdges.push({
              id: `edge-screen-${screen.id}-${choice.id}`,
              source: screenId,
              target: choiceId,
              type: 'default',
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
              label: 'выбор',
              style: { stroke: '#10b981', strokeWidth: 2 },
            })
          })
        })
      })

      setNodes(initialNodes)
      setEdges(initialEdges)
    }
  }, [storyData, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }, [])

  const addNode = useCallback((type: 'scene' | 'screen' | 'choice') => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 500 + 100, y: Math.random() * 400 + 100 },
      data: { 
        label: `Новая ${type === 'scene' ? 'сцена' : type === 'screen' ? 'экран' : 'выбор'}`,
        description: '',
        originalData: {}
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
  }, [setNodes])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null)
    }
  }, [setNodes, setEdges, selectedNode])

  const updateNode = useCallback((nodeId: string, updates: any) => {
    setNodes((nds) => 
      nds.map((node) => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    )
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...updates } } : null)
    }
  }, [setNodes, selectedNode])

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId))
    if (selectedEdge?.id === edgeId) {
      setSelectedEdge(null)
    }
  }, [setEdges, selectedEdge])

  const handleSave = useCallback(() => {
    const storyStructure = {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type
      }))
    }
    onSave(storyStructure)
  }, [nodes, edges, onSave])

  const renderNodeEditor = () => {
    if (!selectedNode) return null

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Редактирование узла
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteNode(selectedNode.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="label">Название</Label>
            <Input
              id="label"
              value={selectedNode.data.label || ''}
              onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
              placeholder="Введите название"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={selectedNode.data.description || ''}
              onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
              placeholder="Введите описание"
              rows={3}
            />
          </div>

          {selectedNode.type === 'screen' && (
            <div>
              <Label htmlFor="background">Фон</Label>
              <Input
                id="background"
                value={selectedNode.data.background || ''}
                onChange={(e) => updateNode(selectedNode.id, { background: e.target.value })}
                placeholder="URL изображения фона"
              />
            </div>
          )}

          {selectedNode.type === 'choice' && (
            <div className="space-y-2">
              <Label>Последствия</Label>
              <div className="space-y-2">
                {selectedNode.data.consequences?.map((consequence: any, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Select
                      value={consequence.type}
                      onValueChange={(value) => {
                        const newConsequences = [...(selectedNode.data.consequences || [])]
                        newConsequences[index] = { ...consequence, type: value }
                        updateNode(selectedNode.id, { consequences: newConsequences })
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gain_credits">Получить кредиты</SelectItem>
                        <SelectItem value="story_point_change">Изменить сюжетную точку</SelectItem>
                        <SelectItem value="talent_stat_change">Изменить статистику</SelectItem>
                        <SelectItem value="gain_equipment">Получить оборудование</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={consequence.amount || consequence.change || ''}
                      onChange={(e) => {
                        const newConsequences = [...(selectedNode.data.consequences || [])]
                        newConsequences[index] = { 
                          ...consequence, 
                          [consequence.type === 'gain_credits' ? 'amount' : 'change']: e.target.value 
                        }
                        updateNode(selectedNode.id, { consequences: newConsequences })
                      }}
                      placeholder="Значение"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const newConsequences = selectedNode.data.consequences?.filter((_: any, i: number) => i !== index) || []
                        updateNode(selectedNode.id, { consequences: newConsequences })
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newConsequences = [...(selectedNode.data.consequences || []), { type: 'gain_credits', amount: 0 }]
                    updateNode(selectedNode.id, { consequences: newConsequences })
                  }}
                  className="w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Добавить последствие
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderEdgeEditor = () => {
    if (!selectedEdge) return null

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Редактирование связи
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteEdge(selectedEdge.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedEdge(null)}
              >
                ✕
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="edgeLabel">Метка</Label>
            <Input
              id="edgeLabel"
              value={selectedEdge.label || ''}
              onChange={(e) => {
                setEdges((eds) => eds.map((edge) => 
                  edge.id === selectedEdge.id 
                    ? { ...edge, label: e.target.value }
                    : edge
                ))
                setSelectedEdge(prev => prev ? { ...prev, label: e.target.value } : null)
              }}
              placeholder="Описание связи"
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p><strong>От:</strong> {selectedEdge.source}</p>
            <p><strong>К:</strong> {selectedEdge.target}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Панель инструментов */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Сюжетный редактор</h1>
          
          {/* Селектор рабочей области */}
          {workspaces && activeWorkspaceId && onWorkspaceChange && (
            <div className="flex items-center gap-2">
              <Label htmlFor="workspace-select" className="text-sm font-medium">
                Рабочая область:
              </Label>
              <Select
                value={activeWorkspaceId}
                onValueChange={onWorkspaceChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(workspaces).map((workspace: any) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addNode('scene')}>
              <Plus className="h-3 w-3 mr-1" />
              Сцена
            </Button>
            <Button size="sm" onClick={() => addNode('screen')}>
              <Plus className="h-3 w-3 mr-1" />
              Экран
            </Button>
            <Button size="sm" onClick={() => addNode('choice')}>
              <Plus className="h-3 w-3 mr-1" />
              Выбор
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'edit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('edit')}
          >
            <Edit className="h-3 w-3 mr-1" />
            Редактирование
          </Button>
          <Button
            variant={viewMode === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('preview')}
          >
            <Eye className="h-3 w-3 mr-1" />
            Предпросмотр
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-3 w-3 mr-1" />
            Сохранить
          </Button>
        </div>
      </div>

      {/* Основная область */}
      <div className="flex-1 flex">
        {/* React Flow канвас */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="top-right"
          >
            <MiniMap />
            <Controls />
            <Background color="#aaa" gap={16} />
          </ReactFlow>
        </div>

        {/* Панель редактирования */}
        <div className="w-80 border-l p-4 overflow-y-auto">
          <ScrollArea className="h-full">
            {selectedNode && renderNodeEditor()}
            {selectedEdge && renderEdgeEditor()}
            {!selectedNode && !selectedEdge && (
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">Выберите узел или связь для редактирования</p>
                <div className="text-sm space-y-2">
                  <p><strong>Управление:</strong></p>
                  <ul className="text-left space-y-1">
                    <li>• Перетаскивайте узлы</li>
                    <li>• Соединяйте узлы линиями</li>
                    <li>• Кликайте для выбора</li>
                    <li>• Используйте колесо мыши для масштабирования</li>
                  </ul>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}