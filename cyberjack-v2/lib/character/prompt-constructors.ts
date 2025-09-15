// lib/character/prompt-constructors.ts

import { prisma } from '@/lib/db/client'
import {
  PromptTemplate,
  PromptCategory,
  PromptVariable,
  PromptVariableType,
  CharacteristicContext,
  PoseContext
} from '@/types/character-ai'

export class PromptConstructors {
  private promptSystem: any

  constructor(promptSystem: any) {
    this.promptSystem = promptSystem
  }

  // Конструктор промптов на основе характеристик
  async buildCharacteristicBasedPrompt(
    characterId: string,
    context: 'high' | 'low' | 'extreme' | 'normal' = 'normal'
  ): Promise<PromptTemplate> {
    const characteristics = await this.getCharacterCharacteristics(characterId)

    // Анализируем характеристики
    const analysis = this.analyzeCharacteristics(characteristics)

    // Создаем промпт на основе анализа
    const template = this.generateCharacteristicPrompt(analysis, context)

    return template
  }

  // Конструктор промптов на основе поз
  async buildPoseBasedPrompt(
    characterId: string,
    poseId?: string
  ): Promise<PromptTemplate> {
    const currentPose = await this.getCurrentPose(characterId, poseId)
    const activeZones = await this.getActiveZones(characterId, currentPose?.id)

    // Анализируем позу и активные зоны
    const analysis = this.analyzePose(currentPose, activeZones)

    // Создаем промпт на основе анализа
    const template = this.generatePosePrompt(analysis)

    return template
  }

  // Конструктор комбинированных промптов
  async buildCombinedPrompt(
    characterId: string,
    context: 'interaction' | 'action' | 'emotion' | 'general' = 'general'
  ): Promise<PromptTemplate> {
    const characteristics = await this.getCharacterCharacteristics(characterId)
    const currentPose = await this.getCurrentPose(characterId)
    const activeZones = await this.getActiveZones(characterId, currentPose?.id)

    // Анализируем все компоненты
    const charAnalysis = this.analyzeCharacteristics(characteristics)
    const poseAnalysis = this.analyzePose(currentPose, activeZones)

    // Создаем комбинированный промпт
    const template = this.generateCombinedPrompt(charAnalysis, poseAnalysis, context)

    return template
  }

  // Получение характеристик персонажа
  private async getCharacterCharacteristics(characterId: string) {
    return await prisma.characteristic.findMany({
      where: { characterId },
      include: {
        definition: true
      }
    })
  }

  // Получение текущей позы
  private async getCurrentPose(characterId: string, poseId?: string) {
    if (poseId) {
      return await prisma.characterPose.findUnique({
        where: { id: poseId },
        include: {
          definition: true,
          angles: {
            include: {
              zones: {
                include: {
                  anatomy: true
                }
              }
            }
          }
        }
      })
    }

    return await prisma.characterPose.findFirst({
      where: {
        characterId,
        isActive: true
      },
      include: {
        definition: true,
        angles: {
          include: {
            zones: {
              include: {
                anatomy: true
              }
            }
          }
        }
      }
    })
  }

  // Получение активных зон
  private async getActiveZones(characterId: string, poseId?: string) {
    if (!poseId) return []

    return await prisma.characterActiveZone.findMany({
      where: {
        characterAngle: {
          characterPoseId: poseId
        }
      },
      include: {
        anatomy: true
      }
    })
  }

