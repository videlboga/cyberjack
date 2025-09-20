'use client'

import React, { useState, useEffect } from 'react'
import { ZoneEditorV7 } from './ZoneEditor-v7'
import { ZonePropertiesPanel } from './ZonePropertiesPanel-v2'
import { Zone } from '@/lib/core/zones/zone-editor-service'

interface MediaFile {
  id: string
  url: string
  type: 'image' | 'video' | 'gif'
  filename: string
}

interface ActiveZonesEditorProps {
  characterAngleId: string
  mediaFiles: MediaFile[]
  className?: string
}

export function ActiveZonesEditorV3({
  characterAngleId,
  mediaFiles,
  className = ''
}: ActiveZonesEditorProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [selectedMediaFile, setSelectedMediaFile] = useState<MediaFile | null>(null)
  const [anatomyDefinitions, setAnatomyDefinitions] = useState<Array<{
    id: string
    name: string
    category: string
  }>>([])
  const [defaultAnatomyId, setDefaultAnatomyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Инициализация - выбираем первое изображение по умолчанию
  useEffect(() => {
    if (mediaFiles.length > 0) {
      const firstImage = mediaFiles.find(file => file.type === 'image') || mediaFiles[0]
      setSelectedMediaFile(firstImage)
    }
  }, [mediaFiles])

  // Загрузка активных зон для выбранного медиа файла
  const loadZones = async (mediaFileId?: string) => {
    try {
      const response = await fetch(`/api/character-poses/angles/${characterAngleId}/zones`)
      if (response.ok) {
        const data = await response.json()

        // Фильтруем зоны по выбранному медиа файлу
        const filteredZones = mediaFileId
          ? data.filter((zone: any) => zone.mediaFileId === mediaFileId)
          : data.filter((zone: any) => !zone.mediaFileId) // Зоны без привязки к медиа

        console.log('📊 Загружены зоны:', filteredZones.map((zone: any) => ({
          id: zone.id,
          name: zone.name,
          anatomyDefId: zone.anatomyDefId,
          anatomyName: zone.anatomy?.name
        })))

        setZones(filteredZones)
      } else {
        console.error('❌ Ошибка загрузки зон:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки зон:', error)
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
        // Автоматическая коррекция размеров зоны
        const correctedZone = {
          ...zone,
          width: Math.max(1, zone.width),
          height: Math.max(1, zone.height)
        }

        // Создаем новую зону
        const requestData = {
          name: correctedZone.name,
          anatomyDefId: correctedZone.anatomyId,
          mediaFileId: selectedMediaFile?.id || null,
          x: correctedZone.x,
          y: correctedZone.y,
          width: correctedZone.width,
          height: correctedZone.height
        }



        const response = await fetch(`/api/character-poses/angles/${characterAngleId}/zones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        })

        if (response.ok) {
          const newZone = await response.json()
          setZones(prev => prev.map(z => z.id === zone.id ? newZone : z))
          setSelectedZone(newZone)
        } else {
          const errorData = await response.json()
          console.error('❌ Ошибка создания зоны:', {
            status: response.status,
            statusText: response.statusText,
            errorData
          })
          throw new Error(`Ошибка создания зоны: ${errorData.error || response.statusText}`)
        }
      } else {
        // Автоматическая коррекция размеров зоны
        const correctedZone = {
          ...zone,
          width: Math.max(1, zone.width),
          height: Math.max(1, zone.height)
        }

        // Обновляем существующую зону
        const updateData = {
          name: correctedZone.name,
          anatomyDefId: correctedZone.anatomyId,
          mediaFileId: selectedMediaFile?.id || null,
          x: correctedZone.x,
          y: correctedZone.y,
          width: correctedZone.width,
          height: correctedZone.height
        }

        console.log('🔍 Обновление зоны - отправляемые данные:', {
          zoneId: zone.id,
          anatomyId: correctedZone.anatomyId,
          updateData
        })

        const response = await fetch(`/api/character-poses/angles/${characterAngleId}/zones/${zone.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })

        if (response.ok) {
          const updatedZone = await response.json()
          console.log('✅ Зона обновлена в API:', {
            anatomyId: updatedZone.anatomyDefId,
            anatomyName: updatedZone.anatomy?.name,
            zoneName: updatedZone.name
          })
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

  // Обработка создания зоны
  const handleZoneCreate = (zone: Zone) => {
    // Автоматически привязываем к выбранной анатомической зоне
    if (defaultAnatomyId) {
      const anatomyDef = anatomyDefinitions.find(a => a.id === defaultAnatomyId)

      if (anatomyDef) {
        zone.anatomyId = defaultAnatomyId
        zone.anatomyName = anatomyDef.name
        zone.name = anatomyDef.name // Приравниваем название к названию анатомической зоны
      }
    }

    saveZone(zone)
  }

  // Обработка смены медиа файла
  const handleMediaFileChange = (mediaFile: MediaFile) => {
    setSelectedMediaFile(mediaFile)
    setSelectedZone(null) // Сбрасываем выбор зоны при смене медиа
  }

  // Загрузка данных при монтировании
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        loadAnatomyDefinitions()
      ])
      setLoading(false)
    }

    loadData()
  }, [characterAngleId])

  // Перезагрузка зон при смене медиа файла
  useEffect(() => {
    if (selectedMediaFile) {
      loadZones(selectedMediaFile.id)
    }
  }, [selectedMediaFile, characterAngleId])

  if (loading) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <div className="text-gray-500">Загрузка редактора активных зон...</div>
      </div>
    )
  }

  if (!selectedMediaFile) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <div className="text-gray-500">Нет доступных медиа файлов для редактирования зон</div>
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

      {/* Выбор медиа файла */}
      {mediaFiles.length > 1 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-3">Выберите медиа файл для редактирования зон:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mediaFiles.map((file) => (
              <div
                key={file.id}
                className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                  selectedMediaFile?.id === file.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => handleMediaFileChange(file)}
              >
                {file.type === 'image' || file.type === 'gif' ? (
                  <img
                    src={file.url}
                    alt={file.filename}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="text-2xl mb-1">🎥</div>
                      <div className="text-xs truncate px-2">{file.filename}</div>
                    </div>
                  </div>
                )}
                <div className="p-2 text-xs text-center bg-white">
                  <div className="font-medium truncate">{file.filename}</div>
                  <div className="text-gray-500 capitalize">{file.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Выбор анатомической зоны по умолчанию */}
      {anatomyDefinitions.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-3">Анатомическая зона по умолчанию для новых зон:</h3>
          <select
            value={defaultAnatomyId}
            onChange={(e) => setDefaultAnatomyId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Выберите анатомическую зону по умолчанию"
          >
            <option value="">Не выбрано</option>
            {anatomyDefinitions.map((anatomy) => (
              <option key={anatomy.id} value={anatomy.id}>
                {anatomy.name} ({anatomy.category})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Графический редактор */}
        <div className="lg:col-span-2">
          <ZoneEditorV7
            key={`${characterAngleId}-${selectedMediaFile.id}`}
            imageUrl={selectedMediaFile.url}
            imageWidth={800}
            imageHeight={600}
            initialZones={zones}
            onZonesChange={handleZonesChange}
            onZoneSelect={handleZoneSelect}
            onZoneCreate={handleZoneCreate}
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
            mediaFileId={selectedMediaFile.id}
            className="w-full"
          />
        </div>
      </div>

      {/* Информация о зонах */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Информация о зонах</h3>
        <div className="text-sm text-gray-600">
          <p>Медиа файл: {selectedMediaFile.filename}</p>
          <p>Всего зон для этого файла: {zones.length}</p>
          {selectedZone && (
            <p>Выбранная зона: {selectedZone.name}</p>
          )}
        </div>
      </div>
    </div>
  )
}
