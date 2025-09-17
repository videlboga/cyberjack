import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания выбора
const createChoiceSchema = z.object({
  text: z.string().min(1, 'Текст выбора обязателен'),
  description: z.string().optional(),
  nextScreenId: z.string().optional(),
  consequences: z.array(z.any()).default([]),
  showConditions: z.array(z.any()).default([]),
  isFinal: z.boolean().optional().default(false)
})

// GET /api/story/screens/[id]/choices - Получить выборы экрана
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const choices = await prisma.choice.findMany({
      where: { screenId: id },
      include: {
        nextScreen: true
      }
    })

    return NextResponse.json(choices)
  } catch (error) {
    console.error('Ошибка при получении выборов:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении выборов' },
      { status: 500 }
    )
  }
}

// POST /api/story/screens/[id]/choices - Создать выбор
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = createChoiceSchema.parse(body)

    // Проверяем, существует ли экран, к которому ссылается выбор
    if (validatedData.nextScreenId) {
      const nextScreen = await prisma.screen.findUnique({
        where: { id: validatedData.nextScreenId }
      })

      if (!nextScreen) {
        return NextResponse.json(
          { error: 'Экран для перехода не найден', details: `Экран с ID ${validatedData.nextScreenId} не существует` },
          { status: 400 }
        )
      }
    }

    const choice = await prisma.choice.create({
      data: {
        ...validatedData,
        screenId: id
      },
      include: {
        nextScreen: true
      }
    })

    return NextResponse.json(choice, { status: 201 })
  } catch (error) {
    console.error('Ошибка при создании выбора:', error)
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
    console.error('Детали ошибки:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Ошибка при создании выбора', details: errorMessage },
      { status: 500 }
    )
  }
}
