"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface User {
  id: string
  email: string
  name: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  credits: number
  modifiers: Record<string, any>
  createdAt: string
  characterCopies: Array<{
    id: string
    settings: Record<string, any>
    character: {
      id: string
      name: string
      description: string | null
      avatar: string | null
    }
  }>
  equipment: Array<{
    id: string
    quantity: number
    settings: Record<string, any>
    acquiredAt: string
    equipment: {
      id: string
      name: string
      category: string
      rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
      cost: number
    }
  }>
}

interface Character {
  id: string
  name: string
  description: string | null
  avatar: string | null
}

interface Equipment {
  id: string
  name: string
  category: string
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
  cost: number
}

interface UserEditModalProps {
  user: User | null
  isOpen: boolean
  onClose: () => void
  onSave: (user: User) => void
}

const rarityColors = {
  COMMON: 'bg-gray-100 text-gray-800',
  UNCOMMON: 'bg-green-100 text-green-800',
  RARE: 'bg-blue-100 text-blue-800',
  EPIC: 'bg-purple-100 text-purple-800',
  LEGENDARY: 'bg-yellow-100 text-yellow-800'
}

const rarityLabels = {
  COMMON: 'Обычное',
  UNCOMMON: 'Необычное',
  RARE: 'Редкое',
  EPIC: 'Эпическое',
  LEGENDARY: 'Легендарное'
}

