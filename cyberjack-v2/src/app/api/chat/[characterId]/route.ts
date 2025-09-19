// app/api/chat/[characterId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { CharacterAIService } from '../../../../../lib/character/ai-service'

// Кэш для AI сервиса
let cachedAIService: CharacterAIService | null = null
let lastApiKey: string | null = null

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { message, userId, context } = await request.json()
    const { characterId } = await params

    console.log('🤖 AI Chat Request:', {
      characterId,
      message,
      userId,
      context
    })

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

    // Используем кэшированный AI сервис
    if (!cachedAIService || lastApiKey !== apiKey) {
      console.log('🚀 Создаем новый CharacterAIService...')
      cachedAIService = new CharacterAIService(apiKey, baseUrl, model, model2)
      lastApiKey = apiKey
      console.log('✅ CharacterAIService создан и закэширован')
    } else {
      console.log('♻️ Используем кэшированный CharacterAIService')
    }
    
    const aiService = cachedAIService

    console.log('🚀 Вызываем aiService.generateResponse...')
    const aiResponse = await aiService.generateResponse(
      characterId,
      message,
      {
        userId,
        ...context
      }
    )
    console.log('✅ aiService.generateResponse завершен')

    console.log('🤖 AI Response:', {
      characterId,
      response: aiResponse.message,
      metadata: aiResponse.metadata
    })

    return NextResponse.json({
      response: aiResponse.message,
      characterId,
      timestamp: aiResponse.timestamp,
      metadata: aiResponse.metadata
    })
  } catch (error) {
    console.error('Error generating AI response:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
