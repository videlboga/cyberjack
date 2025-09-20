// types/character-ai.ts

// Типы для системы промптов Character AI

export interface PromptTemplate {
  id: string
  name: string
  description: string
  category: PromptCategory
  template: string
  variables: PromptVariable[]
  isActive: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
}

export enum PromptCategory {
  CHARACTER_DESCRIPTION = 'character_description',
  CHARACTERISTICS = 'characteristics',
  MEMORY = 'memory',
  CONTEXT = 'context',
  RESPONSE_STYLE = 'response_style',
  EMOTION = 'emotion',
  SITUATION = 'situation',
  INTERACTION = 'interaction'
}

export interface PromptVariable {
  name: string
  type: PromptVariableType
  required: boolean
  defaultValue?: string
  description: string
  validation?: PromptVariableValidation
}

export enum PromptVariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object'
}

export interface PromptVariableValidation {
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  enum?: string[]
}

export interface PromptContext {
  characterId: string
  userId: string
  message: string
  character: {
    id: string
    name: string
    description?: string
    age?: number
    avatar?: string
  }
  characteristics: CharacteristicContext[]
  memory: MemoryContext
  currentPose?: PoseContext
  lastAction?: ActionContext
  userModifiers: Record<string, number>
  gameTime: number
  sessionHistory: ChatMessage[]
  environment: EnvironmentContext
}

export interface CharacteristicContext {
  id: string
  name: string
  category: string
  currentValue: number
  baseValue: number
  isRevealed: boolean
  revealedValue?: number
  accuracy?: number
}

export interface MemoryContext {
  shortTerm: MemoryItem[]
  longTerm: MemoryItem[]
  contextual: MemoryItem[]
  emotional: MemoryItem[]
  recent: MemoryItem[]
}

export interface MemoryItem {
  id: string
  type: MemoryType
  content: string
  importance: number
  timestamp: Date
  tags: string[]
  emotionalWeight: number
  context: string
  isActive: boolean
}

export enum MemoryType {
  INTERACTION = 'interaction',
  EMOTION = 'emotion',
  ACTION = 'action',
  CHARACTERISTIC_CHANGE = 'characteristic_change',
  POSE_CHANGE = 'pose_change',
  USER_PREFERENCE = 'user_preference',
  ENVIRONMENT = 'environment',
  RELATIONSHIP = 'relationship'
}

export interface PoseContext {
  id: string
  name: string
  category: string
  description?: string
  currentAngle: string
  activeZones: ActiveZoneContext[]
}

export interface ActiveZoneContext {
  id: string
  name: string
  anatomyId?: string
  anatomyName?: string
  sensitivity: number
  isActive: boolean
}

export interface ActionContext {
  id: string
  name: string
  category: string
  intensity: number
  effects: ActionEffect[]
  timestamp: Date
}

export interface ActionEffect {
  characteristicId: string
  change: number
  permanent: boolean
  message: string
}

export interface ChatMessage {
  id: string
  characterId: string
  userId: string
  content: string
  timestamp: Date
  isUser: boolean
  metadata?: ChatMessageMetadata
}

export interface ChatMessageMetadata {
  emotion?: string
  intent?: string
  keywords?: string[]
  sentiment?: 'positive' | 'negative' | 'neutral'
  responseTime?: number
  quality?: number
}

export interface EnvironmentContext {
  timeOfDay: string
  location: string
  atmosphere: string
  temperature: string
  lighting: string
  sounds: string[]
  smells: string[]
}

export interface PromptBuilder {
  buildPrompt(context: PromptContext): Promise<string>
  addTemplate(template: PromptTemplate): void
  removeTemplate(templateId: string): void
  updateTemplate(templateId: string, updates: Partial<PromptTemplate>): void
  getTemplate(templateId: string): PromptTemplate | null
  getTemplatesByCategory(category: PromptCategory): PromptTemplate[]
}

export interface MemoryManager {
  addMemory(characterId: string, memory: Omit<MemoryItem, 'id' | 'timestamp'>): Promise<MemoryItem>
  getMemory(characterId: string, type?: MemoryType, limit?: number): Promise<MemoryItem[]>
  updateMemory(memoryId: string, updates: Partial<MemoryItem>): Promise<MemoryItem>
  deleteMemory(memoryId: string): Promise<void>
  getContextualMemory(characterId: string, context: string): Promise<MemoryItem[]>
  getEmotionalMemory(characterId: string, emotion: string): Promise<MemoryItem[]>
  cleanupOldMemory(characterId: string, daysOld: number): Promise<number>
  getMemoryStats(characterId: string): Promise<MemoryStats>
}

export interface MemoryStats {
  totalMemories: number
  shortTermCount: number
  longTermCount: number
  contextualCount: number
  emotionalCount: number
  recentCount: number
  averageImportance: number
  averageEmotionalWeight: number
  mostCommonTags: Array<{ tag: string; count: number }>
  memoryDistribution: Record<MemoryType, number>
}

