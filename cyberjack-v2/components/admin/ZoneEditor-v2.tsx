'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ZoneEditorService, Zone, ZoneEditorState, ZoneEditorConfig } from '@/lib/core/zones/zone-editor-service'

interface ZoneEditorProps {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  initialZones: Zone[]
  onZonesChange: (zones: Zone[]) => void
  onZoneSelect?: (zone: Zone | null) => void
  className?: string
}

export function ZoneEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  initialZones,
  onZonesChange,
  onZoneSelect,
  className = ''
}: ZoneEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [editorService, setEditorService] = useState<ZoneEditorService | null>(null)
  const [editorState, setEditorState] = useState<ZoneEditorState | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createStart, setCreateStart] = useState<{ x: number; y: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Конфигурация редактора
  const config: ZoneEditorConfig = {
    imageWidth,
    imageHeight,
    minZoneSize: 20,
    maxZoneSize: Math.min(imageWidth, imageHeight)
  }

  // Инициализация сервиса
  useEffect(() => {
    const service = new ZoneEditorService(
      initialZones,
      config,
      (state) => {
        setEditorState(state)
        onZonesChange(state.zones)
      }
    )
    setEditorService(service)
    setEditorState(service.getState())
  }, [imageWidth, imageHeight])

  // Обновление зон при изменении пропсов
  useEffect(() => {
    if (editorService) {
      editorService.updateZones(initialZones)
    }
  }, [initialZones, editorService])

  // Обработка выбора зоны
  useEffect(() => {
    if (editorState && onZoneSelect) {
      const selectedZone = editorState.selectedZoneId
        ? editorService?.getZone(editorState.selectedZoneId)
        : null
      onZoneSelect(selectedZone || null)
    }
  }, [editorState?.selectedZoneId, editorService, onZoneSelect])

  // Загрузка изображения
  const loadImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageUrl) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Вычисляем масштаб для отображения
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const scaleX = containerWidth / imageWidth
      const scaleY = containerHeight / imageHeight
      const newScale = Math.min(scaleX, scaleY, 1) // Не увеличиваем больше оригинала

      setScale(newScale)

      const displayWidth = imageWidth * newScale
      const displayHeight = imageHeight * newScale

      canvas.width = displayWidth
      canvas.height = displayHeight

      ctx.clearRect(0, 0, displayWidth, displayHeight)

      // Рисуем изображение с сохранением пропорций (обрезаем, а не растягиваем)
      const imgAspect = img.width / img.height
      const canvasAspect = displayWidth / displayHeight

      let drawWidth = displayWidth
      let drawHeight = displayHeight
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > canvasAspect) {
        // Изображение шире - обрезаем по бокам
        drawWidth = displayHeight * imgAspect
        offsetX = (displayWidth - drawWidth) / 2
      } else {
        // Изображение выше - обрезаем сверху/снизу
        drawHeight = displayWidth / imgAspect
        offsetY = (displayHeight - drawHeight) / 2
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

      setImageLoaded(true)
      drawZones()
    }
    img.src = imageUrl
  }, [imageUrl, imageWidth, imageHeight, scale])

  // Отрисовка зон
  const drawZones = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !editorState) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Перерисовываем изображение
    const img = new Image()
    img.onload = () => {
      // Рисуем изображение с сохранением пропорций
      const imgAspect = img.width / img.height
      const canvasAspect = canvas.width / canvas.height

      let drawWidth = canvas.width
      let drawHeight = canvas.height
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > canvasAspect) {
        // Изображение шире - обрезаем по бокам
        drawWidth = canvas.height * imgAspect
        offsetX = (canvas.width - drawWidth) / 2
      } else {
        // Изображение выше - обрезаем сверху/снизу
        drawHeight = canvas.width / imgAspect
        offsetY = (canvas.height - drawHeight) / 2
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
      drawZonesOnCanvas()
    }
    img.src = imageUrl

    function drawZonesOnCanvas() {
      if (!editorState || !ctx) return

      editorState.zones.forEach(zone => {
        const isSelected = zone.id === editorState.selectedZoneId
        const x = zone.x * scale
        const y = zone.y * scale
        const width = zone.width * scale
        const height = zone.height * scale

        // Фон зоны
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'
        ctx.fillRect(x, y, width, height)

        // Граница зоны
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#6b7280'
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeRect(x, y, width, height)

        // Ручки изменения размера (только для выбранной зоны)
        if (isSelected) {
          const handleSize = 6
          const handles = [
            { x: x - handleSize/2, y: y - handleSize/2 }, // nw
            { x: x + width - handleSize/2, y: y - handleSize/2 }, // ne
            { x: x - handleSize/2, y: y + height - handleSize/2 }, // sw
            { x: x + width - handleSize/2, y: y + height - handleSize/2 } // se
          ]

          ctx.fillStyle = '#3b82f6'
          handles.forEach(handle => {
            ctx.fillRect(handle.x, handle.y, handleSize, handleSize)
          })
        }

        // Название зоны
        if (width > 60 && height > 20) {
          ctx.fillStyle = '#ffffff'
          ctx.font = '12px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(
            zone.name,
            x + width / 2,
            y + height / 2 + 4
          )
        }
      })
    }
  }, [editorState, scale, imageUrl])

  // Обработка событий мыши
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editorService || !editorState) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    // Проверяем, кликнули ли по ручке изменения размера
    if (editorState.selectedZoneId) {
      const handle = editorService.getResizeHandle(x, y, editorState.selectedZoneId)
      if (handle) {
        editorService.startResize(editorState.selectedZoneId, handle, e.clientX, e.clientY)
        return
      }
    }

    // Проверяем, кликнули ли по существующей зоне
    const clickedZone = editorService.getZoneAtPoint(x, y)
    if (clickedZone) {
      editorService.selectZone(clickedZone.id)
      editorService.startDrag(clickedZone.id, e.clientX, e.clientY)
      return
    }

    // Если кликнули по пустому месту, начинаем создание новой зоны
    editorService.selectZone(null)
    setIsCreating(true)
    setCreateStart({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!editorService || !editorState) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    if (editorState.isDragging) {
      editorService.updateDrag(e.clientX, e.clientY)
    } else if (editorState.isResizing) {
      editorService.updateResize(e.clientX, e.clientY)
    } else if (isCreating && createStart) {
      // Отрисовываем предварительную зону при создании
      drawZones()
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        const startX = createStart.x * scale
        const startY = createStart.y * scale
        const currentX = x * scale
        const currentY = y * scale

        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(
          Math.min(startX, currentX),
          Math.min(startY, currentY),
          Math.abs(currentX - startX),
          Math.abs(currentY - startY)
        )
        ctx.setLineDash([])
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!editorService || !editorState) return

    if (editorState.isDragging) {
      editorService.endDrag()
    } else if (editorState.isResizing) {
      editorService.endResize()
    } else if (isCreating && createStart) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left) / scale
        const y = (e.clientY - rect.top) / scale

        const newZone = editorService.createZoneFromCoordinates(
          createStart.x,
          createStart.y,
          x,
          y,
          `Зона ${editorState.zones.length + 1}`
        )

        if (newZone) {
          editorService.selectZone(newZone.id)
        }
      }
      setIsCreating(false)
      setCreateStart(null)
    }
  }

  // Загрузка изображения при монтировании
  useEffect(() => {
    loadImage()
  }, [loadImage])

  // Перерисовка зон при изменении состояния
  useEffect(() => {
    if (imageLoaded) {
      drawZones()
    }
  }, [editorState, imageLoaded, drawZones])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-100"
        style={{ minHeight: '400px' }}
      >
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (editorService) {
              editorService.endDrag()
              editorService.endResize()
            }
            setIsCreating(false)
            setCreateStart(null)
          }}
        />

        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-500">Загрузка изображения...</div>
          </div>
        )}
      </div>

      <div className="mt-2 text-sm text-gray-600">
        <p>• Кликните и перетащите для создания новой зоны</p>
        <p>• Кликните по зоне для выбора</p>
        <p>• Перетаскивайте зону для перемещения</p>
        <p>• Используйте угловые ручки для изменения размера</p>
      </div>
    </div>
  )
}
