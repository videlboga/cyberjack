// Система памяти для персонажей

import { Character, CharacterMemory, MemoryEntry, SummaryEntry, EpisodicMemory, MemoryType } from './types'

export class MemoryManager {
  private maxShortTerm = 20
  private maxLongTerm = 100
  private summaryInterval = 10

  /**
   * Добавляет новую запись в память персонажа
   */
  async addMemory(character: Character, memory: MemoryEntry): Promise<void> {
    // Добавляем в краткосрочную память
    character.memory.shortTerm.push(memory)
    
    // Ограничиваем размер краткосрочной памяти
    if (character.memory.shortTerm.length > this.maxShortTerm) {
      character.memory.shortTerm = character.memory.shortTerm.slice(-this.maxShortTerm)
    }
    
    // Проверяем, нужно ли создать саммари
    if (character.memory.shortTerm.length % this.summaryInterval === 0) {
      await this.createSummary(character)
    }
    
    // Проверяем важность для долгосрочной памяти
    if (memory.importance > 0.7) {
      await this.addToLongTermMemory(character, memory)
    }
    
    // Обновляем счетчик взаимодействий
    character.totalInteractions++
    character.lastInteraction = new Date().toISOString()
  }

  /**
   * Получает релевантные воспоминания для запроса
   */
  async getRelevantMemories(
    character: Character, 
    query: string, 
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    const allMemories = [
      ...character.memory.shortTerm,
      ...character.memory.longTerm
    ]
    
    // Простой поиск по ключевым словам (в будущем можно заменить на векторный поиск)
    const relevantMemories = allMemories.filter(memory => {
      const queryLower = query.toLowerCase()
      const contentLower = memory.content.toLowerCase()
      
      // Поиск по содержимому
      if (contentLower.includes(queryLower)) {
        return true
      }
      
      // Поиск по тегам
      if (memory.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
        return true
      }
      
      return false
    })
    
    // Сортируем по важности и времени
    relevantMemories.sort((a, b) => {
      const importanceDiff = b.importance - a.importance
      if (importanceDiff !== 0) return importanceDiff
      
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    
    return relevantMemories.slice(0, limit)
  }

  /**
   * Создает саммари из краткосрочной памяти
   */
  async createSummary(character: Character): Promise<SummaryEntry> {
    const recentMemories = character.memory.shortTerm.slice(-this.summaryInterval)
    
    if (recentMemories.length === 0) {
      throw new Error('Нет воспоминаний для создания саммари')
    }
    
    const summary: SummaryEntry = {
      id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: this.generateSummaryContent(recentMemories),
      timestamp: new Date().toISOString(),
      period: `${recentMemories[0].timestamp} - ${recentMemories[recentMemories.length - 1].timestamp}`,
      interactionsCount: recentMemories.length
    }
    
    character.memory.summaries.push(summary)
    
    // Ограничиваем количество саммари
    if (character.memory.summaries.length > 10) {
      character.memory.summaries = character.memory.summaries.slice(-10)
    }
    
    return summary
  }

  /**
   * Очищает старые воспоминания
   */
  async cleanupOldMemories(character: Character): Promise<void> {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    // Очищаем краткосрочную память старше недели
    character.memory.shortTerm = character.memory.shortTerm.filter(memory => 
      new Date(memory.timestamp) > oneWeekAgo
    )
    
    // Ограничиваем долгосрочную память
    if (character.memory.longTerm.length > this.maxLongTerm) {
      character.memory.longTerm = character.memory.longTerm
        .sort((a, b) => b.importance - a.importance)
        .slice(0, this.maxLongTerm)
    }
  }

  /**
   * Вычисляет важность воспоминания
   */
  async calculateImportance(memory: MemoryEntry): Promise<number> {
    let importance = 0.5 // Базовая важность
    
    // Учитываем эмоциональное воздействие
    importance += Math.abs(memory.emotionalImpact) * 0.3
    
    // Учитываем тип воспоминания
    switch (memory.type) {
      case MemoryType.TRAUMA:
        importance += 0.4
        break
      case MemoryType.PLEASURE:
        importance += 0.3
        break
      case MemoryType.FETISH:
        importance += 0.2
        break
      case MemoryType.EMOTION:
        importance += 0.1
        break
    }
    
    // Учитываем теги
    if (memory.tags.includes('важное')) importance += 0.2
    if (memory.tags.includes('критическое')) importance += 0.3
    
    return Math.min(importance, 1.0)
  }

  /**
   * Добавляет воспоминание в долгосрочную память
   */
  private async addToLongTermMemory(character: Character, memory: MemoryEntry): Promise<void> {
    // Проверяем, нет ли уже похожего воспоминания
    const similarMemory = character.memory.longTerm.find(existing => 
      existing.content.toLowerCase().includes(memory.content.toLowerCase().split(' ')[0]) ||
      existing.tags.some(tag => memory.tags.includes(tag))
    )
    
    if (!similarMemory) {
      character.memory.longTerm.push(memory)
    } else {
      // Обновляем важность существующего воспоминания
      similarMemory.importance = Math.max(similarMemory.importance, memory.importance)
      similarMemory.emotionalImpact = (similarMemory.emotionalImpact + memory.emotionalImpact) / 2
    }
  }

  /**
   * Генерирует содержимое саммари
   */
  private generateSummaryContent(memories: MemoryEntry[]): string {
    const interactions = memories.filter(m => m.type === MemoryType.INTERACTION).length
    const emotions = memories.filter(m => m.type === MemoryType.EMOTION).length
    const fetishes = memories.filter(m => m.type === MemoryType.FETISH).length
    
    const summary = []
    
    if (interactions > 0) {
      summary.push(`${interactions} взаимодействий`)
    }
    
    if (emotions > 0) {
      summary.push(`${emotions} эмоциональных событий`)
    }
    
    if (fetishes > 0) {
      summary.push(`${fetishes} активаций фетишей`)
    }
    
    const avgEmotionalImpact = memories.reduce((sum, m) => sum + m.emotionalImpact, 0) / memories.length
    
    if (Math.abs(avgEmotionalImpact) > 0.3) {
      summary.push(`Общий эмоциональный тон: ${avgEmotionalImpact > 0 ? 'положительный' : 'отрицательный'}`)
    }
    
    return summary.join(', ')
  }

  /**
   * Получает контекст для AI (последние воспоминания + важные)
   */
  async getContextForAI(character: Character, query?: string): Promise<string> {
    const recentMemories = character.memory.shortTerm.slice(-5)
    const importantMemories = character.memory.longTerm
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3)
    
    let context = 'ПОСЛЕДНИЕ ВОСПОМИНАНИЯ:\n'
    recentMemories.forEach(memory => {
      context += `- ${memory.content}\n`
    })
    
    if (importantMemories.length > 0) {
      context += '\nВАЖНЫЕ ВОСПОМИНАНИЯ:\n'
      importantMemories.forEach(memory => {
        context += `- ${memory.content}\n`
      })
    }
    
    if (character.memory.summaries.length > 0) {
      const latestSummary = character.memory.summaries[character.memory.summaries.length - 1]
      context += `\nПОСЛЕДНЕЕ САММАРИ: ${latestSummary.content}\n`
    }
    
    return context
  }

  /**
   * Добавляет эпизодическое воспоминание
   */
  async addEpisodicMemory(
    character: Character,
    content: string,
    category: string,
    subcategory: string,
    emotionalWeight: number = 0.5
  ): Promise<void> {
    const episodicMemory: EpisodicMemory = {
      id: `episodic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      category,
      subcategory,
      emotionalWeight,
      contextTags: [],
      created_at: new Date().toISOString()
    }
    
    character.memory.episodic.push(episodicMemory)
    
    // Ограничиваем количество эпизодических воспоминаний
    if (character.memory.episodic.length > 50) {
      character.memory.episodic = character.memory.episodic
        .sort((a, b) => b.emotionalWeight - a.emotionalWeight)
        .slice(0, 50)
    }
  }
}
