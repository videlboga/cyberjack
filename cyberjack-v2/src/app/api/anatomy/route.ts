// app/api/anatomy/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const anatomy = await prisma.anatomyDefinition.findMany({
      where: {
        isActive: true,
        ...(category && { category })
      },
      include: {
        anatomy: true,
        activeZones: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(anatomy)
  } catch (error) {
    console.error('Error fetching anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch anatomy' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, description } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const anatomy = await prisma.anatomyDefinition.create({
      data: {
        name,
        category,
        description
      }
    })

    return NextResponse.json(anatomy, { status: 201 })
  } catch (error) {
    console.error('Error creating anatomy:', error)
    return NextResponse.json(
      { error: 'Failed to create anatomy' },
      { status: 500 }
    )
  }
}
