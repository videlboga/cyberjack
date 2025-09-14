import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания выбора
const createChoiceSchema = z.object({
  text: z.string().min(1, 'Текст выбора обязателен'),
  description: z.string().optional(),
  nextScreenId: z.string().optional(),
  consequences: z.array(z.any()).default([]),
  showConditions: z.array(z.any()).default([])
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Ошибка при создании выбора:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании выбора' },
      { status: 500 }
    )
  }
}
