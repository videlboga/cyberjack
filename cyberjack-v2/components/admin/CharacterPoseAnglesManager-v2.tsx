"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ActiveZonesEditorV3 } from './ActiveZonesEditor-v3'

interface CharacterPoseAngle {
  id: string
  characterPoseId: string
  name: string
  description?: string
  media: {
    files: Array<{
      id: string
      url: string
      type: 'image' | 'video' | 'gif'
      filename: string
    }>
  }
  zones: Array<{
    id: string
    name: string
    x: number
    y: number
    width: number
    height: number
    anatomy?: {
      id: string
      name: string
      category: string | null
    }
  }>
}

interface CharacterPoseAnglesManagerProps {
  characterPoseId: string
  poseName: string
  characterName: string
}

// Функция для получения URL первого изображения
function getFirstImageUrl(media: any): string {
  if (!media?.files || !Array.isArray(media.files)) {
    return '/placeholder-image.jpg' // Заглушка
  }

  const firstImage = media.files.find((file: any) => file.type === 'image')
  return firstImage?.url || '/placeholder-image.jpg'
}

export function CharacterPoseAnglesManagerV2({ characterPoseId, poseName, characterName }: CharacterPoseAnglesManagerProps) {
  const [angles, setAngles] = useState<CharacterPoseAngle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedAngle, setSelectedAngle] = useState<CharacterPoseAngle | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    media: {
      files: [] as Array<{
        id: string
        url: string
        type: 'image' | 'video' | 'gif'
        filename: string
      }>
    }
  })
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCharacterAngles()
  }, [characterPoseId])

  const fetchCharacterAngles = async () => {
    try {
      const response = await fetch(`/api/character-poses/${characterPoseId}/angles-v2`)
      if (response.ok) {
        const data = await response.json()
        setAngles(data)
      }
    } catch (err) {
      setError('Ошибка загрузки ракурсов персонажа')
    } finally {
      setLoading(false)
    }
  }

  const createNewAngle = async () => {
    try {
      const response = await fetch(`/api/character-poses/${characterPoseId}/angles-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description
        })
      })

      if (response.ok) {
        await fetchCharacterAngles()
        setShowAddForm(false)
        setEditForm({
          name: '',
          description: '',
          media: { files: [] }
        })
      } else {
        setError('Ошибка создания ракурса')
      }
    } catch (err) {
      setError('Ошибка создания ракурса')
    }
  }

  const updateAngle = async (angleId: string, updates: Partial<CharacterPoseAngle>) => {
    try {
      const response = await fetch(`/api/character-poses/${characterPoseId}/angles-v2/${angleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        await fetchCharacterAngles()
        setEditingId(null)
      } else {
        setError('Ошибка обновления ракурса')
      }
    } catch (err) {
      setError('Ошибка обновления ракурса')
    }
  }

  const removeAngle = async (angleId: string) => {
    if (!confirm('Удалить ракурс?')) return

    try {
      const response = await fetch(`/api/character-poses/${characterPoseId}/angles-v2/${angleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchCharacterAngles()
      }
    } catch (err) {
      setError('Ошибка удаления ракурса')
    }
  }

  const handleEdit = (angle: CharacterPoseAngle) => {
    setEditForm({
      name: angle.name,
      description: angle.description || '',
      media: angle.media
    })
    setEditingId(angle.id)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      updateAngle(editingId, editForm)
    }
  }

  const getFileType = (filename: string): 'image' | 'video' | 'gif' => {
    const ext = filename.toLowerCase().split('.').pop()
    if (['gif'].includes(ext || '')) return 'gif'
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) return 'video'
    return 'image'
  }

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/character-poses/${characterPoseId}/angles-v2/${editingId}/upload`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const uploadedFiles = await response.json()
        setEditForm(prev => ({
          ...prev,
          media: {
            ...prev.media,
            files: [...prev.media.files, ...uploadedFiles]
          }
        }))
      } else {
        setError('Ошибка загрузки файлов')
      }
    } catch (err) {
      setError('Ошибка загрузки файлов')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (fileId: string) => {
    setEditForm(prev => ({
      ...prev,
      media: {
        ...prev.media,
        files: prev.media.files.filter(f => f.id !== fileId)
      }
    }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка ракурсов...</p>
        </div>
      </div>
    )
  }

  if (selectedAngle) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedAngle(null)}>
              ← Назад к ракурсам
            </Button>
            <h2 className="text-xl font-semibold">Активные зоны: {selectedAngle.name}</h2>
          </div>
        </div>

        <ActiveZonesEditorV3
          characterAngleId={selectedAngle.id}
          mediaFiles={selectedAngle.media?.files || []}
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Ракурсы позы: {poseName}</h2>
        <Button onClick={() => setShowAddForm(true)}>
          Создать ракурс
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">Создать новый ракурс</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Название ракурса</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Например: Спереди, Сбоку, Сверху..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Описание (необязательно)</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Описание ракурса..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={createNewAngle}
                disabled={!editForm.name.trim()}
              >
                Создать ракурс
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setEditForm({
                    name: '',
                    description: '',
                    media: { files: [] }
                  })
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {angles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>У позы нет настроенных ракурсов</p>
            <p className="text-sm mt-2">Создайте первый ракурс</p>
          </div>
        ) : (
          angles.map((angle) => (
            <div key={angle.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {editingId === angle.id ? (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Название ракурса</label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Введите название ракурса"
                            title="Название ракурса"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Описание</label>
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="Введите описание ракурса"
                            title="Описание ракурса"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Медиа файлы</label>

                          <div className="mb-3">
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              accept="image/*,video/*,.gif"
                              onChange={(e) => {
                                if (e.target.files) {
                                  handleFileUpload(e.target.files)
                                }
                              }}
                              className="hidden"
                              title="Выберите файлы для загрузки"
                            />
                            <Button
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                            >
                              {uploading ? 'Загрузка...' : 'Загрузить файлы'}
                            </Button>
                          </div>

                          {editForm.media.files.length > 0 && (
                            <div className="space-y-2">
                              {editForm.media.files.map((file) => (
                                <div key={file.id} className="flex items-center gap-2 p-2 bg-white border rounded">
                                  <span className="flex-1 text-sm truncate">{file.filename}</span>
                                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                    {file.type}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeFile(file.id)}
                                  >
                                    🗑️
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleSaveEdit}>
                          Сохранить
                        </Button>
                        <Button variant="outline" onClick={() => setEditingId(null)}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-medium">{angle.name}</h3>
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          {angle.zones.length} активных зон
                        </span>
                      </div>

                      {angle.description && (
                        <p className="text-sm text-gray-600 mb-3">{angle.description}</p>
                      )}

                      <div className="space-y-3">
                        {angle.media.files.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Медиа файлы ({angle.media.files.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {angle.media.files.slice(0, 4).map((file, index) => (
                                <div key={index} className="aspect-square bg-gray-200 rounded border flex items-center justify-center">
                                  {file.type === 'image' || file.type === 'gif' ? (
                                    <img
                                      src={file.url}
                                      alt={file.filename}
                                      className="w-full h-full object-cover rounded"
                                    />
                                  ) : (
                                    <div className="text-center text-gray-500">
                                      <div className="text-2xl mb-1">🎥</div>
                                      <div className="text-xs truncate">{file.filename}</div>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {angle.media.files.length > 4 && (
                                <div className="aspect-square bg-gray-100 rounded border flex items-center justify-center text-sm text-gray-500">
                                  +{angle.media.files.length - 4} еще
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {angle.zones.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Активные зоны</h4>
                            <div className="flex flex-wrap gap-1">
                              {angle.zones.map((zone) => (
                                <span key={zone.id} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                                  {zone.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 ml-2">
                  {editingId !== angle.id && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedAngle(angle)}
                      >
                        🎯
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(angle)}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeAngle(angle.id)}
                      >
                        🗑️
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
