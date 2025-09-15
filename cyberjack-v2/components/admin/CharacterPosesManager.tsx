"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CharacterPoseAnglesManagerV2 } from './CharacterPoseAnglesManager-v2'

interface CharacterPose {
  id: string
  characterId: string
  poseDefId: string
  isActive: boolean
  isDefault?: boolean
  customSettings: Record<string, any>
  definition: {
    id: string
    name: string
    category: string
    description: string | null
    angles?: Array<{
      id: string
      name: string
      angle: string
    }>
  }
  angles?: Array<{
    id: string
    characterPoseId: string
    poseAngleId: string
    media: Record<string, any>
    zones?: Array<{
      id: string
      name: string
      x: number
      y: number
      width: number
      height: number
    }>
  }>
}

interface CharacterPosesManagerProps {
  characterId: string
  characterName: string
}

export function CharacterPosesManager({ characterId, characterName }: CharacterPosesManagerProps) {
  const [poses, setPoses] = useState<CharacterPose[]>([])
  const [availablePoses, setAvailablePoses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPose, setSelectedPose] = useState<CharacterPose | null>(null)
  const [defaultPoseId, setDefaultPoseId] = useState<string | null>(null)
  const [settingDefault, setSettingDefault] = useState<string | null>(null)

  useEffect(() => {
    fetchCharacterPoses()
    fetchAvailablePoses()
    fetchDefaultPose()
  }, [characterId])

  const fetchCharacterPoses = async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}/poses`)
      if (response.ok) {
        const data = await response.json()
        setPoses(data)
      }
    } catch (err) {
      setError('Ошибка загрузки поз персонажа')
    }
  }

  const fetchAvailablePoses = async () => {
    try {
      const response = await fetch('/api/poses')
      if (response.ok) {
        const data = await response.json()
        setAvailablePoses(data)
      }
    } catch (err) {
      setError('Ошибка загрузки доступных поз')
    } finally {
      setLoading(false)
    }
  }

  const addPoseToCharacter = async (poseDefId: string) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/poses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseDefId })
      })

      if (response.ok) {
        await fetchCharacterPoses()
        setShowAddForm(false)
      } else {
        setError('Ошибка добавления позы')
      }
    } catch (err) {
      setError('Ошибка добавления позы')
    }
  }

  const togglePose = async (poseId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/poses/${poseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })

      if (response.ok) {
        await fetchCharacterPoses()
      }
    } catch (err) {
      setError('Ошибка обновления позы')
    }
  }

  const removePoseFromCharacter = async (poseId: string) => {
    if (!confirm('Удалить позу у персонажа?')) return

    try {
      const response = await fetch(`/api/characters/${characterId}/poses/${poseId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchCharacterPoses()
        await fetchDefaultPose()
      }
    } catch (err) {
      setError('Ошибка удаления позы')
    }
  }

  const fetchDefaultPose = async () => {
    try {
      const response = await fetch(`/api/admin/characters/${characterId}/default-pose`)
      if (response.ok) {
        const data = await response.json()
        setDefaultPoseId(data.defaultPose?.id || null)
      }
    } catch (err) {
      console.error('Ошибка загрузки дефолтной позы:', err)
    }
  }

  const setDefaultPose = async (poseId: string) => {
    try {
      setSettingDefault(poseId)
      const response = await fetch(`/api/admin/characters/${characterId}/default-pose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseId })
      })

      if (response.ok) {
        setDefaultPoseId(poseId)
        // Обновляем локальное состояние поз
        setPoses(prev => prev.map(pose => ({
          ...pose,
          isDefault: pose.id === poseId
        })))
      } else {
        setError('Ошибка установки дефолтной позы')
      }
    } catch (err) {
      setError('Ошибка установки дефолтной позы')
    } finally {
      setSettingDefault(null)
    }
  }

  const assignedPoseIds = poses.map(p => p.poseDefId)
  const unassignedPoses = availablePoses.filter(p => !assignedPoseIds.includes(p.id))

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка поз...</p>
        </div>
      </div>
    )
  }

  if (selectedPose) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedPose(null)}>
              ← Назад к позам
            </Button>
            <h2 className="text-xl font-semibold">Ракурсы позы: {selectedPose.definition.name}</h2>
          </div>
        </div>

        <CharacterPoseAnglesManagerV2
          characterPoseId={selectedPose.id}
          poseName={selectedPose.definition.name}
          characterName={characterName}
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Позы персонажа: {characterName}</h2>
        <Button
          onClick={() => setShowAddForm(true)}
          disabled={unassignedPoses.length === 0}
        >
          Добавить позу
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}


      {showAddForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">Добавить позу</h3>
          <div className="space-y-2">
            {unassignedPoses.map((pose) => (
              <div key={pose.id} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <span className="font-medium">{pose.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({pose.category})</span>
                </div>
                <Button size="sm" onClick={() => addPoseToCharacter(pose.id)}>
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

      <div className="space-y-3">
        {poses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>У персонажа нет настроенных поз</p>
            <p className="text-sm mt-2">Добавьте первую позу</p>
          </div>
        ) : (
          poses.map((pose) => (
            <div key={pose.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{pose.definition.name}</h3>
                    <span className="text-sm text-gray-500">({pose.definition.category})</span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        pose.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {pose.isActive ? 'Активна' : 'Неактивна'}
                    </span>
                    {defaultPoseId === pose.id && (
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        Дефолтная
                      </span>
                    )}
                  </div>
                  {pose.definition.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {pose.definition.description}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Доступные ракурсы: {pose.definition.angles?.length || 0}</p>
                    <p>Настроенные ракурсы: {pose.angles?.length || 0}</p>
                    <p>Активные зоны: {pose.angles?.reduce((total, angle) => total + (angle.zones?.length || 0), 0) || 0}</p>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedPose(pose)}
                  >
                    📐
                  </Button>
                  {defaultPoseId !== pose.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDefaultPose(pose.id)}
                      disabled={settingDefault === pose.id || !pose.isActive || pose.angles?.length === 0}
                    >
                      {settingDefault === pose.id ? '⏳' : '⭐'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => togglePose(pose.id, !pose.isActive)}
                  >
                    {pose.isActive ? 'Деактивировать' : 'Активировать'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removePoseFromCharacter(pose.id)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
