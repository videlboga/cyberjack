import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, equipmentId: string }> }
) {
  try {
    const { id, equipmentId } = await params
    const data = await request.json()

    const userEquipment = await prisma.userEquipment.update({
      where: {
        userId_equipmentId: {
          userId: id,
          equipmentId
        }
      },
      data: {
        quantity: data.quantity,
        settings: data.settings || {}
      },
      include: {
        equipment: {
          include: {
            relatedPose: true
          }
        }
      }
    })

    return NextResponse.json(userEquipment)
  } catch (error) {
    console.error('Error updating user equipment:', error)
    return NextResponse.json(
      { error: 'Failed to update user equipment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, equipmentId: string }> }
) {
  try {
    const { id, equipmentId } = await params
    await prisma.userEquipment.delete({
      where: {
        userId_equipmentId: {
          userId: id,
          equipmentId
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing user equipment:', error)
    return NextResponse.json(
      { error: 'Failed to remove user equipment' },
      { status: 500 }
    )
  }
}
