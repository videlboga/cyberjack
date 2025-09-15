/**
 * Простая система чата с анализом тональности
 */

import { SimpleEffectsSystem, SimpleActionEffects } from '../actions/simple-effects-system'
import { prisma } from '../../db/client'

export interface ChatMessage {
  content: string
  senderId: string
  characterId: string
  emotionalTone?: string
}

export class SimpleChatSystem {
  private effectsSystem: SimpleEffectsSystem

  constructor() {
    this.effectsSystem = new SimpleEffectsSystem()
  }

  /**
   * Анализирует тональность сообщения (упрощенный анализ)
   */
  analyzeEmotionalTone(content: string): string {
    const text = content.toLowerCase()

    // Положительные слова
    const positiveWords = ['хорошо', 'отлично', 'прекрасно', 'люблю', 'нравится', 'спасибо', 'благодарю']
    // Негативные слова
    const negativeWords = ['плохо', 'ужасно', 'ненавижу', 'не нравится', 'противный', 'отвратительно']
    // Доминирующие слова
    const dominantWords = ['приказываю', 'требую', 'должна', 'обязана', 'подчиняйся', 'слушайся']
    // Покорные слова
    const submissiveWords = ['да', 'слушаюсь', 'подчиняюсь', 'готова', 'хочу угодить']
    // Сексуальные слова
    const sexualWords = ['секс', 'возбуждаю', 'хочу тебя', 'страсть', 'желание']
    // Унижающие слова
    const humiliatingWords = ['шлюха', 'сука', 'рабыня', 'ничтожество', 'грязь']

    let positiveCount = 0
    let negativeCount = 0
    let dominantCount = 0
    let submissiveCount = 0
    let sexualCount = 0
    let humiliatingCount = 0

    // Подсчитываем слова
    positiveWords.forEach(word => {
      if (text.includes(word)) positiveCount++
    })
    negativeWords.forEach(word => {
      if (text.includes(word)) negativeCount++
    })
    dominantWords.forEach(word => {
      if (text.includes(word)) dominantCount++
    })
    submissiveWords.forEach(word => {
      if (text.includes(word)) submissiveCount++
    })
    sexualWords.forEach(word => {
      if (text.includes(word)) sexualCount++
    })
    humiliatingWords.forEach(word => {
      if (text.includes(word)) humiliatingCount++
    })

    // Определяем доминирующую тональность
    const counts = {
      positive: positiveCount,
      negative: negativeCount,
      dominant: dominantCount,
      submissive: submissiveCount,
      sexual: sexualCount,
      humiliating: humiliatingCount
    }

    const maxCount = Math.max(...Object.values(counts))

    if (maxCount === 0) return 'neutral'

    // Возвращаем тональность с наибольшим количеством слов
    for (const [tone, count] of Object.entries(counts)) {
      if (count === maxCount) return tone
    }

    return 'neutral'
  }

  /**
   * Обрабатывает сообщение чата и применяет эффекты
   */
  async processChatMessage(message: ChatMessage): Promise<{
    emotionalTone: string
    effects: SimpleActionEffects
    applied: boolean
  }> {
    try {
      // Анализируем тональность
      const emotionalTone = this.analyzeEmotionalTone(message.content)

      // Вычисляем эффекты на основе тональности
      const effects = this.effectsSystem.calculateChatEffects(emotionalTone)

      // Применяем эффекты к персонажу
      await this.applyEffectsToCharacter(message.characterId, effects)

      // Сохраняем сообщение в базу данных
      await prisma.chatMessage.create({
        data: {
          content: message.content,
          senderId: message.senderId,
          characterId: message.characterId,
          emotionalTone: emotionalTone,
          messageType: 'user'
        }
      })

      return {
        emotionalTone,
        effects,
        applied: true
      }
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения чата:', error)
      return {
        emotionalTone: 'neutral',
        effects: {},
        applied: false
      }
    }
  }

  /**
   * Применяет эффекты к характеристикам персонажа
   */
  private async applyEffectsToCharacter(
    characterId: string,
    effects: SimpleActionEffects
  ): Promise<void> {
    for (const [characteristicName, effect] of Object.entries(effects)) {
      try {
        // Находим характеристику по имени
        const characteristic = await prisma.characteristic.findFirst({
          where: {
            characterId: characterId,
            definition: {
              name: characteristicName
            }
          },
          include: {
            definition: true
          }
        })

        if (!characteristic) {
          console.log(`⚠️ Характеристика "${characteristicName}" не найдена для персонажа ${characterId}`)
          continue
        }

        // Вычисляем новое значение
        let newValue = characteristic.currentValue + effect.change

        // Ограничиваем значения в пределах 0-100
        newValue = Math.max(0, Math.min(100, newValue))

        // Обновляем характеристику
        await prisma.characteristic.update({
          where: { id: characteristic.id },
          data: {
            currentValue: newValue,
            // Если эффект постоянный, обновляем базовое значение
            ...(effect.permanent && {
              baseValue: newValue
            })
          }
        })

        console.log(`💬 Чат: ${characteristicName}: ${characteristic.currentValue} → ${newValue} (${effect.change > 0 ? '+' : ''}${effect.change})`)
      } catch (error) {
        console.error(`❌ Ошибка обновления характеристики "${characteristicName}":`, error)
      }
    }
  }

  /**
   * Получает историю сообщений персонажа
   */
  async getChatHistory(characterId: string, limit: number = 50): Promise<any[]> {
    try {
      const messages = await prisma.chatMessage.findMany({
        where: { characterId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          sender: {
            select: { name: true }
          }
        }
      })

      return messages.reverse() // Возвращаем в хронологическом порядке
    } catch (error) {
      console.error('❌ Ошибка получения истории чата:', error)
      return []
    }
  }
}
