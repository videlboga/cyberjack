import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

// PUT /api/admin/characters/[characterId]/prompts/[promptId] - Обновление промпта персонажа
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string; promptId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { characterId, promptId } = await params
    const body = await request.json()
    const { templateId, customTemplate, isActive, priority, variables } = body

    // Проверяем существование персонажа
    const character = await prisma.character.findUnique({
      where: { id: characterId }
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Персонаж не найден' },
        { status: 404 }
      )
    }

    // Получаем текущие промпты персонажа
    const currentPrompts = (character.prompts as any[]) || []

    // Находим промпт для обновления
    const promptIndex = currentPrompts.findIndex(p => p.id === promptId)

    if (promptIndex === -1) {
      return NextResponse.json(
        { error: 'Промпт не найден' },
        { status: 404 }
      )
    }

    // Обновляем промпт
    const updatedPrompt = {
      ...currentPrompts[promptIndex],
      templateId: templateId || currentPrompts[promptIndex].templateId,
      customTemplate: customTemplate !== undefined ? customTemplate : currentPrompts[promptIndex].customTemplate,
      isActive: isActive !== undefined ? isActive : currentPrompts[promptIndex].isActive,
      priority: priority !== undefined ? priority : currentPrompts[promptIndex].priority,
      variables: variables !== undefined ? variables : currentPrompts[promptIndex].variables,
      updatedAt: new Date().toISOString()
    }

    // Обновляем массив промптов
    currentPrompts[promptIndex] = updatedPrompt

    // Сохраняем в базу данных
    await prisma.character.update({
      where: { id: characterId },
      data: {
        prompts: currentPrompts
      }
    })

    return NextResponse.json(updatedPrompt)
  } catch (error) {
    console.error('Ошибка обновления промпта персонажа:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/characters/[characterId]/prompts/[promptId] - Удаление промпта персонажа
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string; promptId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { characterId, promptId } = await params

    // Проверяем существование персонажа
    const character = await prisma.character.findUnique({
      where: { id: characterId }
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Персонаж не найден' },
        { status: 404 }
      )
    }

    // Получаем текущие промпты персонажа
    const currentPrompts = (character.prompts as any[]) || []

    // Удаляем промпт
    const updatedPrompts = currentPrompts.filter(p => p.id !== promptId)

    // Сохраняем в базу данных
    await prisma.character.update({
      where: { id: characterId },
      data: {
        prompts: updatedPrompts
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления промпта персонажа:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
