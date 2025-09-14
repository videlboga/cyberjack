import { NextRequest, NextResponse } from 'next/server'
import { StoryGraphEditor } from '@/lib/story/graph-editor'

// GET /api/story/graph/stats - Получить статистику графа
export async function GET(request: NextRequest) {
  try {
    const graphEditor = StoryGraphEditor.getInstance()
    const stats = await graphEditor.getGraphStats()

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Ошибка при получении статистики графа:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении статистики графа' },
      { status: 500 }
    )
  }
}
