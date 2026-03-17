// Основной AI сервис для персонажей

import { 
  Character, 
  CharacterResponse, 
  MemoryEntry, 
  MemoryType,
  FetishAnalysis,
  FetishInfluence,
  CharacterFetish
} from '../unified-entities'
import { MemoryManager } from './memory'
import { StatsManager } from './stats'
import { FetishManager } from './fetishes'
import { ResponseManager } from './response'
import { 
  generateMainPrompt,
  generateImpactAnalysisPrompt,
  generateFetishAnalysisPrompt,
  generateFetishAwarePrompt,
  generateFetishInfluencePrompt,
  generateFetishAwareDialoguePrompt,
  generateEmotionalStatePrompt,
  generateSummaryPrompt,
  generateImportancePrompt
} from './prompts'

// Реальный LLM сервис с OpenRouter API
class OpenRouterLLMService {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor() {
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('⚠️ OPENROUTER_API_KEY не установлен. LLM API недоступен.')
    }
    this.apiKey = process.env.OPENROUTER_API_KEY || ""
    this.baseUrl = "https://openrouter.ai/api/v1"
    this.model = "z-ai/glm-4.5"
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      console.log('🤖 LLM Prompt:', prompt.substring(0, 200) + '...')
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3002',
          'X-Title': 'CyberJack AI Character System'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Ты - AI-система для NSFW игры с BDSM элементами. Отвечай на русском языке, будь креативным и соответствуй тематике игры.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.8
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || 'Извините, не могу ответить сейчас.'
      
      console.log('🤖 LLM Response:', content.substring(0, 200) + '...')
      return content
    } catch (error) {
      console.error('Ошибка LLM API:', error)
      // Fallback на простую логику
      return this.generateFallbackResponse(prompt)
    }
  }
  
  async generateJSONResponse(prompt: string): Promise<any> {
    try {
      const response = await this.generateResponse(prompt)
      // Пытаемся найти JSON в ответе
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return {}
    } catch (error) {
      console.error('Ошибка парсинга JSON:', error)
      return {}
    }
  }

  private generateFallbackResponse(prompt: string): string {
    // Простая логика для демонстрации при ошибках API
    if (prompt.includes('анализ воздействия')) {
      return JSON.stringify({
        threat: 0.0,
        pleasure: 0.3,
        pain: 0.0,
        fear: 0.1,
        arousal: 0.2
      })
    }
    
    if (prompt.includes('фетиши')) {
      return JSON.stringify({
        triggeredFetishes: [],
        overallArousal: 0.0
      })
    }
    
    if (prompt.includes('эмоциональное состояние')) {
      return 'спокойный'
    }
    
    // Базовый ответ персонажа
    return 'Привет! Как дела?'
  }
}

export class CharacterAIService {
  private llmService: OpenRouterLLMService
  private memoryManager: MemoryManager
  private statsManager: StatsManager
  private fetishManager: FetishManager
  private responseManager: ResponseManager

  constructor() {
    this.llmService = new OpenRouterLLMService()
    this.memoryManager = new MemoryManager()
    this.statsManager = new StatsManager()
    this.fetishManager = new FetishManager()
    this.responseManager = new ResponseManager()
  }

  /**
   * Анализирует взаимодействие и генерирует ответ персонажа
   */
  async analyzeInteraction(
    action: string, 
    context: any, 
    character: Character
  ): Promise<CharacterResponse> {
    console.log(`🎭 Анализ взаимодействия: ${action}`)
    
    // Используем новую систему реакций
    const response = await this.responseManager.createCharacterResponse(character, action, context)
    
    // Обновляем характеристики персонажа
    await this.updateStats(character, response.statChanges)
    
    // Обновляем фетиши
    await this.updateFetishes(character, action, response.response)
    
    // Добавляем в память
    await this.addMemory(character, {
      content: `Пользователь: ${action}`,
      type: MemoryType.INTERACTION,
      emotionalImpact: response.impactAnalysis.pleasure - response.impactAnalysis.pain
    })
    
    return response
  }



  /**
   * Обновляет характеристики персонажа
   */
  async updateStats(
    character: Character, 
    changes: Partial<Character['stats']>
  ): Promise<void> {
    this.statsManager.updateStats(character, changes)
  }

  /**
   * Добавляет запись в память персонажа
   */
  async addMemory(
    character: Character, 
    memory: Omit<MemoryEntry, 'id' | 'timestamp' | 'tags'>
  ): Promise<void> {
    const fullMemory: MemoryEntry = {
      ...memory,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tags: []
    }
    
    await this.memoryManager.addMemory(character, fullMemory)
  }



