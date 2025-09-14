"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { UserEditModal } from './UserEditModal'

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
  characterKnowledge: Array<{
    id: string
    level: 'UNKNOWN' | 'APPROXIMATE' | 'DETAILED' | 'PRECISE'
    value: number | null
    accuracy: number | null
    lastRevealed: string | null
    character: {
      id: string
      name: string
    }
    characteristic: {
      id: string
      name: string
    } | null
  }>
}

interface Equipment {
  id: string
  name: string
  category: string
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
  cost: number
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

const knowledgeLevelLabels = {
  UNKNOWN: 'Неизвестно',
  APPROXIMATE: 'Приблизительно',
  DETAILED: 'Подробно',
  PRECISE: 'Точно'
}

export function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchEquipment()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Ошибка загрузки пользователей')
      }
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
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

  const handleAddEquipment = async (userId: string, equipmentId: string, quantity: number = 1) => {
    try {
      const response = await fetch(`/api/users/${userId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId,
          quantity
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка добавления оборудования')
      }

      await fetchUsers()
      setShowEquipmentModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления оборудования')
    }
  }

  const handleEditUser = async (user: User) => {
    try {
      // Получаем полную информацию о пользователе
      const response = await fetch(`/api/users/${user.id}`)
      if (!response.ok) {
        throw new Error('Ошибка загрузки данных пользователя')
      }
      const fullUser = await response.json()
      setEditingUser(fullUser)
      setShowEditModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки пользователя')
    }
  }

  const handleSaveUser = async (updatedUser: User) => {
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u))
    setEditingUser(null)
    setShowEditModal(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Управление пользователями</h2>
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
        <h2 className="text-xl font-semibold mb-4">Управление пользователями</h2>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchUsers} variant="outline">
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold mb-4">Управление пользователями</h2>

        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{user.name}</h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      {user.credits} кредитов
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  <p className="text-xs text-gray-500">
                    Зарегистрирован: {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditUser(user)}
                  >
                    Редактировать
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedUser(user)
                      setShowEquipmentModal(true)
                    }}
                  >
                    Добавить оборудование
                  </Button>
                </div>
              </div>

              {/* Копии персонажей */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Копии персонажей ({user.characterCopies.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {user.characterCopies.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет копий персонажей</p>
                  ) : (
                    user.characterCopies.map((copy) => (
                      <div key={copy.id} className="p-2 border rounded bg-gray-50">
                        <div className="flex items-center gap-2">
                          {copy.character.avatar && (
                            <img
                              src={copy.character.avatar}
                              alt={copy.character.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium">{copy.character.name}</p>
                            <p className="text-xs text-gray-500">
                              Копий: {copy.quantity || 1}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Оборудование */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Оборудование ({user.equipment.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {user.equipment.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет оборудования</p>
                  ) : (
                    user.equipment.map((item) => (
                      <div key={item.id} className="p-2 border rounded bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{item.equipment.name}</p>
                            <p className="text-xs text-gray-500">
                              x{item.quantity} • {item.equipment.category}
                            </p>
                          </div>
                          <span className={`px-1 py-0.5 text-xs rounded ${rarityColors[item.equipment.rarity]}`}>
                            {rarityLabels[item.equipment.rarity]}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Знания о персонажах */}
              <div>
                <h4 className="font-medium mb-2">Знания о персонажах ({user.characterKnowledge.length})</h4>
                <div className="space-y-2">
                  {user.characterKnowledge.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет знаний о персонажах</p>
                  ) : (
                    user.characterKnowledge.slice(0, 5).map((knowledge) => (
                      <div key={knowledge.id} className="p-2 border rounded bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {knowledge.character.name}
                              {knowledge.characteristic && ` • ${knowledge.characteristic.name}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {knowledge.value !== null && `Значение: ${knowledge.value}`}
                              {knowledge.accuracy !== null && ` (±${knowledge.accuracy}%)`}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            knowledge.level === 'PRECISE' ? 'bg-green-100 text-green-800' :
                            knowledge.level === 'DETAILED' ? 'bg-blue-100 text-blue-800' :
                            knowledge.level === 'APPROXIMATE' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {knowledgeLevelLabels[knowledge.level]}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  {user.characterKnowledge.length > 5 && (
                    <p className="text-xs text-gray-500">
                      ... и ещё {user.characterKnowledge.length - 5} знаний
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Модальное окно добавления оборудования */}
      {showEquipmentModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Добавить оборудование пользователю: {selectedUser.name}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEquipmentModal(false)}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              {equipment.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-600">
                        {item.category} • {item.cost} кредитов
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${rarityColors[item.rarity]}`}>
                        {rarityLabels[item.rarity]}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleAddEquipment(selectedUser.id, item.id, 1)}
                      >
                        Добавить
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {equipment.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Нет доступного оборудования
              </p>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно редактирования пользователя */}
      <UserEditModal
        user={editingUser}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingUser(null)
        }}
        onSave={handleSaveUser}
      />
    </div>
  )
}
