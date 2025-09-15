import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      )
    }

    // Получаем знания пользователя о персонаже
    const knowledge = await prisma.characterKnowledge.findMany({
      where: {
        characterId,
        userId
      },
      include: {
        characteristic: true
      }
    })

    // Преобразуем в нужный формат
    const formattedKnowledge = knowledge.map(k => ({
      id: k.id,
      characteristicDefId: k.characteristicDefId,
      level: k.level,
      value: k.value,
      accuracy: k.accuracy,
      lastRevealed: k.lastRevealed,
      definition: k.characteristic || {
        name: 'Unknown',
        category: 'unknown'
      }
    }))

    return NextResponse.json(formattedKnowledge)
  } catch (error) {
    console.error('Error fetching character knowledge:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
