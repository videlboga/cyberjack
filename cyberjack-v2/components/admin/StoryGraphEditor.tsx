'use client'

import { useState, useEffect, useCallback } from 'react'
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
  NodeTypes,
  EdgeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Save, Download, Upload, Trash2 } from 'lucide-react'

// Типы узлов для сюжетного графа
interface StoryNode extends Node {
  data: {
    label: string
    type: 'scene' | 'screen' | 'choice' | 'storypoint'
    description?: string
    metadata?: Record<string, any>
  }
}

interface StoryEdge extends Edge {
  data?: {
    label?: string
    condition?: string
  }
}

// Кастомные компоненты узлов
const SceneNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-blue-100 border-2 border-blue-300 min-w-[150px]">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
      <div className="font-bold text-blue-800">{data.label}</div>
    </div>
    {data.description && (
      <div className="text-xs text-blue-600 mt-1">{data.description}</div>
    )}
  </div>
)

const ScreenNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-green-100 border-2 border-green-300 min-w-[150px]">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
      <div className="font-bold text-green-800">{data.label}</div>
    </div>
    {data.description && (
      <div className="text-xs text-green-600 mt-1">{data.description}</div>
    )}
  </div>
)

const ChoiceNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-yellow-100 border-2 border-yellow-300 min-w-[150px]">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
      <div className="font-bold text-yellow-800">{data.label}</div>
    </div>
    {data.description && (
      <div className="text-xs text-yellow-600 mt-1">{data.description}</div>
    )}
  </div>
)

const StoryPointNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-purple-100 border-2 border-purple-300 min-w-[150px]">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
      <div className="font-bold text-purple-800">{data.label}</div>
    </div>
    {data.description && (
      <div className="text-xs text-purple-600 mt-1">{data.description}</div>
    )}
  </div>
)

const nodeTypes: NodeTypes = {
  scene: SceneNode,
  screen: ScreenNode,
  choice: ChoiceNode,
  storypoint: StoryPointNode,
}

export function StoryGraphEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNodeType, setSelectedNodeType] = useState<'scene' | 'screen' | 'choice' | 'storypoint'>('scene')
  const [nodeCounter, setNodeCounter] = useState(1)
  const [graphStats, setGraphStats] = useState({
    scenes: 0,
    screens: 0,
    choices: 0,
    storyPoints: 0
  })

  // Загрузка данных из API
  const loadStoryData = useCallback(async () => {
    try {
      const response = await fetch('/api/story/graph')
      if (response.ok) {
        const graph = await response.json()

        // Преобразуем данные в формат React Flow
        const newNodes: StoryNode[] = graph.nodes.map((node: any) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            label: node.name,
            type: node.type,
            description: node.description,
            metadata: node.data
          }
        }))

        const newEdges: StoryEdge[] = graph.edges.map((edge: any) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          data: {
            label: edge.label
          }
        }))

        setNodes(newNodes)
        setEdges(newEdges)

        // Загружаем статистику
        const statsResponse = await fetch('/api/story/graph/stats')
        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          setGraphStats(stats)
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных сюжета:', error)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    loadStoryData()
  }, [loadStoryData])

  // Добавление нового узла
  const addNode = useCallback(() => {
    const newNode: StoryNode = {
      id: `${selectedNodeType}-${nodeCounter}`,
      type: selectedNodeType,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: `Новый ${selectedNodeType === 'scene' ? 'сцена' :
                selectedNodeType === 'screen' ? 'экран' :
                selectedNodeType === 'choice' ? 'выбор' : 'сюжетная точка'}`,
        type: selectedNodeType,
        description: '',
        metadata: {}
      }
    }

    setNodes((nds) => [...nds, newNode])
    setNodeCounter((counter) => counter + 1)
  }, [selectedNodeType, nodeCounter, setNodes])

  // Соединение узлов
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: StoryEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        type: 'smoothstep'
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  // Сохранение графа
  const saveGraph = useCallback(async () => {
    try {
      const response = await fetch('/api/story/graph/export')
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.download = `story-graph-${new Date().toISOString().split('T')[0]}.json`
        link.click()

        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Ошибка при экспорте графа:', error)
    }
  }, [])

  // Загрузка графа
  const loadGraph = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const graphJson = e.target?.result as string

            const response = await fetch('/api/story/graph', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ graphJson })
            })

            if (response.ok) {
              await loadStoryData() // Перезагружаем данные
            } else {
              alert('Ошибка при импорте графа')
            }
          } catch (error) {
            console.error('Ошибка при загрузке файла:', error)
            alert('Ошибка при загрузке файла')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [loadStoryData])

  // Очистка графа
  const clearGraph = useCallback(() => {
    if (confirm('Вы уверены, что хотите очистить весь граф?')) {
      setNodes([])
      setEdges([])
    }
  }, [setNodes, setEdges])

  return (
    <div className="h-screen flex flex-col">
      {/* Панель инструментов */}
      <div className="flex items-center gap-4 p-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Тип узла:</label>
          <select
            value={selectedNodeType}
            onChange={(e) => setSelectedNodeType(e.target.value as any)}
            className="px-3 py-1 border rounded"
            title="Выберите тип узла для добавления"
          >
            <option value="scene">Сцена</option>
            <option value="screen">Экран</option>
            <option value="choice">Выбор</option>
            <option value="storypoint">Сюжетная точка</option>
          </select>
        </div>

        <Button onClick={addNode} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Добавить узел
        </Button>

        <div className="flex gap-2">
          <Button onClick={saveGraph} variant="outline" size="sm">
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
          <Button onClick={loadGraph} variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Загрузить
          </Button>
          <Button onClick={clearGraph} variant="outline" size="sm" className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />
            Очистить
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          <Badge variant="outline">Сцены: {graphStats.scenes}</Badge>
          <Badge variant="outline">Экраны: {graphStats.screens}</Badge>
          <Badge variant="outline">Выборы: {graphStats.choices}</Badge>
          <Badge variant="outline">Точки: {graphStats.storyPoints}</Badge>
        </div>
      </div>

      {/* Граф */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>

      {/* Легенда */}
      <div className="p-4 bg-gray-50 border-t">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span>Сцены</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Экраны</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <span>Выборы</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
            <span>Сюжетные точки</span>
          </div>
        </div>
      </div>
    </div>
  )
}