  /**
   * Генерирует ответ с учетом фетишей
   */
  async generateFetishAwareResponse(
    character: Character, 
    context: any, 
    triggeredFetishes: CharacterFetish[]
  ): Promise<string> {
    const prompt = generateFetishAwarePrompt(character, context.action || '', triggeredFetishes)
    return await this.llmService.generateResponse(prompt)
  }

  /**
   * Анализирует влияние фетишей на поведение персонажа
   */
  async analyzeFetishInfluence(
    character: Character,
    action: string,
    triggeredFetishes: CharacterFetish[]
  ): Promise<any> {
    const prompt = generateFetishInfluencePrompt(character, action, triggeredFetishes)
    return await this.llmService.generateJSONResponse(prompt)
  }

  /**
   * Генерирует фетиш-осведомленный диалог
   */
  async generateFetishAwareDialogue(
    character: Character,
    action: string,
    triggeredFetishes: CharacterFetish[],
    context: any = {}
  ): Promise<string> {
    const prompt = generateFetishAwareDialoguePrompt(character, action, triggeredFetishes, context)
    return await this.llmService.generateResponse(prompt)
  }

  /**
   * Создает полный фетиш-осведомленный ответ
   */
  async createFetishAwareResponse(
    character: Character,
    action: string,
    context: any = {}
  ): Promise<CharacterResponse> {
    // Анализируем фетиши
    const fetishAnalysis = await this.fetishManager.analyzeFetishImpact(action, character)
    
    // Если фетиши активированы, используем фетиш-осведомленный подход
    if (fetishAnalysis.triggeredFetishes.length > 0) {
      // Анализируем влияние фетишей
      const fetishInfluence = await this.analyzeFetishInfluence(
        character, 
        action, 
        fetishAnalysis.triggeredFetishes
      )
      
      // Генерируем фетиш-осведомленный ответ
      const response = await this.generateFetishAwareDialogue(
        character,
        action,
        fetishAnalysis.triggeredFetishes,
        context
      )
      
      // Анализируем воздействие
      const impactAnalysis = await this.responseManager.analyzeImpact(action, character, context)
      
      // Вычисляем изменения характеристик
      const statChanges = this.statsManager.calculateStatChanges(impactAnalysis, character.stats)
      
      return {
        impactAnalysis,
        fetishAnalysis,
        statChanges,
        response,
        emotionalState: 'возбужденный', // Фетиши обычно вызывают возбуждение
        fetishInfluence: {
          modifiesResponse: true,
          responseModifier: JSON.stringify(fetishInfluence),
          overallArousal: fetishAnalysis.overallArousal,
          dominantFetish: fetishAnalysis.dominantFetish
        }
      }
    }
    
    // Если фетиши не активированы, используем обычный подход
    return await this.responseManager.createCharacterResponse(character, action, context)
  }

  /**
   * Обновляет фетиши персонажа
   */
  async updateFetishes(
    character: Character, 
    action: string, 
    reaction: string
  ): Promise<void> {
    // Обновляем интенсивность активированных фетишей
    const triggeredFetishes = await this.fetishManager.analyzeTriggers(action, character)
    
    for (const fetish of triggeredFetishes) {
      const impact = this.calculateFetishImpact(action, reaction)
      await this.fetishManager.updateFetishIntensity(fetish, impact)
    }
  }

  /**
   * Вычисляет воздействие на фетиш
   */
  private calculateFetishImpact(action: string, reaction: string): number {
    // Простая логика: положительная реакция увеличивает интенсивность
    const positiveWords = ['да', 'хорошо', 'приятно', 'хочу', 'нравится']
    const negativeWords = ['нет', 'не хочу', 'больно', 'неприятно']
    
    const reactionLower = reaction.toLowerCase()
    
    if (positiveWords.some(word => reactionLower.includes(word))) {
      return 0.2
    }
    
    if (negativeWords.some(word => reactionLower.includes(word))) {
      return -0.1
    }
    
    return 0.0
  }

  /**
   * Получает релевантные воспоминания
   */
  async getRelevantMemories(
    character: Character, 
    query: string
  ): Promise<MemoryEntry[]> {
    return await this.memoryManager.getRelevantMemories(character, query)
  }

  /**
   * Создает саммари
   */
  async createSummary(character: Character): Promise<any> {
    return await this.memoryManager.createSummary(character)
  }

  /**
   * Обновляет эмоциональное состояние
   */
  async updateEmotionalState(character: Character): Promise<void> {
    const recentActions = character.memory.shortTerm
      .slice(-3)
      .map(m => m.content)
    
    const prompt = generateEmotionalStatePrompt(
      character,
      recentActions,
      { threat: 0, pleasure: 0, pain: 0, fear: 0, arousal: 0 }
    )
    
    const newState = await this.llmService.generateResponse(prompt)
    character.emotionalState = newState.trim()
  }






}
