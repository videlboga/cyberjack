"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

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

  const [position, setPosition] = useState(() => {
    // Центрируем панель при первом открытии
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(0, (window.innerWidth - 320) / 2),
        y: Math.max(0, (window.innerHeight - 400) / 2)
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
      const maxX = window.innerWidth - 320 // w-80 = 320px
      const maxY = window.innerHeight - 400 // примерная высота панели
      
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

  if (!isVisible || !talent) return null

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
      states: talent.states || {},
      fetishes: talent.fetishes || [],
      memories: talent.memories || [],
      statusEffects: talent.statusEffects || []
    }
  }, [talent])

  // Мемоизируем вычисления настроения
  const moodValue = useMemo(() => {
    return talent.states?.mood || talent.mood || 0
  }, [talent.states?.mood, talent.mood])

  return (
    <div 
      className="fixed glass-panel border border-cyan-500/50 rounded-lg z-50 w-80 max-h-[80vh] flex flex-col cursor-move"
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

        <Separator className="bg-slate-600 mb-4" />

        {/* Основные характеристики */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Характеристики</h4>
          <div className="space-y-3">
            {/* Физические характеристики */}
            {characterStats?.attributes?.endurance !== undefined && (
              <div>
                <h5 className="text-xs font-medium text-cyan-400 mb-2">Физические</h5>
                <div className="space-y-1">
                                                    <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Выносливость</span>
                    <span className="text-xs font-medium text-gray-500">
                      {renderCharacteristicValue(characterStats.attributes.endurance)}
                    </span>
                  </div>
                  <Progress {...renderCharacteristicProgress(characterStats.attributes.endurance)} />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Чувствительность</span>
                    <span className="text-xs font-medium text-gray-500">
                      {renderCharacteristicValue(characterStats.attributes.sensitivity)}
                    </span>
                  </div>
                  <Progress {...renderCharacteristicProgress(characterStats.attributes.sensitivity)} />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Гибкость</span>
                    <span className="text-xs font-medium text-gray-500">
                      {renderCharacteristicValue(characterStats.attributes.flexibility)}
                    </span>
                  </div>
                  <Progress {...renderCharacteristicProgress(characterStats.attributes.flexibility)} />
                </div>
              </div>
            )}

            {/* Психологические характеристики */}
            {characterStats?.attributes?.emotionalStability !== undefined && (
              <div>
                <h5 className="text-xs font-medium text-cyan-400 mb-2">Психологические</h5>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Эм. стабильность</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Адаптивность</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Интеллект</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />
                </div>
              </div>
            )}

            {/* Социальные характеристики */}
            {characterStats?.attributes?.sociability !== undefined && (
              <div>
                <h5 className="text-xs font-medium text-cyan-400 mb-2">Социальные</h5>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Общительность</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Эмпатия</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Доминантность</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />
                </div>
              </div>
            )}

            {/* Личностные характеристики */}
            {characterStats?.attributes?.selfEsteem !== undefined && (
              <div>
                <h5 className="text-xs font-medium text-cyan-400 mb-2">Личностные</h5>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Самооценка</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Оптимизм</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Любопытство</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />
                </div>
              </div>
            )}

            {/* Специальные характеристики */}
            {characterStats?.attributes?.sexualExperience !== undefined && (
              <div>
                <h5 className="text-xs font-medium text-cyan-400 mb-2">Специальные</h5>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Секс. опытность</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Сопротивляемость</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Зависимость</span>
                    <span className="text-xs font-medium text-gray-500">
                      ❓
                    </span>
                  </div>
                  <Progress value={0} className="h-1 opacity-30" />
                </div>
              </div>
            )}
          </div>

          {/* Состояния */}
          {characterStats?.states && (
            <div>
              <Separator className="bg-slate-600 my-2" />
              <h5 className="text-xs font-semibold text-gray-400 mb-2">Состояния</h5>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Настроение</span>
                  <span className={`text-xs font-medium ${getStatColor(characterStats.states.mood || 0)}`}>
                    {characterStats.states.mood || 0}
                  </span>
                </div>
                <Progress value={characterStats.states.mood || 0} className="h-1" />
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Тревожность</span>
                  <span className={`text-xs font-medium ${getStatColor(characterStats.states.anxiety || 0)}`}>
                    {characterStats.states.anxiety || 0}
                  </span>
                </div>
                <Progress value={characterStats.states.anxiety || 0} className="h-1" />
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Выгорание</span>
                  <span className={`text-xs font-medium ${getStatColor(characterStats.states.burnout || 0)}`}>
                    {characterStats.states.burnout || 0}
                  </span>
                </div>
                <Progress value={characterStats.states.burnout || 0} className="h-1" />
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Вовлеченность</span>
                  <span className={`text-xs font-medium ${getStatColor(characterStats.states.engagement || 0)}`}>
                    {characterStats.states.engagement || 0}
                  </span>
                </div>
                <Progress value={characterStats.states.engagement || 0} className="h-1" />
            </div>
          )}
        </div>

        <Separator className="bg-slate-600 mb-4" />

        {/* Фетиши */}
        {characterStats?.fetishes && characterStats.fetishes.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Фетиши</h4>
            <div className="space-y-2">
              {characterStats.fetishes.map((fetish: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">{fetish.name}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={fetish.intensity * 100} className="w-16 h-1" />
                    <span className="text-xs text-purple-400">
                      {Math.round(fetish.intensity * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
    </div>
  )
}
