"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import systemConfig from '@/data/system-unified.json'

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
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">Настроение</span>
                <span className={`text-sm font-bold ${getMoodColor(moodValue)}`}>
                  {getMoodIcon(moodValue)} {moodValue}%
                </span>
              </div>
              <Progress value={moodValue} className="h-2" />
            </div>
            <Separator className="bg-slate-600 my-4" />

            {/* Топ-5 характеристик и чувствительностей */}
            {(() => {
              const attrsCfg: any[] = (systemConfig as any)?.attributes || []
              const extraCfg: any[] = (systemConfig as any)?.attributes_extra || []
              const values = (characterStats?.attributes || {}) as Record<string, number>

              const pickTop = (ids: string[], topN: number) => {
                const items = ids
                  .map(id => ({ id, name: (attrsCfg.concat(extraCfg).find(a => a.id === id)?.name) || id, value: values[id] ?? 0 }))
                  .filter(x => (x.value ?? 0) > 0)
                  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                  .slice(0, topN)
                return items
              }

              const baseIds = attrsCfg.map(a => a.id)
              const sensitivityIds = extraCfg.map(a => a.id)

              const topBase = pickTop(baseIds, 5)
              const topSens = pickTop(sensitivityIds, 5)

              return (
                <div className="grid grid-cols-1 gap-4">
                  {topBase.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Топ‑5 характеристик</h4>
                      <div className="space-y-1">
                        {topBase.map(item => (
                          <div key={item.id} className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={item.value} className="w-24 h-1" />
                              <span className="text-xs text-gray-300">{item.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {topSens.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Топ‑5 чувствительностей</h4>
                      <div className="space-y-1">
                        {topSens.map(item => (
                          <div key={item.id} className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={item.value} className="w-24 h-1" />
                              <span className="text-xs text-gray-300">{item.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="stats">
            {/* Характеристики из system-unified.json */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Характеристики</h4>
              <div className="space-y-3">
                {(() => {
                  const attrs: any[] = (systemConfig as any)?.attributes || []
                  const extra: any[] = (systemConfig as any)?.attributes_extra || []
                  const byCat: Record<string, any[]> = {}
                  for (const a of [...attrs, ...extra]) {
                    const cat = a.category || 'other'
                    if (!byCat[cat]) byCat[cat] = []
                    byCat[cat].push(a)
                  }
                  return Object.entries(byCat).map(([cat, items]) => {
                    const visible = items.filter((a: any) => ((characterStats?.attributes as any)?.[a.id] ?? 0) > 0)
                    if (visible.length === 0) return null
                    return (
                      <div key={cat}>
                        <h5 className="text-xs font-medium text-cyan-400 mb-2">{cat}</h5>
                        <div className="space-y-1">
                          {visible.map((a: any) => {
                            const val = (characterStats?.attributes as any)?.[a.id] ?? 0
                            const name = a.name || a.id
                            return (
                              <div key={a.id}>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-400">{name}</span>
                                  <span className="text-xs font-medium text-gray-500">{renderCharacteristicValue(val)}</span>
                                </div>
                                <Progress value={val} className="h-1" />
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
            {/* Состояния */}
            {characterStats?.states && (
              <div>
                <Separator className="bg-slate-600 my-2" />
                <h5 className="text-xs font-semibold text-gray-400 mb-2">Состояния</h5>
                {(((systemConfig as any)?.states) || [])
                  .filter((s: any) => ((characterStats?.states as any)?.[s.id] ?? 0) > 0)
                  .map((s: any) => {
                    const val = (characterStats?.states as any)?.[s.id] ?? 0
                    const name = s.name || s.id
                    return (
                      <div key={s.id}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">{name}</span>
                          <span className={`text-xs font-medium ${getStatColor(val)}`}>{val}</span>
                        </div>
                        <Progress value={val} className="h-1" />
                      </div>
                    )
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fetishes">
            {/* Фетиши */}
            {characterStats?.fetishes && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Фетиши</h4>
                <div className="space-y-2">
                  {(((systemConfig as any)?.fetishes) || [])
                    .map((f: any) => {
                      const raw = (characterStats?.fetishes as any)?.[f.id]
                      let val = 0
                      if (typeof raw === 'number') {
                        if (raw <= 1) val = Math.max(0, Math.min(1, raw))
                        else if (raw <= 10) val = Math.max(0, Math.min(1, raw / 10))
                        else if (raw <= 100) val = Math.max(0, Math.min(1, raw / 100))
                        else val = 1
                      }
                      return { def: f, val }
                    })
                    .filter(({ val }: any) => val > 0)
                    .map(({ def, val }: any) => (
                      <div key={def.id} className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">{def.name || def.id}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={val * 100} className="w-16 h-1" />
                          <span className="text-xs text-purple-400">{Math.round(val * 100)}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
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
