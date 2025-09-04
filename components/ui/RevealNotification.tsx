"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { RevealAttempt } from '@/lib/attribute-reveal-system'
import { getUniversalKnowledgeLevelIcon, getUniversalKnowledgeLevelColor } from '@/lib/universal-hidden-attributes'
import { Sparkles, Target, Eye, Lock, Unlock } from 'lucide-react'

interface RevealNotificationProps {
  reveal: RevealAttempt
  onClose: () => void
  autoCloseDelay?: number
}

export function RevealNotification({
  reveal,
  onClose,
  autoCloseDelay = 5000
}: RevealNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [progress, setProgress] = useState(100)

  // Автоматическое закрытие
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          setIsVisible(false)
          setTimeout(onClose, 300) // задержка для анимации
          return 0
        }
        return prev - (100 / (autoCloseDelay / 100))
      })
    }, 100)

    return () => clearInterval(interval)
  }, [autoCloseDelay, onClose])

  const getAttributeDisplayName = (category: string, attributeId: string): string => {
    // TODO: реализовать получение реального имени из конфигурации
    const formattedId = attributeId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    return formattedId
  }

  const getCategoryDisplayName = (category: string): string => {
    const categoryNames: Record<string, string> = {
      physical: 'Физическая',
      psychological: 'Психологическая',
      social: 'Социальная',
      personality: 'Личностная',
      special: 'Специальная',
      bdsm: 'БДСМ',
      psychological_fetish: 'Психологический фетиш',
      sensory: 'Сенсорный',
      body_parts: 'Телесный',
      material: 'Материальный',
      emotional: 'Эмоциональная',
      motivational: 'Мотивационная',
      physical_state: 'Физическое состояние'
    }
    return categoryNames[category] || category
  }

  const getRevealDescription = (changePercent: number): string => {
    if (changePercent >= 80) return 'Полностью раскрыта!'
    if (changePercent >= 60) return 'Хорошо изучена'
    if (changePercent >= 40) return 'Примерно известна'
    return 'Частично раскрыта'
  }

  const getRevealIcon = (changePercent: number) => {
    if (changePercent >= 80) return <Sparkles className="w-5 h-5 text-yellow-400" />
    if (changePercent >= 60) return <Eye className="w-5 h-5 text-blue-400" />
    if (changePercent >= 40) return <Target className="w-5 h-5 text-green-400" />
    return <Unlock className="w-5 h-5 text-purple-400" />
  }

  const getRarityColor = (changePercent: number): string => {
    if (changePercent >= 80) return 'border-yellow-400 bg-yellow-400/10'
    if (changePercent >= 60) return 'border-blue-400 bg-blue-400/10'
    if (changePercent >= 40) return 'border-green-400 bg-green-400/10'
    return 'border-purple-400 bg-purple-400/10'
  }

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-full duration-300">
      <Card className={`w-80 border-2 ${getRarityColor(reveal.changePercent)} shadow-lg`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {getRevealIcon(reveal.changePercent)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-200 truncate">
                  {getAttributeDisplayName(reveal.category, reveal.attributeId)}
                </h4>
                <Badge variant="outline" className="text-xs">
                  {getCategoryDisplayName(reveal.category)}
                </Badge>
              </div>

              <p className="text-xs text-gray-400 mb-2">
                {getRevealDescription(reveal.changePercent)}
              </p>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Вероятность:</span>
                  <span className="text-gray-300">{Math.round(reveal.finalProbability * 100)}%</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Изменение:</span>
                  <span className="text-gray-300">+{Math.round(reveal.changePercent)}%</span>
                </div>

                <Progress
                  value={progress}
                  className="h-1 mt-2"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Компонент для отображения нескольких уведомлений
interface RevealNotificationManagerProps {
  reveals: RevealAttempt[]
  onRemoveReveal: (index: number) => void
}

export function RevealNotificationManager({
  reveals,
  onRemoveReveal
}: RevealNotificationManagerProps) {
  // Показываем только последние 3 уведомления
  const visibleReveals = reveals.slice(-3)

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {visibleReveals.map((reveal, index) => (
        <RevealNotification
          key={`${reveal.category}-${reveal.attributeId}-${reveal.timestamp.getTime()}`}
          reveal={reveal}
          onClose={() => onRemoveReveal(reveals.length - 3 + index)}
          autoCloseDelay={6000 - (index * 1000)} // разные задержки для каскада
        />
      ))}
    </div>
  )
}
