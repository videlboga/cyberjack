import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для создания станции
const createStationSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  type: z.string().min(1, 'Тип обязателен'),
  description: z.string().optional(),
  defaultSceneId: z.string().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).default({})
})

// Схема валидации для обновления станции
const updateStationSchema = createStationSchema.partial()

// GET /api/story/entities - Получить все станции
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    const where: any = {}

    if (type) {
      where.type = type
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const stations = await prisma.stationEntity.findMany({
      where,
      include: {
        defaultScene: {
          include: {
            screens: {
              include: {
                choices: true
              }
            }
          }
        },
        scenes: {
          where: { isActive: true },
          include: {
            screens: {
              include: {
                choices: true
              }
            }
          }
        }
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(stations)
  } catch (error) {
    console.error('Ошибка при получении станций:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении станций' },
      { status: 500 }
    )
  }
}

// POST /api/story/entities - Создать новую станцию
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createStationSchema.parse(body)

    const station = await prisma.stationEntity.create({
      data: validatedData,
      include: {
        defaultScene: {
          include: {
            screens: {
              include: {
                choices: true
              }
            }
          }
        },
        scenes: {
          include: {
            screens: {
              include: {
                choices: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(station, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Ошибка при создании станции:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании станции' },
      { status: 500 }
    )
  }
}