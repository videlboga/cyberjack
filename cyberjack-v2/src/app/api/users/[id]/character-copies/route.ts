import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const characterCopies = await prisma.characterCopy.findMany({
      where: { userId: id },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            description: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(characterCopies)
  } catch (error) {
    console.error('Error fetching character copies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character copies' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const characterCopy = await prisma.characterCopy.upsert({
      where: {
        userId_characterId: {
          userId: id,
          characterId: data.characterId
        }
      },
      update: {
        settings: data.settings || {}
      },
      create: {
        userId: id,
        characterId: data.characterId,
        settings: data.settings || {}
      },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            description: true,
            avatar: true
          }
        }
      }
    })

    return NextResponse.json(characterCopy)
  } catch (error) {
    console.error('Error adding character copy:', error)
    return NextResponse.json(
      { error: 'Failed to add character copy' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const characterId = searchParams.get('characterId')

    if (!characterId) {
      return NextResponse.json(
        { error: 'Character ID is required' },
        { status: 400 }
      )
    }

    await prisma.characterCopy.delete({
      where: {
        userId_characterId: {
          userId: id,
          characterId: characterId
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing character copy:', error)
    return NextResponse.json(
      { error: 'Failed to remove character copy' },
      { status: 500 }
    )
  }
}
