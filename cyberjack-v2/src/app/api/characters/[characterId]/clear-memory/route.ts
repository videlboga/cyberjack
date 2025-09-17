// app/api/characters/[characterId]/clear-memory/route.ts

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

    // Удаляем ВСЕ воспоминания персонажа
    const deletedMemories = await prisma.characterMemory.deleteMany({
      where: {
        characterId
      }
    })

    return NextResponse.json({
      success: true,
      deletedCount: deletedMemories.count,
      message: `Удалено ${deletedMemories.count} воспоминаний персонажа`
    })
  } catch (error) {
    console.error('Ошибка удаления памяти персонажа:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

