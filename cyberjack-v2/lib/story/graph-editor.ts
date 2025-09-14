import { prisma } from '@/lib/db/client'

export interface StoryGraphNode {
  id: string
  type: 'scene' | 'screen' | 'choice' | 'storypoint'
  name: string
  description?: string
  position: { x: number; y: number }
  data: any
}

export interface StoryGraphEdge {
  id: string
  source: string
  target: string
  type: 'scene-to-screen' | 'screen-to-choice' | 'choice-to-storypoint'
  label?: string
}

export interface StoryGraph {
  nodes: StoryGraphNode[]
  edges: StoryGraphEdge[]
}

export class StoryGraphEditor {
  private static instance: StoryGraphEditor

  static getInstance(): StoryGraphEditor {
    if (!StoryGraphEditor.instance) {
      StoryGraphEditor.instance = new StoryGraphEditor()
    }
    return StoryGraphEditor.instance
  }

  // Загрузить граф сюжета из базы данных
  async loadStoryGraph(): Promise<StoryGraph> {
    try {
      const [scenes, storyPoints] = await Promise.all([
        prisma.scene.findMany({
          where: { isActive: true },
          include: {
            screens: {
              include: {
                choices: true
              }
            }
          }
        }),
        prisma.storyPoint.findMany({
          where: { isActive: true }
        })
      ])

      const nodes: StoryGraphNode[] = []
      const edges: StoryGraphEdge[] = []

      // Добавляем сцены
      scenes.forEach((scene, sceneIndex) => {
        nodes.push({
          id: `scene-${scene.id}`,
          type: 'scene',
          name: scene.name,
          description: scene.description || undefined,
          position: { x: 100, y: 100 + sceneIndex * 200 },
          data: scene
        })

        // Добавляем экраны сцены
        scene.screens.forEach((screen, screenIndex) => {
          nodes.push({
            id: `screen-${screen.id}`,
            type: 'screen',
            name: screen.name,
            description: screen.description || undefined,
            position: { x: 400, y: 100 + sceneIndex * 200 + screenIndex * 120 },
            data: screen
          })

          // Связываем сцену с экраном
          edges.push({
            id: `edge-scene-${scene.id}-screen-${screen.id}`,
            source: `scene-${scene.id}`,
            target: `screen-${screen.id}`,
            type: 'scene-to-screen'
          })

          // Добавляем выборы экрана
          screen.choices.forEach((choice, choiceIndex) => {
            nodes.push({
              id: `choice-${choice.id}`,
              type: 'choice',
              name: choice.text,
              description: choice.description || undefined,
              position: { x: 700, y: 100 + sceneIndex * 200 + screenIndex * 120 + choiceIndex * 80 },
              data: choice
            })

            // Связываем экран с выбором
            edges.push({
              id: `edge-screen-${screen.id}-choice-${choice.id}`,
              source: `screen-${screen.id}`,
              target: `choice-${choice.id}`,
              type: 'screen-to-choice'
            })
          })
        })
      })

      // Добавляем сюжетные точки
      storyPoints.forEach((storyPoint, index) => {
        nodes.push({
          id: `storypoint-${storyPoint.id}`,
          type: 'storypoint',
          name: storyPoint.name,
          description: storyPoint.description || undefined,
          position: { x: 1000, y: 100 + index * 100 },
          data: storyPoint
        })
      })

      return { nodes, edges }
    } catch (error) {
      console.error('Ошибка при загрузке графа сюжета:', error)
      return { nodes: [], edges: [] }
    }
  }

  // Сохранить граф сюжета (экспорт в JSON)
  async exportStoryGraph(): Promise<string> {
    const graph = await this.loadStoryGraph()
    return JSON.stringify(graph, null, 2)
  }

  // Импортировать граф сюжета (из JSON)
  async importStoryGraph(graphJson: string): Promise<boolean> {
    try {
      const graph: StoryGraph = JSON.parse(graphJson)

      // Здесь можно добавить логику для импорта графа
      // Пока просто возвращаем true
      console.log('Импортирован граф сюжета:', graph)
      return true
    } catch (error) {
      console.error('Ошибка при импорте графа сюжета:', error)
      return false
    }
  }

  // Получить статистику графа
  async getGraphStats(): Promise<{
    scenes: number
    screens: number
    choices: number
    storyPoints: number
  }> {
    try {
      const [scenesCount, screensCount, choicesCount, storyPointsCount] = await Promise.all([
        prisma.scene.count({ where: { isActive: true } }),
        prisma.screen.count(),
        prisma.choice.count(),
        prisma.storyPoint.count({ where: { isActive: true } })
      ])

      return {
        scenes: scenesCount,
        screens: screensCount,
        choices: choicesCount,
        storyPoints: storyPointsCount
      }
    } catch (error) {
      console.error('Ошибка при получении статистики графа:', error)
      return {
        scenes: 0,
        screens: 0,
        choices: 0,
        storyPoints: 0
      }
    }
  }
}
