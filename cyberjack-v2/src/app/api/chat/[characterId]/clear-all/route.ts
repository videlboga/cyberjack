// app/api/chat/[characterId]/clear-all/route.ts

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

    // Удаляем ВСЕ сообщения чата
    const deletedMessages = await prisma.chatMessage.deleteMany({
      where: {
        characterId
      }
    })

    return NextResponse.json({
      success: true,
      deletedCount: deletedMessages.count,
      message: `Удалено ${deletedMessages.count} сообщений из истории чата`
    })
  } catch (error) {
    console.error('Ошибка удаления истории чата:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

