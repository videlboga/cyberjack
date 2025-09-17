import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/story/choices/[id] - Получить выбор
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // Простая валидация без Zod
    const updateData: any = {}

    if (body.text !== undefined) updateData.text = body.text
    if (body.description !== undefined) updateData.description = body.description
    if (body.nextScreenId !== undefined) updateData.nextScreenId = body.nextScreenId
    if (body.consequences !== undefined) updateData.consequences = body.consequences
    if (body.showConditions !== undefined) updateData.showConditions = body.showConditions

    const choice = await prisma.choice.update({
      where: { id },
      data: updateData,
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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