import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания сюжетной точки
const createStoryPointSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  type: z.enum(['NUMERIC', 'BOOLEAN', 'STRING']),
  category: z.string().optional(),
  description: z.string().optional(),
  defaultValue: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  tags: z.array(z.string()).default([]),
})

// Схема валидации для обновления сюжетной точки
const updateStoryPointSchema = createStoryPointSchema.partial()

// GET /api/story/points - Получить все сюжетные точки
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    const where: any = {}

    if (category) {
      where.category = category
    }

    if (type) {
      where.type = type
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const storyPoints = await prisma.storyPoint.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(storyPoints)
  } catch (error) {
    console.error('Ошибка при получении сюжетных точек:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сюжетных точек' },
      { status: 500 }
    )
  }
}

// POST /api/story/points - Создать новую сюжетную точку
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createStoryPointSchema.parse(body)

    const storyPoint = await prisma.storyPoint.create({
      data: validatedData
    })

    return NextResponse.json(storyPoint, { status: 201 })
  } catch (error) {
    // Обработка ошибок валидации

    console.error('Ошибка при создании сюжетной точки:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании сюжетной точки' },
      { status: 500 }
    )
  }
}
