import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/story/screens/[id]/related-choices - Получить все выборы, которые ведут к этому экрану
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Находим все выборы, которые ведут к этому экрану
    const relatedChoices = await prisma.choice.findMany({
      where: {
        nextScreenId: id
      },
      include: {
        screen: {
          include: {
            scene: true
          }
        }
      }
    })

    return NextResponse.json(relatedChoices)
  } catch (error) {
    console.error('Ошибка при получении связанных выборов:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении связанных выборов' },
      { status: 500 }
    )
  }
}
