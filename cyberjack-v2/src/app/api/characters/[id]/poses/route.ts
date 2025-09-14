// app/api/characters/[id]/poses/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const characterPoses = await prisma.characterPose.findMany({
      where: { characterId: id },
      include: {
        definition: {
          include: {
            angles: {
              select: {
                id: true,
                name: true,
                angle: true
              }
            }
          }
        },
        angles: {
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
          }
        }
      }
    })

    return NextResponse.json(characterPoses)
  } catch (error) {
    console.error('Error fetching character poses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character poses' },
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
    const body = await request.json()
    const { poseDefId } = body

    if (!poseDefId) {
      return NextResponse.json(
        { error: 'poseDefId is required' },
        { status: 400 }
      )
    }

    // Проверяем, что поза уже не назначена персонажу
    const existingPose = await prisma.characterPose.findFirst({
      where: {
        characterId: id,
        poseDefId
      }
    })

    if (existingPose) {
      return NextResponse.json(
        { error: 'Pose already assigned to character' },
        { status: 400 }
      )
    }

    const characterPose = await prisma.characterPose.create({
      data: {
        characterId: id,
        poseDefId,
        isActive: true,
        customSettings: {}
      },
      include: {
        definition: {
          include: {
            angles: {
              select: {
                id: true,
                name: true,
                angle: true
              }
            }
          }
        },
        angles: {
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
          }
        }
      }
    })

    return NextResponse.json(characterPose, { status: 201 })
  } catch (error) {
    console.error('Error creating character pose:', error)
    return NextResponse.json(
      { error: 'Failed to create character pose' },
      { status: 500 }
    )
  }
}
