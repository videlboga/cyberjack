import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания экрана
const createScreenSchema = z.object({
  sceneId: z.string().min(1, 'ID сцены обязателен'),
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  content: z.record(z.string(), z.any()).default({}),
  accessConditions: z.record(z.string(), z.any()).default({}),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).optional(),
  isFinal: z.boolean().default(false)
})

// Схема валидации для обновления экрана
const updateScreenSchema = createScreenSchema.partial()

// GET /api/story/screens - Получить все экраны
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sceneId = searchParams.get('sceneId')

    const where: any = {}

    if (sceneId) {
      where.sceneId = sceneId
    }

    const screens = await prisma.screen.findMany({
      where,
      include: {
        scene: true,
        choices: true
      },
      orderBy: [
        { sceneId: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(screens)
  } catch (error) {
    console.error('Ошибка при получении экранов:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении экранов' },
      { status: 500 }
    )
  }
}

// POST /api/story/screens - Создать новый экран
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createScreenSchema.parse(body)

    const screen = await prisma.screen.create({
      data: validatedData,
      include: {
        scene: true,
        choices: true
      }
    })

    return NextResponse.json(screen, { status: 201 })
  } catch (error) {
    console.error('Ошибка при создании экрана:', error)
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
    console.error('Детали ошибки:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      body: body
    })
    return NextResponse.json(
      { error: 'Ошибка при создании экрана', details: errorMessage },
      { status: 500 }
    )
  }
}
