import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для обновления сущности станции
const updateStationEntitySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  description: z.string().optional(),
  defaultSceneId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  // Поля, которые могут прийти с фронтенда, но не сохраняются в БД
  id: z.string().optional(),
  defaultScene: z.any().optional(),
  scenes: z.any().optional(),
}).passthrough() // Разрешаем дополнительные поля

// GET /api/story/entities/[id] - Получить сущность станции по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entity = await prisma.stationEntity.findUnique({
      where: { id: id }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log('PUT /api/story/entities/[id] - Обновление станции:', { id, body })

    const validatedData = updateStationEntitySchema.parse(body)
    console.log('Валидированные данные:', validatedData)

    // Фильтруем только поля, которые есть в модели StationEntity
    const updateData = {
      name: validatedData.name,
      type: validatedData.type,
      description: validatedData.description,
      defaultSceneId: validatedData.defaultSceneId,
      metadata: validatedData.metadata,
      isActive: validatedData.isActive,
    }

    // Убираем undefined значения
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    )

    console.log('Данные для обновления в БД:', filteredData)

    const entity = await prisma.stationEntity.update({
      where: { id: id },
      data: filteredData
    })

    console.log('Станция успешно обновлена:', entity)
    return NextResponse.json(entity)
  } catch (error) {
    // Обработка ошибок валидации

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.stationEntity.delete({
      where: { id: id }
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
