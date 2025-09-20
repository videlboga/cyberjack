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
  onZoneCreate?: (zone: Zone) => void
  className?: string
}

export function ZoneEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  initialZones,
  onZonesChange,
  onZoneSelect,
  onZoneCreate,
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
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // Конфигурация редактора
  const config: ZoneEditorConfig = {
    imageWidth,
    minZoneSize: 20,
    maxZoneSize: Math.min(imageWidth, imageHeight)
  }

  // Функции управления масштабом
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
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
      // Вычисляем масштаб для отображения всего изображения
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const scaleX = containerWidth / imageWidth
      const scaleY = containerHeight / imageHeight
      const newScale = Math.min(scaleX, scaleY, 1) // Не увеличиваем больше оригинала

      setScale(newScale)

      // Размер canvas фиксированный
      const displayWidth = containerWidth
      const displayHeight = containerHeight

      canvas.width = displayWidth
      canvas.height = displayHeight

      ctx.clearRect(0, 0, displayWidth, displayHeight)

      // Рисуем изображение с сохранением пропорций, но показывая полностью
      const imgAspect = img.width / img.height
      const canvasAspect = displayWidth / displayHeight

      let drawWidth = displayWidth
      let drawHeight = displayHeight
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > canvasAspect) {
        // Изображение шире - подгоняем по ширине, добавляем отступы сверху/снизу
        drawWidth = displayWidth
        drawHeight = displayWidth / imgAspect
        offsetY = (displayHeight - drawHeight) / 2
      } else {
        // Изображение выше - подгоняем по высоте, добавляем отступы по бокам
        drawHeight = displayHeight
        drawWidth = displayHeight * imgAspect
        offsetX = (displayWidth - drawWidth) / 2
      }

      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      ctx.drawImage(img, offsetX / zoom, offsetY / zoom, drawWidth / zoom, drawHeight / zoom)
      ctx.restore()

      setImageLoaded(true)
      drawZones()
    }
    img.src = imageUrl
  }, [imageUrl, imageWidth, imageHeight, zoom, pan.x, pan.y])

  // Отрисовка зон
  const drawZones = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !editorState) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Перерисовываем изображение с сохранением пропорций
    const img = new Image()
    img.onload = () => {
      // Вычисляем размеры для отображения с сохранением пропорций
      const imgAspect = img.width / img.height
      const canvasAspect = canvas.width / canvas.height

      let drawWidth = canvas.width
      let drawHeight = canvas.height
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > canvasAspect) {
        // Изображение шире - подгоняем по ширине
        drawWidth = canvas.width
        drawHeight = canvas.width / imgAspect
        offsetY = (canvas.height - drawHeight) / 2
      } else {
        // Изображение выше - подгоняем по высоте
        drawHeight = canvas.height
        drawWidth = canvas.height * imgAspect
        offsetX = (canvas.width - drawWidth) / 2
      }

      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      ctx.drawImage(img, offsetX / zoom, offsetY / zoom, drawWidth / zoom, drawHeight / zoom)
      ctx.restore()
      drawZonesOnCanvas()
    }
    img.src = imageUrl

    function drawZonesOnCanvas() {
      if (!editorState || !ctx) return

      // Вычисляем отступы для корректного позиционирования зон
      const imgAspect = img.width / img.height
      const canvasAspect = canvas.width / canvas.height

      let offsetX = 0
      let offsetY = 0
      let scaleX = 1
      let scaleY = 1

      if (imgAspect > canvasAspect) {
        // Изображение шире - отступы сверху/снизу
        const drawHeight = canvas.width / imgAspect
        offsetY = (canvas.height - drawHeight) / 2
        scaleY = drawHeight / canvas.height
      } else {
        // Изображение выше - отступы по бокам
        const drawWidth = canvas.height * imgAspect
        offsetX = (canvas.width - drawWidth) / 2
        scaleX = drawWidth / canvas.width
      }

      // Применяем трансформации для зон
      ctx.save()
      ctx.translate(pan.x + offsetX, pan.y + offsetY)
      ctx.scale(scaleX, scaleY)

      editorState.zones.forEach(zone => {
        const isSelected = zone.id === editorState.selectedZoneId
        // Координаты зон в исходных координатах изображения, масштабируем их
        const x = zone.x * scale * zoom
        const y = zone.y * scale * zoom
        const width = zone.width * scale * zoom
        const height = zone.height * scale * zoom

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

      ctx.restore()
    }
  }, [editorState, scale, zoom, pan, imageUrl])

  // Обработка колеса мыши для зума
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)))
  }

  // Функция для преобразования координат мыши в координаты изображения
  const getImageCoordinates = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    const canvas = canvasRef.current
    if (!canvas || !canvas.width || !canvas.height) return { x: 0, y: 0 }

    const canvasX = clientX - rect.left
    const canvasY = clientY - rect.top

    // Вычисляем отступы изображения
    const imgAspect = imageWidth / imageHeight
    const canvasAspect = canvas.width / canvas.height

    let offsetX = 0
    let offsetY = 0
    let scaleX = 1
    let scaleY = 1

    if (imgAspect > canvasAspect) {
      const drawHeight = canvas.width / imgAspect
      offsetY = (canvas.height - drawHeight) / 2
      scaleY = drawHeight / canvas.height
    } else {
      const drawWidth = canvas.height * imgAspect
      offsetX = (canvas.width - drawWidth) / 2
      scaleX = drawWidth / canvas.width
    }

    // Преобразуем координаты в координаты изображения
    // Сначала убираем панорамирование и отступы
    const imageX = (canvasX - pan.x - offsetX) / scaleX
    const imageY = (canvasY - pan.y - offsetY) / scaleY

    // Затем убираем зум и масштабируем к исходным размерам изображения
    const x = (imageX / zoom) / scale
    const y = (imageY / zoom) / scale

    return { x, y }
  }

  // Обработка событий мыши
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editorService || !editorState || !imageLoaded) return

    const { x, y } = getImageCoordinates(e.clientX, e.clientY)

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
    if (!editorService || !editorState || !imageLoaded) return

    const { x, y } = getImageCoordinates(e.clientX, e.clientY)

    if (editorState.isDragging) {
      editorService.updateDrag(e.clientX, e.clientY)
    } else if (editorState.isResizing) {
      editorService.updateResize(e.clientX, e.clientY)
    } else if (isCreating && createStart) {
      // Отрисовываем предварительную зону при создании
      drawZones()
      const ctx = canvasRef.current?.getContext('2d')
      const canvas = canvasRef.current
      if (ctx && canvas) {
        // Вычисляем отступы для корректного позиционирования
        const imgAspect = imageWidth / imageHeight
        const canvasAspect = canvas.width / canvas.height

        let offsetX = 0
        let offsetY = 0
        let scaleX = 1
        let scaleY = 1

        if (imgAspect > canvasAspect) {
          const drawHeight = canvas.width / imgAspect
          offsetY = (canvas.height - drawHeight) / 2
          scaleY = drawHeight / canvas.height
        } else {
          const drawWidth = canvas.height * imgAspect
          offsetX = (canvas.width - drawWidth) / 2
          scaleX = drawWidth / canvas.width
        }

        const startX = (createStart.x * scale * zoom * scaleX) + pan.x + offsetX
        const startY = (createStart.y * scale * zoom * scaleY) + pan.y + offsetY
        const currentX = (x * scale * zoom * scaleX) + pan.x + offsetX
        const currentY = (y * scale * zoom * scaleY) + pan.y + offsetY

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
    if (!editorService || !editorState || !imageLoaded) return

    if (editorState.isDragging) {
      editorService.endDrag()
    } else if (editorState.isResizing) {
      editorService.endResize()
    } else if (isCreating && createStart) {
      const { x, y } = getImageCoordinates(e.clientX, e.clientY)

      const newZone = editorService.createZoneFromCoordinates(
        createStart.x,
        createStart.y,
        x,
        y,
        `Зона ${editorState.zones.length + 1}`
      )

      if (newZone) {
        editorService.selectZone(newZone.id)
        // Уведомляем родительский компонент о создании зоны
        if (onZoneCreate) {
          onZoneCreate(newZone)
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

  // Перерисовка при изменении зума или панорамирования
  useEffect(() => {
    if (imageLoaded) {
      loadImage()
    }
  }, [zoom, pan, loadImage, imageLoaded])

  return (
    <div className={`relative ${className}`}>
      {/* Панель управления */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Масштаб:</span>
          <button
            onClick={handleZoomOut}
            className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            −
          </button>
          <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            +
          </button>
          <button
            onClick={handleResetZoom}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Сброс
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Размер: {Math.round(imageWidth * scale * zoom)} × {Math.round(imageHeight * scale * zoom)}px
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-100 min-h-[500px] max-h-[80vh]"
      >
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
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

      <div className="mt-2 text-sm text-gray-600 space-y-1">
        <p>• Кликните и перетащите для создания новой зоны</p>
        <p>• Кликните по зоне для выбора</p>
        <p>• Перетаскивайте зону для перемещения</p>
        <p>• Используйте угловые ручки для изменения размера</p>
        <p>• Колесо мыши для масштабирования</p>
      </div>
    </div>
  )
}
