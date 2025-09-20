// app/api/chat/[characterId]/history/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params

    if (!characterId) {
      return NextResponse.json(
        { error: 'Character ID is required' },
        { status: 400 }
      )
    }

    // Получаем последние сообщения чата (до 200, начиная с самых свежих)
    const chatHistory = await prisma.chatMessage.findMany({
      where: {
        characterId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 200,
      select: {
        id: true,
        content: true,
        messageType: true,
        emotionalTone: true,
        createdAt: true
      }
    })

    // Возвращаем в хронологическом порядке
    return NextResponse.json(chatHistory.reverse())
  } catch (error) {
    console.error('Ошибка получения истории чата:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
