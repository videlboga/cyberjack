import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для обновления сцены
const updateSceneSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  stationId: z.string().optional(),
  triggerConditions: z.record(z.string(), z.any()).optional(),
  probability: z.number().min(0).max(100).optional(),
})

// GET /api/story/scenes/[id] - Получить сцену по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scene = await prisma.scene.findUnique({
      where: { id },
      include: {
        screens: {
          include: {
            choices: true
          }
        }
      }
    })

    if (!scene) {
      return NextResponse.json(
        { error: 'Сцена не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(scene)
  } catch (error) {
    console.error('Ошибка при получении сцены:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сцены' },
      { status: 500 }
    )
  }
}

// PUT /api/story/scenes/[id] - Обновить сцену
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateSceneSchema.parse(body)

    const scene = await prisma.scene.update({
      where: { id },
      data: validatedData,
      include: {
        screens: {
          include: {
            choices: true
          }
        }
      }
    })

    return NextResponse.json(scene)
  } catch (error) {
    // Обработка ошибок валидации

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Сцена не найдена' },
        { status: 404 }
      )
    }

    console.error('Ошибка при обновлении сцены:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении сцены' },
      { status: 500 }
    )
  }
}

// DELETE /api/story/scenes/[id] - Удалить сцену
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.scene.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Сцена не найдена' },
        { status: 404 }
      )
    }

    console.error('Ошибка при удалении сцены:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении сцены' },
      { status: 500 }
    )
  }
}
