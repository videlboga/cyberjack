// lib/core/chat/chat-formula-system.ts

import { FormulaSystem } from '../formulas/formula-system'
import { CharacteristicsSystem } from '../characteristics/characteristics-system'
import { FormulaExecutionContext } from '../formulas/types/formula-context'

export interface ChatMessage {
  id: string
  content: string
  senderId: string
  characterId: string
  timestamp: Date
  messageType: 'user' | 'character'
  emotionalTone?: 'positive' | 'negative' | 'neutral'
  intensity?: number
}

export interface ChatFormulaResult {
  effects: Array<{
    characteristicId: string
    change: number
    permanent: boolean
  }>
  message: string
  success: boolean
}

export class ChatFormulaSystem {
  private formulaSystem: FormulaSystem
  private characteristicsSystem: CharacteristicsSystem

  constructor() {
    this.formulaSystem = new FormulaSystem()
    this.characteristicsSystem = new CharacteristicsSystem()
  }

  // Обрабатывает сообщение пользователя и применяет формулы
  async processUserMessage(
    message: ChatMessage,
    characterId: string,
    userId: string
  ): Promise<ChatFormulaResult> {
    try {
      // Анализируем тон сообщения
      const emotionalTone = this.analyzeMessageTone(message.content)
      const intensity = this.calculateMessageIntensity(message.content)

      // Создаем контекст для формулы
      const context: FormulaExecutionContext = {
        character: {
          id: characterId,
          characteristics: await this.getCharacterCharacteristics(characterId)
        },
        user: {
          id: userId,
          modifiers: {
            general: 1.0
          }
        },
        message: {
          content: message.content,
          length: message.content.length,
          emotionalTone,
          intensity,
          negativeIntensity: emotionalTone === 'negative' ? intensity : 0
        },
        system: {
          gameTime: {
            current: new Date(),
            gameTime: 0
          }
        }
      }

      // Выбираем формулу в зависимости от тона
      const formula = this.getChatFormula(emotionalTone)

      if (!formula) {
        return {
          effects: [],
          message: 'Сообщение не оказало влияния на персонажа',
          success: true
        }
      }

      // Выполняем формулу
      const result = await this.formulaSystem.executeFormula(formula, context)

      // Преобразуем результат в эффекты
      const effects = this.convertFormulaResultToEffects(result, characterId)

      // Применяем эффекты к характеристикам
      for (const effect of effects) {
        await this.characteristicsSystem.changeValue(
          characterId,
          effect.characteristicId,
          effect.change,
          effect.permanent
        )
      }

      // Генерируем ответное сообщение
      const responseMessage = this.generateResponseMessage(emotionalTone, effects)

      return {
        effects,
        message: responseMessage,
        success: true
      }

    } catch (error) {
      console.error('Ошибка обработки сообщения чата:', error)
      return {
        effects: [],
        message: 'Произошла ошибка при обработке сообщения',
        success: false
      }
    }
  }

  // Анализирует тон сообщения
  private analyzeMessageTone(content: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'хорошо', 'отлично', 'прекрасно', 'замечательно', 'люблю', 'нравится',
      'спасибо', 'благодарю', 'похвала', 'горжусь', 'восхищаюсь', 'обожаю',
      'нежность', 'забота', 'поддержка', 'понимание', 'принятие', 'одобрение'
    ]

    const negativeWords = [
      'плохо', 'ужасно', 'отвратительно', 'ненавижу', 'не нравится', 'злой',
      'грубость', 'оскорбление', 'унижение', 'насмешка', 'критика', 'недовольство',
      'разочарование', 'злость', 'ярость', 'презрение', 'отвращение', 'страх'
    ]

    const lowerContent = content.toLowerCase()

    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  // Вычисляет интенсивность сообщения
  private calculateMessageIntensity(content: string): number {
    // Базовая интенсивность на основе длины сообщения
    let intensity = Math.min(content.length / 50, 2.0) // Максимум 2.0

    // Увеличиваем интенсивность для восклицательных знаков
    const exclamationCount = (content.match(/!/g) || []).length
    intensity += exclamationCount * 0.2

    // Увеличиваем интенсивность для заглавных букв
    const upperCaseCount = (content.match(/[А-Я]/g) || []).length
    intensity += upperCaseCount * 0.1

    return Math.min(intensity, 3.0) // Максимум 3.0
  }

  // Получает характеристики персонажа
  private async getCharacterCharacteristics(characterId: string): Promise<Record<string, number>> {
    // Здесь нужно получить все характеристики персонажа
    // Пока возвращаем заглушку
    return {
      mood: 50,
      trust: 50,
      arousal: 30,
      fear: 20,
      stress: 30
    }
  }

  // Выбирает формулу в зависимости от тона сообщения
  private getChatFormula(tone: 'positive' | 'negative' | 'neutral'): any {
    switch (tone) {
      case 'positive':
        return this.getPositiveChatFormula()
      case 'negative':
        return this.getNegativeChatFormula()
      default:
        return null
    }
  }

