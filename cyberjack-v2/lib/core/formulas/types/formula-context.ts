// lib/core/formulas/types/formula-context.ts

import { DataType } from './formula-node'

export interface FormulaExecutionContext {
  // Контекст персонажа
  character: {
    id: string
    name: string
    characteristics: Record<string, number>
    anatomy: Record<string, number>
    currentPose?: string
    timeInPose?: number
  }

  // Контекст пользователя
  user: {
    id: string
    name: string
    modifiers: Record<string, number>
    credits: number
    level?: number
    experience?: number
  }

  // Контекст действия
  action?: {
    id: string
    name: string
    intensity: number
    cost: number
    duration: number
    category: string
    effects: Record<string, any>
  }

  // Контекст зоны
  zone?: {
    id: string
    name: string
    sensitivity: number
    anatomy: {
      id: string
      name: string
      category: string
    }
    coordinates: {
      x: number
      y: number
      width: number
      height: number
    }
  }

  // Системный контекст
  system: {
    gameTime: number
    realTime: number
    isActionHolding: boolean
    timeMultiplier: number
  }

  // Дополнительные переменные
  custom: Record<string, any>
}

export interface VariableDefinition {
  path: string
  name: string
  description: string
  type: DataType
  category: 'character' | 'user' | 'action' | 'zone' | 'system' | 'custom'
  accessPath: string[]
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    required?: boolean
    allowedValues?: any[]
  }
  examples: any[]
  isReadOnly: boolean
}

export interface FormulaContextSchema {
  variables: Record<string, VariableDefinition>
  functions: Record<string, FunctionDefinition>
  operators: Record<string, OperatorDefinition>
}

export interface FunctionDefinition {
  name: string
  description: string
  parameters: Array<{
    name: string
    type: DataType
    description: string
    required: boolean
    defaultValue?: any
  }>
  returnType: DataType
  examples: Array<{
    input: any[]
    output: any
    description: string
  }>
  category: 'math' | 'logic' | 'string' | 'conditional' | 'utility'
}

export interface OperatorDefinition {
  name: string
  symbol: string
  description: string
  leftType: DataType
  rightType: DataType
  returnType: DataType
  precedence: number
  associativity: 'left' | 'right'
  examples: Array<{
    left: any
    right: any
    result: any
    description: string
  }>
}

// LLM-френдли описания
export interface LLMContextDescription {
  systemPrompt: string
  variableDescriptions: Record<string, string>
  functionDescriptions: Record<string, string>
  operatorDescriptions: Record<string, string>
  examples: Array<{
    naturalLanguage: string
    structuredFormula: any
    explanation: string
  }>
  templates: Array<{
    name: string
    pattern: string
    description: string
    example: string
  }>
}
