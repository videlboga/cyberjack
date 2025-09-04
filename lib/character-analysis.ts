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