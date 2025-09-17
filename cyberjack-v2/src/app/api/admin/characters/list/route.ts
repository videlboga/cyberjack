import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/admin/characters/list - Получить список персонажей для выпадающих списков
export async function GET(request: NextRequest) {
  try {
    const characters = await prisma.character.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(characters)
  } catch (error) {
    console.error('Ошибка при получении списка персонажей:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении списка персонажей' },
      { status: 500 }
    )
  }
}
