import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userEquipment = await prisma.userEquipment.findMany({
      where: { userId: id },
      include: {
        equipment: {
          include: {
            relatedPose: true
          }
        }
      },
      orderBy: {
        acquiredAt: 'desc'
      }
    })

    return NextResponse.json(userEquipment)
  } catch (error) {
    console.error('Error fetching user equipment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user equipment' },
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

    const userEquipment = await prisma.userEquipment.upsert({
      where: {
        userId_equipmentId: {
          userId: id,
          equipmentId: data.equipmentId
        }
      },
      update: {
        quantity: {
          increment: data.quantity || 1
        },
        settings: data.settings || {}
      },
      create: {
        userId: id,
        equipmentId: data.equipmentId,
        quantity: data.quantity || 1,
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
    console.error('Error adding equipment to user:', error)
    return NextResponse.json(
      { error: 'Failed to add equipment to user' },
      { status: 500 }
    )
  }
}
