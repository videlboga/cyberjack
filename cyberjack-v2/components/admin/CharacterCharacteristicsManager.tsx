"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface CharacterCharacteristic {
  id: string
  characterId: string
  characteristicDefId: string
  currentValue: number
  baseValue: number
  recoveryRate: number
  shiftThreshold: number
  shiftRate: number
  timeInAlteredState: number
  lastChanged: string
  lastRecovery: string
  definition: {
    id: string
    name: string
    category: string
    description: string | null
    minValue: number
    maxValue: number
  }
}

interface CharacterCharacteristicsManagerProps {
  characterId: string
  characterName: string
}

export function CharacterCharacteristicsManager({ characterId, characterName }: CharacterCharacteristicsManagerProps) {
  const [characteristics, setCharacteristics] = useState<CharacterCharacteristic[]>([])
  const [availableCharacteristics, setAvailableCharacteristics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    currentValue: 0,
    baseValue: 0,
    recoveryRate: 1.0,
    shiftThreshold: 60,
    shiftRate: 0.1
  })

  useEffect(() => {
    fetchCharacterCharacteristics()
    fetchAvailableCharacteristics()
  }, [characterId])

  const fetchCharacterCharacteristics = async () => {
    try {
      const response = await fetch(`/api/characteristics/${characterId}`)
      if (response.ok) {
        const data = await response.json()
        setCharacteristics(data)
      }
    } catch (err) {
      setError('Ошибка загрузки характеристик персонажа')
    }
  }

  const fetchAvailableCharacteristics = async () => {
    try {
      const response = await fetch('/api/characteristics')
      if (response.ok) {
        const data = await response.json()
        setAvailableCharacteristics(data)
      }
    } catch (err) {
      setError('Ошибка загрузки доступных характеристик')
    } finally {
      setLoading(false)
    }
  }

  const addCharacteristicToCharacter = async (characteristicDefId: string) => {
    try {
      const response = await fetch(`/api/characteristics/${characterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characteristicDefId,
          currentValue: 50,
          baseValue: 50
        })
      })

      if (response.ok) {
        await fetchCharacterCharacteristics()
        setShowAddForm(false)
      } else {
        setError('Ошибка добавления характеристики')
      }
    } catch (err) {
      setError('Ошибка добавления характеристики')
    }
  }

  const updateCharacteristic = async (characteristicId: string, updates: Partial<CharacterCharacteristic>) => {
    try {
      const response = await fetch(`/api/characteristics/${characterId}/${characteristicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        await fetchCharacterCharacteristics()
        setEditingId(null)
      } else {
        setError('Ошибка обновления характеристики')
      }
    } catch (err) {
      setError('Ошибка обновления характеристики')
    }
  }

  const removeCharacteristicFromCharacter = async (characteristicId: string) => {
    if (!confirm('Удалить характеристику у персонажа?')) return

    try {
      const response = await fetch(`/api/characteristics/${characterId}/${characteristicId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchCharacterCharacteristics()
      }
    } catch (err) {
      setError('Ошибка удаления характеристики')
    }
  }

  const handleEdit = (characteristic: CharacterCharacteristic) => {
    setEditForm({
      currentValue: characteristic.currentValue,
      baseValue: characteristic.baseValue,
      recoveryRate: characteristic.recoveryRate,
      shiftThreshold: characteristic.shiftThreshold,
      shiftRate: characteristic.shiftRate
    })
    setEditingId(characteristic.id)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      updateCharacteristic(editingId, editForm)
    }
  }

  const assignedCharacteristicIds = characteristics.map(c => c.characteristicDefId)
  const unassignedCharacteristics = availableCharacteristics.filter(c => !assignedCharacteristicIds.includes(c.id))

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Загрузка характеристик...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Характеристики персонажа: {characterName}</h2>
        <Button
          onClick={() => setShowAddForm(true)}
          disabled={unassignedCharacteristics.length === 0}
        >
          Добавить характеристику
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">Добавить характеристику</h3>
          <div className="space-y-2">
            {unassignedCharacteristics.map((characteristic) => (
              <div key={characteristic.id} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <span className="font-medium">{characteristic.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({characteristic.category})</span>
                  <div className="text-xs text-gray-500">
                    Диапазон: {characteristic.minValue} - {characteristic.maxValue}
                  </div>
                </div>
                <Button size="sm" onClick={() => addCharacteristicToCharacter(characteristic.id)}>
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
        {characteristics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>У персонажа нет настроенных характеристик</p>
            <p className="text-sm mt-2">Добавьте первую характеристику</p>
          </div>
        ) : (
          characteristics.map((characteristic) => (
            <div key={characteristic.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium">{characteristic.definition.name}</h3>
                    <span className="text-sm text-gray-500">({characteristic.definition.category})</span>
                  </div>

                  {characteristic.definition.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {characteristic.definition.description}
                    </p>
                  )}

                  {editingId === characteristic.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Текущее значение</label>
                          <input
                            type="number"
                            min={characteristic.definition.minValue}
                            max={characteristic.definition.maxValue}
                            value={editForm.currentValue}
                            onChange={(e) => setEditForm({ ...editForm, currentValue: Number(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Текущее значение характеристики"
                            placeholder="Введите текущее значение"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Базовое значение</label>
                          <input
                            type="number"
                            min={characteristic.definition.minValue}
                            max={characteristic.definition.maxValue}
                            value={editForm.baseValue}
                            onChange={(e) => setEditForm({ ...editForm, baseValue: Number(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Базовое значение характеристики"
                            placeholder="Введите базовое значение"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Скорость восстановления</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={editForm.recoveryRate}
                            onChange={(e) => setEditForm({ ...editForm, recoveryRate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Скорость восстановления характеристики"
                            placeholder="Введите скорость восстановления"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Порог сдвига (мин)</label>
                          <input
                            type="number"
                            min="1"
                            max="1440"
                            value={editForm.shiftThreshold}
                            onChange={(e) => setEditForm({ ...editForm, shiftThreshold: Number(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Порог сдвига в минутах"
                            placeholder="Введите порог сдвига"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Скорость сдвига</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={editForm.shiftRate}
                            onChange={(e) => setEditForm({ ...editForm, shiftRate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Скорость сдвига характеристики"
                            placeholder="Введите скорость сдвига"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          Сохранить
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Текущее значение:</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-blue-500 h-3 rounded-full"
                                style={{
                                  width: `${((characteristic.currentValue - characteristic.definition.minValue) /
                                    (characteristic.definition.maxValue - characteristic.definition.minValue)) * 100}%`
                                }}
                              ></div>
                            </div>
                            <span className="text-sm w-12 text-right">{Math.round(characteristic.currentValue)}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Базовое значение:</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-green-500 h-3 rounded-full"
                                style={{
                                  width: `${((characteristic.baseValue - characteristic.definition.minValue) /
                                    (characteristic.definition.maxValue - characteristic.definition.minValue)) * 100}%`
                                }}
                              ></div>
                            </div>
                            <span className="text-sm w-12 text-right">{Math.round(characteristic.baseValue)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>Восстановление: {characteristic.recoveryRate}/мин</div>
                        <div>Порог сдвига: {characteristic.shiftThreshold} мин</div>
                        <div>Скорость сдвига: {characteristic.shiftRate}/мин</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        В измененном состоянии: {characteristic.timeInAlteredState} мин
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 ml-2">
                  {editingId !== characteristic.id && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(characteristic)}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeCharacteristicFromCharacter(characteristic.id)}
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
