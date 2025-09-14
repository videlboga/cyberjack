import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания выбора
const createChoiceSchema = z.object({
  screenId: z.string().min(1, 'ID экрана обязателен'),
  text: z.string().min(1, 'Текст выбора обязателен'),
  description: z.string().optional(),
  consequences: z.record(z.string(), z.any()).default({}),
  showConditions: z.record(z.string(), z.any()).default({}),
})

// Схема валидации для обновления выбора
const updateChoiceSchema = createChoiceSchema.partial()

// GET /api/story/choices - Получить все выборы
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const screenId = searchParams.get('screenId')

    const where: any = {}

    if (screenId) {
      where.screenId = screenId
    }

    const choices = await prisma.choice.findMany({
      where,
      include: {
        screen: {
          include: {
            scene: true
          }
        }
      },
      orderBy: [
        { screenId: 'asc' },
        { text: 'asc' }
      ]
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

// POST /api/story/choices - Создать новый выбор
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createChoiceSchema.parse(body)

    const choice = await prisma.choice.create({
      data: validatedData,
      include: {
        screen: {
          include: {
            scene: true
          }
        }
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
