import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const characteristic = await prisma.characteristicDefinition.findUnique({
      where: { id: params.id }
    })

    if (!characteristic) {
      return NextResponse.json(
        { error: 'Characteristic not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(characteristic)
  } catch (error) {
    console.error('Error fetching characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch characteristic' },
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
    const { name, category, description, minValue, maxValue, isActive } = body

    const characteristic = await prisma.characteristicDefinition.update({
      where: { id: params.id },
      data: {
        name,
        category,
        description,
        minValue,
        maxValue,
        isActive
      }
    })

    return NextResponse.json(characteristic)
  } catch (error) {
    console.error('Error updating characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to update characteristic' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.characteristicDefinition.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to delete characteristic' },
      { status: 500 }
    )
  }
}
