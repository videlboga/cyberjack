// app/api/chat/[characterId]/clear-system/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function DELETE(
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

    // Удаляем системные сообщения
    const deletedMessages = await prisma.chatMessage.deleteMany({
      where: {
        characterId,
        OR: [
          { content: { contains: 'К тебе было применено действие' } },
          { content: { contains: 'Это вызвало:' } },
          { content: { contains: 'Как ты реагируешь на это действие?' } }
        ]
      }
    })

    return NextResponse.json({
      success: true,
      deletedCount: deletedMessages.count,
      message: `Удалено ${deletedMessages.count} системных сообщений`
    })
  } catch (error) {
    console.error('Ошибка удаления системных сообщений:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
