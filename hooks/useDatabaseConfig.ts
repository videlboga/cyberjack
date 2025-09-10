// ===== ХУК ДЛЯ РАБОТЫ С КОНФИГУРАЦИЕЙ ИЗ БД =====
// Замена useUnifiedConfig для работы с PostgreSQL

import { useState, useEffect, useCallback } from 'react'
import type { GameConfig } from '@/lib/unified-entities'

interface UseDatabaseConfigResult {
  config: GameConfig | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  stats: {
    characters: number
    actions: number
    contracts: number
    events: number
    equipment: number
    users: number
    storyScenes: number
    conditions: number
    stationEntities: number
  } | null
}

export function useDatabaseConfig(): UseDatabaseConfigResult {
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<UseDatabaseConfigResult['stats']>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Загружаем конфигурацию
      const res = await fetch('/api/db/config', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Ошибка загрузки конфигурации')
      }

      setConfig(data.config)
      setStats(data.stats)

      console.log('✅ Конфигурация загружена из БД:', {
        charactersCount: data.config?.characters?.length || 0,
        actionsCount: Object.keys(data.config?.actions || {}).length,
        contractsCount: data.config?.contracts?.length || 0,
        eventsCount: Object.values(data.config?.events || {}).flat().length,
        equipmentCount: data.config?.equipment?.length || 0,
        usersCount: data.config?.users?.length || 0,
        storyScenesCount: data.config?.storyScenes?.length || 0,
        conditionsCount: data.config?.conditions?.length || 0,
        stationEntitiesCount: Object.keys(data.config?.station?.stationEntities || {}).length
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('❌ Ошибка загрузки конфигурации из БД:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { config, loading, error, refresh, stats }
}

// Хук для работы с персонажами
export function useCharacters() {
  const [characters, setCharacters] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCharacters = useCallback(async (params?: {
    rank?: string
    status?: string
    location?: string
    skills?: string[]
    limit?: number
    offset?: number
  }) => {
    try {
      setLoading(true)
      setError(null)

      const searchParams = new URLSearchParams()
      if (params?.rank) searchParams.set('rank', params.rank)
      if (params?.status) searchParams.set('status', params.status)
      if (params?.location) searchParams.set('location', params.location)
      if (params?.skills) searchParams.set('skills', params.skills.join(','))
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.offset) searchParams.set('offset', params.offset.toString())

      const res = await fetch(`/api/db/characters?${searchParams}`, {
        cache: 'no-store'
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Ошибка загрузки персонажей')
      }

      setCharacters(data.data)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('❌ Ошибка загрузки персонажей:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const createCharacter = useCallback(async (characterData: any) => {
    try {
      const res = await fetch('/api/db/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(characterData)
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Ошибка создания персонажа')
      }

      // Обновляем список персонажей
      await fetchCharacters()

      return data.data

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('❌ Ошибка создания персонажа:', errorMessage)
      throw new Error(errorMessage)
    }
  }, [fetchCharacters])

  const updateCharacter = useCallback(async (id: string, updates: any) => {
    try {
      const res = await fetch('/api/db/characters', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, ...updates })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Ошибка обновления персонажа')
      }

      // Обновляем список персонажей
      await fetchCharacters()

      return data.data

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('❌ Ошибка обновления персонажа:', errorMessage)
      throw new Error(errorMessage)
    }
  }, [fetchCharacters])

  const deleteCharacter = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/db/characters?id=${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Ошибка удаления персонажа')
      }

      // Обновляем список персонажей
      await fetchCharacters()

      return data.data

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('❌ Ошибка удаления персонажа:', errorMessage)
      throw new Error(errorMessage)
    }
  }, [fetchCharacters])

  useEffect(() => {
    void fetchCharacters()
  }, [fetchCharacters])

  return {
    characters,
    loading,
    error,
    fetchCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter
  }
}

// Хук для проверки подключения к БД
export function useDatabaseConnection() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const checkConnection = useCallback(async () => {
    try {
      setLoading(true)

      const res = await fetch('/api/db/health', {
        cache: 'no-store'
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      setConnected(data.success)

    } catch (err) {
      console.error('❌ Ошибка проверки подключения к БД:', err)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkConnection()
  }, [checkConnection])

  return { connected, loading, checkConnection }
}
