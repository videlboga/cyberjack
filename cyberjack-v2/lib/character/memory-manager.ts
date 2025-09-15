// lib/character/memory-manager.ts

import { prisma } from '@/lib/db/client'
import {
  MemoryManager,
  MemoryItem,
  MemoryType,
  MemoryStats,
  MemoryContext
} from '@/types/character-ai'

export class CharacterMemoryManager implements MemoryManager {
  private readonly MAX_MEMORY_ITEMS = 1000
  private readonly MEMORY_RETENTION_DAYS = 30
  private readonly SHORT_TERM_THRESHOLD_HOURS = 24
  private readonly LONG_TERM_THRESHOLD_DAYS = 7

  // Добавление воспоминания
  async addMemory(
    characterId: string,
    memory: Omit<MemoryItem, 'id' | 'timestamp'>
  ): Promise<MemoryItem> {
    const memoryItem: MemoryItem = {
      id: this.generateId(),
      ...memory,
      timestamp: new Date()
    }

    // Сохраняем в базе данных
    await this.saveMemoryToDatabase(characterId, memoryItem)

    // Обновляем кэш
    await this.updateMemoryCache(characterId, memoryItem)

    return memoryItem
  }

  // Получение воспоминаний
  async getMemory(
    characterId: string,
    type?: MemoryType,
    limit: number = 50
  ): Promise<MemoryItem[]> {
    const memories = await this.getMemoriesFromDatabase(characterId, type, limit)
    return this.sortMemoriesByRelevance(memories)
  }

  // Обновление воспоминания
  async updateMemory(
    memoryId: string,
    updates: Partial<MemoryItem>
  ): Promise<MemoryItem> {
    const existingMemory = await this.getMemoryById(memoryId)
    if (!existingMemory) {
      throw new Error('Воспоминание не найдено')
    }

    const updatedMemory: MemoryItem = {
      ...existingMemory,
      ...updates,
      timestamp: existingMemory.timestamp // Сохраняем оригинальную дату
    }

    await this.updateMemoryInDatabase(memoryId, updatedMemory)
    return updatedMemory
  }

  // Удаление воспоминания
  async deleteMemory(memoryId: string): Promise<void> {
    await this.deleteMemoryFromDatabase(memoryId)
  }

  // Получение контекстуальных воспоминаний
  async getContextualMemory(
    characterId: string,
    context: string
  ): Promise<MemoryItem[]> {
    const memories = await this.getMemoriesFromDatabase(characterId)

    // Фильтруем по контексту и тегам
    const contextualMemories = memories.filter(memory =>
      memory.context.toLowerCase().includes(context.toLowerCase()) ||
      memory.tags.some(tag => tag.toLowerCase().includes(context.toLowerCase()))
    )

    return this.sortMemoriesByRelevance(contextualMemories, 20)
  }

  // Получение эмоциональных воспоминаний
  async getEmotionalMemory(
    characterId: string,
    emotion: string
  ): Promise<MemoryItem[]> {
    const memories = await this.getMemoriesFromDatabase(characterId, MemoryType.EMOTION)

    const emotionalMemories = memories.filter(memory =>
      memory.content.toLowerCase().includes(emotion.toLowerCase()) ||
      memory.tags.some(tag => tag.toLowerCase().includes(emotion.toLowerCase()))
    )

    return this.sortMemoriesByRelevance(emotionalMemories, 15)
  }

  // Очистка старых воспоминаний
  async cleanupOldMemory(
    characterId: string,
    daysOld: number = this.MEMORY_RETENTION_DAYS
  ): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const deletedCount = await this.deleteOldMemoriesFromDatabase(characterId, cutoffDate)

    // Обновляем кэш
    await this.refreshMemoryCache(characterId)

