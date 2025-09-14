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
            zones: true
          }
        },
        poses: {
          include: {
            character: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
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
    const data = await request.json()

    const pose = await prisma.poseDefinition.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        effects: data.effects || {},
        requirements: data.requirements || {},
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    })

    return NextResponse.json(pose)
  } catch (error) {
    console.error('Error creating pose:', error)
    return NextResponse.json(
      { error: 'Failed to create pose' },
      { status: 500 }
    )
  }
}