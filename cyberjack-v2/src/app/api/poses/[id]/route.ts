// app/api/poses/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pose = await prisma.poseDefinition.findUnique({
      where: { id: params.id },
      include: {
        angles: {
          include: {
            zones: {
              include: {
                anatomy: true
              }
            }
          }
        }
      }
    })

    if (!pose) {
      return NextResponse.json(
        { error: 'Pose not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(pose)
  } catch (error) {
    console.error('Error fetching pose:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pose' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, category, description, effects, requirements, isActive } = body

    const pose = await prisma.poseDefinition.update({
      where: { id: params.id },
      data: {
        name,
        category,
        description,
        effects,
        requirements,
        isActive
      }
    })

    return NextResponse.json(pose)
  } catch (error) {
    console.error('Error updating pose:', error)
    return NextResponse.json(
      { error: 'Failed to update pose' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.poseDefinition.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pose:', error)
    return NextResponse.json(
      { error: 'Failed to delete pose' },
      { status: 500 }
    )
  }
}