export function UserEditModal({ user, isOpen, onClose, onSave }: UserEditModalProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'characters' | 'equipment' | 'modifiers'>('basic')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'USER' as const,
    credits: 1000,
    modifiers: '{}'
  })

  const [newCharacterId, setNewCharacterId] = useState('')
  const [newEquipmentId, setNewEquipmentId] = useState('')
  const [newEquipmentQuantity, setNewEquipmentQuantity] = useState(1)

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits,
        modifiers: JSON.stringify(user.modifiers, null, 2)
      })
      fetchCharacters()
      fetchEquipment()
    }
  }, [isOpen, user])

  const fetchCharacters = async () => {
    try {
      const response = await fetch('/api/characters')
      if (response.ok) {
        const data = await response.json()
        setCharacters(data)
      }
    } catch (err) {
      console.error('Error fetching characters:', err)
    }
  }

  const fetchEquipment = async () => {
    try {
      const response = await fetch('/api/equipment')
      if (response.ok) {
        const data = await response.json()
        setEquipment(data)
      }
    } catch (err) {
      console.error('Error fetching equipment:', err)
    }
  }

  const handleSave = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          modifiers: JSON.parse(formData.modifiers || '{}')
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка сохранения пользователя')
      }

      const updatedUser = await response.json()
      onSave(updatedUser)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCharacter = async () => {
    if (!user || !newCharacterId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${user.id}/character-copies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: newCharacterId,
          settings: {}
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка добавления персонажа')
      }

      const updatedUser = await fetch(`/api/users/${user.id}`).then(r => r.json())
      onSave(updatedUser)
      setNewCharacterId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления персонажа')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveCharacter = async (characterId: string) => {
    if (!user) return

    if (!confirm('Вы уверены, что хотите удалить копию персонажа?')) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${user.id}/character-copies?characterId=${characterId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Ошибка удаления персонажа')
      }

      const updatedUser = await fetch(`/api/users/${user.id}`).then(r => r.json())
      onSave(updatedUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления персонажа')
    } finally {
      setLoading(false)
    }
  }

  const handleAddEquipment = async () => {
    if (!user || !newEquipmentId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${user.id}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: newEquipmentId,
          quantity: newEquipmentQuantity
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка добавления оборудования')
      }

      const updatedUser = await fetch(`/api/users/${user.id}`).then(r => r.json())
      onSave(updatedUser)
      setNewEquipmentId('')
      setNewEquipmentQuantity(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления оборудования')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEquipmentQuantity = async (equipmentId: string, quantity: number) => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${user.id}/equipment/${equipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          settings: user.equipment.find(e => e.equipment.id === equipmentId)?.settings || {}
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка обновления количества')
      }

      const updatedUser = await fetch(`/api/users/${user.id}`).then(r => r.json())
      onSave(updatedUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveEquipment = async (equipmentId: string) => {
    if (!user) return

    if (!confirm('Вы уверены, что хотите удалить оборудование?')) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${user.id}/equipment/${equipmentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Ошибка удаления оборудования')
      }

      const updatedUser = await fetch(`/api/users/${user.id}`).then(r => r.json())
      onSave(updatedUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления оборудования')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">
            Редактирование пользователя: {user.name}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            ✕
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Вкладки */}
        <div className="flex space-x-1 mb-6 border-b">
          {[
            { id: 'basic', label: 'Основное' },
            { id: 'characters', label: 'Персонажи' },
            { id: 'equipment', label: 'Оборудование' },
            { id: 'modifiers', label: 'Модификаторы' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Основная информация */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">Имя</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  placeholder="Введите имя пользователя"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  placeholder="Введите email"
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium mb-1">Роль</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="USER">Пользователь</option>
                  <option value="ADMIN">Администратор</option>
                  <option value="SUPER_ADMIN">Супер-администратор</option>
                </select>
              </div>
              <div>
                <label htmlFor="credits" className="block text-sm font-medium mb-1">Кредиты</label>
                <input
                  id="credits"
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                  min="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Копии персонажей */}
        {activeTab === 'characters' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <select
                value={newCharacterId}
                onChange={(e) => setNewCharacterId(e.target.value)}
                className="flex-1 p-2 border rounded-md"
                title="Выберите персонажа для добавления"
              >
                <option value="">Выберите персонажа</option>
                {characters
                  .filter(char => !user.characterCopies.some(copy => copy.character.id === char.id))
                  .map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
              </select>
              <Button
                onClick={handleAddCharacter}
                disabled={!newCharacterId || loading}
                size="sm"
              >
                Добавить
              </Button>
            </div>

            <div className="space-y-2">
              {user.characterCopies.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Нет копий персонажей</p>
              ) : (
                user.characterCopies.map((copy) => (
                  <div key={copy.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {copy.character.avatar && (
                        <img
                          src={copy.character.avatar}
                          alt={copy.character.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium">{copy.character.name}</p>
                        {copy.character.description && (
                          <p className="text-sm text-gray-600">{copy.character.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveCharacter(copy.character.id)}
                      disabled={loading}
                    >
                      Удалить
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Оборудование */}
        {activeTab === 'equipment' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <select
                value={newEquipmentId}
                onChange={(e) => setNewEquipmentId(e.target.value)}
                className="flex-1 p-2 border rounded-md"
                title="Выберите оборудование для добавления"
              >
                <option value="">Выберите оборудование</option>
                {equipment
                  .filter(eq => !user.equipment.some(userEq => userEq.equipment.id === eq.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category})
                    </option>
                  ))}
              </select>
              <input
                type="number"
                value={newEquipmentQuantity}
                onChange={(e) => setNewEquipmentQuantity(parseInt(e.target.value) || 1)}
                className="w-20 p-2 border rounded-md"
                min="1"
                placeholder="Кол-во"
              />
              <Button
                onClick={handleAddEquipment}
                disabled={!newEquipmentId || loading}
                size="sm"
              >
                Добавить
              </Button>
            </div>

            <div className="space-y-2">
              {user.equipment.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Нет оборудования</p>
              ) : (
                user.equipment.map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{item.equipment.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded ${rarityColors[item.equipment.rarity]}`}>
                          {rarityLabels[item.equipment.rarity]}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveEquipment(item.equipment.id)}
                        disabled={loading}
                      >
                        Удалить
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Количество:</span>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => handleUpdateEquipmentQuantity(item.equipment.id, parseInt(e.target.value) || 1)}
                className="w-20 p-1 border rounded text-sm"
                min="1"
                disabled={loading}
                title="Количество оборудования"
                placeholder="1"
              />
                      <span className="text-sm text-gray-500">
                        ({item.equipment.category} • {item.equipment.cost} кредитов)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Модификаторы */}
        {activeTab === 'modifiers' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="modifiers" className="block text-sm font-medium mb-1">Модификаторы (JSON)</label>
              <textarea
                id="modifiers"
                value={formData.modifiers}
                onChange={(e) => setFormData({ ...formData, modifiers: e.target.value })}
                className="w-full p-2 border rounded-md font-mono text-sm"
                rows={8}
                placeholder='{"mood": 1.2, "trust": 0.8}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Модификаторы влияют на эффективность действий. Значение 1.0 = без изменений, 1.2 = +20%, 0.8 = -20%
              </p>
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  )
}
