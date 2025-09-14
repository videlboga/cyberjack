// lib/character/ai-service.ts

import { prisma } from '@/lib/db/client'
import { CharacterContext } from '@/types/game'

export class CharacterAIService {
  private openRouterApiKey: string
  private baseUrl: string
  private model: string
  private model2: string

  constructor(apiKey: string, baseUrl?: string, model?: string, model2?: string) {
    this.openRouterApiKey = apiKey
    this.baseUrl = baseUrl || 'https://openrouter.ai/api/v1'
    this.model = model || 'z-ai/glm-4.5'
    this.model2 = model2 || 'google/gemini-2.5-flash-lite'
  }

  // Генерация ответа персонажа
  async generateResponse(
    characterId: string,
    userMessage: string,
    context: CharacterContext
  ): Promise<string> {
    const character = await this.getCharacter(characterId)
    const prompt = await this.buildPrompt(character, userMessage, context)

    const response = await this.callOpenRouter(prompt)
    return response
  }

  // Получить персонажа
  private async getCharacter(characterId: string) {
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
      throw new Error('Персонаж не найден')
    }

    return character
  }

  // Построение промпта
  private async buildPrompt(
    character: any,
    userMessage: string,
    context: CharacterContext
  ): Promise<string> {
    const characteristics = await this.getCharacterCharacteristics(character.id)
    const recentActions = await this.getRecentActions(character.id)
    const memory = await this.getCharacterMemory(character.id)

    return `
Ты - ${character.name}, ${character.description || 'персонаж в игре'}

Твои текущие характеристики:
${this.formatCharacteristics(characteristics)}

Последние действия: ${recentActions.join(', ') || 'нет'}

Память: ${memory}

Контекст:
${context.lastAction ? `Последнее действие: ${context.lastAction}` : ''}
${context.currentPose ? `Текущая поза: ${context.currentPose}` : ''}

Сообщение пользователя: "${userMessage}"

Ответь как ${character.name}, учитывая свои характеристики и текущее состояние. Будь естественным и соответствуй своему характеру.
    `.trim()
  }

  // Получить характеристики персонажа
  private async getCharacterCharacteristics(characterId: string) {
    const characteristics = await prisma.characteristic.findMany({
      where: { characterId },
      include: {
        definition: true
      }
    })

    return characteristics.map(char => ({
      name: char.definition.name,
      category: char.definition.category,
      value: char.currentValue,
      baseValue: char.baseValue
    }))
  }

  // Получить последние действия
  private async getRecentActions(characterId: string): Promise<string[]> {
    // TODO: Реализовать получение последних действий
    // Пока возвращаем заглушку
    return []
  }

  // Получить память персонажа
  private async getCharacterMemory(characterId: string): Promise<string> {
    // TODO: Реализовать систему памяти персонажа
    // Пока возвращаем заглушку
    return 'Нет особых воспоминаний'
  }

  // Форматировать характеристики для промпта
  private formatCharacteristics(characteristics: any[]): string {
    if (characteristics.length === 0) {
      return 'Характеристики не определены'
    }

    return characteristics.map(char =>
      `- ${char.name} (${char.category}): ${char.value}/100 (базовое: ${char.baseValue})`
    ).join('\n')
  }

  // Вызов OpenRouter API
  private async callOpenRouter(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CyberJack v2.0'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.8,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        })
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter API')
      }

      return data.choices[0]?.message?.content || 'Извините, я не могу ответить сейчас.'
    } catch (error) {
      console.error('Ошибка при вызове OpenRouter API:', error)
      return 'Извините, произошла ошибка при генерации ответа.'
    }
  }

  // Получить стоимость запроса
  async getRequestCost(prompt: string): Promise<number> {
    // Примерная стоимость: 1 кредит за 100 токенов
    const estimatedTokens = Math.ceil(prompt.length / 4) // примерная оценка
    return Math.ceil(estimatedTokens / 100)
  }

  // Проверить доступность API
  async checkApiHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  // Получить доступные модели
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch models')
      }

      const data = await response.json()
      return data.data?.map((model: any) => model.id) || []
    } catch (error) {
      console.error('Ошибка при получении моделей:', error)
      return []
    }
  }

  // Установить модель
  setModel(modelId: string): void {
    this.model = modelId
  }

  // Получить текущую модель
  getCurrentModel(): string {
    return this.model
  }

  // Анализ сообщения пользователя (использует вторую модель)
  async analyzeMessage(userMessage: string): Promise<{
    intent: string
    emotion: string
    keywords: string[]
    sentiment: 'positive' | 'negative' | 'neutral'
  }> {
    const analysisPrompt = `
Проанализируй следующее сообщение пользователя и верни JSON с анализом:

Сообщение: "${userMessage}"

Верни JSON в формате:
{
  "intent": "основное намерение пользователя",
  "emotion": "эмоциональное состояние",
  "keywords": ["ключевые", "слова"],
  "sentiment": "positive|negative|neutral"
}
    `.trim()

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CyberJack v2.0'
        },
        body: JSON.stringify({
          model: this.model2, // Используем вторую модель для анализа
          messages: [
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 200,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('No response from analysis API')
      }

      // Пытаемся распарсить JSON
      try {
        return JSON.parse(content)
      } catch {
        // Если не удалось распарсить, попробуем найти JSON в markdown блоке
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[1])
          } catch {
            // Если и это не сработало, попробуем найти JSON без markdown
            const jsonMatch2 = content.match(/\{[\s\S]*\}/)
            if (jsonMatch2) {
              try {
                return JSON.parse(jsonMatch2[0])
              } catch {
                // Последняя попытка - вернуть дефолтные значения
              }
            }
          }
        }

        // Если ничего не сработало, возвращаем дефолтные значения
        return {
          intent: 'unknown',
          emotion: 'neutral',
          keywords: [],
          sentiment: 'neutral' as const
        }
      }
    } catch (error) {
      console.error('Ошибка при анализе сообщения:', error)
      return {
        intent: 'unknown',
        emotion: 'neutral',
        keywords: [],
        sentiment: 'neutral' as const
      }
    }
  }
}
