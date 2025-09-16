// lib/character/prompt-system.ts

import { prisma } from '@/lib/db/client'
import {
  PromptTemplate,
  PromptCategory,
  PromptVariable,
  PromptVariableType,
  PromptContext,
  PromptBuilder,
  PromptVariableValidation
} from '@/types/character-ai'
import { PromptConstructors } from './prompt-constructors'
import { serverLogger, LogCategory } from '@/lib/utils/server-logger'
import { getGlobalSystemPromptShort } from './global-system-prompt'

export class PromptSystem implements PromptBuilder {
  private templates: Map<string, PromptTemplate> = new Map()
  private defaultTemplates: PromptTemplate[] = []
  private constructors: PromptConstructors

  constructor() {
    this.initializeDefaultTemplates()
    this.constructors = new PromptConstructors(this)
  }

  // Инициализация стандартных шаблонов
  private initializeDefaultTemplates(): void {
    this.defaultTemplates = [
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'characteristics-display',
        name: 'Отображение характеристик',
        description: 'Отображение текущих характеристик персонажа',
        category: PromptCategory.CHARACTERISTICS,
        template: `Твои текущие характеристики:
{{#each characteristics}}
- {{name}} ({{category}}): {{interpretation}}{{#if isRevealed}} (раскрыто: {{revealedValue}} с точностью {{accuracy}}%){{/if}}
{{/each}}

Эти характеристики влияют на твое поведение и реакции.`,
        variables: [
          {
            name: 'characteristics',
            type: PromptVariableType.ARRAY,
            required: true,
            description: 'Массив характеристик персонажа'
          },
          {
            name: 'name',
            type: PromptVariableType.STRING,
            required: false,
            description: 'Имя характеристики'
          },
          {
            name: 'category',
            type: PromptVariableType.STRING,
            required: false,
            description: 'Категория характеристики'
          },
          {
            name: 'currentValue',
            type: PromptVariableType.NUMBER,
            required: false,
            description: 'Текущее значение характеристики'
          },
          {
            name: 'isRevealed',
            type: PromptVariableType.BOOLEAN,
            required: false,
            description: 'Раскрыта ли характеристика'
          },
          {
            name: 'revealedValue',
            type: PromptVariableType.NUMBER,
            required: false,
            description: 'Раскрытое значение характеристики'
          },
          {
            name: 'accuracy',
            type: PromptVariableType.NUMBER,
            required: false,
            description: 'Точность раскрытия'
          }
        ],
        isActive: true,
        priority: 90,
        createdAt: new Date(),
        updatedAt: new Date()
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
          },
          {
            name: 'content',
            type: PromptVariableType.STRING,
            required: false,
            description: 'Содержимое воспоминания'
          },
          {
            name: 'timestamp',
            type: PromptVariableType.STRING,
            required: false,
            description: 'Время создания воспоминания'
          },
          {
            name: 'importance',
            type: PromptVariableType.NUMBER,
            required: false,
            description: 'Важность воспоминания'
          }
        ],
        isActive: true,
        priority: 80,
        createdAt: new Date(),
        updatedAt: new Date()
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'response-style',
        name: 'Стиль ответа',
        description: 'Инструкции по стилю ответа',
        category: PromptCategory.RESPONSE_STYLE,
        template: `{{globalSystemPrompt}}

Правила ответа:
- Отвечай как {{characterName}}, оставаясь в характере
- Будь естественным и эмоциональным
- Учитывай свои характеристики и текущее состояние
- Реагируй на эмоции и намерения пользователя
- Используй короткие, естественные фразы
- Будь отзывчивым и живым

Сообщение пользователя: "{{userMessage}}"

Ответь как {{characterName}}:`,
        variables: [
          {
            name: 'globalSystemPrompt',
            type: PromptVariableType.STRING,
            required: true,
            description: 'Глобальный системный промпт'
          },
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
        createdAt: new Date(),
        updatedAt: new Date()
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
          },
          {
            name: 'content',
            type: PromptVariableType.STRING,
            required: false,
            description: 'Содержимое эмоционального воспоминания'
          },
          {
            name: 'emotionalWeight',
            type: PromptVariableType.NUMBER,
            required: false,
            description: 'Эмоциональный вес воспоминания'
          }
        ],
        isActive: true,
        priority: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // Загружаем стандартные шаблоны
    this.defaultTemplates.forEach(template => {
      this.templates.set(template.id, template)
    })
  }

  // Построение промпта на основе контекста
  async buildPrompt(context: PromptContext): Promise<string> {
    serverLogger.info(LogCategory.AI, 'Начинаем построение промпта через PromptSystem', {
      characterId: context.characterId,
      userId: context.userId
    })

    const character = await this.getCharacter(context.characterId)
    if (!character) {
      serverLogger.error(LogCategory.AI, 'Персонаж не найден при построении промпта', {
        characterId: context.characterId
      })
      throw new Error('Персонаж не найден')
    }

    // Получаем активные шаблоны, отсортированные по приоритету
    const activeTemplates = Array.from(this.templates.values())
      .filter(template => template.isActive)
      .sort((a, b) => b.priority - a.priority)

    serverLogger.debug(LogCategory.AI, 'Активные шаблоны для промпта', {
      characterId: context.characterId,
      activeTemplatesCount: activeTemplates.length,
      templateIds: activeTemplates.map(t => t.id)
    })

    const promptParts: string[] = []

    // Строим промпт из шаблонов
    for (const template of activeTemplates) {
      try {
        const renderedTemplate = await this.renderTemplate(template, context, character)
        if (renderedTemplate.trim()) {
          promptParts.push(renderedTemplate)
          serverLogger.debug(LogCategory.AI, 'Шаблон успешно отрендерен', {
            characterId: context.characterId,
            templateId: template.id,
            templateCategory: template.category,
            renderedLength: renderedTemplate.length
          })
        }
      } catch (error) {
        serverLogger.error(LogCategory.AI, 'Ошибка при рендеринге шаблона', {
          characterId: context.characterId,
          templateId: template.id,
          error: error.message
        })
        console.error(`Ошибка при рендеринге шаблона ${template.id}:`, error)
      }
    }

    const finalPrompt = promptParts.join('\n\n')

    serverLogger.info(LogCategory.AI, 'Промпт построен через PromptSystem', {
      characterId: context.characterId,
      finalPromptLength: finalPrompt.length,
      estimatedTokens: Math.ceil(finalPrompt.length / 4),
      templatesUsed: promptParts.length
    })

    return finalPrompt
  }

  // Рендеринг шаблона с переменными
  private async renderTemplate(
    template: PromptTemplate,
    context: PromptContext,
    character: any
  ): Promise<string> {
    let rendered = template.template

    // Заменяем переменные
    for (const variable of template.variables) {
      const value = await this.getVariableValue(variable.name, context, character)
      const placeholder = `{{${variable.name}}}`

      if (value !== null && value !== undefined) {
        rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value))
      } else if (variable.required) {
        console.warn(`Обязательная переменная ${variable.name} не найдена в шаблоне ${template.id}`)
        rendered = rendered.replace(new RegExp(placeholder, 'g'), variable.defaultValue || '')
      } else {
        rendered = rendered.replace(new RegExp(placeholder, 'g'), variable.defaultValue || '')
      }
    }

    // Обрабатываем условные блоки
    rendered = this.processConditionalBlocks(rendered, context, character)

    // Обрабатываем циклы
    rendered = this.processLoops(rendered, context, character)

    return rendered.trim()
  }

  // Получение значения переменной
  private async getVariableValue(
    variableName: string,
    context: PromptContext,
    character: any
  ): Promise<any> {
    switch (variableName) {
      case 'characterName':
        return character.name
      case 'characterDescription':
        return character.description || 'загадочный персонаж'
      case 'characterPersonality':
        return character.personality || 'загадочный и привлекательный'
      case 'characterAge':
        return character.age || 'неизвестен'
      case 'characterAppearance':
        return character.appearance || 'привлекательная внешность'
      case 'characteristics':
        // Возвращаем характеристики с интерпретациями
        if (context.characteristics) {
          const { CharacteristicInterpreter } = await import('./characteristic-interpreter')
          const interpreter = new CharacteristicInterpreter()

          return context.characteristics.map(c => ({
            ...c,
            interpretation: interpreter.interpretCharacteristic(
              c.name,
              c.currentValue,
              c.baseValue,
              c.recentChange,
              c.category
            ).interpretation
          }))
        }
        return context.characteristics
      case 'memory':
        return context.memory
      case 'currentPose':
        return context.currentPose
      case 'lastAction':
        return context.lastAction
      case 'environment':
        return context.environment
      case 'userMessage':
        return context.message
      case 'emotionalMemories':
        return context.memory.emotional || []
      case 'userSentiment':
        return context.userModifiers.sentiment || 'neutral'
      case 'globalSystemPrompt':
        return getGlobalSystemPromptShort()
      default:
        return null
    }
  }

  // Обработка условных блоков
  private processConditionalBlocks(
    template: string,
    context: PromptContext,
    character: any
  ): string {
    // Простая обработка условных блоков {{#if condition}}...{{/if}}
    return template.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const value = this.getConditionValue(condition, context, character)
      return value ? content : ''
    })
  }

  // Обработка циклов
  private processLoops(
    template: string,
    context: PromptContext,
    character: any
  ): string {
    // Простая обработка циклов {{#each array}}...{{/each}}
    return template.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
      const array = this.getArrayValue(arrayName, context, character)
      if (!Array.isArray(array)) return ''

      return array.map(item => {
        let itemContent = content
        // Заменяем переменные внутри цикла
        itemContent = itemContent.replace(/\{\{(\w+)\}\}/g, (varMatch, varName) => {
          return item[varName] || ''
        })
        return itemContent
      }).join('')
    })
  }

  // Получение значения условия
  private getConditionValue(condition: string, context: PromptContext, character: any): any {
    switch (condition) {
      case 'currentPose':
        return context.currentPose
      case 'lastAction':
        return context.lastAction
      case 'environment':
        return context.environment
      case 'memory.shortTerm.length':
        return context.memory.shortTerm?.length > 0
      case 'memory.longTerm.length':
        return context.memory.longTerm?.length > 0
      case 'memory.contextual.length':
        return context.memory.contextual?.length > 0
      case 'emotionalMemories.length':
        return context.memory.emotional?.length > 0
      case 'userSentiment':
        return context.userModifiers.sentiment
      default:
        return false
    }
  }

  // Получение значения массива
  private getArrayValue(arrayName: string, context: PromptContext, character: any): any[] {
    switch (arrayName) {
      case 'characteristics':
        return context.characteristics || []
      case 'memory.shortTerm':
        return context.memory.shortTerm || []
      case 'memory.longTerm':
        return context.memory.longTerm || []
      case 'memory.contextual':
        return context.memory.contextual || []
      case 'emotionalMemories':
        return context.memory.emotional || []
      default:
        return []
    }
  }

  // Получение персонажа
  private async getCharacter(characterId: string) {
    return await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })
  }

  // Добавление шаблона
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template)
  }

  // Удаление шаблона
  removeTemplate(templateId: string): void {
    this.templates.delete(templateId)
  }

  // Обновление шаблона
  updateTemplate(templateId: string, updates: Partial<PromptTemplate>): void {
    const existing = this.templates.get(templateId)
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: new Date() }
      this.templates.set(templateId, updated)
    }
  }

  // Получение шаблона
  getTemplate(templateId: string): PromptTemplate | null {
    return this.templates.get(templateId) || null
  }

  // Получение шаблонов по категории
  getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category)
      .sort((a, b) => b.priority - a.priority)
  }

  // Получение всех шаблонов
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.priority - a.priority)
  }

  // Валидация шаблона
  validateTemplate(template: PromptTemplate): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!template.id || !template.name || !template.template) {
      errors.push('Обязательные поля не заполнены')
    }

    if (!Object.values(PromptCategory).includes(template.category)) {
      errors.push('Неверная категория шаблона')
    }

    // Проверяем переменные в шаблоне
    const variableMatches = template.template.match(/\{\{(\w+)\}\}/g)
    if (variableMatches) {
      const templateVariables = new Set(variableMatches.map(match => match.slice(2, -2)))
      const definedVariables = new Set(template.variables.map(v => v.name))

      for (const variable of templateVariables) {
        if (!definedVariables.has(variable)) {
          errors.push(`Переменная ${variable} используется в шаблоне, но не определена`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Оптимизация промпта
  optimizePrompt(prompt: string, maxTokens: number = 2000): string {
    // Простая оптимизация - удаление лишних пробелов и переносов
    let optimized = prompt
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Убираем множественные переносы
      .replace(/\s+/g, ' ') // Убираем множественные пробелы
      .trim()

    // Если промпт слишком длинный, обрезаем его
    const estimatedTokens = Math.ceil(optimized.length / 4)
    if (estimatedTokens > maxTokens) {
      const ratio = maxTokens / estimatedTokens
      const targetLength = Math.floor(optimized.length * ratio)
      optimized = optimized.substring(0, targetLength) + '...'
    }

    return optimized
  }

  // Получение статистики промпта
  getPromptStats(prompt: string): {
    length: number
    estimatedTokens: number
    variableCount: number
    conditionalBlocks: number
    loops: number
  } {
    const variableMatches = prompt.match(/\{\{(\w+)\}\}/g) || []
    const conditionalMatches = prompt.match(/\{\{#if\s+\w+\}\}/g) || []
    const loopMatches = prompt.match(/\{\{#each\s+\w+\}\}/g) || []

    return {
      length: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4),
      variableCount: variableMatches.length,
      conditionalBlocks: conditionalMatches.length,
      loops: loopMatches.length
    }
  }

  // Методы для работы с конструкторами промптов

  // Создание динамического промпта на основе характеристик
  async createCharacteristicPrompt(
    characterId: string,
    context: 'high' | 'low' | 'extreme' | 'normal' = 'normal'
  ): Promise<PromptTemplate> {
    return await this.constructors.addDynamicPrompt(characterId, 'characteristic', context)
  }

  // Создание динамического промпта на основе позы
  async createPosePrompt(characterId: string, poseId?: string): Promise<PromptTemplate> {
    return await this.constructors.addDynamicPrompt(characterId, 'pose')
  }

  // Создание комбинированного динамического промпта
  async createCombinedPrompt(
    characterId: string,
    context: 'interaction' | 'action' | 'emotion' | 'general' = 'general'
  ): Promise<PromptTemplate> {
    return await this.constructors.addDynamicPrompt(characterId, 'combined', context)
  }

  // Получение всех динамических промптов для персонажа
  async getDynamicPrompts(characterId: string): Promise<PromptTemplate[]> {
    return await this.constructors.getDynamicPrompts(characterId)
  }

  // Обновление динамических промптов для персонажа
  async refreshDynamicPrompts(characterId: string): Promise<PromptTemplate[]> {
    return await this.constructors.refreshDynamicPrompts(characterId)
  }

  // Построение промпта с динамическими шаблонами
  async buildDynamicPrompt(
    characterId: string,
    context: PromptContext,
    includeDynamic: boolean = true
  ): Promise<string> {
    if (includeDynamic) {
      // Обновляем динамические промпты
      await this.refreshDynamicPrompts(characterId)
    }

    // Строим обычный промпт
    return await this.buildPrompt(context)
  }

  // Получение конструкторов
  getConstructors(): PromptConstructors {
    return this.constructors
  }
}
