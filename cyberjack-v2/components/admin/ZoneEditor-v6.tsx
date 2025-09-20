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

export function ZoneEditorV6({
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
  const [imageInfo, setImageInfo] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1
  })

  // Конфигурация редактора - будет обновлена после загрузки изображения
  const [config, setConfig] = useState<ZoneEditorConfig>({
    imageWidth: 800,
    imageHeight: 600,
    minZoneSize: 20,
    maxZoneSize: 600
  })

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
  }, [config])

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
      // Размер canvas фиксированный
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      canvas.width = containerWidth
      canvas.height = containerHeight

      // Вычисляем параметры отображения с сохранением пропорций
      const imgAspect = img.naturalWidth / img.naturalHeight
      const canvasAspect = containerWidth / containerHeight

      let displayWidth = containerWidth
      let displayHeight = containerHeight
      let offsetX = 0
      let offsetY = 0
      let scaleX = 1
      let scaleY = 1

      if (imgAspect > canvasAspect) {
        // Изображение шире - подгоняем по ширине
        displayWidth = containerWidth
        displayHeight = containerWidth / imgAspect
        offsetY = (containerHeight - displayHeight) / 2
        scaleY = displayHeight / containerHeight
      } else {
        // Изображение выше - подгоняем по высоте
        displayHeight = containerHeight
        displayWidth = containerHeight * imgAspect
        offsetX = (containerWidth - displayWidth) / 2
        scaleX = displayWidth / containerWidth
      }

      setImageInfo({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth,
        displayHeight,
        offsetX,
        offsetY,
        scaleX,
        scaleY
      })

      // Обновляем конфигурацию с реальными размерами изображения
      setConfig({
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
        minZoneSize: 20,
        maxZoneSize: Math.min(img.naturalWidth, img.naturalHeight)
      })

      setImageLoaded(true)
      drawZones()
    }
    img.src = imageUrl
  }, [imageUrl])

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
        imageInfo.offsetX / zoom,
        imageInfo.offsetY / zoom,
        imageInfo.displayWidth / zoom,
        imageInfo.displayHeight / zoom
      )
      ctx.restore()
      drawZonesOnCanvas()
    }
    img.src = imageUrl

    function drawZonesOnCanvas() {
      if (!editorState || !ctx) return

      editorState.zones.forEach(zone => {
        const isSelected = zone.id === editorState.selectedZoneId

        // Преобразуем координаты зоны в координаты отображения
        const displayX = (zone.x / imageInfo.naturalWidth) * imageInfo.displayWidth
        const displayY = (zone.y / imageInfo.naturalHeight) * imageInfo.displayHeight
        const displayWidth = (zone.width / imageInfo.naturalWidth) * imageInfo.displayWidth
        const displayHeight = (zone.height / imageInfo.naturalHeight) * imageInfo.displayHeight

        // Применяем трансформации
        ctx.save()
        ctx.translate(pan.x + imageInfo.offsetX, pan.y + imageInfo.offsetY)
        ctx.scale(zoom * imageInfo.scaleX, zoom * imageInfo.scaleY)

        // Фон зоны
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'
        ctx.fillRect(displayX, displayY, displayWidth, displayHeight)

        // Граница зоны
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#6b7280'
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeRect(displayX, displayY, displayWidth, displayHeight)

        // Ручки изменения размера (только для выбранной зоны)
        if (isSelected) {
          const handleSize = 6
          const handles = [
            { x: displayX - handleSize/2, y: displayY - handleSize/2 }, // nw
            { x: displayX + displayWidth - handleSize/2, y: displayY - handleSize/2 }, // ne
            { x: displayX - handleSize/2, y: displayY + displayHeight - handleSize/2 }, // sw
            { x: displayX + displayWidth - handleSize/2, y: displayY + displayHeight - handleSize/2 } // se
          ]

          ctx.fillStyle = '#3b82f6'
          handles.forEach(handle => {
            ctx.fillRect(handle.x, handle.y, handleSize, handleSize)
          })
        }

        // Название зоны
        if (displayWidth > 60 && displayHeight > 20) {
          ctx.fillStyle = '#ffffff'
          ctx.font = '12px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(
            zone.name,
            displayX + displayWidth / 2,
            displayY + displayHeight / 2 + 4
          )
        }

        ctx.restore()
      })
    }
  }, [editorState, zoom, pan, imageUrl, imageInfo, imageLoaded])

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
    const imageX = (canvasX - pan.x - imageInfo.offsetX) / (zoom * imageInfo.scaleX)
    const imageY = (canvasY - pan.y - imageInfo.offsetY) / (zoom * imageInfo.scaleY)

    // Преобразуем в координаты исходного изображения
    const x = (imageX / imageInfo.displayWidth) * imageInfo.naturalWidth
    const y = (imageY / imageInfo.displayHeight) * imageInfo.naturalHeight

    return { x, y }
  }

  // Обработка событий мыши
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editorService || !editorState || !imageLoaded) return

    const { x, y } = getImageCoordinates(e.clientX, e.clientY)

    console.log('🖱️ Mouse down:', {
      clientX: e.clientX,
      clientY: e.clientY,
      imageCoords: { x, y },
      imageInfo,
      pan,
      zoom
    })

    // Проверяем, кликнули ли по ручке изменения размера
    if (editorState.selectedZoneId) {
      const handle = editorService.getResizeHandle(x, y, editorState.selectedZoneId)
      if (handle) {
        console.log('🔧 Resize handle clicked:', handle)
        editorService.startResize(editorState.selectedZoneId, handle, e.clientX, e.clientY)
        return
      }
    }

    // Проверяем, кликнули ли по существующей зоне
    const clickedZone = editorService.getZoneAtPoint(x, y)
    if (clickedZone) {
      console.log('🎯 Clicked on zone:', clickedZone)
      editorService.selectZone(clickedZone.id)
      editorService.startDrag(clickedZone.id, e.clientX, e.clientY)
      return
    }

    // Если кликнули по пустому месту, начинаем создание новой зоны
    console.log('➕ Creating new zone at:', { x, y })
    editorService.selectZone(null)
    setIsCreating(true)
    setCreateStart({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!editorService || !editorState || !imageLoaded) return

    const { x, y } = getImageCoordinates(e.clientX, e.clientY)

    if (editorState.isDragging) {
      console.log('🔄 Dragging zone')
      editorService.updateDrag(e.clientX, e.clientY)
    } else if (editorState.isResizing) {
      console.log('📏 Resizing zone')
      editorService.updateResize(e.clientX, e.clientY)
    } else if (isCreating && createStart) {
      // Отрисовываем предварительную зону при создании
      drawZones()
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        const startDisplayX = (createStart.x / imageInfo.naturalWidth) * imageInfo.displayWidth
        const startDisplayY = (createStart.y / imageInfo.naturalHeight) * imageInfo.displayHeight
        const currentDisplayX = (x / imageInfo.naturalWidth) * imageInfo.displayWidth
        const currentDisplayY = (y / imageInfo.naturalHeight) * imageInfo.displayHeight

        const startCanvasX = (startDisplayX * zoom * imageInfo.scaleX) + pan.x + imageInfo.offsetX
        const startCanvasY = (startDisplayY * zoom * imageInfo.scaleY) + pan.y + imageInfo.offsetY
        const currentCanvasX = (currentDisplayX * zoom * imageInfo.scaleX) + pan.x + imageInfo.offsetX
        const currentCanvasY = (currentDisplayY * zoom * imageInfo.scaleY) + pan.y + imageInfo.offsetY

        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(
          Math.min(startCanvasX, currentCanvasX),
          Math.min(startCanvasY, currentCanvasY),
          Math.abs(currentCanvasX - startCanvasX),
          Math.abs(currentCanvasY - startCanvasY)
        )
        ctx.setLineDash([])
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!editorService || !editorState || !imageLoaded) return

    if (editorState.isDragging) {
      console.log('✅ Drag ended')
      editorService.endDrag()
    } else if (editorState.isResizing) {
      console.log('✅ Resize ended')
      editorService.endResize()
    } else if (isCreating && createStart) {
      const { x, y } = getImageCoordinates(e.clientX, e.clientY)

      console.log('🎯 Creating zone:', {
        start: createStart,
        end: { x, y },
        zones: editorState.zones.length
      })

      const newZone = editorService.createZoneFromCoordinates(
        createStart.x,
        createStart.y,
        x,
        y,
        `Зона ${editorState.zones.length + 1}`
      )

      if (newZone) {
        console.log('✅ Zone created:', newZone)
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
          Размер: {Math.round(imageInfo.naturalWidth * zoom)} × {Math.round(imageInfo.naturalHeight * zoom)}px
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