export interface ResponseManager {
  generateResponse(
    characterId: string,
    userMessage: string,
    context: PromptContext
  ): Promise<AIResponse>
  analyzeResponse(response: string, context: PromptContext): Promise<ResponseAnalysis>
  validateResponse(response: string, context: PromptContext): Promise<ValidationResult>
  enhanceResponse(response: string, context: PromptContext): Promise<string>
  getResponseQuality(response: string, context: PromptContext): Promise<number>
}

export interface AIResponse {
  message: string
  characterId: string
  timestamp: Date
  metadata: AIResponseMetadata
}

export interface AIResponseMetadata {
  emotion: string
  intent: string
  keywords: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  responseTime: number
  quality: number
  confidence: number
  tokensUsed: number
  cost: number
}

export interface ResponseAnalysis {
  emotion: string
  intent: string
  keywords: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  quality: number
  confidence: number
  issues: string[]
  suggestions: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number
}

export interface CharacterAIConfig {
  model: string
  model2: string
  maxTokens: number
  temperature: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  maxMemoryItems: number
  memoryRetentionDays: number
  responseQualityThreshold: number
  enableResponseAnalysis: boolean
  enableMemoryManagement: boolean
  enablePromptOptimization: boolean
}

export interface CharacterAIService {
  generateResponse(
    characterId: string,
    userMessage: string,
    context: Partial<PromptContext>
  ): Promise<AIResponse>

  analyzeMessage(userMessage: string): Promise<MessageAnalysis>

  getCharacterMemory(characterId: string, type?: MemoryType): Promise<MemoryItem[]>

  addCharacterMemory(
    characterId: string,
    memory: Omit<MemoryItem, 'id' | 'timestamp'>
  ): Promise<MemoryItem>

  getCharacterContext(characterId: string, userId: string): Promise<PromptContext>

  updateCharacterPrompts(characterId: string, prompts: Record<string, any>): Promise<void>

  getCharacterPrompts(characterId: string): Promise<Record<string, any>>

  checkApiHealth(): Promise<boolean>

  getAvailableModels(): Promise<string[]>

  setModel(modelId: string): void

  getCurrentModel(): string

  getRequestCost(prompt: string): Promise<number>
}

export interface MessageAnalysis {
  intent: string
  emotion: string
  keywords: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  complexity: number
  urgency: number
  requiresResponse: boolean
  suggestedActions: string[]
  // Новые поля для связи с игровыми системами
  poseCommands: PoseCommand[]
  characteristicInfluences: CharacteristicInfluence[]
  actionTriggers: ActionTrigger[]
  fetishElements: FetishElement[]
  moodChanges: MoodChange[]
}

export interface PoseCommand {
  poseId?: string
  poseKey?: string
  poseName?: string
  command?: string
  confidence: number
  isExplicit: boolean
  modifiers?: string[]
}

export interface CharacteristicInfluence {
  characteristicName: string
  influence: number // -100 to 100
  confidence: number
  reason: string
  isPermanent: boolean
}

export interface ActionTrigger {
  actionName: string
  confidence: number
  intensity?: number
  targetZone?: string
}

export interface FetishElement {
  type: string
  intensity: number
  keywords: string[]
  confidence: number
}

export interface MoodChange {
  moodType: string
  change: number // -100 to 100
  confidence: number
  trigger: string
}

export interface PromptOptimization {
  optimizePrompt(prompt: string, context: PromptContext): Promise<string>
  getPromptEfficiency(prompt: string): Promise<number>
  suggestImprovements(prompt: string): Promise<string[]>
  compressPrompt(prompt: string, maxTokens: number): Promise<string>
}

export interface CharacterAIMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  averageQuality: number
  totalTokensUsed: number
  totalCost: number
  mostUsedTemplates: Array<{ templateId: string; count: number }>
  errorRate: number
  lastUpdated: Date
}

// Система действий-сообщений
export interface ActionMessageSystem {
  actionCount: number
  messageThreshold: number
  lastActionTime: Date
  pendingActions: PendingAction[]
  actionHistory: ActionHistoryItem[]
}

export interface PendingAction {
  id: string
  actionName: string
  characterId: string
  userId: string
  timestamp: Date
  intensity: number
  targetZone?: string
  effects: ActionEffect[]
}

export interface ActionHistoryItem {
  id: string
  actionName: string
  characterId: string
  userId: string
  timestamp: Date
  intensity: number
  targetZone?: string
  effects: ActionEffect[]
  aiReaction?: string
  messageSent: boolean
}

export interface ActionMessageConfig {
  messageThreshold: number // Количество действий перед отправкой сообщения
  timeThreshold: number // Время в секундах для группировки действий
  enableAutoMessages: boolean
  messageTemplates: ActionMessageTemplate[]
}

export interface ActionMessageTemplate {
  id: string
  name: string
  trigger: string // 'action_count', 'time_elapsed', 'specific_action'
  condition: string
  template: string
  variables: string[]
  priority: number
}
