"use client"

import { useState, useEffect } from 'react'

interface Character {
  id: string
  name: string
  description: string | null
  age: number | null
  avatar: string | null
  isActive: boolean
  characteristics: Array<{
    currentValue: number
    baseValue: number
    definition: {
      name: string
      category: string
    }
  }>
}

interface GameCharacterListProps {
  onSelect: (character: Character) => void
  selectedId?: string
}

export function GameCharacterList({ onSelect, selectedId }: GameCharacterListProps) {
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
      setCharacters(data.filter((char: Character) => char.isActive))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
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
          <button
            onClick={fetchCharacters}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <h2 className="text-xl font-semibold mb-4">Персонажи</h2>
      <div className="space-y-3">
        {characters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Активные персонажи не найдены</p>
            <p className="text-sm mt-2">Создайте персонажа в админ-панели</p>
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
              onClick={() => onSelect(character)}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  {character.avatar ? (
                    <img
                      src={character.avatar}
                      alt={character.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-500 text-lg">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{character.name}</h3>
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
                  <div className="mt-2 space-y-1">
                    {character.characteristics.slice(0, 3).map((char) => (
                      <div key={char.definition.name} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 truncate">
                          {char.definition.name}:
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${char.currentValue}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 w-8">
                          {Math.round(char.currentValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
