// src/app/api/chat/[characterId]/formula/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ChatFormulaSystem } from '@/lib/core/chat/chat-formula-system'
import { prisma } from '@/lib/db/client'

const chatFormulaSystem = new ChatFormulaSystem()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { characterId } = await params
    const body = await request.json()
    const { message, messageType = 'user' } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    // Проверяем, что персонаж существует и принадлежит пользователю
    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        userId: session.user.id
      }
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Character not found or access denied' },
        { status: 404 }
      )
    }

    // Создаем объект сообщения
    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      content: message,
      senderId: session.user.id,
      characterId,
      timestamp: new Date(),
      messageType: messageType as 'user' | 'character'
    }

    // Обрабатываем сообщение с помощью формул
    const result = await chatFormulaSystem.processUserMessage(
      chatMessage,
      characterId,
      session.user.id
    )

    // Сохраняем сообщение в базе данных
    await prisma.chatMessage.create({
      data: {
        id: chatMessage.id,
        content: message,
        senderId: session.user.id,
        characterId,
        messageType,
        emotionalTone: result.effects.length > 0 ?
          (result.effects.some(e => e.change > 0) ? 'positive' : 'negative') : 'neutral',
        createdAt: chatMessage.timestamp
      }
    })

    return NextResponse.json({
      success: true,
      message: result.message,
      effects: result.effects,
      emotionalTone: result.effects.length > 0 ?
        (result.effects.some(e => e.change > 0) ? 'positive' : 'negative') : 'neutral'
    })

  } catch (error) {
    console.error('Ошибка обработки сообщения чата:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - получить историю сообщений с эффектами
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { characterId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Проверяем доступ к персонажу
    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        userId: session.user.id
      }
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Character not found or access denied' },
        { status: 404 }
      )
    }

    // Получаем историю сообщений
    const messages = await prisma.chatMessage.findMany({
      where: {
        characterId,
        OR: [
          { senderId: session.user.id },
          { characterId }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    return NextResponse.json({
      success: true,
      messages: messages.reverse(), // Возвращаем в хронологическом порядке
      total: messages.length
    })

  } catch (error) {
    console.error('Ошибка получения истории чата:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