  // Анализ характеристик
  private analyzeCharacteristics(characteristics: any[]) {
    const analysis = {
      dominant: [] as any[],
      extreme: [] as any[],
      low: [] as any[],
      categories: {} as Record<string, any[]>,
      overall: {
        average: 0,
        range: 0,
        volatility: 0
      }
    }

    if (characteristics.length === 0) return analysis

    // Группируем по категориям
    characteristics.forEach(char => {
      const category = char.definition.category
      if (!analysis.categories[category]) {
        analysis.categories[category] = []
      }
      analysis.categories[category].push(char)
    })

    // Анализируем значения
    const values = characteristics.map(char => char.currentValue)
    analysis.overall.average = values.reduce((sum, val) => sum + val, 0) / values.length
    analysis.overall.range = Math.max(...values) - Math.min(...values)

    // Вычисляем волатильность (стандартное отклонение)
    const variance = values.reduce((sum, val) => sum + Math.pow(val - analysis.overall.average, 2), 0) / values.length
    analysis.overall.volatility = Math.sqrt(variance)

    // Определяем доминирующие, экстремальные и низкие характеристики
    characteristics.forEach(char => {
      if (char.currentValue >= 80) {
        analysis.dominant.push(char)
      }
      if (char.currentValue >= 90 || char.currentValue <= 10) {
        analysis.extreme.push(char)
      }
      if (char.currentValue <= 30) {
        analysis.low.push(char)
      }
    })

    return analysis
  }

  // Анализ позы
  private analyzePose(pose: any, activeZones: any[]) {
    const analysis = {
      pose: pose,
      activeZones: activeZones,
      sensitiveAreas: [] as any[],
      exposedAreas: [] as any[],
      dominantAnatomy: [] as any[],
      poseType: 'neutral' as 'intimate' | 'exposed' | 'restrained' | 'neutral',
      intensity: 0
    }

    if (!pose) return analysis

    // Анализируем активные зоны
    activeZones.forEach(zone => {
      if (zone.anatomy) {
        if (zone.anatomy.category === 'sensitive') {
          analysis.sensitiveAreas.push(zone)
        }
        if (zone.anatomy.category === 'exposed') {
          analysis.exposedAreas.push(zone)
        }
      }
    })

    // Определяем тип позы
    if (analysis.sensitiveAreas.length > 2) {
      analysis.poseType = 'intimate'
      analysis.intensity = 8
    } else if (analysis.exposedAreas.length > 1) {
      analysis.poseType = 'exposed'
      analysis.intensity = 6
    } else if (pose.definition.category === 'restrained') {
      analysis.poseType = 'restrained'
      analysis.intensity = 7
    } else {
      analysis.poseType = 'neutral'
      analysis.intensity = 3
    }

    return analysis
  }

