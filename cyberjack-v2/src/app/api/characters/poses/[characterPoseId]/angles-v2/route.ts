import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/characters/poses/[characterPoseId]/angles-v2 - получить ракурсы позы персонажа (новая версия)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterPoseId: string }> }
) {
  try {
    const { characterPoseId } = await params

    const angles = await prisma.characterPoseAngle.findMany({
      where: {
        characterPoseId
      },
      include: {
        zones: {
          include: {
            anatomy: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    })

    return NextResponse.json(angles)
  } catch (error) {
    console.error('Error fetching character pose angles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character pose angles' },
      { status: 500 }
    )
  }
}

// POST /api/characters/poses/[characterPoseId]/angles-v2 - создать новый ракурс для позы персонажа
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterPoseId: string }> }
) {
  try {
    const { characterPoseId } = await params
    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Проверяем, что поза персонажа существует
    const characterPose = await prisma.characterPose.findUnique({
      where: { id: characterPoseId }
    })

    if (!characterPose) {
      return NextResponse.json(
        { error: 'Character pose not found' },
        { status: 404 }
      )
    }

    // Создаем новый ракурс
    const characterAngle = await prisma.characterPoseAngle.create({
      data: {
        characterPoseId,
        name,
        description: description || '',
        media: {
          files: []
        }
      },
      include: {
        zones: true
      }
    })

    return NextResponse.json(characterAngle, { status: 201 })
  } catch (error) {
    console.error('Error creating character pose angle:', error)
    return NextResponse.json(
      { error: 'Failed to create character pose angle' },
      { status: 500 }
    )
  }
}
