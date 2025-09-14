// app/api/anatomy/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const anatomy = await prisma.anatomyDefinition.findUnique({
      where: { id: params.id },
      include: {
        anatomy: true,
        activeZones: true
      }
    })

    if (!anatomy) {
      return NextResponse.json(
        { error: 'Anatomy not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(anatomy)
  } catch (error) {
    console.error('Error fetching anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch anatomy' },
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
    const { name, category, description, isActive } = body

    const anatomy = await prisma.anatomyDefinition.update({
      where: { id: params.id },
      data: {
        name,
        category,
        description,
        isActive
      }
    })

    return NextResponse.json(anatomy)
  } catch (error) {
    console.error('Error updating anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to update anatomy' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.anatomyDefinition.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to delete anatomy' },
      { status: 500 }
    )
  }
}
