'use client'

import React, { useState, useRef, useCallback } from 'react'

interface ImageCropperProps {
  imageUrl: string
  onCrop: (croppedImageUrl: string) => void
  onCancel: () => void
  className?: string
}

export function ImageCropper({ imageUrl, onCrop, onCancel, className = '' }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageInfo, setImageInfo] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
    offsetX: 0,
    offsetY: 0
  })

  // Загрузка изображения
  const loadImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Размер canvas
      const containerWidth = 800
      const containerHeight = 600
      canvas.width = containerWidth
      canvas.height = containerHeight

      // Вычисляем параметры отображения с сохранением пропорций
      const imgAspect = img.naturalWidth / img.naturalHeight
      const canvasAspect = containerWidth / containerHeight

      let displayWidth = containerWidth
      let displayHeight = containerHeight
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > canvasAspect) {
        // Изображение шире - подгоняем по ширине
        displayWidth = containerWidth
        displayHeight = containerWidth / imgAspect
        offsetY = (containerHeight - displayHeight) / 2
      } else {
        // Изображение выше - подгоняем по высоте
        displayHeight = containerHeight
        displayWidth = containerHeight * imgAspect
        offsetX = (containerWidth - displayWidth) / 2
      }

      setImageInfo({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth,
        displayHeight,
        offsetX,
        offsetY
      })

      // Инициализируем область кропа (по умолчанию - центр изображения, 80% размера)
      const cropWidth = displayWidth * 0.8
      const cropHeight = displayHeight * 0.8
      setCropArea({
        x: offsetX + (displayWidth - cropWidth) / 2,
        y: offsetY + (displayHeight - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight
      })

      setImageLoaded(true)
      drawImage()
    }
    img.src = imageUrl
  }, [imageUrl])

  // Отрисовка изображения и области кропа
  const drawImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageLoaded) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Рисуем изображение
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(
        img,
        imageInfo.offsetX,
        imageInfo.offsetY,
        imageInfo.displayWidth,
        imageInfo.displayHeight
      )

      // Рисуем затемнение вне области кропа
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Очищаем область кропа
      ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

      // Перерисовываем изображение только в области кропа
      ctx.drawImage(
        img,
        imageInfo.offsetX,
        imageInfo.offsetY,
        imageInfo.displayWidth,
        imageInfo.displayHeight
      )

      // Рисуем границу области кропа
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

      // Рисуем угловые ручки
      const handleSize = 8
      const handles = [
        { x: cropArea.x - handleSize/2, y: cropArea.y - handleSize/2 }, // nw
        { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y - handleSize/2 }, // ne
        { x: cropArea.x - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 }, // sw
        { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 } // se
      ]

      ctx.fillStyle = '#3b82f6'
      handles.forEach(handle => {
        ctx.fillRect(handle.x, handle.y, handleSize, handleSize)
      })
    }
    img.src = imageUrl
  }, [imageUrl, imageInfo, cropArea, imageLoaded])

  // Обработка мыши
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Проверяем, кликнули ли по ручке изменения размера
    const handleSize = 8
    const handles = [
      { x: cropArea.x - handleSize/2, y: cropArea.y - handleSize/2 }, // nw
      { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y - handleSize/2 }, // ne
      { x: cropArea.x - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 }, // sw
      { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 } // se
    ]

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i]
      if (x >= handle.x && x <= handle.x + handleSize && y >= handle.y && y <= handle.y + handleSize) {
        setIsDragging(true)
        setDragStart({ x, y })
        return
      }
    }

    // Проверяем, кликнули ли внутри области кропа для перемещения
    if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
        y >= cropArea.y && y <= cropArea.y + cropArea.height) {
      setIsDragging(true)
      setDragStart({ x: x - cropArea.x, y: y - cropArea.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Простое изменение размера (упрощенная версия)
    const newWidth = Math.max(100, Math.abs(x - cropArea.x))
    const newHeight = Math.max(100, Math.abs(y - cropArea.y))

    setCropArea(prev => ({
      ...prev,
      width: newWidth,
      height: newHeight
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Применение кропа
  const handleApplyCrop = () => {
    const canvas = canvasRef.current
    if (!canvas || !imageLoaded) return

    // Создаем новый canvas для кропнутого изображения
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')
    if (!cropCtx) return

    // Вычисляем координаты кропа в исходном изображении
    const cropX = ((cropArea.x - imageInfo.offsetX) / imageInfo.displayWidth) * imageInfo.naturalWidth
    const cropY = ((cropArea.y - imageInfo.offsetY) / imageInfo.displayHeight) * imageInfo.naturalHeight
    const cropWidth = (cropArea.width / imageInfo.displayWidth) * imageInfo.naturalWidth
    const cropHeight = (cropArea.height / imageInfo.displayHeight) * imageInfo.naturalHeight

    // Устанавливаем размер кропнутого изображения
    cropCanvas.width = cropWidth
    cropCanvas.height = cropHeight

    // Рисуем кропнутое изображение
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      cropCtx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      )

      // Конвертируем в blob и создаем URL
      cropCanvas.toBlob((blob) => {
        if (blob) {
          const croppedUrl = URL.createObjectURL(blob)
          onCrop(croppedUrl)
        }
      }, 'image/png')
    }
    img.src = imageUrl
  }

  // Загрузка изображения при монтировании
  React.useEffect(() => {
    loadImage()
  }, [loadImage])

  // Перерисовка при изменении области кропа
  React.useEffect(() => {
    if (imageLoaded) {
      drawImage()
    }
  }, [cropArea, imageLoaded, drawImage])

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Обрезка изображения</h3>
        <p className="text-sm text-gray-600">Выберите область для обрезки</p>
      </div>

      <div className="flex justify-center">
        <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={handleApplyCrop}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Применить обрезку
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Отмена
        </button>
      </div>

      <div className="text-sm text-gray-600 text-center">
        <p>• Перетаскивайте углы для изменения размера области</p>
        <p>• Перетаскивайте центр для перемещения области</p>
      </div>
    </div>
  )
}
