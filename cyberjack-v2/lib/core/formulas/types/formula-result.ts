// lib/core/formulas/types/formula-result.ts

import { DataType } from './formula-node'

export interface FormulaResult {
  value: any
  dataType: DataType
  executionTime: number
  factors: FormulaFactor[]
  metadata: {
    formulaId: string
    executedAt: Date
    context: Record<string, any>
    version: string
  }
  debug?: {
    nodeResults: Record<string, NodeResult>
    executionPath: string[]
    warnings: string[]
  }
}

export interface NodeResult {
  nodeId: string
  value: any
  dataType: DataType
  executionTime: number
  factors: FormulaFactor[]
  error?: string
}

export interface FormulaFactor {
  name: string
  value: any
  impact: number // -1 to 1, влияние на результат
  description: string
  category: 'input' | 'modifier' | 'function' | 'operator'
  source: string // откуда пришел фактор
}

export interface FormulaExecutionError {
  type: 'syntax' | 'semantic' | 'runtime' | 'validation'
  message: string
  nodeId?: string
  path?: string
  suggestion?: string
  severity: 'error' | 'warning' | 'info'
  code: string
}

export interface FormulaValidationResult {
  isValid: boolean
  errors: FormulaExecutionError[]
  warnings: FormulaExecutionError[]
  suggestions: string[]
  performance: {
    complexity: number
    estimatedExecutionTime: number
    memoryUsage: number
  }
}

// LLM-френдли результаты
export interface LLMFormulaAnalysis {
  confidence: number // 0-1
  interpretation: string
  suggestions: string[]
  alternativeFormulations: Array<{
    naturalLanguage: string
    confidence: number
    reasoning: string
  }>
  potentialIssues: Array<{
    issue: string
    severity: 'low' | 'medium' | 'high'
    suggestion: string
  }>
}

export interface FormulaComparisonResult {
  formulas: Array<{
    id: string
    name: string
    result: FormulaResult
    performance: {
      executionTime: number
      complexity: number
    }
  }>
  bestFormula: string
  reasoning: string
  recommendations: string[]
}
