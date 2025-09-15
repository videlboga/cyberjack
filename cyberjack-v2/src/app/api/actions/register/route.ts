// app/api/actions/register/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { CharacterAIService } from '../../../../../lib/character/ai-service'

export async function POST(request: NextRequest) {
  try {
    const { characterId, userId, actionName, intensity, targetZone, effects } = await request.json()

    if (!characterId || !userId || !actionName) {
      return NextResponse.json(
        { error: 'Missing required parameters: characterId, userId, actionName' },
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

    // Регистрируем действие
    await aiService.registerAction(
      characterId,
      userId,
      actionName,
      intensity || 50,
      targetZone,
      effects || []
    )

    return NextResponse.json({
      success: true,
      message: 'Action registered successfully'
    })
  } catch (error) {
    console.error('Error registering action:', error)
    return NextResponse.json(
      { error: 'Failed to register action' },
      { status: 500 }
    )
  }
}
