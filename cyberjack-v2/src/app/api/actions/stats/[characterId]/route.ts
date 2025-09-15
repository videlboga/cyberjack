// app/api/actions/stats/[characterId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { CharacterAIService } from '../../../../../../lib/character/ai-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const aiService = new CharacterAIService(apiKey)

    // Получаем статистику действий
    const stats = await aiService.getActionStats(characterId, userId)

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error getting action stats:', error)
    return NextResponse.json(
      { error: 'Failed to get action stats' },
      { status: 500 }
    )
  }
}
