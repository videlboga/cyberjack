// app/api/characters/[characterId]/poses/[poseId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string, poseId: string }> }
) {
  try {
    const { characterId: id, poseId } = await params
    const body = await request.json()
    const { isActive, customSettings } = body

    const characterPose = await prisma.characterPose.update({
      where: {
        id: poseId,
        characterId: id
      },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(customSettings && { customSettings })
      },
      include: {
        definition: true
      }
    })

    return NextResponse.json(characterPose)
  } catch (error) {
    console.error('Error updating character pose:', error)
    return NextResponse.json(
      { error: 'Failed to update character pose' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string, poseId: string }> }
) {
  try {
    const { characterId: id, poseId } = await params
    await prisma.characterPose.delete({
      where: {
        id: poseId,
        characterId: id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting character pose:', error)
    return NextResponse.json(
      { error: 'Failed to delete character pose' },
      { status: 500 }
    )
  }
}
