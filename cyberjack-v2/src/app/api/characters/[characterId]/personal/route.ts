import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Получаем копию персонажа пользователя
    const characterCopy = await prisma.characterCopy.findFirst({
      where: {
        characterId,
        userId
      },
      include: {
        character: {
          include: {
            anatomy: {
              include: {
                definition: true
              }
            },
            poses: {
              include: {
                definition: true
              }
            }
          }
        },
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!characterCopy) {
      return NextResponse.json(
        { error: 'Character copy not found' },
        { status: 404 }
      )
    }

    // Формируем ответ с персональными характеристиками
    const response = {
      id: characterCopy.character.id,
      name: characterCopy.character.name,
      description: characterCopy.character.description,
      age: characterCopy.character.age,
      avatar: characterCopy.character.avatar,
      price: characterCopy.character.price,
      isActive: characterCopy.character.isActive,
      characteristics: characterCopy.characteristics,
      anatomy: characterCopy.character.anatomy,
      poses: characterCopy.character.poses,
      copyId: characterCopy.id,
      settings: characterCopy.settings
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching personal character:', error)
    return NextResponse.json(
      { error: 'Failed to fetch personal character' },
      { status: 500 }
    )
  }
}
