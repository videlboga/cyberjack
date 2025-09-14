import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    const users = await prisma.user.findMany({
      where: {
        ...(role && { role: role as any })
      },
      include: {
        characterCopies: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                description: true,
                avatar: true
              }
            }
          }
        },
        equipment: {
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                category: true,
                rarity: true,
                cost: true
              }
            }
          }
        },
        characterKnowledge: {
          include: {
            character: {
              select: {
                id: true,
                name: true
              }
            },
            characteristic: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role || 'USER',
        modifiers: data.modifiers || {},
        credits: data.credits || 1000
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
