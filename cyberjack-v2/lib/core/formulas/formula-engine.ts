// lib/core/formulas/formula-engine.ts

import {
  Formula,
  FormulaNode,
  ValueNode,
  VariableNode,
  OperatorNode,
  FunctionNode,
  ConditionNode,
  DataType
} from './types/formula-node'
import { FormulaExecutionContext } from './types/formula-context'
import { FormulaResult, NodeResult, FormulaFactor } from './types/formula-result'

export class FormulaEngine {
  private contextSchema: any
  private executionCache: Map<string, any> = new Map()

  constructor(contextSchema: any) {
    this.contextSchema = contextSchema
  }

  // Основной метод выполнения формулы
  async executeFormula(
    formula: Formula,
    context: FormulaExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<FormulaResult> {
    const startTime = Date.now()

    try {
      // Очищаем кеш если нужно
      if (!options.useCache) {
        this.executionCache.clear()
      }

      // Выполняем формулу
      const result = await this.evaluateNode(formula.rootNode, context, options)

      const executionTime = Date.now() - startTime

      return {
        value: result.value,
        dataType: result.dataType,
        executionTime,
        factors: result.factors,
        metadata: {
          formulaId: formula.id,
          executedAt: new Date(),
          context: this.sanitizeContext(context),
          version: formula.version
        },
        debug: options.debug ? {
          nodeResults: {},
          executionPath: [],
          warnings: []
        } : undefined
      }
    } catch (error) {
      const executionTime = Date.now() - startTime

      throw new Error(
        `Formula execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Выполнение узла формулы
  private async evaluateNode(
    node: FormulaNode,
    context: FormulaExecutionContext,
    options: ExecutionOptions
  ): Promise<NodeResult> {
    // Проверяем, что узел существует
    if (!node) {
      throw new Error('Formula node is null or undefined')
    }

    const startTime = Date.now()
    const cacheKey = this.getCacheKey(node, context)

    // Проверяем кеш
    if (options.useCache && this.executionCache.has(cacheKey)) {
      return this.executionCache.get(cacheKey)
    }

    let result: NodeResult

    switch (node.type) {
      case 'value':
        result = await this.evaluateValueNode(node as ValueNode)
        break
      case 'variable':
        result = await this.evaluateVariableNode(node as VariableNode, context)
        break
      case 'operator':
        result = await this.evaluateOperatorNode(node as OperatorNode, context, options)
        break
      case 'function':
        result = await this.evaluateFunctionNode(node as FunctionNode, context, options)
        break
      case 'condition':
        result = await this.evaluateConditionNode(node as ConditionNode, context, options)
        break
      default:
        throw new Error(`Unknown node type: ${(node as any).type}`)
    }

    result.executionTime = Date.now() - startTime

    // Кешируем результат
    if (options.useCache) {
      this.executionCache.set(cacheKey, result)
    }

    return result
  }

  // Выполнение узла значения
  private async evaluateValueNode(node: ValueNode): Promise<NodeResult> {
    return {
      nodeId: node.id,
      value: node.value,
      dataType: node.dataType,
      executionTime: 0,
      factors: []
    }
  }

  // Выполнение узла переменной
  private async evaluateVariableNode(
    node: VariableNode,
    context: FormulaExecutionContext
  ): Promise<NodeResult> {
    const value = this.getContextValue(node.variablePath, context)

    if (value === undefined) {
      // Используем значение по умолчанию если есть
      const defaultValue = node.defaultValue
      if (defaultValue !== undefined) {
        return {
          nodeId: node.id,
          value: defaultValue,
          dataType: node.dataType,
          executionTime: 0,
          factors: [{
            name: 'default_value',
            value: defaultValue,
            impact: 0,
            description: `Used default value for ${node.variablePath}`,
            category: 'input',
            source: 'default'
          }]
        }
      }

      throw new Error(`Variable '${node.variablePath}' not found in context`)
    }

    return {
      nodeId: node.id,
      value,
      dataType: node.dataType,
      executionTime: 0,
      factors: [{
        name: node.variablePath,
        value,
        impact: this.calculateImpact(value, node.dataType),
        description: `Variable: ${node.displayName}`,
        category: 'input',
        source: 'context'
      }]
    }
  }

  // Выполнение узла оператора
  private async evaluateOperatorNode(
    node: OperatorNode,
    context: FormulaExecutionContext,
    options: ExecutionOptions
  ): Promise<NodeResult> {
    if (!node.leftInput || !node.rightInput) {
      throw new Error('Operator node must have both left and right inputs')
    }

    const leftResult = await this.evaluateNode(node.leftInput, context, options)
    const rightResult = await this.evaluateNode(node.rightInput, context, options)

    const value = this.applyOperator(
      node.operator,
      leftResult.value,
      rightResult.value,
      leftResult.dataType,
      rightResult.dataType
    )

    const factors = [...leftResult.factors, ...rightResult.factors, {
      name: `operator_${node.operator}`,
      value,
      impact: this.calculateOperatorImpact(node.operator, leftResult.value, rightResult.value),
      description: `Operation: ${node.operator}`,
      category: 'operator' as const,
      source: 'computation'
    }]

    return {
      nodeId: node.id,
      value,
      dataType: node.dataType,
      executionTime: leftResult.executionTime + rightResult.executionTime,
      factors
    }
  }

  // Выполнение узла функции
  private async evaluateFunctionNode(
    node: FunctionNode,
    context: FormulaExecutionContext,
    options: ExecutionOptions
  ): Promise<NodeResult> {
    if (!node.parameters || !Array.isArray(node.parameters)) {
      throw new Error('Function node must have parameters array')
    }

    const parameterResults = await Promise.all(
      node.parameters.map(param => this.evaluateNode(param, context, options))
    )

    const parameterValues = parameterResults.map(result => result.value)
    const value = this.applyFunction(node.functionName, parameterValues)

    const factors = parameterResults.flatMap(result => result.factors)
    factors.push({
      name: `function_${node.functionName}`,
      value,
      impact: this.calculateFunctionImpact(node.functionName, parameterValues, value),
      description: `Function: ${node.functionName}`,
      category: 'function' as const,
      source: 'computation'
    })

    return {
      nodeId: node.id,
      value,
      dataType: node.dataType,
      executionTime: parameterResults.reduce((sum, result) => sum + result.executionTime, 0),
      factors
    }
  }

  // Выполнение узла условия
  private async evaluateConditionNode(
    node: ConditionNode,
    context: FormulaExecutionContext,
    options: ExecutionOptions
  ): Promise<NodeResult> {
    if (!node.condition || !node.trueValue || !node.falseValue) {
      throw new Error('Condition node must have condition, trueValue, and falseValue')
    }

    const conditionResult = await this.evaluateNode(node.condition, context, options)

    if (conditionResult.dataType !== 'boolean') {
      throw new Error('Condition must evaluate to boolean')
    }

    const branchResult = conditionResult.value
      ? await this.evaluateNode(node.trueValue, context, options)
      : await this.evaluateNode(node.falseValue, context, options)

    const factors = [...conditionResult.factors, ...branchResult.factors, {
      name: 'condition_result',
      value: branchResult.value,
      impact: conditionResult.value ? 1 : -1,
      description: `Condition: ${conditionResult.value ? 'true' : 'false'}`,
      category: 'conditional',
      source: 'computation'
    }]

    return {
      nodeId: node.id,
      value: branchResult.value,
      dataType: node.dataType,
      executionTime: conditionResult.executionTime + branchResult.executionTime,
      factors
    }
  }

  // Применение операторов
  private applyOperator(
    operator: string,
    leftValue: any,
    rightValue: any,
    leftType: DataType,
    rightType: DataType
  ): any {
    switch (operator) {
      case 'add':
        return leftValue + rightValue
      case 'subtract':
        return leftValue - rightValue
      case 'multiply':
        return leftValue * rightValue
      case 'divide':
        if (rightValue === 0) {
          throw new Error('Division by zero')
        }
        return leftValue / rightValue
      case 'modulo':
        return leftValue % rightValue
      case 'power':
        return Math.pow(leftValue, rightValue)
      case 'equal':
        return leftValue === rightValue
      case 'not_equal':
        return leftValue !== rightValue
      case 'less_than':
        return leftValue < rightValue
      case 'greater_than':
        return leftValue > rightValue
      case 'less_equal':
        return leftValue <= rightValue
      case 'greater_equal':
        return leftValue >= rightValue
      case 'and':
        return leftValue && rightValue
      case 'or':
        return leftValue || rightValue
      default:
        throw new Error(`Unknown operator: ${operator}`)
    }
  }

  // Применение функций
  private applyFunction(functionName: string, parameters: any[]): any {
    switch (functionName) {
      case 'min':
        return Math.min(...parameters)
      case 'max':
        return Math.max(...parameters)
      case 'abs':
        return Math.abs(parameters[0])
      case 'round':
        return Math.round(parameters[0])
      case 'floor':
        return Math.floor(parameters[0])
      case 'ceil':
        return Math.ceil(parameters[0])
      case 'sqrt':
        return Math.sqrt(parameters[0])
      case 'sin':
        return Math.sin(parameters[0])
      case 'cos':
        return Math.cos(parameters[0])
      case 'tan':
        return Math.tan(parameters[0])
      case 'sum':
        return parameters.reduce((sum, val) => sum + val, 0)
      case 'average':
        return parameters.reduce((sum, val) => sum + val, 0) / parameters.length
      case 'count':
        return parameters.length
      case 'random':
        return Math.random() * (parameters[1] || 1) + (parameters[0] || 0)
      case 'clamp':
        const value = parameters[0]
        const min = parameters[1]
        const max = parameters[2]
        return Math.min(Math.max(value, min), max)
      case 'if':
        return parameters[0] ? parameters[1] : parameters[2]
      default:
        throw new Error(`Unknown function: ${functionName}`)
    }
  }

  // Получение значения из контекста
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

  // Расчет влияния значения
  private calculateImpact(value: any, dataType: DataType): number {
    if (dataType === 'number') {
      // Нормализуем числовые значения к диапазону [-1, 1]
      if (typeof value === 'number') {
        return Math.tanh(value / 100) // Используем гиперболический тангенс для нормализации
      }
    }

    return 0 // Для нечисловых типов влияние нейтральное
  }

  // Расчет влияния оператора
  private calculateOperatorImpact(operator: string, leftValue: any, rightValue: any): number {
    switch (operator) {
      case 'multiply':
        return (leftValue * rightValue) / 10000 // Нормализуем
      case 'divide':
        return leftValue / rightValue / 100
      case 'add':
        return (leftValue + rightValue) / 200
      case 'subtract':
        return (leftValue - rightValue) / 200
      default:
        return 0
    }
  }

  // Расчет влияния функции
  private calculateFunctionImpact(functionName: string, parameters: any[], result: any): number {
    switch (functionName) {
      case 'min':
      case 'max':
        return result / 100
      case 'abs':
        return Math.abs(result) / 100
      case 'random':
        return (result - 0.5) * 2 // Нормализуем к [-1, 1]
      default:
        return 0
    }
  }

  // Генерация ключа кеша
  private getCacheKey(node: FormulaNode, context: FormulaExecutionContext): string {
    const nodeKey = `${node.id}_${node.type}`
    const contextKey = this.getContextKey(context)
    return `${nodeKey}_${contextKey}`
  }

  // Генерация ключа контекста
  private getContextKey(context: FormulaExecutionContext): string {
    // Создаем хеш из релевантных частей контекста
    const relevantParts = {
      characterId: context.character.id,
      userId: context.user.id,
      actionId: context.action?.id,
      zoneId: context.zone?.id,
      gameTime: context.system.gameTime
    }

    return JSON.stringify(relevantParts)
  }

  // Очистка контекста для метаданных
  private sanitizeContext(context: FormulaExecutionContext): Record<string, any> {
    return {
      characterId: context.character.id,
      userId: context.user.id,
      actionId: context.action?.id,
      zoneId: context.zone?.id,
      gameTime: context.system.gameTime
    }
  }
}

// Опции выполнения
interface ExecutionOptions {
  useCache?: boolean
  debug?: boolean
  timeout?: number
}
