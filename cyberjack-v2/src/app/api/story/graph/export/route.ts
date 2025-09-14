import { NextRequest, NextResponse } from 'next/server'
import { StoryGraphEditor } from '@/lib/story/graph-editor'

// GET /api/story/graph/export - Экспортировать граф сюжета
export async function GET(request: NextRequest) {
  try {
    const graphEditor = StoryGraphEditor.getInstance()
    const graphJson = await graphEditor.exportStoryGraph()

    return new NextResponse(graphJson, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="story-graph.json"'
      }
    })
  } catch (error) {
    console.error('Ошибка при экспорте графа сюжета:', error)
    return NextResponse.json(
      { error: 'Ошибка при экспорте графа сюжета' },
      { status: 500 }
    )
  }
}
