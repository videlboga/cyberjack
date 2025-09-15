import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PromptSystem } from '@/lib/character/prompt-system'

// POST /api/admin/characters/[characterId]/refresh-prompts - Обновление динамических промптов
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

    // Проверяем существование персонажа
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Персонаж не найден' },
        { status: 404 }
      )
    }

    // Создаем систему промптов
    const promptSystem = new PromptSystem()

    // Обновляем динамические промпты
    const dynamicPrompts = await promptSystem.refreshDynamicPrompts(characterId)

    // Получаем все промпты для персонажа
    const allPrompts = await promptSystem.getDynamicPrompts(characterId)

    return NextResponse.json({
      success: true,
      dynamicPrompts: dynamicPrompts.length,
      totalPrompts: allPrompts.length,
      prompts: allPrompts.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        category: prompt.category,
        priority: prompt.priority,
        isActive: prompt.isActive
      }))
    })
  } catch (error) {
    console.error('Ошибка обновления динамических промптов:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
