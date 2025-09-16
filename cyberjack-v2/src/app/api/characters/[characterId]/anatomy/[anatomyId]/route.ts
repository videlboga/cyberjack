// app/api/characters/[characterId]/anatomy/[anatomyId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string, anatomyId: string }> }
) {
  try {
    const { characterId: id, anatomyId } = await params
    const body = await request.json()
    const { hasPart, sensitivity } = body

    const characterAnatomy = await prisma.characterAnatomy.update({
      where: {
        id: anatomyId,
        characterId: id
      },
      data: {
        ...(hasPart !== undefined && { hasPart }),
        ...(sensitivity !== undefined && { sensitivity })
      },
      include: {
        definition: true
      }
    })

    return NextResponse.json(characterAnatomy)
  } catch (error) {
    console.error('Error updating character anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to update character anatomy' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string, anatomyId: string }> }
) {
  try {
    const { characterId: id, anatomyId } = await params
    await prisma.characterAnatomy.delete({
      where: {
        id: anatomyId,
        characterId: id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting character anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to delete character anatomy' },
      { status: 500 }
    )
  }
}
