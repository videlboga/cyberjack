// app/api/actions/history/[characterId]/route.ts

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
    const limit = parseInt(searchParams.get('limit') || '20')

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

    // Получаем историю действий
    const history = await aiService.getActionHistory(characterId, userId, limit)

    return NextResponse.json({
      success: true,
      history
    })
  } catch (error) {
    console.error('Error getting action history:', error)
    return NextResponse.json(
      { error: 'Failed to get action history' },
      { status: 500 }
    )
  }
}
