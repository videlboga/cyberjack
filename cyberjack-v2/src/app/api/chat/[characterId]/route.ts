// app/api/chat/[characterId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { CharacterAIService } from '../../../../../lib/character/ai-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { characterId: string } }
) {
  try {
    const { message, userId, context } = await request.json()

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    const baseUrl = process.env.OPENROUTER_BASE_URL
    const model = process.env.OPENROUTER_MODEL
    const model2 = process.env.OPENROUTER_MODEL_2

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const aiService = new CharacterAIService(apiKey, baseUrl, model, model2)
    const response = await aiService.generateResponse(
      params.characterId,
      message,
      context || {}
    )

    return NextResponse.json({
      response,
      characterId: params.characterId,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Error generating AI response:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
