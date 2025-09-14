import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: params.id },
      include: {
        relatedPose: true,
        userEquipment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json()

    const equipment = await prisma.equipment.update({
      where: { id: params.id },
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        rarity: data.rarity,
        cost: data.cost,
        relatedPoseId: data.relatedPoseId,
        requirements: data.requirements,
        isActive: data.isActive
      },
      include: {
        relatedPose: true
      }
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error updating equipment:', error)
    return NextResponse.json(
      { error: 'Failed to update equipment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.equipment.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return NextResponse.json(
      { error: 'Failed to delete equipment' },
      { status: 500 }
    )
  }
}
