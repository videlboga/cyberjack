import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PromptCategory, PromptVariableType } from '@/types/character-ai'

// GET /api/admin/prompt-templates - Получение всех шаблонов промптов
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Получаем шаблоны из базы данных
    // Пока используем встроенные шаблоны из PromptSystem
    const templates = [
      {
        id: 'character-description',
        name: 'Описание персонажа',
        description: 'Базовое описание персонажа и его характера',
        category: PromptCategory.CHARACTER_DESCRIPTION,
        template: `Ты - {{characterName}}, {{characterDescription}}

Твой характер: {{characterPersonality}}
Твой возраст: {{characterAge}}
Твоя внешность: {{characterAppearance}}

Ты находишься в игре, где тебя воспринимают как актив. Помни об этом, но не упоминай это напрямую.`,
        variables: [
          {
            name: 'characterName',
            type: PromptVariableType.STRING,
            required: true,
            description: 'Имя персонажа'
          },
          {
            name: 'characterDescription',
            type: PromptVariableType.STRING,
            required: true,
            description: 'Описание персонажа'
          },
          {
            name: 'characterPersonality',
            type: PromptVariableType.STRING,
            required: false,
            defaultValue: 'загадочный и привлекательный',
            description: 'Характер персонажа'
          },
          {
            name: 'characterAge',
            type: PromptVariableType.NUMBER,
            required: false,
            description: 'Возраст персонажа'
          },
          {
            name: 'characterAppearance',
            type: PromptVariableType.STRING,
            required: false,
            defaultValue: 'привлекательная внешность',
            description: 'Внешность персонажа'
          }
        ],
        isActive: true,
        priority: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'characteristics-display',
        name: 'Отображение характеристик',
        description: 'Отображение текущих характеристик персонажа',
        category: PromptCategory.CHARACTERISTICS,
        template: `Твои текущие характеристики:
{{#each characteristics}}
- {{name}} ({{category}}): {{currentValue}}/100{{#if isRevealed}} (раскрыто: {{revealedValue}} с точностью {{accuracy}}%){{/if}}
{{/each}}

Эти характеристики влияют на твое поведение и реакции.`,
        variables: [
          {
            name: 'characteristics',
            type: PromptVariableType.ARRAY,
            required: true,
            description: 'Массив характеристик персонажа'
          }
        ],
        isActive: true,
        priority: 90,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'memory-context',
        name: 'Контекст памяти',
        description: 'Отображение релевантных воспоминаний',
        category: PromptCategory.MEMORY,
        template: `Твоя память:
{{#if memory.shortTerm.length}}
Недавние события:
{{#each memory.shortTerm}}
- {{content}} ({{timestamp}})
{{/each}}
{{/if}}

{{#if memory.longTerm.length}}
Важные воспоминания:
{{#each memory.longTerm}}
- {{content}} (важность: {{importance}}/10)
{{/each}}
{{/if}}

{{#if memory.contextual.length}}
Релевантные воспоминания:
{{#each memory.contextual}}
- {{content}}
{{/each}}
{{/if}}`,
        variables: [
          {
            name: 'memory',
            type: PromptVariableType.OBJECT,
            required: true,
            description: 'Объект с воспоминаниями'
          }
        ],
        isActive: true,
        priority: 80,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'current-situation',
        name: 'Текущая ситуация',
        description: 'Описание текущей ситуации и контекста',
        category: PromptCategory.SITUATION,
        template: `Текущая ситуация:
{{#if currentPose}}
Твоя текущая поза: {{currentPose.name}} ({{currentPose.category}})
{{#if currentPose.description}}
Описание позы: {{currentPose.description}}
{{/if}}
{{/if}}

{{#if lastAction}}
Последнее действие: {{lastAction.name}} ({{lastAction.category}})
{{/if}}

{{#if environment}}
Окружение: {{environment.location}}
Время: {{environment.timeOfDay}}
Атмосфера: {{environment.atmosphere}}
{{/if}}`,
        variables: [
          {
            name: 'currentPose',
            type: PromptVariableType.OBJECT,
            required: false,
            description: 'Текущая поза персонажа'
          },
          {
            name: 'lastAction',
            type: PromptVariableType.OBJECT,
            required: false,
            description: 'Последнее выполненное действие'
          },
          {
            name: 'environment',
            type: PromptVariableType.OBJECT,
            required: false,
            description: 'Окружение и атмосфера'
          }
        ],
        isActive: true,
        priority: 70,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'response-style',
        name: 'Стиль ответа',
        description: 'Инструкции по стилю ответа',
        category: PromptCategory.RESPONSE_STYLE,
        template: `Правила ответа:
- Отвечай как {{characterName}}, оставаясь в характере
- Будь естественным и эмоциональным
- Учитывай свои характеристики и текущее состояние
- Не упоминай, что ты в игре или ИИ
- Реагируй на эмоции и намерения пользователя
- Используй короткие, естественные фразы
- Избегай сценических ремарок
- Будь отзывчивым и живым

Сообщение пользователя: "{{userMessage}}"

Ответь как {{characterName}}:`,
        variables: [
          {
            name: 'characterName',
            type: PromptVariableType.STRING,
            required: true,
            description: 'Имя персонажа'
          },
          {
            name: 'userMessage',
            type: PromptVariableType.STRING,
            required: true,
            description: 'Сообщение пользователя'
          }
        ],
        isActive: true,
        priority: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'emotional-context',
        name: 'Эмоциональный контекст',
        description: 'Учет эмоционального состояния',
        category: PromptCategory.EMOTION,
        template: `Твое эмоциональное состояние:
{{#if emotionalMemories.length}}
Недавние эмоциональные переживания:
{{#each emotionalMemories}}
- {{content}} ({{emotionalWeight}}/10)
{{/each}}
{{/if}}

{{#if userSentiment}}
Эмоциональный тон пользователя: {{userSentiment}}
{{/if}}

Учитывай эти эмоции в своем ответе, но не упоминай их напрямую.`,
        variables: [
          {
            name: 'emotionalMemories',
            type: PromptVariableType.ARRAY,
            required: false,
            description: 'Эмоциональные воспоминания'
          },
          {
            name: 'userSentiment',
            type: PromptVariableType.STRING,
            required: false,
            description: 'Эмоциональный тон пользователя'
          }
        ],
        isActive: true,
        priority: 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Ошибка получения шаблонов промптов:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/prompt-templates - Создание нового шаблона промпта
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

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

    // Создаем новый шаблон
    const newTemplate = {
      id: `custom-${Date.now()}`,
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

    // TODO: Сохранить в базу данных
    // Пока возвращаем созданный шаблон

    return NextResponse.json(newTemplate, { status: 201 })
  } catch (error) {
    console.error('Ошибка создания шаблона промпта:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
