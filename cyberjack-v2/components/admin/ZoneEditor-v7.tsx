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

export function ZoneEditorV7({
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
  const [imageLoaded, setImageLoaded] = useState(false)
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

  // Инициализация сервиса
  useEffect(() => {
    const service = new ZoneEditorService(
      initialZones,
      config,
      (state) => {
        setEditorState(state)
        // Не вызываем onZonesChange здесь, чтобы избежать двойных вызовов
      }
    )
    setEditorService(service)
    const initialState = service.getState()
    setEditorState(initialState)
  }, [config, initialZones])

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
      ctx.drawImage(
        img,
        imageInfo.offsetX,
        imageInfo.offsetY,
        imageInfo.displayWidth,
        imageInfo.displayHeight
      )
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

        // Применяем смещение изображения
        const canvasX = displayX + imageInfo.offsetX
        const canvasY = displayY + imageInfo.offsetY

        // Фон зоны
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'
        ctx.fillRect(canvasX, canvasY, displayWidth, displayHeight)

        // Граница зоны
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#6b7280'
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeRect(canvasX, canvasY, displayWidth, displayHeight)

        // Ручки изменения размера (только для выбранной зоны)
        if (isSelected) {
          const handleSize = 6
          const handles = [
            { x: canvasX - handleSize/2, y: canvasY - handleSize/2 }, // nw
            { x: canvasX + displayWidth - handleSize/2, y: canvasY - handleSize/2 }, // ne
            { x: canvasX - handleSize/2, y: canvasY + displayHeight - handleSize/2 }, // sw
            { x: canvasX + displayWidth - handleSize/2, y: canvasY + displayHeight - handleSize/2 } // se
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
            canvasX + displayWidth / 2,
            canvasY + displayHeight / 2 + 4
          )
        }
      })
    }
  }, [editorState, imageUrl, imageInfo, imageLoaded])

  // Функция для преобразования координат мыши в координаты изображения
  const getImageCoordinates = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    const canvasX = clientX - rect.left
    const canvasY = clientY - rect.top

    // Проверяем, что клик внутри области изображения
    if (canvasX < imageInfo.offsetX || canvasX > imageInfo.offsetX + imageInfo.displayWidth ||
        canvasY < imageInfo.offsetY || canvasY > imageInfo.offsetY + imageInfo.displayHeight) {
      return { x: 0, y: 0 }
    }

    // Преобразуем координаты в координаты изображения
    const imageX = canvasX - imageInfo.offsetX
    const imageY = canvasY - imageInfo.offsetY

    // Преобразуем в координаты исходного изображения
    const x = (imageX / imageInfo.displayWidth) * imageInfo.naturalWidth
    const y = (imageY / imageInfo.displayHeight) * imageInfo.naturalHeight


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
      if (ctx) {
        const startDisplayX = (createStart.x / imageInfo.naturalWidth) * imageInfo.displayWidth
        const startDisplayY = (createStart.y / imageInfo.naturalHeight) * imageInfo.displayHeight
        const currentDisplayX = (x / imageInfo.naturalWidth) * imageInfo.displayWidth
        const currentDisplayY = (y / imageInfo.naturalHeight) * imageInfo.displayHeight

        const startCanvasX = startDisplayX + imageInfo.offsetX
        const startCanvasY = startDisplayY + imageInfo.offsetY
        const currentCanvasX = currentDisplayX + imageInfo.offsetX
        const currentCanvasY = currentDisplayY + imageInfo.offsetY

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

  return (
    <div className={`relative ${className}`}>
      {/* Информация о размерах */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border">
        <div className="text-sm text-gray-600">
          Размер изображения: {imageInfo.naturalWidth} × {imageInfo.naturalHeight}px
        </div>
        <div className="text-sm text-gray-600">
          Зон: {editorState?.zones.length || 0}
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
      </div>
    </div>
  )
}
