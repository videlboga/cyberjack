// app/api/characteristics/definitions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const characteristic = await prisma.characteristicDefinition.findUnique({
      where: { id }
    })

    if (!characteristic) {
      return NextResponse.json(
        { error: 'Characteristic definition not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(characteristic)
  } catch (error) {
    console.error('Error fetching characteristic definition:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch characteristic definition' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Каскадно удаляем все связанные данные
    await prisma.$transaction(async (tx) => {
      // Удаляем знания пользователей об этой характеристике
      await tx.characterKnowledge.deleteMany({
        where: {
          characteristicDefId: id
        }
      })

      // Удаляем характеристики персонажей
      await tx.characteristic.deleteMany({
        where: {
          characteristicDefId: id
        }
      })

      // Удаляем само определение характеристики
      await tx.characteristicDefinition.delete({
        where: { id }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting characteristic definition:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete characteristic definition' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, category, description, minValue, maxValue, isActive } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      )
    }

    const characteristic = await prisma.characteristicDefinition.update({
      where: { id },
      data: {
        name,
        category,
        description,
        minValue: minValue || 0,
        maxValue: maxValue || 100,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    return NextResponse.json(characteristic)
  } catch (error) {
    console.error('Error updating characteristic definition:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update characteristic definition' },
      { status: 500 }
    )
  }
}