  // Генерация промпта на основе характеристик
  private generateCharacteristicPrompt(analysis: any, context: string): PromptTemplate {
    const template = this.buildCharacteristicTemplate(analysis, context)

    return {
      id: `characteristic-${context}-${Date.now()}`,
      name: `Промпт на основе характеристик (${context})`,
      description: `Динамически созданный промпт на основе анализа характеристик персонажа`,
      category: PromptCategory.CHARACTERISTICS,
      template: template,
      variables: this.getCharacteristicVariables(),
      isActive: true,
      priority: 85,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // Генерация промпта на основе позы
  private generatePosePrompt(analysis: any): PromptTemplate {
    const template = this.buildPoseTemplate(analysis)

    return {
      id: `pose-${analysis.poseType}-${Date.now()}`,
      name: `Промпт на основе позы (${analysis.poseType})`,
      description: `Динамически созданный промпт на основе анализа позы и активных зон`,
      category: PromptCategory.SITUATION,
      template: template,
      variables: this.getPoseVariables(),
      isActive: true,
      priority: 80,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // Генерация комбинированного промпта
  private generateCombinedPrompt(
    charAnalysis: any,
    poseAnalysis: any,
    context: string
  ): PromptTemplate {
    const template = this.buildCombinedTemplate(charAnalysis, poseAnalysis, context)

    return {
      id: `combined-${context}-${Date.now()}`,
      name: `Комбинированный промпт (${context})`,
      description: `Динамически созданный промпт на основе характеристик, позы и контекста`,
      category: PromptCategory.INTERACTION,
      template: template,
      variables: this.getCombinedVariables(),
      isActive: true,
      priority: 90,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // Построение шаблона характеристик
  private buildCharacteristicTemplate(analysis: any, context: string): string {
    let template = `Твои характеристики влияют на твое поведение:\n\n`

    // Доминирующие характеристики
    if (analysis.dominant.length > 0) {
      template += `Доминирующие черты (высокие значения):\n`
      analysis.dominant.forEach((char: any) => {
        template += `- ${char.definition.name}: ${char.currentValue}/100 - ${this.getCharacteristicDescription(char, 'high')}\n`
      })
      template += `\n`
    }

    // Экстремальные характеристики
    if (analysis.extreme.length > 0) {
      template += `Экстремальные состояния:\n`
      analysis.extreme.forEach((char: any) => {
        const level = char.currentValue >= 90 ? 'очень высокий' : 'очень низкий'
        template += `- ${char.definition.name}: ${char.currentValue}/100 (${level}) - ${this.getCharacteristicDescription(char, 'extreme')}\n`
      })
      template += `\n`
    }

    // Низкие характеристики
    if (analysis.low.length > 0) {
      template += `Слабые стороны:\n`
      analysis.low.forEach((char: any) => {
        template += `- ${char.definition.name}: ${char.currentValue}/100 - ${this.getCharacteristicDescription(char, 'low')}\n`
      })
      template += `\n`
    }

    // Общее состояние
    template += `Общее состояние: ${this.getOverallStateDescription(analysis.overall)}\n\n`

    // Контекстные инструкции
    template += this.getContextualInstructions(context, analysis)

    return template
  }

  // Построение шаблона позы
  private buildPoseTemplate(analysis: any): string {
    if (!analysis.pose) {
      return `Твоя текущая поза: нейтральная позиция`
    }

    let template = `Твоя текущая поза: ${analysis.pose.definition.name}\n`
    template += `Категория: ${analysis.pose.definition.category}\n`

    if (analysis.pose.definition.description) {
      template += `Описание: ${analysis.pose.definition.description}\n`
    }

    template += `\nТип позы: ${this.getPoseTypeDescription(analysis.poseType)}\n`
    template += `Интенсивность: ${analysis.intensity}/10\n\n`

    // Активные зоны
    if (analysis.activeZones.length > 0) {
      template += `Активные зоны:\n`
      analysis.activeZones.forEach((zone: any) => {
        template += `- ${zone.name}`
        if (zone.anatomy) {
          template += ` (${zone.anatomy.name})`
        }
        template += `\n`
      })
      template += `\n`
    }

    // Чувствительные области
    if (analysis.sensitiveAreas.length > 0) {
      template += `Чувствительные области:\n`
      analysis.sensitiveAreas.forEach((zone: any) => {
        template += `- ${zone.name} - требует особого внимания\n`
      })
      template += `\n`
    }

    // Инструкции по поведению
    template += this.getPoseBehaviorInstructions(analysis)

    return template
  }

  // Построение комбинированного шаблона
  private buildCombinedTemplate(charAnalysis: any, poseAnalysis: any, context: string): string {
    let template = `Твое текущее состояние:\n\n`

    // Характеристики
    template += `Характеристики:\n`
    if (charAnalysis.dominant.length > 0) {
      template += `- Доминирующие: ${charAnalysis.dominant.map((c: any) => c.definition.name).join(', ')}\n`
    }
    if (charAnalysis.extreme.length > 0) {
      template += `- Экстремальные: ${charAnalysis.extreme.map((c: any) => c.definition.name).join(', ')}\n`
    }
    template += `- Общее состояние: ${this.getOverallStateDescription(charAnalysis.overall)}\n\n`

    // Поза
    if (poseAnalysis.pose) {
      template += `Поза: ${poseAnalysis.pose.definition.name} (${poseAnalysis.poseType}, интенсивность ${poseAnalysis.intensity}/10)\n`
      if (poseAnalysis.sensitiveAreas.length > 0) {
        template += `- Чувствительные области: ${poseAnalysis.sensitiveAreas.map((z: any) => z.name).join(', ')}\n`
      }
      template += `\n`
    }

    // Контекстные инструкции
    template += this.getCombinedContextualInstructions(context, charAnalysis, poseAnalysis)

    return template
  }

  // Получение описания характеристики
  private getCharacteristicDescription(char: any, level: 'high' | 'low' | 'extreme'): string {
    const descriptions = {
      'чувствительность': {
        high: 'очень чувствителен к прикосновениям',
        low: 'малочувствителен к внешним воздействиям',
        extreme: 'крайне чувствителен или полностью нечувствителен'
      },
      'покорность': {
        high: 'склонен к подчинению',
        low: 'склонен к сопротивлению',
        extreme: 'полностью покорен или крайне сопротивляется'
      },
      'невинность': {
        high: 'сохраняет невинность и чистоту',
        low: 'опытен и знающ',
        extreme: 'абсолютно невинен или полностью развращен'
      },
      'агрессивность': {
        high: 'склонен к агрессивному поведению',
        low: 'миролюбив и спокоен',
        extreme: 'крайне агрессивен или полностью пассивен'
      }
    }

    const charName = char.definition.name.toLowerCase()
    return descriptions[charName]?.[level] || `характеристика на ${level === 'high' ? 'высоком' : level === 'low' ? 'низком' : 'экстремальном'} уровне`
  }

  // Получение описания общего состояния
  private getOverallStateDescription(overall: any): string {
    if (overall.average >= 80) {
      return 'очень возбужден и активен'
    } else if (overall.average >= 60) {
      return 'возбужден и отзывчив'
    } else if (overall.average >= 40) {
      return 'умеренно активен'
    } else if (overall.average >= 20) {
      return 'спокоен и расслаблен'
    } else {
      return 'очень спокоен или подавлен'
    }
  }

  // Получение описания типа позы
  private getPoseTypeDescription(poseType: string): string {
    const descriptions = {
      intimate: 'интимная и близкая',
      exposed: 'открытая и уязвимая',
      restrained: 'ограниченная и подчиненная',
      neutral: 'нейтральная и естественная'
    }
    return descriptions[poseType] || 'неопределенная'
  }

  // Получение инструкций по поведению в позе
  private getPoseBehaviorInstructions(analysis: any): string {
    const instructions = {
      intimate: 'Будь особенно внимателен к чувствам и реакциям. Проявляй нежность и заботу.',
      exposed: 'Чувствуй уязвимость, но не стыдись. Будь открыт и честен в реакциях.',
      restrained: 'Ощущай ограничения, но не сопротивляйся. Принимай подчиненную роль.',
      neutral: 'Веди себя естественно и расслабленно. Реагируй спонтанно.'
    }
    return instructions[analysis.poseType] || 'Веди себя согласно своему характеру.'
  }

  // Получение контекстных инструкций
  private getContextualInstructions(context: string, analysis: any): string {
    const instructions = {
      high: 'Твои высокие характеристики делают тебя очень отзывчивым. Реагируй интенсивно и эмоционально.',
      low: 'Твои низкие характеристики делают тебя более сдержанным. Реагируй спокойно и размеренно.',
      extreme: 'Твои экстремальные характеристики создают сильные эмоции. Реагируй очень ярко и выразительно.',
      normal: 'Твои характеристики в норме. Реагируй естественно и сбалансированно.'
    }
    return instructions[context] || 'Реагируй согласно своим характеристикам.'
  }

  // Получение комбинированных контекстных инструкций
  private getCombinedContextualInstructions(context: string, charAnalysis: any, poseAnalysis: any): string {
    const instructions = {
      interaction: 'Взаимодействуй естественно, учитывая свои характеристики и текущую позу.',
      action: 'Реагируй на действия, исходя из своего состояния и положения.',
      emotion: 'Выражай эмоции согласно своим характеристикам и чувствуй позу.',
      general: 'Веди себя согласно своему характеру и текущему состоянию.'
    }
    return instructions[context] || 'Реагируй естественно.'
  }

  // Переменные для промптов характеристик
  private getCharacteristicVariables(): PromptVariable[] {
    return [
      {
        name: 'characteristics',
        type: PromptVariableType.ARRAY,
        required: true,
        description: 'Массив характеристик персонажа'
      },
      {
        name: 'dominant',
        type: PromptVariableType.ARRAY,
        required: false,
        description: 'Доминирующие характеристики'
      },
      {
        name: 'extreme',
        type: PromptVariableType.ARRAY,
        required: false,
        description: 'Экстремальные характеристики'
      },
      {
        name: 'low',
        type: PromptVariableType.ARRAY,
        required: false,
        description: 'Низкие характеристики'
      },
      {
        name: 'overall',
        type: PromptVariableType.OBJECT,
        required: false,
        description: 'Общее состояние характеристик'
      }
    ]
  }

  // Переменные для промптов поз
  private getPoseVariables(): PromptVariable[] {
    return [
      {
        name: 'pose',
        type: PromptVariableType.OBJECT,
        required: true,
        description: 'Текущая поза персонажа'
      },
      {
        name: 'activeZones',
        type: PromptVariableType.ARRAY,
        required: false,
        description: 'Активные зоны позы'
      },
      {
        name: 'sensitiveAreas',
        type: PromptVariableType.ARRAY,
        required: false,
        description: 'Чувствительные области'
      },
      {
        name: 'poseType',
        type: PromptVariableType.STRING,
        required: false,
        description: 'Тип позы'
      },
      {
        name: 'intensity',
        type: PromptVariableType.NUMBER,
        required: false,
        description: 'Интенсивность позы'
      }
    ]
  }

  // Переменные для комбинированных промптов
  private getCombinedVariables(): PromptVariable[] {
    return [
      ...this.getCharacteristicVariables(),
      ...this.getPoseVariables(),
      {
        name: 'context',
        type: PromptVariableType.STRING,
        required: true,
        description: 'Контекст взаимодействия'
      }
    ]
  }

  // Добавление конструктора в систему промптов
  async addDynamicPrompt(characterId: string, type: 'characteristic' | 'pose' | 'combined', context?: string): Promise<PromptTemplate> {
    let template: PromptTemplate

    switch (type) {
      case 'characteristic':
        template = await this.buildCharacteristicBasedPrompt(characterId, context as any)
        break
      case 'pose':
        template = await this.buildPoseBasedPrompt(characterId)
        break
      case 'combined':
        template = await this.buildCombinedPrompt(characterId, context as any)
        break
      default:
        throw new Error('Неизвестный тип конструктора промптов')
    }

    // Добавляем в систему промптов
    this.promptSystem.addTemplate(template)

    return template
  }

  // Получение всех динамических промптов для персонажа
  async getDynamicPrompts(characterId: string): Promise<PromptTemplate[]> {
    const templates = this.promptSystem.getAllTemplates()
    return templates.filter(template =>
      template.id.includes(characterId) ||
      template.id.startsWith('characteristic-') ||
      template.id.startsWith('pose-') ||
      template.id.startsWith('combined-')
    )
  }

  // Обновление динамических промптов
  async refreshDynamicPrompts(characterId: string): Promise<PromptTemplate[]> {
    // Удаляем старые динамические промпты
    const oldPrompts = await this.getDynamicPrompts(characterId)
    oldPrompts.forEach(prompt => {
      this.promptSystem.removeTemplate(prompt.id)
    })

    // Создаем новые
    const newPrompts = await Promise.all([
      this.addDynamicPrompt(characterId, 'characteristic', 'normal'),
      this.addDynamicPrompt(characterId, 'pose'),
      this.addDynamicPrompt(characterId, 'combined', 'interaction')
    ])

    return newPrompts
  }
}
