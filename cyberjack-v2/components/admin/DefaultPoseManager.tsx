"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface CharacterPose {
  id: string
  definition: {
    id: string
    name: string
    description: string | null
    category: string
  }
  isDefault: boolean
  isActive: boolean
  angles: Array<{
    id: string
    name: string
  }>
}

interface DefaultPoseManagerProps {
  characterId: string
  characterName: string
}

export function DefaultPoseManager({ characterId, characterName }: DefaultPoseManagerProps) {
  const [poses, setPoses] = useState<CharacterPose[]>([])
  const [defaultPose, setDefaultPose] = useState<CharacterPose | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPoses()
    fetchDefaultPose()
  }, [characterId])

  const fetchPoses = async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}/poses`)
      if (response.ok) {
        const data = await response.json()
        setPoses(data)
      }
    } catch (error) {
      console.error('Error fetching poses:', error)
    }
  }

  const fetchDefaultPose = async () => {
    try {
      const response = await fetch(`/api/admin/characters/${characterId}/default-pose`)
      if (response.ok) {
        const data = await response.json()
        setDefaultPose(data.defaultPose)
      }
    } catch (error) {
      console.error('Error fetching default pose:', error)
    } finally {
      setLoading(false)
    }
  }

  const setDefaultPoseHandler = async (poseId: string) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/admin/characters/${characterId}/default-pose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseId })
      })

      if (response.ok) {
        const data = await response.json()
        setDefaultPose(data.pose)
        // Обновляем локальное состояние
        setPoses(prev => prev.map(pose => ({
          ...pose,
          isDefault: pose.id === poseId
        })))
      }
    } catch (error) {
      console.error('Error setting default pose:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="text-center text-gray-400 mt-2">Загрузка поз...</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Дефолтная поза для {characterName}
        </h3>
        <p className="text-sm text-gray-400">
          Выберите позу, которая будет отображаться по умолчанию для этого персонажа
        </p>
      </div>

      {defaultPose && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-green-400 font-medium">Текущая дефолтная поза:</span>
            <span className="text-white">{defaultPose.definition.name}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {poses.map((pose) => (
          <div
            key={pose.id}
            className={`p-4 rounded-lg border transition-colors ${
              pose.isDefault
                ? 'bg-green-900/20 border-green-500/50'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-white">{pose.definition.name}</h4>
                  {pose.isDefault && (
                    <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                      Дефолтная
                    </span>
                  )}
                  {!pose.isActive && (
                    <span className="px-2 py-1 text-xs bg-gray-600 text-white rounded">
                      Неактивна
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-400 mb-2">
                  {pose.definition.description || 'Без описания'}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Категория: {pose.definition.category}</span>
                  <span>Ракурсов: {pose.angles.length}</span>
                </div>
              </div>

              <div className="ml-4">
                {pose.isDefault ? (
                  <div className="text-green-400 text-sm font-medium">
                    Текущая дефолтная
                  </div>
                ) : (
                  <Button
                    onClick={() => setDefaultPoseHandler(pose.id)}
                    disabled={saving || !pose.isActive || pose.angles.length === 0}
                    size="sm"
                    variant="outline"
                  >
                    {saving ? 'Сохранение...' : 'Сделать дефолтной'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {poses.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          <p>У персонажа нет поз</p>
        </div>
      )}
    </Card>
  )
}
