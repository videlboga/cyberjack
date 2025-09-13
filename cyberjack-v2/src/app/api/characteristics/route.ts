import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET() {
  try {
    const characteristics = await prisma.characteristicDefinition.findMany({
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(characteristics)
  } catch (error) {
    console.error('Error fetching characteristics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch characteristics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, description, minValue, maxValue, isActive = true } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      )
    }

    const characteristic = await prisma.characteristicDefinition.create({
      data: {
        name,
        category,
        description,
        minValue: minValue || 0,
        maxValue: maxValue || 100,
        isActive
      }
    })

    return NextResponse.json(characteristic, { status: 201 })
  } catch (error) {
    console.error('Error creating characteristic:', error)
    return NextResponse.json(
      { error: 'Failed to create characteristic' },
      { status: 500 }
    )
  }
}