    return deletedCount
  }

  // Получение статистики памяти
  async getMemoryStats(characterId: string): Promise<MemoryStats> {
    const memories = await this.getMemoriesFromDatabase(characterId)

    const stats: MemoryStats = {
      totalMemories: memories.length,
      shortTermCount: 0,
      longTermCount: 0,
      contextualCount: 0,
      emotionalCount: 0,
      recentCount: 0,
      averageImportance: 0,
      averageEmotionalWeight: 0,
      mostCommonTags: [],
      memoryDistribution: {} as Record<MemoryType, number>
    }

    // Инициализируем распределение по типам
    Object.values(MemoryType).forEach(type => {
      stats.memoryDistribution[type] = 0
    })

    // Подсчитываем статистику
    let totalImportance = 0
    let totalEmotionalWeight = 0
    const tagCounts: Record<string, number> = {}
    const now = new Date()

    memories.forEach(memory => {
      // Классификация по времени
      const hoursDiff = (now.getTime() - memory.timestamp.getTime()) / (1000 * 60 * 60)
      const daysDiff = hoursDiff / 24

      if (hoursDiff <= this.SHORT_TERM_THRESHOLD_HOURS) {
        stats.shortTermCount++
      }
      if (daysDiff >= this.LONG_TERM_THRESHOLD_DAYS) {
        stats.longTermCount++
      }
      if (memory.type === MemoryType.EMOTION) {
        stats.emotionalCount++
      }
      if (memory.context) {
        stats.contextualCount++
      }
      if (hoursDiff <= 1) {
        stats.recentCount++
      }

      // Распределение по типам
      stats.memoryDistribution[memory.type]++

      // Подсчет важности и эмоционального веса
      totalImportance += memory.importance
      totalEmotionalWeight += memory.emotionalWeight

      // Подсчет тегов
      memory.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })

    // Вычисляем средние значения
    if (memories.length > 0) {
      stats.averageImportance = totalImportance / memories.length
      stats.averageEmotionalWeight = totalEmotionalWeight / memories.length
    }

    // Находим самые частые теги
    stats.mostCommonTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    return stats
  }

  // Получение контекста памяти для промпта
  async getMemoryContext(characterId: string): Promise<MemoryContext> {
    const memories = await this.getMemoriesFromDatabase(characterId)
    const now = new Date()

    const context: MemoryContext = {
      shortTerm: [],
      longTerm: [],
      contextual: [],
      emotional: [],
      recent: []
    }

    memories.forEach(memory => {
      const hoursDiff = (now.getTime() - memory.timestamp.getTime()) / (1000 * 60 * 60)
      const daysDiff = hoursDiff / 24

      // Классификация по времени
      if (hoursDiff <= this.SHORT_TERM_THRESHOLD_HOURS) {
        context.shortTerm.push(memory)
      }
      if (daysDiff >= this.LONG_TERM_THRESHOLD_DAYS) {
        context.longTerm.push(memory)
      }
      if (hoursDiff <= 1) {
        context.recent.push(memory)
      }

      // Классификация по типу
      if (memory.type === MemoryType.EMOTION) {
        context.emotional.push(memory)
      }
      if (memory.context) {
        context.contextual.push(memory)
      }
    })

    // Сортируем по релевантности
    context.shortTerm = this.sortMemoriesByRelevance(context.shortTerm, 10)
    context.longTerm = this.sortMemoriesByRelevance(context.longTerm, 15)
    context.contextual = this.sortMemoriesByRelevance(context.contextual, 10)
    context.emotional = this.sortMemoriesByRelevance(context.emotional, 8)
    context.recent = this.sortMemoriesByRelevance(context.recent, 5)

    return context
  }

  // Сортировка воспоминаний по релевантности
  private sortMemoriesByRelevance(
    memories: MemoryItem[],
    limit?: number
  ): MemoryItem[] {
    const sorted = memories.sort((a, b) => {
      // Сначала по важности
      if (a.importance !== b.importance) {
        return b.importance - a.importance
      }

      // Затем по эмоциональному весу
      if (a.emotionalWeight !== b.emotionalWeight) {
        return b.emotionalWeight - a.emotionalWeight
      }

      // Наконец по времени (более новые сначала)
      return b.timestamp.getTime() - a.timestamp.getTime()
    })

    return limit ? sorted.slice(0, limit) : sorted
  }

  // Генерация ID
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Сохранение в базе данных
  private async saveMemoryToDatabase(characterId: string, memory: MemoryItem): Promise<void> {
    // Сохраняем в поле prompts персонажа как JSON
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { prompts: true }
    })

    if (!character) {
      throw new Error('Персонаж не найден')
    }

    const prompts = character.prompts as any || {}
    if (!prompts.memories) {
      prompts.memories = []
    }

    prompts.memories.push(memory)

    // Ограничиваем количество воспоминаний
    if (prompts.memories.length > this.MAX_MEMORY_ITEMS) {
      prompts.memories = prompts.memories
        .sort((a: MemoryItem, b: MemoryItem) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, this.MAX_MEMORY_ITEMS)
    }

    await prisma.character.update({
      where: { id: characterId },
      data: { prompts }
    })
  }

  // Получение из базы данных
  private async getMemoriesFromDatabase(
    characterId: string,
    type?: MemoryType,
    limit?: number
  ): Promise<MemoryItem[]> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { prompts: true }
    })

    if (!character) {
      return []
    }

    const prompts = character.prompts as any || {}
    let memories: MemoryItem[] = prompts.memories || []

    // Фильтруем по типу
    if (type) {
      memories = memories.filter((memory: MemoryItem) => memory.type === type)
    }

    // Фильтруем активные воспоминания
    memories = memories.filter((memory: MemoryItem) => memory.isActive)

    // Сортируем по времени
    memories.sort((a: MemoryItem, b: MemoryItem) => b.timestamp.getTime() - a.timestamp.getTime())

    // Ограничиваем количество
    if (limit) {
      memories = memories.slice(0, limit)
    }

    return memories
  }

  // Обновление в базе данных
  private async updateMemoryInDatabase(memoryId: string, memory: MemoryItem): Promise<void> {
    // Находим персонажа с этим воспоминанием
    const characters = await prisma.character.findMany({
      select: { id: true, prompts: true }
    })

    for (const character of characters) {
      const prompts = character.prompts as any || {}
      if (prompts.memories) {
        const memoryIndex = prompts.memories.findIndex((m: MemoryItem) => m.id === memoryId)
        if (memoryIndex !== -1) {
          prompts.memories[memoryIndex] = memory
          await prisma.character.update({
            where: { id: character.id },
            data: { prompts }
          })
          return
        }
      }
    }

    throw new Error('Воспоминание не найдено')
  }

  // Удаление из базы данных
  private async deleteMemoryFromDatabase(memoryId: string): Promise<void> {
    const characters = await prisma.character.findMany({
      select: { id: true, prompts: true }
    })

    for (const character of characters) {
      const prompts = character.prompts as any || {}
      if (prompts.memories) {
        const initialLength = prompts.memories.length
        prompts.memories = prompts.memories.filter((m: MemoryItem) => m.id !== memoryId)

        if (prompts.memories.length < initialLength) {
          await prisma.character.update({
            where: { id: character.id },
            data: { prompts }
          })
          return
        }
      }
    }

    throw new Error('Воспоминание не найдено')
  }

  // Получение воспоминания по ID
  private async getMemoryById(memoryId: string): Promise<MemoryItem | null> {
    const characters = await prisma.character.findMany({
      select: { prompts: true }
    })

    for (const character of characters) {
      const prompts = character.prompts as any || {}
      if (prompts.memories) {
        const memory = prompts.memories.find((m: MemoryItem) => m.id === memoryId)
        if (memory) {
          return memory
        }
      }
    }

    return null
  }

  // Удаление старых воспоминаний
  private async deleteOldMemoriesFromDatabase(
    characterId: string,
    cutoffDate: Date
  ): Promise<number> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { prompts: true }
    })

    if (!character) {
      return 0
    }

    const prompts = character.prompts as any || {}
    if (!prompts.memories) {
      return 0
    }

    const initialLength = prompts.memories.length
    prompts.memories = prompts.memories.filter((memory: MemoryItem) => {
      return memory.timestamp > cutoffDate || memory.importance >= 8 // Сохраняем очень важные воспоминания
    })

    const deletedCount = initialLength - prompts.memories.length

    if (deletedCount > 0) {
      await prisma.character.update({
        where: { id: characterId },
        data: { prompts }
      })
    }

    return deletedCount
  }

  // Обновление кэша памяти
  private async updateMemoryCache(characterId: string, memory: MemoryItem): Promise<void> {
    // Здесь можно добавить логику кэширования в Redis или другом хранилище
    // Пока просто логируем
    console.log(`Memory cache updated for character ${characterId}: ${memory.id}`)
  }

  // Обновление кэша памяти
  private async refreshMemoryCache(characterId: string): Promise<void> {
    // Здесь можно добавить логику обновления кэша
    console.log(`Memory cache refreshed for character ${characterId}`)
  }

  // Создание воспоминания о взаимодействии
  async createInteractionMemory(
    characterId: string,
    userMessage: string,
    aiResponse: string,
    context: string
  ): Promise<MemoryItem> {
    return this.addMemory(characterId, {
      type: MemoryType.INTERACTION,
      content: `Пользователь: "${userMessage}" | Ответ: "${aiResponse}"`,
      importance: 5,
      tags: ['взаимодействие', 'чат'],
      emotionalWeight: 3,
      context,
      isActive: true
    })
  }

  // Создание эмоционального воспоминания
  async createEmotionalMemory(
    characterId: string,
    emotion: string,
    trigger: string,
    intensity: number
  ): Promise<MemoryItem> {
    return this.addMemory(characterId, {
      type: MemoryType.EMOTION,
      content: `Эмоция: ${emotion} | Триггер: ${trigger}`,
      importance: Math.min(10, intensity),
      tags: ['эмоция', emotion.toLowerCase()],
      emotionalWeight: intensity,
      context: trigger,
      isActive: true
    })
  }

  // Создание воспоминания об изменении характеристики
  async createCharacteristicChangeMemory(
    characterId: string,
    characteristicName: string,
    oldValue: number,
    newValue: number,
    reason: string
  ): Promise<MemoryItem> {
    const change = newValue - oldValue
    const importance = Math.min(10, Math.abs(change) / 10 + 3)

    return this.addMemory(characterId, {
      type: MemoryType.CHARACTERISTIC_CHANGE,
      content: `${characteristicName}: ${oldValue} → ${newValue} (${change > 0 ? '+' : ''}${change})`,
      importance,
      tags: ['характеристика', characteristicName.toLowerCase()],
      emotionalWeight: Math.abs(change) / 20,
      context: reason,
      isActive: true
    })
  }
}
