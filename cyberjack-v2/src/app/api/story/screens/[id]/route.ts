import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // Простая валидация без Zod
    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.content !== undefined) updateData.content = body.content
    if (body.isFinal !== undefined) updateData.isFinal = body.isFinal
    if (body.position !== undefined) updateData.position = body.position
    if (body.accessConditions !== undefined) updateData.accessConditions = body.accessConditions

    const screen = await prisma.screen.update({
      where: { id },
      data: updateData,
      include: {
        choices: true,
        scene: true
      }
    })

    return NextResponse.json(screen)
  } catch (error) {

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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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