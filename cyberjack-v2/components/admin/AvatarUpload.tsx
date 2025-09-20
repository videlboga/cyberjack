"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface AvatarUploadProps {
  characterId: string
  currentAvatar?: string
  onAvatarChange: (url: string) => void
  className?: string
}

export function AvatarUpload({
  characterId,
  currentAvatar,
  onAvatarChange,
  className = ""
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentAvatar || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Неподдерживаемый тип файла. Разрешены только изображения (jpg, jpeg, png, gif, webp)')
      return
    }

    // Проверяем размер файла (максимум 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setError('Файл слишком большой. Максимальный размер: 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Создаем предварительный просмотр
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Загружаем файл
      const formData = new FormData()
      formData.append('file', file)

      // Выбираем endpoint в зависимости от того, новый ли это персонаж
      const uploadUrl = characterId === 'new'
        ? '/api/upload/avatar'
        : `/api/characters/${characterId}/avatar/upload`

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка загрузки файла')
      }

      const result = await response.json()
      onAvatarChange(result.url)
      setPreview(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
      setPreview(currentAvatar || null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = () => {
    setPreview(null)
    onAvatarChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <label className="block text-sm font-medium">Аватар персонажа</label>

      {/* Предварительный просмотр */}
      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Предварительный просмотр аватара"
            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
          />
          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            title="Удалить аватар"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Кнопка загрузки */}
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleUploadClick}
          disabled={uploading}
          className="flex items-center gap-2"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              {preview ? 'Изменить аватар' : 'Загрузить аватар'}
            </>
          )}
        </Button>

        {!preview && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <ImageIcon className="w-4 h-4" />
            <span>JPG, PNG, GIF, WebP до 5MB</span>
          </div>
        )}
      </div>

      {/* Скрытый input для выбора файла */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Выберите файл аватара"
      />

      {/* Ошибка */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
