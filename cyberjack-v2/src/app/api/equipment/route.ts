import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const rarity = searchParams.get('rarity')

    const equipment = await prisma.equipment.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
        ...(rarity && { rarity: rarity as any })
      },
      include: {
        relatedPose: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const equipment = await prisma.equipment.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        rarity: data.rarity || 'COMMON',
        cost: data.cost || 100,
        relatedPoseId: data.relatedPoseId,
        requirements: data.requirements || {},
        isActive: data.isActive !== undefined ? data.isActive : true
      },
      include: {
        relatedPose: true
      }
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error creating equipment:', error)
    return NextResponse.json(
      { error: 'Failed to create equipment' },
      { status: 500 }
    )
  }
}
