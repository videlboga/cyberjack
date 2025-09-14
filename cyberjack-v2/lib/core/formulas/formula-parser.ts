// lib/core/formulas/formula-parser.ts

import {
  Formula,
  FormulaNode,
  ValueNode,
  VariableNode,
  OperatorNode,
  FunctionNode,
  ConditionNode,
  DataType,
  OperatorType,
  FunctionType,
  NaturalLanguageFormula
} from './types/formula-node'
import { FormulaExecutionContext } from './types/formula-context'
import { FormulaValidationResult, FormulaExecutionError } from './types/formula-result'

export class FormulaParser {
  private contextSchema: any

  constructor(contextSchema: any) {
    this.contextSchema = contextSchema
  }

  // Парсинг естественного языка в структурированную формулу
  parseNaturalLanguage(naturalExpression: string, context: FormulaExecutionContext): NaturalLanguageFormula {
    const cleaned = this.cleanNaturalExpression(naturalExpression)
    const structured = this.parseToStructured(cleaned, context)

    return {
      id: this.generateId(),
      name: this.extractName(naturalExpression),
      description: this.extractDescription(naturalExpression),
      naturalExpression,
      structuredFormula: structured,
      confidence: this.calculateConfidence(cleaned, structured),
      suggestions: this.generateSuggestions(cleaned, structured)
    }
  }

  // Очистка естественного выражения
  private cleanNaturalExpression(expression: string): string {
    return expression
      .toLowerCase()
      .replace(/[^\w\s\+\-\*\/\(\)\[\]\.\,\:\;\=\<\>\!]/g, '') // Удаляем специальные символы
      .replace(/\s+/g, ' ') // Нормализуем пробелы
      .trim()
  }

