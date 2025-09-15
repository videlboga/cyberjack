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

interface CharacterPanelProps {
  onCharacterSelect: (character: Character) => void
  selectedId?: string
}

export function CharacterPanel({ onCharacterSelect, selectedId }: CharacterPanelProps) {
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
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
        <p className="text-gray-400">Загрузка персонажей...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchCharacters}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="text-4xl mb-2">👤</div>
        <p>Персонажи не найдены</p>
        <p className="text-sm mt-1">Создайте персонажей в админ-панели</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {characters.map((character) => (
        <div
          key={character.id}
          onClick={() => onCharacterSelect(character)}
          className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
            selectedId === character.id
              ? 'bg-blue-600 border-2 border-blue-400'
              : 'bg-gray-800 hover:bg-gray-700 border-2 border-transparent'
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Аватар */}
            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
              {character.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="text-gray-300 text-lg">👤</span>
              )}
            </div>

            {/* Информация о персонаже */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{character.name}</h3>

              {character.description && (
                <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                  {character.description}
                </p>
              )}

              {character.age && (
                <p className="text-xs text-gray-400 mt-1">
                  Возраст: {character.age}
                </p>
              )}

              {/* Краткий обзор характеристик */}
              <div className="mt-2 space-y-1">
                {character.characteristics.slice(0, 2).map((char) => (
                  <div key={char.definition.name} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-12 truncate">
                      {char.definition.name}:
                    </span>
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${char.currentValue}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-400 w-6">
                      {Math.round(char.currentValue)}
                    </span>
                  </div>
                ))}
                {character.characteristics.length > 2 && (
                  <p className="text-xs text-gray-500">
                    +{character.characteristics.length - 2} других характеристик
                  </p>
                )}
              </div>
            </div>

            {/* Индикатор выбора */}
            {selectedId === character.id && (
              <div className="text-blue-400 text-xl">✓</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
