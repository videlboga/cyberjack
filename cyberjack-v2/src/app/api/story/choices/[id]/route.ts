import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для обновления выбора
const updateChoiceSchema = z.object({
  text: z.string().min(1, 'Текст выбора обязателен'),
  description: z.string().optional(),
  nextScreenId: z.string().optional(),
  consequences: z.record(z.any()).default({}),
  showConditions: z.record(z.any()).default({})
})

// GET /api/story/choices/[id] - Получить выбор
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const choice = await prisma.choice.findUnique({
      where: { id },
      include: {
        screen: {
          include: {
            scene: true
          }
        },
        nextScreen: true
      }
    })

    if (!choice) {
      return NextResponse.json(
        { error: 'Выбор не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json(choice)
  } catch (error) {
    console.error('Ошибка при получении выбора:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении выбора' },
      { status: 500 }
    )
  }
}

// PUT /api/story/choices/[id] - Обновить выбор
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateChoiceSchema.parse(body)

    const choice = await prisma.choice.update({
      where: { id },
      data: validatedData,
      include: {
        screen: {
          include: {
            scene: true
          }
        },
        nextScreen: true
      }
    })

    return NextResponse.json(choice)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Ошибка при обновлении выбора:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении выбора' },
      { status: 500 }
    )
  }
}

// DELETE /api/story/choices/[id] - Удалить выбор
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.choice.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка при удалении выбора:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении выбора' },
      { status: 500 }
    )
  }
}