import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

// GET /api/admin/characters/[characterId]/prompts - Получение промптов персонажа
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { characterId } = await params

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

    // Получаем промпты персонажа из поля prompts
    const characterPrompts = character.prompts as any[] || []

    // TODO: Получить полную информацию о шаблонах
    // Пока возвращаем базовую структуру
    const prompts = Array.isArray(characterPrompts) ? characterPrompts.map((prompt, index) => ({
      id: `prompt-${index}`,
      templateId: prompt.templateId || 'unknown',
      template: {
        id: prompt.templateId || 'unknown',
        name: prompt.templateName || 'Неизвестный шаблон',
        description: prompt.templateDescription || '',
        category: prompt.category || 'character_description',
        template: prompt.template || '',
        variables: prompt.variables || [],
        isActive: true,
        priority: 50
      },
      customTemplate: prompt.customTemplate,
      isActive: prompt.isActive !== false,
      priority: prompt.priority || 50,
      variables: prompt.variables || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })) : []

    return NextResponse.json(prompts)
  } catch (error) {
    console.error('Ошибка получения промптов персонажа:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/characters/[characterId]/prompts - Создание промпта для персонажа
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { characterId } = await params
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

    // Валидация
    if (!templateId) {
      return NextResponse.json(
        { error: 'ID шаблона обязателен' },
        { status: 400 }
      )
    }

    // Получаем текущие промпты персонажа
    const currentPrompts = (character.prompts as any[]) || []

    // Создаем новый промпт
    const newPrompt = {
      id: `prompt-${Date.now()}`,
      templateId,
      customTemplate: customTemplate || null,
      isActive: isActive !== false,
      priority: priority || 50,
      variables: variables || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Добавляем к существующим промптам
    const updatedPrompts = [...currentPrompts, newPrompt]

    // Обновляем персонажа
    await prisma.character.update({
      where: { id: characterId },
      data: {
        prompts: updatedPrompts
      }
    })

    return NextResponse.json(newPrompt, { status: 201 })
  } catch (error) {
    console.error('Ошибка создания промпта персонажа:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
