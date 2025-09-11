// ===== УСТАРЕВШАЯ СИСТЕМА АНАЛИЗА =====
// ЗАМЕЩЕНА НОВОЙ СИСТЕМОЙ АВТОМАТИЧЕСКОГО РАСКРЫТИЯ
// @deprecated Используйте lib/attribute-reveal-system.ts

import {
  CharacterAttributes,
  CharacterAttributeKnowledge,
  CharacteristicKnowledge,
  KnowledgeLevel
} from './unified-entities'

// УСТАРЕВШИЕ ТИПЫ - оставлены для совместимости
export type AnalysisMethod = string
export type AnalysisMethodInfo = any
export type AnalysisSession = any

// ===== УСТАРЕВШИЕ МЕТОДЫ =====
// Все методы анализа убраны в пользу автоматического раскрытия
// Используйте lib/attribute-reveal-system.ts для новой системы

export const ANALYSIS_METHODS: Record<string, any> = {}

// ===== ПРЕДУПРЕЖДЕНИЕ =====
// Этот файл содержит устаревшую систему анализа характеристик.
// Новая система автоматического раскрытия находится в:
// lib/attribute-reveal-system.ts
//
// Все старые методы анализа были удалены.
// Раскрытие теперь происходит автоматически при изменениях характеристик >20%.

// Экспортируем пустые функции для совместимости
export function analyzeCharacter() { return null }
export function getAnalysisCost() { return 0 }
export function getAnalysisTime() { return 0 }

// ===== ФУНКЦИИ ДЛЯ ОТОБРАЖЕНИЯ УРОВНЕЙ ЗНАНИЙ =====
// Добавлены для совместимости с UserKnowledgePanel

export function calculateAnalysisProgress(knowledge: any): number {
  if (!knowledge) return 0

  const entries = Object.entries(knowledge)
  if (entries.length === 0) return 0

  const knownCount = entries.filter(([key, value]: [string, any]) =>
    value && (value.level === 'known' || value.level === 'partial')
  ).length

  return Math.round((knownCount / entries.length) * 100)
}

export function getCharacteristicDisplayValue(knowledge: any, actualValue: number): string {
  if (!knowledge) return '??'

  switch (knowledge.level) {
    case 'known':
      return actualValue.toString()
    case 'partial':
      return `~${Math.round(actualValue)}`
    case 'suspected':
      return '??.?'
    default:
      return '??'
  }
}

export function getKnowledgeLevelIcon(level: string): string {
  switch (level) {
    case 'known':
      return '✅'
    case 'partial':
      return '🤔'
    case 'suspected':
      return '❓'
    default:
      return '❌'
  }
}

export function getKnowledgeLevelColor(level: string): string {
  switch (level) {
    case 'known':
      return 'text-green-400'
    case 'partial':
      return 'text-yellow-400'
    case 'suspected':
      return 'text-orange-400'
    default:
      return 'text-red-400'
  }
}