import { CharacterPrompt } from '../types/character'

export interface PromptTemplate {
  basePrompt: string
  communicationStyle: string
  behaviorPatterns: string[]
  characteristicResponses: {
    [characteristic: string]: {
      [range: string]: string
    }
  }
}

export class PromptSystem {
  /**
   * Генерирует базовый промт для персонажа
   */
  generateCharacterPrompt(character: any): string {
    const { name, age, characteristics, prompt } = character
    
    let basePrompt = `Ты - ${name}`
    
    if (age) {
      basePrompt += `, ${age}-летний персонаж`
    }
    
    if (prompt?.character) {
      basePrompt += `. ${prompt.character}`
    }
    
    // Добавляем стиль общения
    if (prompt?.communication) {
      basePrompt += `\n\nСтиль общения:\n${prompt.communication}`
    }
    
    // Добавляем особенности поведения
    if (prompt?.behavior) {
      basePrompt += `\n\nОсобенности поведения:\n${prompt.behavior}`
    }
    
    return basePrompt
  }
  
  /**
   * Генерирует промт для ответа на действие
   */
  generateResponsePrompt(character: any, action: string, currentStats: any): string {
    const basePrompt = this.generateCharacterPrompt(character)
    
    let responsePrompt = `${basePrompt}\n\nТекущие характеристики:\n`
    
    // Добавляем текущие характеристики
    if (currentStats) {
      Object.entries(currentStats).forEach(([key, value]) => {
        responsePrompt += `- ${key}: ${value}\n`
      })
    }
    
    responsePrompt += `\nДействие пользователя: "${action}"\n\n`
    responsePrompt += `Отвечай в соответствии с характером персонажа и текущими характеристиками. `
    responsePrompt += `Учитывай возраст, стиль речи и особенности поведения.`
    
    return responsePrompt
  }
  
  /**
   * Генерирует интерпретацию характеристики
   */
  generateCharacteristicInterpretation(
    character: any, 
    characteristic: string, 
    value: number
  ): string {
    const interpretations = character.prompt?.characteristicInterpretations?.[characteristic]
    
    if (!interpretations) {
      return this.getDefaultInterpretation(characteristic, value)
    }
    
    // Определяем диапазон для значения
    let range = ''
    if (value <= 3) range = '1-3'
    else if (value <= 6) range = '4-6'
    else if (value <= 8) range = '7-8'
    else range = '9-10'
    
    return interpretations[range] || this.getDefaultInterpretation(characteristic, value)
  }
  
  /**
   * Получает интерпретацию по умолчанию
   */
  private getDefaultInterpretation(characteristic: string, value: number): string {
    const interpretations = {
      endurance: {
        '1-3': 'Я очень устал...',
        '4-6': 'Я устаю, но могу продолжать...',
        '7-8': 'Я ещё не очень устал...',
        '9-10': 'Я полон сил!'
      },
      sensitivity: {
        '1-3': 'Я почти ничего не чувствую...',
        '4-6': 'Обычные ощущения...',
        '7-8': 'Каждое прикосновение особенное...',
        '9-10': 'Я взрываюсь от каждого прикосновения!'
      },
      emotionalStability: {
        '1-3': 'Я не могу контролировать себя...',
        '4-6': 'Иногда мне грустно, но потом становится лучше...',
        '7-8': 'Я относительно спокоен...',
        '9-10': 'Я полностью контролирую свои эмоции...'
      }
    }
    
    let range = ''
    if (value <= 3) range = '1-3'
    else if (value <= 6) range = '4-6'
    else if (value <= 8) range = '7-8'
    else range = '9-10'
    
    return interpretations[characteristic]?.[range] || 'Нормальная реакция...'
  }
  
  /**
   * Генерирует промт с учетом фетишей
   */
  generateFetishPrompt(character: any, triggeredFetishes: string[]): string {
    if (!triggeredFetishes.length) return ''
    
    let fetishPrompt = '\n\nАктивированные фетиши:\n'
    
    triggeredFetishes.forEach(fetish => {
      const fetishData = character.fetishes?.intensities?.[fetish]
      if (fetishData) {
        fetishPrompt += `- ${fetish} (интенсивность: ${fetishData}/10)\n`
      }
    })
    
    fetishPrompt += '\nРеагируй с учетом активированных фетишей.'
    
    return fetishPrompt
  }
  
  /**
   * Генерирует полный промт для анализа сообщения
   */
  generateAnalysisPrompt(character: any, userMessage: string): string {
    const basePrompt = this.generateCharacterPrompt(character)
    
    let analysisPrompt = `${basePrompt}\n\n`
    analysisPrompt += `Сообщение пользователя: "${userMessage}"\n\n`
    analysisPrompt += `Проанализируй это сообщение и верни JSON с анализом:\n\n`
    analysisPrompt += `{\n`
    analysisPrompt += `  "emotionalContent": {\n`
    analysisPrompt += `    "threat": 0-1,\n`
    analysisPrompt += `    "pleasure": 0-1,\n`
    analysisPrompt += `    "pain": 0-1,\n`
    analysisPrompt += `    "fear": 0-1,\n`
    analysisPrompt += `    "arousal": 0-1\n`
    analysisPrompt += `  },\n`
    analysisPrompt += `  "commands": {\n`
    analysisPrompt += `    "poseChange": {\n`
    analysisPrompt += `      "poseId": "id_позы_или_null",\n`
    analysisPrompt += `      "force": true/false\n`
    analysisPrompt += `    },\n`
    analysisPrompt += `    "action": {\n`
    analysisPrompt += `      "actionId": "id_действия_или_null",\n`
    analysisPrompt += `      "intensity": 1-10\n`
    analysisPrompt += `    },\n`
    analysisPrompt += `    "tool": {\n`
    analysisPrompt += `      "toolId": "id_инструмента_или_null",\n`
    analysisPrompt += `      "intensity": 1-10,\n`
    analysisPrompt += `      "duration": секунды\n`
    analysisPrompt += `    }\n`
    analysisPrompt += `  },\n`
    analysisPrompt += `  "fetishTriggers": ["список_активированных_фетишей"],\n`
    analysisPrompt += `  "statChanges": {\n`
    analysisPrompt += `    "имя_стата": изменение_число\n`
    analysisPrompt += `  },\n`
    analysisPrompt += `  "response": "естественный_ответ_персонажа_на_сообщение"\n`
    analysisPrompt += `}\n\n`
    analysisPrompt += `Анализируй эмоциональное содержание, ищи команды, определяй активированные фетиши и предлагай изменения характеристик.`
    
    return analysisPrompt
  }
}



