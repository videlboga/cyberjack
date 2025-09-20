import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// PATCH /api/character-poses/angles/[characterAngleId]/zones/[zoneId] - обновить активную зону
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ characterAngleId: string; zoneId: string }> }
) {
  try {
    const { characterAngleId, zoneId } = await params
    const updates = await request.json()

    // Валидация данных
    const allowedFields = ['name', 'anatomyDefId', 'mediaFileId', 'x', 'y', 'width', 'height']
    const filteredUpdates: any = {}

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (['x', 'y', 'width', 'height'].includes(field)) {
          filteredUpdates[field] = Number(updates[field])
        } else {
          filteredUpdates[field] = updates[field]
        }
      }
    }

    const updatedZone = await prisma.characterActiveZone.update({
      where: {
        id: zoneId,
        characterAngleId // Дополнительная проверка безопасности
      },
      data: filteredUpdates,
      include: {
        anatomy: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    })

    return NextResponse.json(updatedZone)
  } catch (error) {
    console.error('Error updating character active zone:', error)
    return NextResponse.json(
      { error: 'Failed to update character active zone' },
      { status: 500 }
    )
  }
}

// DELETE /api/character-poses/angles/[characterAngleId]/zones/[zoneId] - удалить активную зону
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterAngleId: string; zoneId: string }> }
) {
  try {
    const { characterAngleId, zoneId } = await params

    await prisma.characterActiveZone.delete({
      where: {
        id: zoneId,
        characterAngleId // Дополнительная проверка безопасности
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting character active zone:', error)
    return NextResponse.json(
      { error: 'Failed to delete character active zone' },
      { status: 500 }
    )
  }
}
