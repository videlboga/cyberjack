import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для обновления экрана
const updateScreenSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  content: z.record(z.any()).default({}),
  isFinal: z.boolean().default(false),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).optional(),
  accessConditions: z.record(z.any()).default({})
})

// GET /api/story/screens/[id] - Получить экран
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const screen = await prisma.screen.findUnique({
      where: { id },
      include: {
        choices: true,
        scene: true
      }
    })

    if (!screen) {
      return NextResponse.json(
        { error: 'Экран не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json(screen)
  } catch (error) {
    console.error('Ошибка при получении экрана:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении экрана' },
      { status: 500 }
    )
  }
}

// PUT /api/story/screens/[id] - Обновить экран
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateScreenSchema.parse(body)

    const screen = await prisma.screen.update({
      where: { id },
      data: validatedData,
      include: {
        choices: true,
        scene: true
      }
    })

    return NextResponse.json(screen)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Ошибка при обновлении экрана:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении экрана' },
      { status: 500 }
    )
  }
}

// DELETE /api/story/screens/[id] - Удалить экран
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.screen.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка при удалении экрана:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении экрана' },
      { status: 500 }
    )
  }
}