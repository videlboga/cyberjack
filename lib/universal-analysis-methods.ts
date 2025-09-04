// ===== УСТАРЕВШИЕ УНИВЕРСАЛЬНЫЕ МЕТОДЫ АНАЛИЗА =====
// ЗАМЕЩЕНЫ НОВОЙ СИСТЕМОЙ АВТОМАТИЧЕСКОГО РАСКРЫТИЯ
// @deprecated Используйте lib/attribute-reveal-system.ts

import { UniversalAttributeKnowledge, UniversalCharacterKnowledge } from './universal-hidden-attributes'

// ===== ПРЕДУПРЕЖДЕНИЕ =====
// Этот файл содержит устаревшую систему универсальных методов анализа.
// Новая система автоматического раскрытия находится в:
// lib/attribute-reveal-system.ts
//
// Все старые методы анализа были удалены.
// Раскрытие теперь происходит автоматически при изменениях характеристик >20%.

// УСТАРЕВШИЕ ТИПЫ - оставлены для совместимости
export type UniversalAnalysisMethod = string
export interface UniversalAnalysisMethodInfo {
  id: string
  name: string
  description: string
  cost: number
  time: number
  risk: string
  baseAccuracy: number
  reveals: any
  effects: any
}

// УСТАРЕВШИЕ КОНСТАНТЫ - оставлены для совместимости
export const UNIVERSAL_ANALYSIS_METHODS: Record<string, any> = {}

// Экспортируем пустые функции для совместимости
export function getUniversalAnalysisMethod() { return null }
export function calculateUniversalAnalysisCost() { return 0 }
export function simulateUniversalAnalysis() { return null }