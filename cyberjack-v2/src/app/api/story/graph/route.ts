import { NextRequest, NextResponse } from 'next/server'
import { StoryGraphEditor } from '@/lib/story/graph-editor'

// GET /api/story/graph - Получить граф сюжета
export async function GET(request: NextRequest) {
  try {
    const graphEditor = StoryGraphEditor.getInstance()
    const graph = await graphEditor.loadStoryGraph()

    return NextResponse.json(graph)
  } catch (error) {
    console.error('Ошибка при получении графа сюжета:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении графа сюжета' },
      { status: 500 }
    )
  }
}

// POST /api/story/graph - Импортировать граф сюжета
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { graphJson } = body

    if (!graphJson) {
      return NextResponse.json(
        { error: 'JSON графа обязателен' },
        { status: 400 }
      )
    }

    const graphEditor = StoryGraphEditor.getInstance()
    const success = await graphEditor.importStoryGraph(graphJson)

    if (!success) {
      return NextResponse.json(
        { error: 'Ошибка при импорте графа' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка при импорте графа сюжета:', error)
    return NextResponse.json(
      { error: 'Ошибка при импорте графа сюжета' },
      { status: 500 }
    )
  }
}
