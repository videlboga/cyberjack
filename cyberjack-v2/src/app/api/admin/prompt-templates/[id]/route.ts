import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PromptCategory } from '@/types/character-ai'

// GET /api/admin/prompt-templates/[id] - Получение конкретного шаблона
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id } = await params

    // TODO: Получить шаблон из базы данных
    // Пока возвращаем заглушку
    const template = {
      id,
      name: 'Шаблон',
      description: 'Описание шаблона',
      category: PromptCategory.CHARACTER_DESCRIPTION,
      template: 'Шаблон промпта',
      variables: [],
      isActive: true,
      priority: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Ошибка получения шаблона промпта:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/prompt-templates/[id] - Обновление шаблона
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, category, template, variables, isActive, priority } = body

    // Валидация
    if (!name || !description || !category || !template) {
      return NextResponse.json(
        { error: 'Обязательные поля не заполнены' },
        { status: 400 }
      )
    }

    if (!Object.values(PromptCategory).includes(category)) {
      return NextResponse.json(
        { error: 'Неверная категория' },
        { status: 400 }
      )
    }

    // TODO: Обновить шаблон в базе данных
    const updatedTemplate = {
      id,
      name,
      description,
      category,
      template,
      variables: variables || [],
      isActive: isActive !== false,
      priority: priority || 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error('Ошибка обновления шаблона промпта:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/prompt-templates/[id] - Удаление шаблона
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { id } = await params

    // TODO: Удалить шаблон из базы данных
    // Проверить, не используется ли шаблон в промптах персонажей

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления шаблона промпта:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
