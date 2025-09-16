'use client'

import React, { useState, useEffect } from 'react'
import { ZoneEditor } from './ZoneEditor-v2'
import { ZonePropertiesPanel } from './ZonePropertiesPanel-v2'
import { Zone } from '@/lib/core/zones/zone-editor-service'

interface ActiveZonesEditorProps {
  characterAngleId: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  className?: string
}

export function ActiveZonesEditor({
  characterAngleId,
  imageUrl,
  imageWidth,
  imageHeight,
  className = ''
}: ActiveZonesEditorProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [anatomyDefinitions, setAnatomyDefinitions] = useState<Array<{
    id: string
    name: string
    category: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Загрузка активных зон
  const loadZones = async () => {
    try {
      const response = await fetch(`/api/character-poses/angles/${characterAngleId}/zones`)
      if (response.ok) {
        const data = await response.json()
        setZones(data)
      }
    } catch (error) {
      console.error('Ошибка загрузки зон:', error)
    }
  }

  // Загрузка определений анатомии
  const loadAnatomyDefinitions = async () => {
    try {
      const response = await fetch('/api/anatomy')
      if (response.ok) {
        const data = await response.json()
        setAnatomyDefinitions(data)
      }
    } catch (error) {
      console.error('Ошибка загрузки определений анатомии:', error)
    }
  }

  // Сохранение зоны
  const saveZone = async (zone: Zone) => {
    setSaving(true)
    try {
      // Проверяем, является ли зона новой (временный ID)
      const isNewZone = zone.id.startsWith('zone_')

      if (isNewZone) {
        // Создаем новую зону
        const response = await fetch(`/api/character-poses/angles/${characterAngleId}/zones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: zone.name,
            anatomyDefId: zone.anatomyId,
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height
          })
        })

        if (response.ok) {
          const newZone = await response.json()
          setZones(prev => prev.map(z => z.id === zone.id ? newZone : z))
          setSelectedZone(newZone)
        } else {
          throw new Error('Ошибка создания зоны')
        }
      } else {
        // Обновляем существующую зону
        const response = await fetch(`/api/character-poses/angles/${characterAngleId}/zones/${zone.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: zone.name,
            anatomyDefId: zone.anatomyId,
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height
          })
        })

        if (response.ok) {
          const updatedZone = await response.json()
          setZones(prev => prev.map(z => z.id === zone.id ? updatedZone : z))
          setSelectedZone(updatedZone)
        } else {
          throw new Error('Ошибка сохранения зоны')
        }
      }
    } catch (error) {
      console.error('Ошибка сохранения зоны:', error)
      alert('Ошибка сохранения зоны')
    } finally {
      setSaving(false)
    }
  }

  // Создание новой зоны (теперь обрабатывается в saveZone)
  const createZone = async (zone: Omit<Zone, 'id'>) => {
    // Эта функция больше не нужна, так как создание обрабатывается в saveZone
    // Оставляем для совместимости, но не используем
    console.warn('createZone is deprecated, use saveZone instead')
  }

  // Удаление зоны
  const deleteZone = async (zoneId: string) => {
    setSaving(true)
    try {
      // Проверяем, является ли зона новой (временный ID)
      const isNewZone = zoneId.startsWith('zone_')

      if (isNewZone) {
        // Для новых зон просто удаляем из локального состояния
        setZones(prev => prev.filter(z => z.id !== zoneId))
        setSelectedZone(null)
      } else {
        // Для существующих зон удаляем через API
        const response = await fetch(`/api/character-poses/angles/${characterAngleId}/zones/${zoneId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          setZones(prev => prev.filter(z => z.id !== zoneId))
          setSelectedZone(null)
        } else {
          throw new Error('Ошибка удаления зоны')
        }
      }
    } catch (error) {
      console.error('Ошибка удаления зоны:', error)
      alert('Ошибка удаления зоны')
    } finally {
      setSaving(false)
    }
  }

  // Обработка изменения зон
  const handleZonesChange = (newZones: Zone[]) => {
    setZones(newZones)
  }

  // Обработка выбора зоны
  const handleZoneSelect = (zone: Zone | null) => {
    setSelectedZone(zone)
  }

  // Обработка обновления зоны
  const handleZoneUpdate = (zoneId: string, updates: Partial<Omit<Zone, 'id'>>) => {
    const zone = zones.find(z => z.id === zoneId)
    if (zone) {
      const updatedZone = { ...zone, ...updates }
      saveZone(updatedZone)
    }
  }

  // Обработка удаления зоны
  const handleZoneDelete = (zoneId: string) => {
    deleteZone(zoneId)
  }

  // Загрузка данных при монтировании
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        loadZones(),
        loadAnatomyDefinitions()
      ])
      setLoading(false)
    }

    loadData()
  }, [characterAngleId])

  if (loading) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <div className="text-gray-500">Загрузка редактора активных зон...</div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Редактор активных зон</h2>
        {saving && (
          <div className="text-sm text-blue-600">Сохранение...</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Графический редактор */}
        <div className="lg:col-span-2">
          <ZoneEditor
            imageUrl={imageUrl}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            initialZones={zones}
            onZonesChange={handleZonesChange}
            onZoneSelect={handleZoneSelect}
            className="w-full"
          />
        </div>

        {/* Панель свойств */}
        <div className="lg:col-span-1">
          <ZonePropertiesPanel
            selectedZone={selectedZone}
            onZoneUpdate={handleZoneUpdate}
            onZoneDelete={handleZoneDelete}
            anatomyDefinitions={anatomyDefinitions}
            className="w-full"
          />
        </div>
      </div>

      {/* Информация о зонах */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Информация о зонах</h3>
        <div className="text-sm text-gray-600">
          <p>Всего зон: {zones.length}</p>
          {selectedZone && (
            <p>Выбранная зона: {selectedZone.name}</p>
          )}
        </div>
      </div>
    </div>
  )
}
