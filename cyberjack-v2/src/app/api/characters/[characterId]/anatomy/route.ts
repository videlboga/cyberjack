// app/api/characters/[characterId]/anatomy/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId: id } = await params
    const characterAnatomy = await prisma.characterAnatomy.findMany({
      where: { characterId: id },
      include: {
        definition: true
      }
    })

    return NextResponse.json(characterAnatomy)
  } catch (error) {
    console.error('Error fetching character anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character anatomy' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId: id } = await params
    const body = await request.json()
    const { anatomyDefId } = body

    if (!anatomyDefId) {
      return NextResponse.json(
        { error: 'anatomyDefId is required' },
        { status: 400 }
      )
    }

    // Проверяем, что анатомическая часть уже не назначена персонажу
    const existingAnatomy = await prisma.characterAnatomy.findFirst({
      where: {
        characterId: id,
        anatomyDefId
      }
    })

    if (existingAnatomy) {
      return NextResponse.json(
        { error: 'Anatomy part already assigned to character' },
        { status: 400 }
      )
    }

    const characterAnatomy = await prisma.characterAnatomy.create({
      data: {
        characterId: id,
        anatomyDefId,
        hasPart: true,
        sensitivity: 50 // Значение по умолчанию
      },
      include: {
        definition: true
      }
    })

    return NextResponse.json(characterAnatomy, { status: 201 })
  } catch (error) {
    console.error('Error creating character anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to create character anatomy' },
      { status: 500 }
    )
  }
}
