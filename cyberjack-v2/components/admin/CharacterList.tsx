"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Character {
  id: string
  name: string
  description: string | null
  age: number | null
  avatar: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CharacterListProps {
  onSelect?: (character: Character) => void
  selectedId?: string
}

export function CharacterList({ onSelect, selectedId }: CharacterListProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCharacters()
  }, [])

  const fetchCharacters = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/characters')
      if (!response.ok) {
        throw new Error('Ошибка загрузки персонажей')
      }
      const data = await response.json()
      setCharacters(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого персонажа?')) {
      return
    }

    try {
      const response = await fetch(`/api/characters/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Ошибка удаления персонажа')
      }
      await fetchCharacters()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Персонажи</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Персонажи</h2>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchCharacters} variant="outline">
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Персонажи</h2>
        <Button onClick={() => window.location.href = '/db/characters/new'}>
          Создать
        </Button>
      </div>

      <div className="space-y-3">
        {characters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Персонажи не найдены</p>
            <p className="text-sm mt-2">Создайте первого персонажа</p>
          </div>
        ) : (
          characters.map((character) => (
            <div
              key={character.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedId === character.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelect?.(character)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{character.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        character.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {character.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                  {character.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {character.description}
                    </p>
                  )}
                  {character.age && (
                    <p className="text-xs text-gray-500 mt-1">
                      Возраст: {character.age}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.location.href = `/db/characters/${character.id}/edit`
                    }}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(character.id)
                    }}
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
