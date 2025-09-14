"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ActiveZonesEditor } from './ActiveZonesEditor-v2'

interface CharacterPoseAngle {
  id: string
  characterPoseId: string
  poseAngleId: string
  media: {
    images: string[]
    videos: string[]
    gifs: string[]
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
  poseAngle: {
    id: string
    name: string
    angle: string
  }
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

export function CharacterPoseAnglesManager({ characterPoseId, poseName, characterName }: CharacterPoseAnglesManagerProps) {
  const [angles, setAngles] = useState<CharacterPoseAngle[]>([])
  const [availableAngles, setAvailableAngles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedAngle, setSelectedAngle] = useState<CharacterPoseAngle | null>(null)
  const [editForm, setEditForm] = useState({
    media: {
      images: [] as string[],
      videos: [] as string[],
      gifs: [] as string[]
    }
  })

  useEffect(() => {
    fetchCharacterAngles()
    fetchAvailableAngles()
  }, [characterPoseId])

  const fetchCharacterAngles = async () => {
    try {
      const response = await fetch(`/api/characters/poses/${characterPoseId}/angles`)
      if (response.ok) {
        const data = await response.json()
        setAngles(data)
      }
    } catch (err) {
      setError('Ошибка загрузки ракурсов персонажа')
    }
  }

  const fetchAvailableAngles = async () => {
    try {
      const response = await fetch(`/api/characters/poses/${characterPoseId}/available-angles`)
      if (response.ok) {
        const data = await response.json()
        setAvailableAngles(data)
      }
    } catch (err) {
      setError('Ошибка загрузки доступных ракурсов')
    } finally {
      setLoading(false)
    }
  }

  const addAngleToCharacter = async (poseAngleId: string) => {
    try {
      const response = await fetch(`/api/characters/poses/${characterPoseId}/angles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseAngleId })
      })

      if (response.ok) {
        await fetchCharacterAngles()
        setShowAddForm(false)
      } else {
        setError('Ошибка добавления ракурса')
      }
    } catch (err) {
      setError('Ошибка добавления ракурса')
    }
  }

  const updateAngle = async (angleId: string, updates: Partial<CharacterPoseAngle>) => {
    try {
      const response = await fetch(`/api/characters/poses/${characterPoseId}/angles/${angleId}`, {
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

  const removeAngleFromCharacter = async (angleId: string) => {
    if (!confirm('Удалить ракурс у персонажа?')) return

    try {
      const response = await fetch(`/api/characters/poses/${characterPoseId}/angles/${angleId}`, {
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
      media: angle.media
    })
    setEditingId(angle.id)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      updateAngle(editingId, editForm)
    }
  }

  const addMediaUrl = (type: 'images' | 'videos' | 'gifs', url: string) => {
    if (url.trim()) {
      setEditForm({
        ...editForm,
        media: {
          ...editForm.media,
          [type]: [...editForm.media[type], url.trim()]
        }
      })
    }
  }

  const removeMediaUrl = (type: 'images' | 'videos' | 'gifs', index: number) => {
    setEditForm({
      ...editForm,
      media: {
        ...editForm.media,
        [type]: editForm.media[type].filter((_, i) => i !== index)
      }
    })
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
            <h2 className="text-xl font-semibold">Активные зоны: {selectedAngle.poseAngle.name}</h2>
          </div>
        </div>

        <ActiveZonesEditor
          characterAngleId={selectedAngle.id}
          imageUrl={getFirstImageUrl(selectedAngle.media)}
          imageWidth={800}
          imageHeight={600}
        />
      </div>
    )
  }

  const assignedAngleIds = angles.map(a => a.poseAngleId)
  const unassignedAngles = availableAngles.filter(a => !assignedAngleIds.includes(a.id))

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Ракурсы позы: {poseName}</h2>
        <Button
          onClick={() => setShowAddForm(true)}
          disabled={unassignedAngles.length === 0}
        >
          Добавить ракурс
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">Добавить ракурс</h3>
          <div className="space-y-2">
            {unassignedAngles.map((angle) => (
              <div key={angle.id} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <span className="font-medium">{angle.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({angle.angle})</span>
                </div>
                <Button size="sm" onClick={() => addAngleToCharacter(angle.id)}>
                  Добавить
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setShowAddForm(false)}
          >
            Отмена
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {angles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>У позы нет настроенных ракурсов</p>
            <p className="text-sm mt-2">Добавьте первый ракурс</p>
          </div>
        ) : (
          angles.map((angle) => (
            <div key={angle.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {editingId === angle.id ? (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h4 className="font-medium">Медиа файлы</h4>

                        {(['images', 'videos', 'gifs'] as const).map((type) => (
                          <div key={type} className="space-y-2">
                            <label className="block text-sm font-medium">
                              {type === 'images' ? 'Изображения' : type === 'videos' ? 'Видео' : 'GIF'}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                placeholder={`URL ${type === 'images' ? 'изображения' : type === 'videos' ? 'видео' : 'GIF'}`}
                                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title={`URL ${type === 'images' ? 'изображения' : type === 'videos' ? 'видео' : 'GIF'}`}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    addMediaUrl(type, e.currentTarget.value)
                                    e.currentTarget.value = ''
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  const input = e.currentTarget.previousElementSibling as HTMLInputElement
                                  addMediaUrl(type, input.value)
                                  input.value = ''
                                }}
                              >
                                Добавить
                              </Button>
                            </div>
                            {editForm.media[type].length > 0 && (
                              <div className="space-y-1">
                                {editForm.media[type].map((url, index) => (
                                  <div key={index} className="flex items-center gap-2 p-2 bg-white border rounded">
                                    <span className="flex-1 text-sm truncate">{url}</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => removeMediaUrl(type, index)}
                                    >
                                      🗑️
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
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
                        <h3 className="font-medium">{angle.poseAngle.name}</h3>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {angle.poseAngle.angle}
                        </span>
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          {angle.zones.length} активных зон
                        </span>
                      </div>

                      <div className="space-y-3">
                        {angle.media.images.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Изображения ({angle.media.images.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {angle.media.images.slice(0, 4).map((url, index) => (
                                <div key={index} className="aspect-square bg-gray-200 rounded border flex items-center justify-center">
                                  <img src={url} alt={`${angle.poseAngle.name} ${index + 1}`} className="w-full h-full object-cover rounded" />
                                </div>
                              ))}
                              {angle.media.images.length > 4 && (
                                <div className="aspect-square bg-gray-100 rounded border flex items-center justify-center text-sm text-gray-500">
                                  +{angle.media.images.length - 4} еще
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {angle.media.videos.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Видео ({angle.media.videos.length})</h4>
                            <div className="space-y-1">
                              {angle.media.videos.map((url, index) => (
                                <div key={index} className="text-sm text-blue-600 truncate">
                                  {url}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {angle.media.gifs.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">GIF ({angle.media.gifs.length})</h4>
                            <div className="space-y-1">
                              {angle.media.gifs.map((url, index) => (
                                <div key={index} className="text-sm text-blue-600 truncate">
                                  {url}
                                </div>
                              ))}
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
                        onClick={() => removeAngleFromCharacter(angle.id)}
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
