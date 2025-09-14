// app/api/poses/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const poses = await prisma.poseDefinition.findMany({
      where: {
        isActive: true,
        ...(category && { category })
      },
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
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(poses)
  } catch (error) {
    console.error('Error fetching poses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch poses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, description, effects, requirements } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      )
    }

    const pose = await prisma.poseDefinition.create({
      data: {
        name,
        category,
        description,
        effects: effects || {},
        requirements: requirements || {}
      }
    })

    return NextResponse.json(pose, { status: 201 })
  } catch (error) {
    console.error('Error creating pose:', error)
    return NextResponse.json(
      { error: 'Failed to create pose' },
      { status: 500 }
    )
  }
}
