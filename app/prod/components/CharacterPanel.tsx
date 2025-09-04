"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import systemConfig from '@/data/system-unified.json'
import { getUniversalAttributeDisplayValue, getUniversalKnowledgeLevelIcon, getUniversalKnowledgeLevelColor } from '@/lib/universal-hidden-attributes'

interface CharacterPanelProps {
  talent: any
  isVisible: boolean
}

// Функция для отображения значения характеристики
const renderCharacteristicValue = (value: number) => {
  return value === 0 ? '❓' : value
}

// Функция для отображения прогресса характеристики
const renderCharacteristicProgress = (value: number) => {
  return {
    value: value === 0 ? 0 : value,
    className: `h-1 ${value === 0 ? 'opacity-30' : ''}`
  }
}

export default function CharacterPanel({ talent, isVisible }: CharacterPanelProps) {
  const PANEL_WIDTH = 560
  const PANEL_HEIGHT = 420

  const [position, setPosition] = useState(() => {
    // Центрируем панель при первом открытии
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(0, (window.innerWidth - PANEL_WIDTH) / 2),
        y: Math.max(0, (window.innerHeight - PANEL_HEIGHT) / 2)
      }
    }
    return { x: 100, y: 100 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y

      // Ограничиваем позицию границами экрана
      const maxX = window.innerWidth - PANEL_WIDTH
      const maxY = window.innerHeight - PANEL_HEIGHT

      setPosition(prev => ({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      }))
    }
  }, [isDragging, dragOffset])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])


  const getMoodColor = useCallback((mood: number) => {
    if (mood >= 80) return "text-green-400"
    if (mood >= 60) return "text-yellow-400"
    if (mood >= 40) return "text-orange-400"
    return "text-red-400"
  }, [])

  const getMoodIcon = useCallback((mood: number) => {
    if (mood >= 80) return "😊"
    if (mood >= 60) return "🙂"
    if (mood >= 40) return "😐"
    return "😞"
  }, [])

  const getStatColor = useCallback((value: number) => {
    if (value >= 80) return "text-green-400"
    if (value >= 60) return "text-blue-400"
    if (value >= 40) return "text-yellow-400"
    return "text-red-400"
  }, [])

  // Мемоизируем вычисления характеристик
  const characterStats = useMemo(() => {
    if (!talent) return null

    return {
      attributes: talent.attributes || {},
      states: talent.condition || talent.states || {},
      fetishes: (() => {
        const f = (talent as any)?.fetishes || {}
        const a = (talent as any)?.affinities || {}
        return { ...a, ...f }
      })(),
      memories: talent.memories || [],
      statusEffects: talent.statusEffects || []
    }
  }, [talent])

  // Мемоизируем вычисления настроения
  const moodValue = useMemo(() => {
    return (talent?.states?.mood ?? talent?.mood ?? 0)
  }, [talent?.states?.mood, talent?.mood])

  // Не допускаем условных хуков — проверка видимости после всех хуков
  if (!isVisible || !talent) return null

  return (
    <div
      className={`fixed glass-panel border border-cyan-500/50 rounded-lg z-50 w-[${PANEL_WIDTH}px] max-h-[80vh] flex flex-col cursor-move`}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="p-3 border-b border-gray-600 flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <h3 className="font-semibold text-cyan-400 flex items-center gap-2">
          <span className="text-2xl">👤</span>
          <span>{talent.name}</span>
        </h3>
        <Badge variant="outline" className="text-xs">
          {talent.status}
        </Badge>
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-4 mb-3">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="stats">Характеристики</TabsTrigger>
            <TabsTrigger value="states">Состояния</TabsTrigger>
            <TabsTrigger value="fetishes">Фетиши</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Эмоциональное состояние */}
            {(() => {
              const universalKnowledge = talent?.universalKnowledge
              const moodKnowledge = universalKnowledge?.states?.['Настроение'] || universalKnowledge?.states?.mood
              const moodLevel = moodKnowledge?.level || 'unknown'
              const shouldShowMood = moodLevel !== 'unknown'

              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Настроение</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-medium ${getUniversalKnowledgeLevelColor(moodLevel)}`}>
                        {getUniversalKnowledgeLevelIcon(moodLevel)}
                      </span>
                      <span className={`text-sm font-bold ${shouldShowMood ? getMoodColor(moodValue) : 'text-gray-500'}`}>
                        {shouldShowMood ? `${getMoodIcon(moodValue)} ${moodValue}%` : '❓'}
                      </span>
                    </div>
                  </div>
                  {shouldShowMood ? (
                    <Progress value={moodValue} className="h-2" />
                  ) : (
                    <div className="h-2 bg-gray-700 rounded opacity-30"></div>
                  )}
                </div>
              )
            })()}
            <Separator className="bg-slate-600 my-4" />

            {/* Топ-5 характеристик и чувствительностей */}
            {(() => {
              const attrsCfg: any[] = (systemConfig as any)?.attributes || []
              const extraCfg: any[] = (systemConfig as any)?.attributes_extra || []
              const values = (characterStats?.attributes || {}) as Record<string, number>

              const pickTop = (ids: string[], topN: number, category: string) => {
                const universalKnowledge = talent?.universalKnowledge
                const items = ids
                  .map(id => {
                    const attr = attrsCfg.concat(extraCfg).find(a => a.id === id)
                    const name = attr?.name || id
                    const value = values[id] ?? 0
                    const knowledge = universalKnowledge?.attributes?.[category]?.[id]
                    const level = knowledge?.level || 'unknown'

                    return {
                      id,
                      name,
                      value,
                      level,
                      shouldShow: level !== 'unknown' && value > 0
                    }
                  })
                  .filter(x => x.shouldShow)
                  .sort((a, b) => b.value - a.value)
                  .slice(0, topN)
                return items
              }

              const baseIds = attrsCfg.map(a => a.id)
              const sensitivityIds = extraCfg.map(a => a.id)

              const topBase = pickTop(baseIds, 5, 'physical') // Основные характеристики из physical категории
              const topSens = pickTop(sensitivityIds, 5, 'special') // Чувствительности из special категории

              return (
                <div className="grid grid-cols-1 gap-4">
                  {topBase.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Топ‑5 характеристик</h4>
                      <div className="space-y-1">
                        {topBase.map(item => {
                          const displayValue = item.level === 'unknown' ? '❓' : item.value.toString()
                          const colorClass = getUniversalKnowledgeLevelColor(item.level)
                          const icon = getUniversalKnowledgeLevelIcon(item.level)

                          return (
                            <div key={item.id} className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">{item.name}</span>
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-medium ${colorClass}`}>{icon}</span>
                                <span className="text-xs text-gray-300">{displayValue}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {topSens.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Топ‑5 чувствительностей</h4>
                      <div className="space-y-1">
                        {topSens.map(item => {
                          const displayValue = item.level === 'unknown' ? '❓' : item.value.toString()
                          const colorClass = getUniversalKnowledgeLevelColor(item.level)
                          const icon = getUniversalKnowledgeLevelIcon(item.level)

                          return (
                            <div key={item.id} className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">{item.name}</span>
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-medium ${colorClass}`}>{icon}</span>
                                <span className="text-xs text-gray-300">{displayValue}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="stats">
            {/* Характеристики из универсальной системы скрытых атрибутов */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Характеристики</h4>
              <div className="space-y-3">
                {(() => {
                  const attrs: any[] = (systemConfig as any)?.attributes || []
                  const extra: any[] = (systemConfig as any)?.attributes_extra || []
                  const universalKnowledge = talent?.universalKnowledge

                  // Категории характеристик
                  const categories = {
                    physical: attrs.filter((a: any) => a.category === 'physical'),
                    psychological: attrs.filter((a: any) => a.category === 'psychological'),
                    social: attrs.filter((a: any) => a.category === 'social'),
                    personality: attrs.filter((a: any) => a.category === 'personality'),
                    special: attrs.filter((a: any) => a.category === 'special')
                  }

                  // Добавляем extra атрибуты
                  extra.forEach((a: any) => {
                    const cat = a.category || 'special'
                    if (!categories[cat]) categories[cat] = []
                    categories[cat].push(a)
                  })

                  return Object.entries(categories).map(([cat, items]) => {
                    if (items.length === 0) return null

                    return (
                      <div key={cat}>
                        <h5 className="text-xs font-medium text-cyan-400 mb-2 capitalize">{cat}</h5>
                        <div className="space-y-1">
                          {items.map((a: any) => {
                            const name = a.name || a.id

                            // Получаем знания из универсальной системы
                            let knowledge = null
                            let actualValue = 0

                            if (universalKnowledge?.attributes?.[cat]?.[a.id]) {
                              knowledge = universalKnowledge.attributes[cat][a.id]
                              // Получаем реальное значение для отображения
                              const attrCat = cat === 'special' ? 'special' : cat
                              // Используем русское название из system-unified.json
                              const displayName = a.name || a.id
                              actualValue = talent?.characteristics?.[attrCat]?.[displayName] || 0
                            } else {
                              // Fallback для совместимости - пробуем оба варианта
                              const displayName = a.name || a.id
                              actualValue = talent?.characteristics?.[cat]?.[displayName] ||
                                          talent?.characteristics?.[cat]?.[a.id] || 0
                            }

                            const displayValue = knowledge
                              ? getUniversalAttributeDisplayValue(knowledge, actualValue)
                              : '❓'

                            const level = knowledge?.level || 'unknown'
                            const icon = getUniversalKnowledgeLevelIcon(level)
                            const colorClass = getUniversalKnowledgeLevelColor(level)

                            // Пропускаем нулевые атрибуты
                            if (actualValue === 0) return null

                            return (
                              <div key={a.id}>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-400">{name}</span>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs font-medium ${colorClass}`}>{icon}</span>
                                    <span className="text-xs font-medium text-gray-500">{displayValue}</span>
                                  </div>
                                </div>
                                {/* Показываем прогресс-бар только если уровень знания не 'unknown' */}
                                {level !== 'unknown' ? (
                                  <Progress value={actualValue} className="h-1" />
                                ) : (
                                  <div className="h-1 bg-gray-700 rounded opacity-30"></div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="states">
            {/* Состояния из универсальной системы */}
            <div>
              <h5 className="text-xs font-semibold text-gray-400 mb-2">Состояния</h5>
              {(() => {
                const states: any[] = (systemConfig as any)?.states || []
                const universalKnowledge = talent?.universalKnowledge

                return states.map((s: any) => {
                  const name = s.name || s.id
                  let knowledge = null
                  let actualValue = 0

                  // Получаем знания из универсальной системы
                  if (universalKnowledge?.states?.[s.id]) {
                    knowledge = universalKnowledge.states[s.id]
                    actualValue = talent?.states?.[s.id] || 0
                  } else {
                    // Fallback для совместимости
                    actualValue = talent?.states?.[s.id] || 0
                  }

                  const displayValue = knowledge
                    ? getUniversalAttributeDisplayValue(knowledge, actualValue, 100)
                    : '❓'

                  const level = knowledge?.level || 'unknown'
                  const icon = getUniversalKnowledgeLevelIcon(level)
                  const colorClass = getUniversalKnowledgeLevelColor(level)

                  // Пропускаем нулевые состояния
                  if (actualValue === 0) return null

                  return (
                    <div key={s.id}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">{name}</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-medium ${colorClass}`}>{icon}</span>
                          <span className={`text-xs font-medium ${getStatColor(actualValue)}`}>{displayValue}</span>
                        </div>
                      </div>
                      {/* Показываем прогресс-бар только если уровень знания не 'unknown' */}
                      {level !== 'unknown' ? (
                        <Progress value={actualValue} className="h-1" />
                      ) : (
                        <div className="h-1 bg-gray-700 rounded opacity-30"></div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </TabsContent>

          <TabsContent value="fetishes">
            {/* Фетиши из универсальной системы */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Фетиши</h4>
              <div className="space-y-2">
                {(() => {
                  const fetishes: any[] = (systemConfig as any)?.fetishes || []
                  const universalKnowledge = talent?.universalKnowledge

                  // Группируем фетиши по категориям
                  const categories = {
                    bdsm: fetishes.filter((f: any) => f.category === 'bdsm'),
                    psychological: fetishes.filter((f: any) => f.category === 'psychological'),
                    sensory: fetishes.filter((f: any) => f.category === 'sensory'),
                    body_parts: fetishes.filter((f: any) => f.category === 'body_parts'),
                    material: fetishes.filter((f: any) => f.category === 'material'),
                    social: fetishes.filter((f: any) => f.category === 'social'),
                    physiological: fetishes.filter((f: any) => f.category === 'physiological'),
                    extreme: fetishes.filter((f: any) => f.category === 'extreme'),
                    additional: fetishes.filter((f: any) => !f.category || f.category === 'additional')
                  }

                  return Object.entries(categories).map(([category, categoryFetishes]) => {
                    if (categoryFetishes.length === 0) return null

                    return (
                      <div key={category}>
                        <h5 className="text-xs font-medium text-purple-400 mb-2 capitalize">
                          {category === 'bdsm' ? 'БДСМ' :
                           category === 'psychological' ? 'Психологические' :
                           category === 'sensory' ? 'Сенсорные' :
                           category === 'body_parts' ? 'Телесные' :
                           category === 'material' ? 'Материальные' :
                           category === 'social' ? 'Социальные' :
                           category === 'physiological' ? 'Физиологические' :
                           category === 'extreme' ? 'Экстремальные' :
                           category === 'additional' ? 'Дополнительные' : category}
                        </h5>
                        <div className="space-y-1">
                          {categoryFetishes.map((f: any) => {
                            const name = f.name || f.id
                            let knowledge = null
                            let actualValue = 0

                            // Получаем знания из универсальной системы
                            if (universalKnowledge?.fetishes?.[category]?.[f.id]) {
                              knowledge = universalKnowledge.fetishes[category][f.id]
                              actualValue = talent?.fetishes?.[f.id] || 0
                            } else {
                              // Fallback для совместимости
                              actualValue = talent?.fetishes?.[f.id] || 0
                            }

                            // Преобразуем значение для отображения (0-10 -> 0-100%)
                            const displayValue = knowledge
                              ? getUniversalAttributeDisplayValue(knowledge, actualValue)
                              : '❓'

                            const level = knowledge?.level || 'unknown'
                            const icon = getUniversalKnowledgeLevelIcon(level)
                            const colorClass = getUniversalKnowledgeLevelColor(level)

                            // Пропускаем нулевые фетиши
                            if (actualValue === 0) return null

                            return (
                              <div key={f.id}>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-400">{name}</span>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs font-medium ${colorClass}`}>{icon}</span>
                                    <span className="text-xs font-medium text-purple-400">{displayValue}</span>
                                  </div>
                                </div>
                                {/* Показываем прогресс-бар только если уровень знания не 'unknown' */}
                                {level !== 'unknown' ? (
                                  <Progress value={actualValue * 10} className="h-1" />
                                ) : (
                                  <div className="h-1 bg-gray-700 rounded opacity-30"></div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Separator className="bg-slate-600 mb-4" />

      {/* Последние воспоминания */}
      {characterStats?.memories && characterStats.memories.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Последние воспоминания</h4>
          <div className="space-y-1">
            {characterStats.memories.slice(-3).map((memory: string, index: number) => (
              <div key={index} className="text-xs text-gray-400 bg-slate-700/50 p-2 rounded">
                {memory}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Статусные эффекты */}
      {characterStats?.statusEffects && characterStats.statusEffects.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Статусные эффекты</h4>
          <div className="flex flex-wrap gap-1">
            {characterStats.statusEffects.map((effect: any, index: number) => (
              <Badge
                key={index}
                variant={effect.type === 'buff' ? 'default' : 'destructive'}
                className="text-xs"
              >
                {effect.icon} {effect.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
