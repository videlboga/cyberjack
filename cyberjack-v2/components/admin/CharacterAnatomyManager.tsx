"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface CharacterAnatomy {
  id: string
  characterId: string
  anatomyDefId: string
  hasPart: boolean
  sensitivity: number
  definition: {
    id: string
    name: string
    category: string | null
    description: string | null
  }
}

interface CharacterAnatomyManagerProps {
  characterId: string
  characterName: string
}

export function CharacterAnatomyManager({ characterId, characterName }: CharacterAnatomyManagerProps) {
  const [anatomy, setAnatomy] = useState<CharacterAnatomy[]>([])
  const [availableAnatomy, setAvailableAnatomy] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchCharacterAnatomy()
    fetchAvailableAnatomy()
  }, [characterId])

  const fetchCharacterAnatomy = async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}/anatomy`)
      if (response.ok) {
        const data = await response.json()
        setAnatomy(data)
      }
    } catch (err) {
      setError('Ошибка загрузки анатомии персонажа')
    }
  }

  const fetchAvailableAnatomy = async () => {
    try {
      const response = await fetch('/api/anatomy')
      if (response.ok) {
        const data = await response.json()
        setAvailableAnatomy(data)
      }
    } catch (err) {
      setError('Ошибка загрузки доступной анатомии')
    } finally {
      setLoading(false)
    }
  }

  const addAnatomyToCharacter = async (anatomyDefId: string) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/anatomy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anatomyDefId })
      })

      if (response.ok) {
        await fetchCharacterAnatomy()
        setShowAddForm(false)
      } else {
        setError('Ошибка добавления анатомической части')
      }
    } catch (err) {
      setError('Ошибка добавления анатомической части')
    }
  }

  const updateAnatomy = async (anatomyId: string, hasPart: boolean, sensitivity: number) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/anatomy/${anatomyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasPart, sensitivity })
      })

      if (response.ok) {
        await fetchCharacterAnatomy()
      }
    } catch (err) {
      setError('Ошибка обновления анатомии')
    }
  }

  const removeAnatomyFromCharacter = async (anatomyId: string) => {
    if (!confirm('Удалить анатомическую часть у персонажа?')) return

    try {
      const response = await fetch(`/api/characters/${characterId}/anatomy/${anatomyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchCharacterAnatomy()
      }
    } catch (err) {
      setError('Ошибка удаления анатомической части')
    }
  }

  const assignedAnatomyIds = anatomy.map(a => a.anatomyDefId)
  const unassignedAnatomy = availableAnatomy.filter(a => !assignedAnatomyIds.includes(a.id))

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка анатомии...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Анатомия персонажа: {characterName}</h2>
        <Button
          onClick={() => setShowAddForm(true)}
          disabled={unassignedAnatomy.length === 0}
        >
          Добавить часть тела
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">Добавить анатомическую часть</h3>
          <div className="space-y-2">
            {unassignedAnatomy.map((anatomyItem) => (
              <div key={anatomyItem.id} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <span className="font-medium">{anatomyItem.name}</span>
                  {anatomyItem.category && (
                    <span className="text-sm text-gray-500 ml-2">({anatomyItem.category})</span>
                  )}
                </div>
                <Button size="sm" onClick={() => addAnatomyToCharacter(anatomyItem.id)}>
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
        {anatomy.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>У персонажа нет настроенной анатомии</p>
            <p className="text-sm mt-2">Добавьте первую анатомическую часть</p>
          </div>
        ) : (
          anatomy.map((anatomyItem) => (
            <div key={anatomyItem.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium">{anatomyItem.definition.name}</h3>
                    {anatomyItem.definition.category && (
                      <span className="text-sm text-gray-500">({anatomyItem.definition.category})</span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        anatomyItem.hasPart
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {anatomyItem.hasPart ? 'Есть' : 'Нет'}
                    </span>
                  </div>

                  {anatomyItem.definition.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {anatomyItem.definition.description}
                    </p>
                  )}

                  {anatomyItem.hasPart && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Чувствительность:</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={anatomyItem.sensitivity}
                        onChange={(e) => updateAnatomy(anatomyItem.id, true, parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm w-12 text-right">{Math.round(anatomyItem.sensitivity)}%</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateAnatomy(anatomyItem.id, !anatomyItem.hasPart, anatomyItem.sensitivity)}
                  >
                    {anatomyItem.hasPart ? 'Убрать' : 'Добавить'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeAnatomyFromCharacter(anatomyItem.id)}
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
