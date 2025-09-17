import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// Схема валидации для последствий выбора
const consequenceSchema = z.object({
  type: z.enum([
    'change_characteristic', 'change_credits', 'change_equipment',
    'change_story_point', 'trigger_action', 'end_scene', 'add_character', 'remove_character',
    'buy_character', 'sell_character', 'buy_equipment', 'sell_equipment'
  ]),

  // Для изменения характеристик персонажа
  characterId: z.string().optional(),
  characteristicId: z.string().optional(),
  change: z.number().optional(),

  // Для изменения кредитов пользователя
  creditsChange: z.number().optional(),
  creditsVariable: z.enum(['character_price', 'equipment_price', 'character_copy_price']).optional(),
  creditsMultiplier: z.number().optional(),

  // Для изменения оборудования
  equipmentId: z.string().optional(),
  equipmentAction: z.enum(['add', 'remove']).optional(),

  // Для изменения сюжетных точек
  storyPointId: z.string().optional(),
  storyPointChange: z.number().optional(),

  // Для триггера действия
  actionId: z.string().optional(),
  actionIntensity: z.number().optional(),

  // Для добавления/удаления персонажей
  targetCharacterId: z.string().optional(),

  // Для покупки/продажи персонажей
  buyCharacterId: z.string().optional(),
  sellCharacterCopyId: z.string().optional(),

  // Для покупки/продажи оборудования
  buyEquipmentId: z.string().optional(),
  sellEquipmentId: z.string().optional(),
  equipmentQuantity: z.number().optional()
})

// Схема валидации для создания выбора
const createChoiceSchema = z.object({
  text: z.string().min(1, 'Текст выбора обязателен'),
  description: z.string().optional(),
  nextScreenId: z.string().optional(),
  consequences: z.array(consequenceSchema).default([]),
  showConditions: z.array(z.any()).default([]),
  isFinal: z.boolean().optional().default(false)
})

// GET /api/story/screens/[id]/choices - Получить выборы экрана
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const choices = await prisma.choice.findMany({
      where: { screenId: id },
      include: {
        nextScreen: true
      }
    })

    return NextResponse.json(choices)
  } catch (error) {
    console.error('Ошибка при получении выборов:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении выборов' },
      { status: 500 }
    )
  }
}

// POST /api/story/screens/[id]/choices - Создать выбор
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = createChoiceSchema.parse(body)

    // Проверяем, существует ли экран, к которому ссылается выбор
    if (validatedData.nextScreenId) {
      const nextScreen = await prisma.screen.findUnique({
        where: { id: validatedData.nextScreenId }
      })

      if (!nextScreen) {
        return NextResponse.json(
          { error: 'Экран для перехода не найден', details: `Экран с ID ${validatedData.nextScreenId} не существует` },
          { status: 400 }
        )
      }
    }

    const choice = await prisma.choice.create({
      data: {
        ...validatedData,
        screenId: id
      },
      include: {
        nextScreen: true
      }
    })

    return NextResponse.json(choice, { status: 201 })
  } catch (error) {
    console.error('Ошибка при создании выбора:', error)
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
    console.error('Детали ошибки:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Ошибка при создании выбора', details: errorMessage },
      { status: 500 }
    )
  }
}
