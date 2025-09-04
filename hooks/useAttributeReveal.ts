"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  UniversalCharacterKnowledge,
  createUnknownKnowledge
} from '@/lib/universal-hidden-attributes'
import {
  createAttributeChangeTracker,
  createAttributeChange,
  AttributeChange,
  RevealAttempt,
  calculateRevealProbability
} from '@/lib/attribute-reveal-system'

export interface CharacterSnapshot {
  attributes: Record<string, Record<string, number>>
  states: Record<string, number>
  fetishes: Record<string, number>
  timestamp: Date
}

export interface RevealResult {
  change: AttributeChange
  successfulReveals: RevealAttempt[]
  updatedKnowledge: UniversalCharacterKnowledge
}

export function useAttributeReveal(
  initialKnowledge: UniversalCharacterKnowledge,
  characterId: string
) {
  const { toast } = useToast()
  const [currentKnowledge, setCurrentKnowledge] = useState<UniversalCharacterKnowledge>(initialKnowledge)
  const [isProcessingChanges, setIsProcessingChanges] = useState(false)
  const [recentReveals, setRecentReveals] = useState<RevealAttempt[]>([])

  // Создаем трекер для отслеживания изменений
  const trackerRef = useRef(createAttributeChangeTracker(initialKnowledge))

  // Функция для получения актуального значения атрибута
  const getActualValue = useCallback((category: string, attributeId: string): number => {
    // Эта функция должна быть реализована в зависимости от того,
    // где хранятся актуальные значения персонажа
    // Пока возвращаем заглушку
    return 50 // TODO: реализовать получение реального значения
  }, [])

  // Функция для отслеживания изменения атрибута
  const trackAttributeChange = useCallback(async (
    category: string,
    attributeId: string,
    oldValue: number,
    newValue: number,
    context?: string
  ): Promise<RevealResult | null> => {
    setIsProcessingChanges(true)

    try {
      // Вычисляем процент изменения
      const changePercent = Math.abs(((newValue - oldValue) / Math.max(1, oldValue)) * 100)

      // Если изменение меньше 20%, не обрабатываем
      if (changePercent < 20) {
        setIsProcessingChanges(false)
        return null
      }

      // Отслеживаем изменение через трекер
      const result = trackerRef.current.trackChange(
        category,
        attributeId,
        oldValue,
        newValue,
        context
      )

      // Обновляем состояние
      setCurrentKnowledge(result.updatedKnowledge)

      // Добавляем успешные раскрытия в список недавних
      if (result.successfulReveals.length > 0) {
        setRecentReveals(prev => [...prev, ...result.successfulReveals])

        // Показываем уведомления о раскрытии
        result.successfulReveals.forEach(reveal => {
          showRevealNotification(reveal)
        })
      }

      setIsProcessingChanges(false)
      return result

    } catch (error) {
      console.error('Ошибка при обработке изменения атрибута:', error)
      setIsProcessingChanges(false)
      return null
    }
  }, [])

  // Функция для показа уведомления о раскрытии
  const showRevealNotification = useCallback((reveal: RevealAttempt) => {
    const attributeName = getAttributeDisplayName(reveal.category, reveal.attributeId)
    const levelText = getKnowledgeLevelText(reveal)

    toast({
      title: "🎯 Характеристика раскрыта!",
      description: `${attributeName} теперь ${levelText}`,
      duration: 5000,
    })
  }, [toast])

  // Функция для получения отображаемого имени атрибута
  const getAttributeDisplayName = useCallback((category: string, attributeId: string): string => {
    // TODO: реализовать получение реального имени из конфигурации
    return attributeId.charAt(0).toUpperCase() + attributeId.slice(1)
  }, [])

  // Функция для получения текста уровня знания
  const getKnowledgeLevelText = useCallback((reveal: RevealAttempt): string => {
    switch (reveal.changePercent) {
      case reveal.changePercent >= 80:
        return "точно известна"
      case reveal.changePercent >= 60:
        return "хорошо изучена"
      case reveal.changePercent >= 40:
        return "примерно известна"
      default:
        return "частично раскрыта"
    }
  }, [])

  // Функция для массового обновления характеристик (например, после сессии игры)
  const processBulkChanges = useCallback(async (
    changes: Array<{
      category: string
      attributeId: string
      oldValue: number
      newValue: number
      context?: string
    }>
  ): Promise<RevealResult[]> => {
    setIsProcessingChanges(true)
    const results: RevealResult[] = []

    try {
      for (const change of changes) {
        const result = await trackAttributeChange(
          change.category,
          change.attributeId,
          change.oldValue,
          change.newValue,
          change.context
        )

        if (result) {
          results.push(result)
        }
      }

      // Групповое уведомление если много раскрытий
      if (results.length > 3) {
        toast({
          title: "🎯 Множественное раскрытие!",
          description: `Раскрыто ${results.length} характеристик`,
          duration: 5000,
        })
      }

    } catch (error) {
      console.error('Ошибка при массовой обработке изменений:', error)
    }

    setIsProcessingChanges(false)
    return results
  }, [trackAttributeChange, toast])

  // Функция для получения статистики раскрытия
  const getRevealStats = useCallback(() => {
    const history = trackerRef.current.getRevealHistory()
    const totalAttempts = history.length
    const successfulAttempts = history.filter(h => h.successful).length
    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0

    return {
      totalAttempts,
      successfulAttempts,
      successRate,
      recentReveals: recentReveals.slice(-10) // последние 10 раскрытий
    }
  }, [recentReveals])

  // Функция для сброса истории раскрытий
  const resetRevealHistory = useCallback(() => {
    trackerRef.current.resetHistory()
    setRecentReveals([])
  }, [])

  // Эффект для очистки старых уведомлений
  useEffect(() => {
    const interval = setInterval(() => {
      setRecentReveals(prev => prev.filter(reveal =>
        Date.now() - reveal.timestamp.getTime() < 30000 // 30 секунд
      ))
    }, 10000) // каждые 10 секунд

    return () => clearInterval(interval)
  }, [])

  return {
    // Состояние
    currentKnowledge,
    isProcessingChanges,
    recentReveals,

    // Методы
    trackAttributeChange,
    processBulkChanges,
    getRevealStats,
    resetRevealHistory,

    // Утилиты
    calculateRevealProbability,
    getActualValue
  }
}
