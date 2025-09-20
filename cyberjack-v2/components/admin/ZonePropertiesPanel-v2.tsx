'use client'

import React, { useState, useEffect } from 'react'
import { Zone } from '@/lib/core/zones/zone-editor-service'

interface ZonePropertiesPanelProps {
  selectedZone: Zone | null
  onZoneUpdate: (zoneId: string, updates: Partial<Omit<Zone, 'id'>>) => void
  onZoneDelete: (zoneId: string) => void
  anatomyDefinitions: Array<{
    id: string
    name: string
    category: string
  }>
  mediaFileId?: string
  className?: string
}

export function ZonePropertiesPanel({
  selectedZone,
  onZoneUpdate,
  onZoneDelete,
  anatomyDefinitions,
  mediaFileId,
  className = ''
}: ZonePropertiesPanelProps) {
  const [name, setName] = useState('')
  const [anatomyId, setAnatomyId] = useState<string>('')
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)

  // Обновляем поля при изменении выбранной зоны
  useEffect(() => {
    if (selectedZone) {
      console.log('🎯 ZonePropertiesPanel: Загружена зона:', {
        id: selectedZone.id,
        name: selectedZone.name,
        anatomyId: selectedZone.anatomyId,
        anatomyDefId: (selectedZone as any).anatomyDefId
      })

      setName(selectedZone.name)
      // Используем anatomyDefId если anatomyId не установлен
      const anatomyIdToUse = selectedZone.anatomyId || (selectedZone as any).anatomyDefId || ''
      setAnatomyId(anatomyIdToUse)
      setX(Math.round(selectedZone.x) || 0)
      setY(Math.round(selectedZone.y) || 0)
      setWidth(Math.round(selectedZone.width) || 0)
      setHeight(Math.round(selectedZone.height) || 0)
    } else {
      setName('')
      setAnatomyId('')
      setX(0)
      setY(0)
      setWidth(0)
      setHeight(0)
    }
  }, [selectedZone])

  // Автоматически обновляем название при изменении анатомической зоны
  useEffect(() => {
    if (anatomyId && anatomyDefinitions.length > 0) {
      const anatomyDef = anatomyDefinitions.find(a => a.id === anatomyId)
      if (anatomyDef) {
        setName(anatomyDef.name)
      }
    }
  }, [anatomyId, anatomyDefinitions])

  const handleSave = () => {
    if (!selectedZone) return

    const updates = {
      name,
      anatomyId: anatomyId || undefined,
      mediaFileId: mediaFileId || undefined,
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height)
    }

    console.log('💾 ZonePropertiesPanel: Сохранение зоны:', {
      zoneId: selectedZone.id,
      updates
    })

    onZoneUpdate(selectedZone.id, updates)
  }

  const handleDelete = () => {
    if (!selectedZone) return

    if (confirm('Вы уверены, что хотите удалить эту зону?')) {
      onZoneDelete(selectedZone.id)
    }
  }

  if (!selectedZone) {
    return (
      <div className={`p-4 border border-gray-300 rounded-lg bg-gray-50 ${className}`}>
        <h3 className="text-lg font-semibold mb-2">Свойства зоны</h3>
        <p className="text-gray-500">Выберите зону для редактирования</p>
      </div>
    )
  }

  return (
    <div className={`p-4 border border-gray-300 rounded-lg bg-white ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Свойства зоны</h3>

      <div className="space-y-4">
        {/* Название зоны */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Название
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Введите название зоны"
          />
        </div>

        {/* Связь с анатомией */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Анатомическая зона
          </label>
          <select
            value={anatomyId}
            onChange={(e) => setAnatomyId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Выберите анатомическую зону"
          >
            <option value="">Не выбрано</option>
            {anatomyDefinitions.map((anatomy) => (
              <option key={anatomy.id} value={anatomy.id}>
                {anatomy.name} ({anatomy.category})
              </option>
            ))}
          </select>
        </div>

        {/* Координаты и размеры */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              X (px)
            </label>
            <input
              type="number"
              value={isNaN(x) ? 0 : x}
              onChange={(e) => {
                const value = Number(e.target.value)
                setX(isNaN(value) ? 0 : value)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              aria-label="Координата X"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Y (px)
            </label>
            <input
              type="number"
              value={isNaN(y) ? 0 : y}
              onChange={(e) => {
                const value = Number(e.target.value)
                setY(isNaN(value) ? 0 : value)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              aria-label="Координата Y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ширина (px)
            </label>
            <input
              type="number"
              value={isNaN(width) ? 0 : width}
              onChange={(e) => {
                const value = Number(e.target.value)
                setWidth(isNaN(value) ? 0 : Math.max(1, value))
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              aria-label="Ширина зоны"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Высота (px)
            </label>
            <input
              type="number"
              value={isNaN(height) ? 0 : height}
              onChange={(e) => {
                const value = Number(e.target.value)
                setHeight(isNaN(value) ? 0 : Math.max(1, value))
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              aria-label="Высота зоны"
            />
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Сохранить
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  )
}
