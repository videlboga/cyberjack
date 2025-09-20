"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CharacterPosesManager } from './CharacterPosesManager'
import { CharacterAnatomyManager } from './CharacterAnatomyManager'
import { CharacterCharacteristicsManager } from './CharacterCharacteristicsManager'
import { CharacterPromptsManager } from './CharacterPromptsManager'
import { AvatarUpload } from './AvatarUpload'

interface Character {
  id: string
  name: string
  description: string | null
  age: number | null
  avatar: string | null
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  prompts?: any
  characteristics: Array<{
    id: string
    currentValue: number
    baseValue: number
    definition: {
      id: string
      name: string
      category: string
    }
  }>
  anatomy: Array<{
    id: string
    hasPart: boolean
    sensitivity: number
    definition: {
      id: string
      name: string
      category: string | null
    }
  }>
}

export function CharactersAdmin() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    age: '',
    avatar: '',
    price: '500',
    isActive: true
  })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingId ? `/api/characters/${editingId}` : '/api/characters'
      const method = editingId ? 'PUT' : 'POST'

      const submitData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        price: parseInt(formData.price) || 500
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения персонажа')
      }

      await fetchCharacters()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  const handleEdit = (character: Character) => {
    setFormData({
      name: character.name,
      description: character.description || '',
      age: character.age?.toString() || '',
      avatar: character.avatar || '',
      price: character.price.toString(),
      isActive: character.isActive
    })
    setEditingId(character.id)
    setShowForm(true)
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      age: '',
      avatar: '',
      price: '500',
      isActive: true
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (selectedCharacter) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedCharacter(null)}>
              ← Назад к списку
            </Button>
            <h2 className="text-xl font-semibold">Настройки: {selectedCharacter.name}</h2>
          </div>
        </div>

        <Tabs defaultValue="characteristics" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="characteristics">Характеристики</TabsTrigger>
            <TabsTrigger value="poses">Позы</TabsTrigger>
            <TabsTrigger value="anatomy">Анатомия</TabsTrigger>
            <TabsTrigger value="prompts">Промпты</TabsTrigger>
          </TabsList>

          <TabsContent value="characteristics" className="mt-6">
            <CharacterCharacteristicsManager
              characterId={selectedCharacter.id}
              characterName={selectedCharacter.name}
            />
          </TabsContent>

          <TabsContent value="poses" className="mt-6">
            <CharacterPosesManager
              characterId={selectedCharacter.id}
              characterName={selectedCharacter.name}
            />
          </TabsContent>

          <TabsContent value="anatomy" className="mt-6">
            <CharacterAnatomyManager
              characterId={selectedCharacter.id}
              characterName={selectedCharacter.name}
            />
          </TabsContent>

          <TabsContent value="prompts" className="mt-6">
            <CharacterPromptsManager
              character={selectedCharacter as any}
              onUpdate={fetchCharacters}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Управление персонажами</h2>
        <Button onClick={() => setShowForm(true)}>
          Создать персонажа
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">
            {editingId ? 'Редактировать персонажа' : 'Создать персонажа'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Имя</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите имя персонажа"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Возраст</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите возраст"
                  min="1"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Цена (кредиты)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите цену"
                  min="0"
                  step="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите описание персонажа"
                rows={3}
              />
            </div>

            <AvatarUpload
              characterId={editingId || 'new'}
              currentAvatar={formData.avatar}
              onAvatarChange={(url) => setFormData({ ...formData, avatar: url })}
            />

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                Активен
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? 'Обновить' : 'Создать'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {characters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Персонажи не найдены</p>
            <p className="text-sm mt-2">Создайте первого персонажа</p>
          </div>
        ) : (
          characters.map((character) => (
            <div key={character.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    {character.avatar ? (
                      <img
                        src={character.avatar}
                        alt={character.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-500 text-xl">👤</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-lg">{character.name}</h3>
                      {character.age && (
                        <span className="text-sm text-gray-500">({character.age} лет)</span>
                      )}
                      <span className="text-sm text-blue-600 font-medium">
                        {character.price} кредитов
                      </span>
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
                      <p className="text-sm text-gray-600 mb-3">
                        {character.description}
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
                      <div>
                        <p className="font-medium mb-1">Характеристики:</p>
                        <div className="space-y-1">
                          {character.characteristics.slice(0, 3).map((char) => (
                            <div key={char.id} className="flex items-center gap-2">
                              <span className="w-20 truncate">{char.definition.name}:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${char.currentValue}%` }}
                                ></div>
                              </div>
                              <span className="w-8 text-right">{Math.round(char.currentValue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-medium mb-1">Анатомия:</p>
                        <div className="space-y-1">
                          {character.anatomy.slice(0, 3).map((anatomy) => (
                            <div key={anatomy.id} className="flex items-center gap-2">
                              <span className="w-20 truncate">{anatomy.definition.name}:</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                anatomy.hasPart ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {anatomy.hasPart ? 'Есть' : 'Нет'}
                              </span>
                              {anatomy.hasPart && (
                                <span className="text-xs">
                                  {Math.round(anatomy.sensitivity)}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedCharacter(character)}
                  >
                    ⚙️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(character)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(character.id)}
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
