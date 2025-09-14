// lib/core/formulas/formula-validator.ts

import {
  Formula,
  FormulaNode,
  ValidationError,
  ValidationWarning,
  DataType,
  OperatorType,
  FunctionType
} from './types/formula-node'
import { FormulaValidationResult, FormulaExecutionError } from './types/formula-result'
import { FormulaExecutionContext, VariableDefinition } from './types/formula-context'

export class FormulaValidator {
  private contextSchema: any
  private variableDefinitions: Map<string, VariableDefinition>

  constructor(contextSchema: any) {
    this.contextSchema = contextSchema
    this.variableDefinitions = new Map()
    this.buildVariableMap()
  }

  // Основной метод валидации
  validateFormula(formula: Formula, context?: FormulaExecutionContext): FormulaValidationResult {
    const errors: FormulaExecutionError[] = []
    const warnings: FormulaExecutionError[] = []
    const suggestions: string[] = []

    // 1. Синтаксическая валидация
    this.validateSyntax(formula.rootNode, errors, warnings)

    // 2. Семантическая валидация
    this.validateSemantics(formula.rootNode, errors, warnings)

    // 3. Типовая валидация
    this.validateTypes(formula.rootNode, errors, warnings)

    // 4. Контекстная валидация
    if (context) {
      this.validateContext(formula.rootNode, context, errors, warnings)
    }

    // 5. Производительность
    const performance = this.analyzePerformance(formula.rootNode)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      performance
    }
  }

  // Синтаксическая валидация
  private validateSyntax(node: FormulaNode, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    switch (node.type) {
      case 'value':
        this.validateValueNode(node, errors, warnings)
        break
      case 'variable':
        this.validateVariableNode(node, errors, warnings)
        break
      case 'operator':
        this.validateOperatorNode(node, errors, warnings)
        break
      case 'function':
        this.validateFunctionNode(node, errors, warnings)
        break
      case 'condition':
        this.validateConditionNode(node, errors, warnings)
        break
    }
  }

  private validateValueNode(node: any, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    if (node.value === null || node.value === undefined) {
      errors.push({
        type: 'syntax',
        message: 'Value node cannot have null or undefined value',
        nodeId: node.id,
        severity: 'error',
        code: 'VALUE_NULL'
      })
    }

    // Проверяем соответствие типа и значения
    if (node.dataType === 'number' && typeof node.value !== 'number') {
      errors.push({
        type: 'syntax',
        message: `Expected number value, got ${typeof node.value}`,
        nodeId: node.id,
        severity: 'error',
        code: 'TYPE_MISMATCH'
      })
    }

    if (node.dataType === 'string' && typeof node.value !== 'string') {
      errors.push({
        type: 'syntax',
        message: `Expected string value, got ${typeof node.value}`,
        nodeId: node.id,
        severity: 'error',
        code: 'TYPE_MISMATCH'
      })
    }

    if (node.dataType === 'boolean' && typeof node.value !== 'boolean') {
      errors.push({
        type: 'syntax',
        message: `Expected boolean value, got ${typeof node.value}`,
        nodeId: node.id,
        severity: 'error',
        code: 'TYPE_MISMATCH'
      })
    }
  }

  private validateVariableNode(node: any, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    if (!node.variablePath || typeof node.variablePath !== 'string') {
      errors.push({
        type: 'syntax',
        message: 'Variable node must have a valid variablePath',
        nodeId: node.id,
        severity: 'error',
        code: 'INVALID_VARIABLE_PATH'
      })
      return
    }

    const variableDef = this.variableDefinitions.get(node.variablePath)
    if (!variableDef) {
      warnings.push({
        type: 'semantic',
        message: `Variable '${node.variablePath}' is not defined in context`,
        nodeId: node.id,
        severity: 'warning',
        code: 'UNKNOWN_VARIABLE'
      })
    } else {
      // Проверяем тип переменной
      if (node.dataType !== variableDef.type) {
        errors.push({
          type: 'semantic',
          message: `Variable type mismatch: expected ${variableDef.type}, got ${node.dataType}`,
          nodeId: node.id,
          severity: 'error',
          code: 'VARIABLE_TYPE_MISMATCH'
        })
      }
    }
  }

  private validateOperatorNode(node: any, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    if (!node.leftInput || !node.rightInput) {
      errors.push({
        type: 'syntax',
        message: 'Operator node must have both left and right inputs',
        nodeId: node.id,
        severity: 'error',
        code: 'MISSING_OPERAND'
      })
      return
    }

    // Валидируем дочерние узлы
    this.validateSyntax(node.leftInput, errors, warnings)
    this.validateSyntax(node.rightInput, errors, warnings)

    // Проверяем совместимость типов
    const leftType = node.leftInput.dataType
    const rightType = node.rightInput.dataType

    if (!this.areTypesCompatible(leftType, rightType, node.operator)) {
      errors.push({
        type: 'semantic',
        message: `Incompatible types for operator ${node.operator}: ${leftType} and ${rightType}`,
        nodeId: node.id,
        severity: 'error',
        code: 'INCOMPATIBLE_TYPES'
      })
    }

    // Проверяем деление на ноль
    if (node.operator === 'divide' && this.isZero(node.rightInput)) {
      warnings.push({
        type: 'runtime',
        message: 'Potential division by zero',
        nodeId: node.id,
        severity: 'warning',
        code: 'DIVISION_BY_ZERO'
      })
    }
  }

  private validateFunctionNode(node: any, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    const functionDef = this.getFunctionDefinition(node.functionName)
    if (!functionDef) {
      errors.push({
        type: 'syntax',
        message: `Unknown function: ${node.functionName}`,
        nodeId: node.id,
        severity: 'error',
        code: 'UNKNOWN_FUNCTION'
      })
      return
    }

    // Проверяем количество параметров
    if (node.parameters.length < functionDef.requiredParams) {
      errors.push({
        type: 'syntax',
        message: `Function ${node.functionName} requires at least ${functionDef.requiredParams} parameters, got ${node.parameters.length}`,
        nodeId: node.id,
        severity: 'error',
        code: 'INSUFFICIENT_PARAMETERS'
      })
    }

    if (node.parameters.length > functionDef.maxParams) {
      errors.push({
        type: 'syntax',
        message: `Function ${node.functionName} accepts at most ${functionDef.maxParams} parameters, got ${node.parameters.length}`,
        nodeId: node.id,
        severity: 'warning',
        code: 'TOO_MANY_PARAMETERS'
      })
    }

    // Валидируем параметры
    node.parameters.forEach((param: FormulaNode, index: number) => {
      this.validateSyntax(param, errors, warnings)

      if (index < functionDef.parameterTypes.length) {
        const expectedType = functionDef.parameterTypes[index]
        if (param.dataType !== expectedType) {
          errors.push({
            type: 'semantic',
            message: `Function parameter ${index + 1} type mismatch: expected ${expectedType}, got ${param.dataType}`,
            nodeId: node.id,
            severity: 'error',
            code: 'PARAMETER_TYPE_MISMATCH'
          })
        }
      }
    })
  }

  private validateConditionNode(node: any, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    if (!node.condition || !node.trueValue || !node.falseValue) {
      errors.push({
        type: 'syntax',
        message: 'Condition node must have condition, trueValue, and falseValue',
        nodeId: node.id,
        severity: 'error',
        code: 'INCOMPLETE_CONDITION'
      })
      return
    }

    // Валидируем дочерние узлы
    this.validateSyntax(node.condition, errors, warnings)
    this.validateSyntax(node.trueValue, errors, warnings)
    this.validateSyntax(node.falseValue, errors, warnings)

    // Проверяем тип условия
    if (node.condition.dataType !== 'boolean') {
      errors.push({
        type: 'semantic',
        message: 'Condition must evaluate to boolean',
        nodeId: node.id,
        severity: 'error',
        code: 'CONDITION_NOT_BOOLEAN'
      })
    }

    // Проверяем совместимость типов trueValue и falseValue
    if (node.trueValue.dataType !== node.falseValue.dataType) {
      errors.push({
        type: 'semantic',
        message: 'True and false values must have the same type',
        nodeId: node.id,
        severity: 'error',
        code: 'CONDITION_TYPE_MISMATCH'
      })
    }
  }

  // Семантическая валидация
  private validateSemantics(node: FormulaNode, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    // Проверяем логические ошибки
    if (node.type === 'operator') {
      this.validateOperatorSemantics(node, errors, warnings)
    }

    // Проверяем рекурсию
    this.checkForRecursion(node, errors, warnings)
  }

  private validateOperatorSemantics(node: any, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    // Проверяем операции с бесконечностью
    if (this.isInfinite(node.leftInput) || this.isInfinite(node.rightInput)) {
      warnings.push({
        type: 'runtime',
        message: 'Operation with infinite values',
        nodeId: node.id,
        severity: 'warning',
        code: 'INFINITE_OPERATION'
      })
    }

    // Проверяем операции с NaN
    if (this.isNaN(node.leftInput) || this.isNaN(node.rightInput)) {
      warnings.push({
        type: 'runtime',
        message: 'Operation with NaN values',
        nodeId: node.id,
        severity: 'warning',
        code: 'NAN_OPERATION'
      })
    }
  }

  private checkForRecursion(node: FormulaNode, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    const visited = new Set<string>()
    this.checkRecursionRecursive(node, visited, errors, warnings)
  }

  private checkRecursionRecursive(node: FormulaNode, visited: Set<string>, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    if (visited.has(node.id)) {
      errors.push({
        type: 'semantic',
        message: 'Circular reference detected in formula',
        nodeId: node.id,
        severity: 'error',
        code: 'CIRCULAR_REFERENCE'
      })
      return
    }

    visited.add(node.id)

    if (node.type === 'operator') {
      this.checkRecursionRecursive(node.leftInput, visited, errors, warnings)
      this.checkRecursionRecursive(node.rightInput, visited, errors, warnings)
    } else if (node.type === 'function') {
      node.parameters.forEach(param => {
        this.checkRecursionRecursive(param, visited, errors, warnings)
      })
    } else if (node.type === 'condition') {
      this.checkRecursionRecursive(node.condition, visited, errors, warnings)
      this.checkRecursionRecursive(node.trueValue, visited, errors, warnings)
      this.checkRecursionRecursive(node.falseValue, visited, errors, warnings)
    }

    visited.delete(node.id)
  }

  // Типовая валидация
  private validateTypes(node: FormulaNode, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    const actualType = this.inferType(node)

    if (actualType !== node.dataType) {
      errors.push({
        type: 'semantic',
        message: `Type mismatch: inferred ${actualType}, declared ${node.dataType}`,
        nodeId: node.id,
        severity: 'error',
        code: 'TYPE_INFERENCE_MISMATCH'
      })
    }
  }

  private inferType(node: FormulaNode): DataType {
    switch (node.type) {
      case 'value':
        return node.dataType
      case 'variable':
        const variableDef = this.variableDefinitions.get(node.variablePath)
        return variableDef?.type || 'number'
      case 'operator':
        return this.getOperatorReturnType(node.operator, node.leftInput.dataType, node.rightInput.dataType)
      case 'function':
        return this.getFunctionReturnType(node.functionName)
      case 'condition':
        return node.trueValue.dataType
      default:
        return 'number'
    }
  }

  // Контекстная валидация
  private validateContext(node: FormulaNode, context: FormulaExecutionContext, errors: FormulaExecutionError[], warnings: FormulaExecutionError[]): void {
    if (node.type === 'variable') {
      const value = this.getContextValue(node.variablePath, context)
      if (value === undefined) {
        warnings.push({
          type: 'runtime',
          message: `Variable '${node.variablePath}' not found in context`,
          nodeId: node.id,
          severity: 'warning',
          code: 'MISSING_CONTEXT_VARIABLE'
        })
      }
    }

    // Рекурсивно проверяем дочерние узлы
    if (node.type === 'operator') {
      this.validateContext(node.leftInput, context, errors, warnings)
      this.validateContext(node.rightInput, context, errors, warnings)
    } else if (node.type === 'function') {
      node.parameters.forEach(param => {
        this.validateContext(param, context, errors, warnings)
      })
    } else if (node.type === 'condition') {
      this.validateContext(node.condition, context, errors, warnings)
      this.validateContext(node.trueValue, context, errors, warnings)
      this.validateContext(node.falseValue, context, errors, warnings)
    }
  }

  // Анализ производительности
  private analyzePerformance(node: FormulaNode): { complexity: number, estimatedExecutionTime: number, memoryUsage: number } {
    const complexity = this.calculateComplexity(node)
    const estimatedExecutionTime = this.estimateExecutionTime(node)
    const memoryUsage = this.estimateMemoryUsage(node)

    return { complexity, estimatedExecutionTime, memoryUsage }
  }

  private calculateComplexity(node: FormulaNode): number {
    let complexity = 1

    switch (node.type) {
      case 'operator':
        complexity += this.calculateComplexity(node.leftInput) + this.calculateComplexity(node.rightInput)
        break
      case 'function':
        complexity += node.parameters.reduce((sum, param) => sum + this.calculateComplexity(param), 0)
        if (node.functionName === 'random') complexity += 10 // Random функции дороже
        break
      case 'condition':
        complexity += this.calculateComplexity(node.condition) +
                     this.calculateComplexity(node.trueValue) +
                     this.calculateComplexity(node.falseValue)
        break
    }

    return complexity
  }

  private estimateExecutionTime(node: FormulaNode): number {
    // Очень грубая оценка в миллисекундах
    return this.calculateComplexity(node) * 0.1
  }

  private estimateMemoryUsage(node: FormulaNode): number {
    // Оценка использования памяти в байтах
    return this.calculateComplexity(node) * 64
  }

  // Вспомогательные методы
  private buildVariableMap(): void {
    // Строим карту переменных из схемы контекста
    if (this.contextSchema?.variables) {
      Object.entries(this.contextSchema.variables).forEach(([path, def]) => {
        this.variableDefinitions.set(path, def as VariableDefinition)
      })
    }
  }

  private areTypesCompatible(leftType: DataType, rightType: DataType, operator: OperatorType): boolean {
    // Логика совместимости типов для операторов
    switch (operator) {
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
        return leftType === 'number' && rightType === 'number'
      case 'equal':
      case 'not_equal':
        return leftType === rightType
      case 'less_than':
      case 'greater_than':
      case 'less_equal':
      case 'greater_equal':
        return leftType === 'number' && rightType === 'number'
      default:
        return true
    }
  }

  private isZero(node: FormulaNode): boolean {
    return node.type === 'value' && node.dataType === 'number' && node.value === 0
  }

  private isInfinite(node: FormulaNode): boolean {
    return node.type === 'value' && node.dataType === 'number' && typeof node.value === 'number' && !isFinite(node.value)
  }

  private isNaN(node: FormulaNode): boolean {
    return node.type === 'value' && node.dataType === 'number' && typeof node.value === 'number' && isNaN(node.value)
  }

  private getContextValue(path: string, context: FormulaExecutionContext): any {
    const parts = path.split('.')
    let current: any = context

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        return undefined
      }
    }

    return current
  }

  private getOperatorReturnType(operator: OperatorType, leftType: DataType, rightType: DataType): DataType {
    switch (operator) {
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
      case 'modulo':
      case 'power':
        return 'number'
      case 'equal':
      case 'not_equal':
      case 'less_than':
      case 'greater_than':
      case 'less_equal':
      case 'greater_equal':
      case 'and':
      case 'or':
        return 'boolean'
      default:
        return 'number'
    }
  }

  private getFunctionReturnType(functionName: FunctionType): DataType {
    switch (functionName) {
      case 'min':
      case 'max':
      case 'abs':
      case 'round':
      case 'floor':
      case 'ceil':
      case 'sqrt':
      case 'sin':
      case 'cos':
      case 'tan':
      case 'sum':
      case 'average':
        return 'number'
      case 'if':
        return 'number' // Упрощение
      default:
        return 'number'
    }
  }

  private getFunctionDefinition(functionName: FunctionType): any {
    const functionDefs: Record<string, any> = {
      'min': { requiredParams: 2, maxParams: Infinity, parameterTypes: ['number', 'number'] },
      'max': { requiredParams: 2, maxParams: Infinity, parameterTypes: ['number', 'number'] },
      'abs': { requiredParams: 1, maxParams: 1, parameterTypes: ['number'] },
      'round': { requiredParams: 1, maxParams: 1, parameterTypes: ['number'] },
      'floor': { requiredParams: 1, maxParams: 1, parameterTypes: ['number'] },
      'ceil': { requiredParams: 1, maxParams: 1, parameterTypes: ['number'] },
      'if': { requiredParams: 3, maxParams: 3, parameterTypes: ['boolean', 'number', 'number'] }
    }

    return functionDefs[functionName]
  }
}
