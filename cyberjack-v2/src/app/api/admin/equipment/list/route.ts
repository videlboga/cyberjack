import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/admin/equipment/list - Получить список оборудования для выпадающих списков
export async function GET(request: NextRequest) {
  try {
    const equipment = await prisma.equipment.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        cost: true,
        category: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Ошибка при получении списка оборудования:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении списка оборудования' },
      { status: 500 }
    )
  }
}
