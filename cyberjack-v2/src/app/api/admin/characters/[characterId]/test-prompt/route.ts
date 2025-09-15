import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PromptSystem } from '@/lib/character/prompt-system'

// POST /api/admin/characters/[characterId]/test-prompt - Тестирование промптов персонажа
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { characterId } = await params
    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Сообщение для тестирования обязательно' },
        { status: 400 }
      )
    }

    // Проверяем существование персонажа
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Персонаж не найден' },
        { status: 404 }
      )
    }

    // Создаем систему промптов
    const promptSystem = new PromptSystem()

    // Создаем контекст для тестирования
    const testContext = {
      characterId,
      userId: session.user.id,
      message,
      characteristics: character.characteristics.map(char => ({
        id: char.id,
        name: char.definition.name,
        category: char.definition.category,
        currentValue: char.currentValue,
        baseValue: char.baseValue,
        isRevealed: true,
        revealedValue: char.currentValue,
        accuracy: 100
      })),
      memory: {
        shortTerm: [],
        longTerm: [],
        contextual: [],
        emotional: [],
        recent: []
      },
      userModifiers: {
        sentiment: 'neutral'
      },
      gameTime: Date.now(),
      sessionHistory: [],
      environment: {
        timeOfDay: 'day',
        location: 'test',
        atmosphere: 'neutral',
        temperature: 'comfortable',
        lighting: 'normal',
        sounds: [],
        smells: []
      }
    }

    // Генерируем промпт
    const prompt = await promptSystem.buildDynamicPrompt(characterId, testContext, true)

    return NextResponse.json({
      prompt,
      context: testContext,
      character: {
        id: character.id,
        name: character.name,
        description: character.description
      }
    })
  } catch (error) {
    console.error('Ошибка тестирования промпта:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
