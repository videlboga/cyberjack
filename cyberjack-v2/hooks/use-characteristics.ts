// hooks/use-characteristics.ts

import { useState, useEffect, useCallback } from 'react'
import { CharacteristicDisplay } from '@/types/game'

export function useCharacteristics(characterId: string) {
  const [characteristics, setCharacteristics] = useState<CharacteristicDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCharacteristics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/characters/${characterId}/characteristics`)
      if (!response.ok) {
        throw new Error('Failed to fetch characteristics')
      }

      const data = await response.json()
      setCharacteristics(data.characteristics || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [characterId])

  const updateCharacteristic = useCallback(async (
    characteristicId: string,
    change: number,
    permanent: boolean = false
  ) => {
    try {
      const response = await fetch(
        `/api/characteristics/${characterId}/${characteristicId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ change, permanent }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update characteristic')
      }

      // Обновить локальное состояние
      setCharacteristics(prev =>
        prev.map(char =>
          char.id === characteristicId
            ? { ...char, currentValue: char.currentValue + change }
            : char
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [characterId])

  useEffect(() => {
    if (characterId) {
      fetchCharacteristics()
    }
  }, [characterId, fetchCharacteristics])

  return {
    characteristics,
    loading,
    error,
    updateCharacteristic,
    refetch: fetchCharacteristics
  }
}

