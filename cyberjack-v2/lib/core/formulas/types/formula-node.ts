// lib/core/formulas/types/formula-node.ts

export type DataType = 'number' | 'string' | 'boolean' | 'array' | 'object'

export type OperatorType =
  // Арифметические
  | 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power'
  // Логические
  | 'and' | 'or' | 'not' | 'equal' | 'not_equal' | 'less_than' | 'greater_than' | 'less_equal' | 'greater_equal'
  // Строковые
  | 'concat' | 'contains' | 'starts_with' | 'ends_with'

export type FunctionType =
  // Математические
  | 'min' | 'max' | 'abs' | 'round' | 'floor' | 'ceil' | 'sqrt' | 'sin' | 'cos' | 'tan'
  // Статистические
  | 'sum' | 'average' | 'count' | 'median'
  // Условные
  | 'if' | 'switch' | 'case'
  // Утилиты
  | 'random' | 'clamp' | 'lerp' | 'map_range'

export interface BaseFormulaNode {
  id: string
  type: string
  dataType: DataType
  position?: { x: number; y: number }
  metadata?: {
    description?: string
    tags?: string[]
    version?: string
    createdBy?: 'human' | 'llm' | 'template'
  }
}

export interface ValueNode extends BaseFormulaNode {
  type: 'value'
  value: number | string | boolean | null
  dataType: DataType
}

export interface VariableNode extends BaseFormulaNode {
  type: 'variable'
  variablePath: string
  displayName: string
  dataType: DataType
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    required?: boolean
  }
}

export interface OperatorNode extends BaseFormulaNode {
  type: 'operator'
  operator: OperatorType
  leftInput: FormulaNode
  rightInput: FormulaNode
}

export interface FunctionNode extends BaseFormulaNode {
  type: 'function'
  functionName: FunctionType
  parameters: FormulaNode[]
}

export interface ConditionNode extends BaseFormulaNode {
  type: 'condition'
  condition: FormulaNode
  trueValue: FormulaNode
  falseValue: FormulaNode
}

export interface ArrayNode extends BaseFormulaNode {
  type: 'array'
  elements: FormulaNode[]
}

export interface ObjectNode extends BaseFormulaNode {
  type: 'object'
  properties: Record<string, FormulaNode>
}

export type FormulaNode =
  | ValueNode
  | VariableNode
  | OperatorNode
  | FunctionNode
  | ConditionNode
  | ArrayNode
  | ObjectNode

export interface Formula {
  id: string
  name: string
  description?: string
  version: string
  rootNode: FormulaNode
  context: FormulaContext
  metadata: {
    createdBy: 'human' | 'llm' | 'template'
    createdAt: Date
    updatedAt: Date
    tags: string[]
    category: string
  }
  validation: {
    isValid: boolean
    errors: ValidationError[]
    warnings: ValidationWarning[]
  }
}

export interface FormulaContext {
  requiredVariables: string[]
  optionalVariables: string[]
  returnType: DataType
  description: string
  examples: FormulaExample[]
}

export interface FormulaExample {
  name: string
  description: string
  input: Record<string, any>
  expectedOutput: any
  actualOutput?: any
  passed?: boolean
}

export interface ValidationError {
  level: 'error' | 'warning'
  message: string
  nodeId?: string
  path?: string
  suggestion?: string
}

export interface ValidationWarning extends ValidationError {
  level: 'warning'
}

// LLM-френдли нотация
export interface NaturalLanguageFormula {
  id: string
  name: string
  description: string
  naturalExpression: string
  structuredFormula: Formula
  confidence: number // 0-1, уверенность LLM в правильности
  suggestions: string[]
}

// Шаблоны для LLM
export interface FormulaTemplate {
  id: string
  name: string
  description: string
  category: string
  naturalTemplate: string
  structuredTemplate: Formula
  variables: Array<{
    name: string
    type: DataType
    description: string
    required: boolean
    examples: any[]
  }>
  examples: FormulaExample[]
  llmPrompt: string
}