  // Парсинг в структурированную формулу
  private parseToStructured(expression: string, context: FormulaExecutionContext): Formula {
    const tokens = this.tokenize(expression)
    const ast = this.parseTokens(tokens, context)

    return {
      id: this.generateId(),
      name: 'Generated Formula',
      description: `Formula generated from: ${expression}`,
      version: '1.0.0',
      rootNode: ast,
      context: this.buildContext(ast),
      metadata: {
        createdBy: 'llm',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['generated', 'natural-language'],
        category: 'auto-generated'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Токенизация
  private tokenize(expression: string): Token[] {
    const tokens: Token[] = []
    let current = ''
    let i = 0

    while (i < expression.length) {
      const char = expression[i]

      if (this.isWhitespace(char)) {
        if (current) {
          tokens.push(this.createToken(current))
          current = ''
        }
      } else if (this.isOperator(char)) {
        if (current) {
          tokens.push(this.createToken(current))
          current = ''
        }
        tokens.push(this.createToken(char))
      } else if (char === '(' || char === ')') {
        if (current) {
          tokens.push(this.createToken(current))
          current = ''
        }
        tokens.push(this.createToken(char))
      } else {
        current += char
      }
      i++
    }

    if (current) {
      tokens.push(this.createToken(current))
    }

    return tokens
  }

  // Парсинг токенов в AST
  private parseTokens(tokens: Token[], context: FormulaExecutionContext): FormulaNode {
    return this.parseExpression(tokens, 0).node
  }

  private parseExpression(tokens: Token[], index: number): { node: FormulaNode, nextIndex: number } {
    let left = this.parseTerm(tokens, index)

    while (left.nextIndex < tokens.length) {
      const token = tokens[left.nextIndex]

      if (token.type === 'operator' && this.isAdditiveOperator(token.value)) {
        const right = this.parseTerm(tokens, left.nextIndex + 1)
        left = {
          node: this.createOperatorNode(token.value as OperatorType, left.node, right.node),
          nextIndex: right.nextIndex
        }
      } else {
        break
      }
    }

    return left
  }

  private parseTerm(tokens: Token[], index: number): { node: FormulaNode, nextIndex: number } {
    let left = this.parseFactor(tokens, index)

    while (left.nextIndex < tokens.length) {
      const token = tokens[left.nextIndex]

      if (token.type === 'operator' && this.isMultiplicativeOperator(token.value)) {
        const right = this.parseFactor(tokens, left.nextIndex + 1)
        left = {
          node: this.createOperatorNode(token.value as OperatorType, left.node, right.node),
          nextIndex: right.nextIndex
        }
      } else {
        break
      }
    }

    return left
  }

  private parseFactor(tokens: Token[], index: number): { node: FormulaNode, nextIndex: number } {
    const token = tokens[index]

    if (token.type === 'number') {
      return {
        node: this.createValueNode(parseFloat(token.value), 'number'),
        nextIndex: index + 1
      }
    } else if (token.type === 'string') {
      return {
        node: this.createValueNode(token.value, 'string'),
        nextIndex: index + 1
      }
    } else if (token.type === 'variable') {
      return {
        node: this.createVariableNode(token.value),
        nextIndex: index + 1
      }
    } else if (token.type === 'function') {
      return this.parseFunction(tokens, index)
    } else if (token.value === '(') {
      const expr = this.parseExpression(tokens, index + 1)
      if (tokens[expr.nextIndex]?.value !== ')') {
        throw new Error('Expected closing parenthesis')
      }
      return {
        node: expr.node,
        nextIndex: expr.nextIndex + 1
      }
    }

    throw new Error(`Unexpected token: ${token.value}`)
  }

  private parseFunction(tokens: Token[], index: number): { node: FunctionNode, nextIndex: number } {
    const functionName = tokens[index].value as FunctionType
    let nextIndex = index + 1

    if (tokens[nextIndex]?.value !== '(') {
      throw new Error('Expected opening parenthesis after function name')
    }

    nextIndex++
    const parameters: FormulaNode[] = []

    while (nextIndex < tokens.length && tokens[nextIndex].value !== ')') {
      const param = this.parseExpression(tokens, nextIndex)
      parameters.push(param.node)
      nextIndex = param.nextIndex

      if (tokens[nextIndex]?.value === ',') {
        nextIndex++
      }
    }

    if (tokens[nextIndex]?.value !== ')') {
      throw new Error('Expected closing parenthesis')
    }

    return {
      node: this.createFunctionNode(functionName, parameters),
      nextIndex: nextIndex + 1
    }
  }

  // Создание узлов
  private createValueNode(value: any, dataType: DataType): ValueNode {
    return {
      id: this.generateId(),
      type: 'value',
      dataType,
      value
    }
  }

  private createVariableNode(variablePath: string): VariableNode {
    return {
      id: this.generateId(),
      type: 'variable',
      variablePath,
      displayName: this.getDisplayName(variablePath),
      dataType: this.getVariableType(variablePath)
    }
  }

  private createOperatorNode(operator: OperatorType, left: FormulaNode, right: FormulaNode): OperatorNode {
    return {
      id: this.generateId(),
      type: 'operator',
      operator,
      leftInput: left,
      rightInput: right,
      dataType: this.getOperatorReturnType(operator, left.dataType, right.dataType)
    }
  }

  private createFunctionNode(functionName: FunctionType, parameters: FormulaNode[]): FunctionNode {
    return {
      id: this.generateId(),
      type: 'function',
      functionName,
      parameters,
      dataType: this.getFunctionReturnType(functionName)
    }
  }

  // Вспомогательные методы
  private createToken(value: string): Token {
    if (this.isNumber(value)) {
      return { type: 'number', value }
    } else if (this.isString(value)) {
      return { type: 'string', value: value.slice(1, -1) }
    } else if (this.isFunction(value)) {
      return { type: 'function', value }
    } else if (this.isOperator(value)) {
      return { type: 'operator', value }
    } else if (this.isVariable(value)) {
      return { type: 'variable', value }
    } else {
      return { type: 'unknown', value }
    }
  }

  private isNumber(value: string): boolean {
    return /^\d+(\.\d+)?$/.test(value)
  }

  private isString(value: string): boolean {
    return /^["'].*["']$/.test(value)
  }

  private isFunction(value: string): boolean {
    const functions = ['min', 'max', 'abs', 'round', 'floor', 'ceil', 'if', 'random']
    return functions.includes(value.toLowerCase())
  }

  private isOperator(value: string): boolean {
    const operators = ['+', '-', '*', '/', '%', '^', '==', '!=', '<', '>', '<=', '>=', '&&', '||']
    return operators.includes(value)
  }

  private isVariable(value: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(value)
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char)
  }

  private isAdditiveOperator(value: string): boolean {
    return ['+', '-'].includes(value)
  }

  private isMultiplicativeOperator(value: string): boolean {
    return ['*', '/', '%'].includes(value)
  }

  // LLM-специфичные методы
  private calculateConfidence(expression: string, formula: Formula): number {
    // Простая эвристика для расчета уверенности
    let confidence = 0.5

    // Проверяем наличие известных паттернов
    if (expression.includes('multiply') || expression.includes('times')) confidence += 0.2
    if (expression.includes('add') || expression.includes('plus')) confidence += 0.2
    if (expression.includes('if') || expression.includes('when')) confidence += 0.1

    // Проверяем структуру формулы
    if (formula.rootNode.type === 'operator') confidence += 0.1
    if (formula.rootNode.type === 'function') confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  private generateSuggestions(expression: string, formula: Formula): string[] {
    const suggestions: string[] = []

    // Анализируем выражение и предлагаем улучшения
    if (expression.includes('multiply')) {
      suggestions.push('Consider using the * operator for multiplication')
    }

    if (expression.includes('if')) {
      suggestions.push('Consider using the IF function for conditional logic')
    }

    return suggestions
  }

  private extractName(expression: string): string {
    // Извлекаем имя из выражения
    const lines = expression.split('\n')
    const firstLine = lines[0]

    if (firstLine.includes(':')) {
      return firstLine.split(':')[0].trim()
    }

    return 'Generated Formula'
  }

  private extractDescription(expression: string): string {
    // Извлекаем описание из выражения
    const lines = expression.split('\n')
    if (lines.length > 1) {
      return lines[1].trim()
    }

    return `Formula: ${expression}`
  }

  private getDisplayName(variablePath: string): string {
    // Преобразуем путь переменной в читаемое имя
    return variablePath.replace(/\./g, ' ').replace(/_/g, ' ')
  }

  private getVariableType(variablePath: string): DataType {
    // Определяем тип переменной по пути
    if (variablePath.includes('characteristics') || variablePath.includes('modifiers')) {
      return 'number'
    }

    return 'number' // По умолчанию
  }

  private getOperatorReturnType(operator: OperatorType, leftType: DataType, rightType: DataType): DataType {
    // Определяем возвращаемый тип оператора
    switch (operator) {
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
        return 'number'
      case 'equal':
      case 'not_equal':
      case 'less_than':
      case 'greater_than':
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
        return 'number'
      case 'if':
        return 'number' // Упрощение
      default:
        return 'number'
    }
  }

  private buildContext(node: FormulaNode): any {
    // Строим контекст формулы
    return {
      requiredVariables: this.extractVariables(node),
      optionalVariables: [],
      returnType: node.dataType,
      description: 'Generated formula context'
    }
  }

  private extractVariables(node: FormulaNode): string[] {
    const variables: string[] = []

    if (node.type === 'variable') {
      variables.push(node.variablePath)
    } else if (node.type === 'operator') {
      variables.push(...this.extractVariables(node.leftInput))
      variables.push(...this.extractVariables(node.rightInput))
    } else if (node.type === 'function') {
      node.parameters.forEach(param => {
        variables.push(...this.extractVariables(param))
      })
    }

    return [...new Set(variables)]
  }

  private generateId(): string {
    return `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

interface Token {
  type: 'number' | 'string' | 'function' | 'operator' | 'variable' | 'unknown'
  value: string
}