  // Формула для позитивных сообщений
  private getPositiveChatFormula(): any {
    return {
      id: 'chat_positive_formula',
      name: 'Формула позитивного чата',
      description: 'Влияние позитивных сообщений на характеристики персонажа',
      rootNode: {
        id: 'chat_positive_root',
        type: 'value',
        dataType: 'object',
        value: {
          'Настроение': {
            change: {
              id: 'chat_mood_change',
              type: 'operator',
              operator: 'multiply',
              dataType: 'number',
              leftInput: {
                id: 'chat_base_mood',
                type: 'value',
                dataType: 'number',
                value: 3
              },
              rightInput: {
                id: 'chat_message_length_factor',
                type: 'operator',
                operator: 'divide',
                dataType: 'number',
                leftInput: {
                  id: 'chat_message_length',
                  type: 'variable',
                  variablePath: 'message.length',
                  dataType: 'number'
                },
                rightInput: {
                  id: 'chat_length_divisor',
                  type: 'value',
                  dataType: 'number',
                  value: 50
                }
              }
            },
            permanent: {
              id: 'chat_mood_permanent',
              type: 'value',
              dataType: 'boolean',
              value: false
            }
          },
          'Доверие': {
            change: {
              id: 'chat_trust_change',
              type: 'value',
              dataType: 'number',
              value: 1
            },
            permanent: {
              id: 'chat_trust_permanent',
              type: 'value',
              dataType: 'boolean',
              value: false
            }
          }
        }
      },
      version: '2.0',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // Формула для негативных сообщений
  private getNegativeChatFormula(): any {
    return {
      id: 'chat_negative_formula',
      name: 'Формула негативного чата',
      description: 'Влияние негативных сообщений на характеристики персонажа',
      rootNode: {
        id: 'chat_negative_root',
        type: 'value',
        dataType: 'object',
        value: {
          'Настроение': {
            change: {
              id: 'chat_negative_mood_change',
              type: 'operator',
              operator: 'multiply',
              dataType: 'number',
              leftInput: {
                id: 'chat_negative_base',
                type: 'value',
                dataType: 'number',
                value: -2
              },
              rightInput: {
                id: 'chat_negative_intensity',
                type: 'variable',
                variablePath: 'message.negativeIntensity',
                dataType: 'number'
              }
            },
            permanent: {
              id: 'chat_negative_mood_permanent',
              type: 'value',
              dataType: 'boolean',
              value: false
            }
          },
          'Страх': {
            change: {
              id: 'chat_fear_change',
              type: 'value',
              dataType: 'number',
              value: 2
            },
            permanent: {
              id: 'chat_fear_permanent',
              type: 'value',
              dataType: 'boolean',
              value: false
            }
          }
        }
      },
      version: '2.0',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // Преобразует результат формулы в эффекты
  private convertFormulaResultToEffects(result: any, characterId: string): Array<{
    characteristicId: string
    change: number
    permanent: boolean
  }> {
    const effects: Array<{
      characteristicId: string
      change: number
      permanent: boolean
    }> = []

    if (result.value && typeof result.value === 'object') {
      for (const [characteristicName, effectData] of Object.entries(result.value)) {
        if (typeof effectData === 'object' && effectData !== null && 'change' in effectData) {
          const effect = effectData as { change: any; permanent: any }

          // Вычисляем изменение (если это формула, нужно выполнить ее)
          let change = 0
          if (typeof effect.change === 'number') {
            change = effect.change
          } else if (effect.change && typeof effect.change === 'object') {
            // Это формула, нужно вычислить ее значение
            change = this.evaluateSimpleFormula(effect.change)
          }

          effects.push({
            characteristicId: characteristicName,
            change,
            permanent: effect.permanent?.value || false
          })
        }
      }
    }

    return effects
  }

  // Вычисляет простую формулу (для вложенных формул)
  private evaluateSimpleFormula(formula: any): number {
    if (typeof formula === 'number') return formula
    if (typeof formula === 'object' && formula !== null) {
      if (formula.type === 'value') return formula.value || 0
      if (formula.type === 'operator') {
        const left = this.evaluateSimpleFormula(formula.leftInput)
        const right = this.evaluateSimpleFormula(formula.rightInput)

        switch (formula.operator) {
          case 'multiply': return left * right
          case 'divide': return right !== 0 ? left / right : 0
          case 'add': return left + right
          case 'subtract': return left - right
          default: return 0
        }
      }
    }
    return 0
  }

  // Генерирует ответное сообщение
  private generateResponseMessage(
    tone: 'positive' | 'negative' | 'neutral',
    effects: Array<{ characteristicId: string; change: number; permanent: boolean }>
  ): string {
    if (tone === 'positive') {
      return 'Ваши слова согревают мне душу... Я чувствую, как мое настроение улучшается.'
    } else if (tone === 'negative') {
      return 'Ваши слова причиняют мне боль... Я чувствую, как мое настроение ухудшается.'
    }

    return 'Я понимаю ваше сообщение.'
  }
}
