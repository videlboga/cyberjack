import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для обновления сущности станции
const updateStationEntitySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  description: z.string().optional(),
  defaultSceneId: z.string().optional(),
  customSceneId: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/story/entities/[id] - Получить сущность станции по ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const entity = await prisma.stationEntity.findUnique({
      where: { id: params.id }
    })

    if (!entity) {
      return NextResponse.json(
        { error: 'Сущность станции не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(entity)
  } catch (error) {
    console.error('Ошибка при получении сущности станции:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сущности станции' },
      { status: 500 }
    )
  }
}

// PUT /api/story/entities/[id] - Обновить сущность станции
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validatedData = updateStationEntitySchema.parse(body)

    const entity = await prisma.stationEntity.update({
      where: { id: params.id },
      data: validatedData
    })

    return NextResponse.json(entity)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Сущность станции не найдена' },
        { status: 404 }
      )
    }

    console.error('Ошибка при обновлении сущности станции:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении сущности станции' },
      { status: 500 }
    )
  }
}

// DELETE /api/story/entities/[id] - Удалить сущность станции
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.stationEntity.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Сущность станции не найдена' },
        { status: 404 }
      )
    }

    console.error('Ошибка при удалении сущности станции:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении сущности станции' },
      { status: 500 }
    )
  }
}
