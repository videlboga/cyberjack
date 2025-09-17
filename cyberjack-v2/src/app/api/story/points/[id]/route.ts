import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для обновления сюжетной точки
const updateStoryPointSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['NUMERIC', 'BOOLEAN', 'STRING']).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  defaultValue: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/story/points/[id] - Получить сюжетную точку по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const storyPoint = await prisma.storyPoint.findUnique({
      where: { id: id }
    })

    if (!storyPoint) {
      return NextResponse.json(
        { error: 'Сюжетная точка не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(storyPoint)
  } catch (error) {
    console.error('Ошибка при получении сюжетной точки:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сюжетной точки' },
      { status: 500 }
    )
  }
}

// PUT /api/story/points/[id] - Обновить сюжетную точку
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateStoryPointSchema.parse(body)

    const storyPoint = await prisma.storyPoint.update({
      where: { id: id },
      data: validatedData
    })

    return NextResponse.json(storyPoint)
  } catch (error) {
    // Обработка ошибок валидации

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Сюжетная точка не найдена' },
        { status: 404 }
      )
    }

    console.error('Ошибка при обновлении сюжетной точки:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении сюжетной точки' },
      { status: 500 }
    )
  }
}

// DELETE /api/story/points/[id] - Удалить сюжетную точку
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.storyPoint.delete({
      where: { id: id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Сюжетная точка не найдена' },
        { status: 404 }
      )
    }

    console.error('Ошибка при удалении сюжетной точки:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении сюжетной точки' },
      { status: 500 }
    )
  }
}
