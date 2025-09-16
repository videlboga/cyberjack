import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// PATCH /api/character-poses/[characterPoseId]/angles-v2/[angleId] - обновить ракурс
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ characterPoseId: string; angleId: string }> }
) {
  try {
    const { characterPoseId, angleId } = await params
    const updates = await request.json()

    // Проверяем, что ракурс существует и принадлежит указанной позе
    const existingAngle = await prisma.characterPoseAngle.findFirst({
      where: {
        id: angleId,
        characterPoseId
      }
    })

    if (!existingAngle) {
      return NextResponse.json(
        { error: 'Character pose angle not found' },
        { status: 404 }
      )
    }

    // Обновляем ракурс
    const updatedAngle = await prisma.characterPoseAngle.update({
      where: { id: angleId },
      data: {
        name: updates.name,
        description: updates.description,
        media: updates.media
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
      }
    })

    return NextResponse.json(updatedAngle)
  } catch (error) {
    console.error('Error updating character pose angle:', error)
    return NextResponse.json(
      { error: 'Failed to update character pose angle' },
      { status: 500 }
    )
  }
}

// DELETE /api/character-poses/[characterPoseId]/angles-v2/[angleId] - удалить ракурс
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterPoseId: string; angleId: string }> }
) {
  try {
    const { characterPoseId, angleId } = await params

    // Проверяем, что ракурс существует и принадлежит указанной позе
    const existingAngle = await prisma.characterPoseAngle.findFirst({
      where: {
        id: angleId,
        characterPoseId
      }
    })

    if (!existingAngle) {
      return NextResponse.json(
        { error: 'Character pose angle not found' },
        { status: 404 }
      )
    }

    // Удаляем ракурс (каскадное удаление активных зон произойдет автоматически)
    await prisma.characterPoseAngle.delete({
      where: { id: angleId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting character pose angle:', error)
    return NextResponse.json(
      { error: 'Failed to delete character pose angle' },
      { status: 500 }
    )
  }
}
