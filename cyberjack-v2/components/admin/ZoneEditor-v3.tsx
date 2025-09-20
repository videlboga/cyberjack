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

export function ZoneEditorV3({
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
  const [imageLoaded, setImageLoaded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [imageDisplayInfo, setImageDisplayInfo] = useState({
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    displayWidth: 0,
    displayHeight: 0
  })

  // Конфигурация редактора
  const config: ZoneEditorConfig = {
    imageWidth,
    imageHeight,
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

  // Вычисление параметров отображения изображения
  const calculateImageDisplayInfo = useCallback((imgWidth: number, imgHeight: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const imgAspect = imgWidth / imgHeight
    const canvasAspect = canvas.width / canvas.height

    let offsetX = 0
    let offsetY = 0
    let displayWidth = canvas.width
    let displayHeight = canvas.height
    let scaleX = 1
    let scaleY = 1

    if (imgAspect > canvasAspect) {
      // Изображение шире - подгоняем по ширине
      displayWidth = canvas.width
      displayHeight = canvas.width / imgAspect
      offsetY = (canvas.height - displayHeight) / 2
      scaleY = displayHeight / canvas.height
    } else {
      // Изображение выше - подгоняем по высоте
      displayHeight = canvas.height
      displayWidth = canvas.height * imgAspect
      offsetX = (canvas.width - displayWidth) / 2
      scaleX = displayWidth / canvas.width
    }

    setImageDisplayInfo({
      offsetX,
      offsetY,
      scaleX,
      scaleY,
      displayWidth,
      displayHeight
    })
  }, [])

  // Загрузка изображения
  const loadImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageUrl) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Размер canvas фиксированный
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      canvas.width = containerWidth
      canvas.height = containerHeight

      // Используем реальные размеры изображения
      calculateImageDisplayInfo(img.naturalWidth, img.naturalHeight)
      setImageLoaded(true)
      drawZones()
    }
    img.src = imageUrl
  }, [imageUrl, calculateImageDisplayInfo])

  // Отрисовка зон
  const drawZones = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !editorState || !imageLoaded) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Перерисовываем изображение
    const img = new Image()
    img.onload = () => {
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      ctx.drawImage(
        img,
        imageDisplayInfo.offsetX / zoom,
        imageDisplayInfo.offsetY / zoom,
        imageDisplayInfo.displayWidth / zoom,
        imageDisplayInfo.displayHeight / zoom
      )
      ctx.restore()
      drawZonesOnCanvas()
    }
    img.src = imageUrl

    function drawZonesOnCanvas() {
      if (!editorState || !ctx) return

      // Применяем трансформации для зон
      ctx.save()
      ctx.translate(pan.x + imageDisplayInfo.offsetX, pan.y + imageDisplayInfo.offsetY)
      ctx.scale(zoom * imageDisplayInfo.scaleX, zoom * imageDisplayInfo.scaleY)

      editorState.zones.forEach(zone => {
        const isSelected = zone.id === editorState.selectedZoneId

        // Фон зоны
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height)

        // Граница зоны
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#6b7280'
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height)

        // Ручки изменения размера (только для выбранной зоны)
        if (isSelected) {
          const handleSize = 6
          const handles = [
            { x: zone.x - handleSize/2, y: zone.y - handleSize/2 }, // nw
            { x: zone.x + zone.width - handleSize/2, y: zone.y - handleSize/2 }, // ne
            { x: zone.x - handleSize/2, y: zone.y + zone.height - handleSize/2 }, // sw
            { x: zone.x + zone.width - handleSize/2, y: zone.y + zone.height - handleSize/2 } // se
          ]

          ctx.fillStyle = '#3b82f6'
          handles.forEach(handle => {
            ctx.fillRect(handle.x, handle.y, handleSize, handleSize)
          })
        }

        // Название зоны
        if (zone.width > 60 && zone.height > 20) {
          ctx.fillStyle = '#ffffff'
          ctx.font = '12px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(
            zone.name,
            zone.x + zone.width / 2,
            zone.y + zone.height / 2 + 4
          )
        }
      })

      ctx.restore()
    }
  }, [editorState, zoom, pan, imageUrl, imageDisplayInfo, imageLoaded])

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

    // Преобразуем координаты в координаты изображения
    const imageX = (canvasX - pan.x - imageDisplayInfo.offsetX) / (zoom * imageDisplayInfo.scaleX)
    const imageY = (canvasY - pan.y - imageDisplayInfo.offsetY) / (zoom * imageDisplayInfo.scaleY)

    return { x: imageX, y: imageY }
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
      if (ctx) {
        const startX = (createStart.x * zoom * imageDisplayInfo.scaleX) + pan.x + imageDisplayInfo.offsetX
        const startY = (createStart.y * zoom * imageDisplayInfo.scaleY) + pan.y + imageDisplayInfo.offsetY
        const currentX = (x * zoom * imageDisplayInfo.scaleX) + pan.x + imageDisplayInfo.offsetX
        const currentY = (y * zoom * imageDisplayInfo.scaleY) + pan.y + imageDisplayInfo.offsetY

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
          Размер: {Math.round(imageWidth * zoom)} × {Math.round(imageHeight * zoom)}px
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
