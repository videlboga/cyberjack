import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

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
      }
      // Убираем orderBy с createdAt, так как это поле не существует в схеме
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Простая валидация без Zod
    const createData = {
      name: body.name || 'Новый экран',
      description: body.description || '',
      content: body.content || {},
      isFinal: body.isFinal || false,
      position: body.position || { x: 100, y: 100 },
      accessConditions: body.accessConditions || {},
      sceneId: id
    }

    const screen = await prisma.screen.create({
      data: createData,
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

    console.error('Ошибка при создании экрана:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании экрана' },
      { status: 500 }
    )
  }
}
