import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания сцены
const createSceneSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  stationId: z.string().optional(),
  triggerConditions: z.record(z.string(), z.any()).default({}),
  probability: z.number().min(0).max(100).default(100),
})

// Схема валидации для обновления сцены
const updateSceneSchema = createSceneSchema.partial()

// GET /api/story/scenes - Получить все сцены
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stationId = searchParams.get('stationId')

    const where: any = {}

    if (stationId) {
      where.stationId = stationId
    }

    const scenes = await prisma.scene.findMany({
      where,
      include: {
        screens: {
          include: {
            choices: true
          }
        }
      },
      orderBy: [
        { name: 'asc' }
      ]
    })

    return NextResponse.json(scenes)
  } catch (error) {
    console.error('Ошибка при получении сцен:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сцен' },
      { status: 500 }
    )
  }
}

// POST /api/story/scenes - Создать новую сцену
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createSceneSchema.parse(body)

    const scene = await prisma.scene.create({
      data: validatedData,
      include: {
        screens: {
          include: {
            choices: true
          }
        }
      }
    })

    return NextResponse.json(scene, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Ошибка при создании сцены:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании сцены' },
      { status: 500 }
    )
  }
}
