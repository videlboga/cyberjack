// types/pose-formulas.ts

import { DataType } from '@/lib/core/formulas/types/formula-node'

// Условия для активации позы
export interface PoseCondition {
  id: string
  type: 'characteristic' | 'equipment' | 'pose' | 'time' | 'custom'
  target: string // ID характеристики, оборудования, позы или путь к переменной
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in'
  value: any
  description?: string
}

// Эффекты позы
export interface PoseEffect {
  id: string
  type: 'characteristic' | 'modifier' | 'action' | 'custom'
  target: string // ID характеристики или путь к переменной
  formula: string // Формула для вычисления эффекта
  frequency: 'per_minute' | 'per_hour' | 'per_action' | 'on_activation' | 'on_deactivation'
  description?: string
}

// Модификаторы позы для действий
export interface PoseModifier {
  id: string
  type: 'intensity' | 'cost' | 'duration' | 'effect' | 'success_rate'
  target: string // ID действия или категория действий
  formula: string // Формула модификатора
  description?: string
}

// Полная структура формул позы
export interface PoseFormulas {
  conditions: PoseCondition[]
  effects: PoseEffect[]
  modifiers: PoseModifier[]
}

// Контекст выполнения формул позы
export interface PoseFormulaContext {
  // Контекст персонажа
  character: {
    id: string
    name: string
    characteristics: Record<string, number>
    anatomy: Record<string, number>
    currentPoses: string[]
    timeInCurrentPose: number
  }

  // Контекст пользователя
  user: {
    id: string
    name: string
    modifiers: Record<string, number>
    credits: number
    equipment: Record<string, number>
  }

  // Контекст позы
  pose: {
    id: string
    name: string
    category: string
    duration: number
    isActive: boolean
  }

  // Системный контекст
  system: {
    gameTime: number
    realTime: number
    timeMultiplier: number
  }

  // Дополнительные переменные
  custom: Record<string, any>
}

// Результат проверки условий позы
export interface PoseConditionResult {
  conditionId: string
  passed: boolean
  actualValue: any
  expectedValue: any
  error?: string
}

// Результат применения эффекта позы
export interface PoseEffectResult {
  effectId: string
  target: string
  oldValue: any
  newValue: any
  change: any
  success: boolean
  error?: string
}

// Результат применения модификатора позы
export interface PoseModifierResult {
  modifierId: string
  target: string
  originalValue: any
  modifiedValue: any
  multiplier: number
  success: boolean
  error?: string
}

// Статус позы для персонажа
export interface CharacterPoseStatus {
  poseId: string
  isActive: boolean
  activatedAt: Date
  duration: number
  conditionsPassed: PoseConditionResult[]
  effectsApplied: PoseEffectResult[]
  modifiersApplied: PoseModifierResult[]
}

// API типы для управления формулами поз
export interface CreatePoseConditionRequest {
  poseId: string
  type: PoseCondition['type']
  target: string
  operator: PoseCondition['operator']
  value: any
  description?: string
}

export interface UpdatePoseConditionRequest {
  type?: PoseCondition['type']
  target?: string
  operator?: PoseCondition['operator']
  value?: any
  description?: string
}

export interface CreatePoseEffectRequest {
  poseId: string
  type: PoseEffect['type']
  target: string
  formula: string
  frequency: PoseEffect['frequency']
  description?: string
}

export interface UpdatePoseEffectRequest {
  type?: PoseEffect['type']
  target?: string
  formula?: string
  frequency?: PoseEffect['frequency']
  description?: string
}

export interface CreatePoseModifierRequest {
  poseId: string
  type: PoseModifier['type']
  target: string
  formula: string
  description?: string
}

export interface UpdatePoseModifierRequest {
  type?: PoseModifier['type']
  target?: string
  formula?: string
  description?: string
}

// Шаблоны формул для поз
export interface PoseFormulaTemplate {
  id: string
  name: string
  category: 'condition' | 'effect' | 'modifier'
  description: string
  formula: string
  variables: Array<{
    name: string
    type: DataType
    description: string
    example: any
  }>
  example: {
    context: Partial<PoseFormulaContext>
    result: any
  }
}

// Валидация формул поз
export interface PoseFormulaValidation {
  isValid: boolean
  errors: Array<{
    type: 'syntax' | 'semantic' | 'context'
    message: string
    position?: number
    suggestion?: string
  }>
  warnings: Array<{
    type: 'performance' | 'logic' | 'style'
    message: string
    position?: number
  }>
}
