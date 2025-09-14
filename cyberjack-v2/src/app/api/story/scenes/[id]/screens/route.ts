import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания экрана
const createScreenSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  content: z.record(z.any()).default({}),
  isFinal: z.boolean().default(false),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).default({ x: 100, y: 100 }),
  accessConditions: z.record(z.any()).default({})
})

// GET /api/story/scenes/[id]/screens - Получить экраны сцены
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const screens = await prisma.screen.findMany({
      where: { sceneId: id },
      include: {
        choices: {
          include: {
            nextScreen: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(screens)
  } catch (error) {
    console.error('Ошибка при получении экранов сцены:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении экранов сцены' },
      { status: 500 }
    )
  }
}

// POST /api/story/scenes/[id]/screens - Создать экран
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const validatedData = createScreenSchema.parse(body)

    const screen = await prisma.screen.create({
      data: {
        ...validatedData,
        sceneId: id
      },
      include: {
        choices: {
          include: {
            nextScreen: true
          }
        }
      }
    })

    // Если это первый экран сцены, делаем его начальным
    const existingScreens = await prisma.screen.count({
      where: { sceneId: id }
    })

    if (existingScreens === 1) {
      await prisma.scene.update({
        where: { id },
        data: { startScreenId: screen.id }
      })
    }

    return NextResponse.json(screen, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Ошибка при создании экрана:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании экрана' },
      { status: 500 }
    )
  }
}
