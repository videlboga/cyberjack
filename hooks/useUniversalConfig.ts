"use client"

import { useCallback, useEffect, useState } from "react"
import type { GameConfig } from "@/lib/unified-entities"

type UseUniversalConfigResult = {
  config: GameConfig | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  source: 'database' | 'json' | 'mixed'
}

export function useUniversalConfig(): UseUniversalConfigResult {
  console.log('🚀 useUniversalConfig: Хук инициализирован')

  const [config, setConfig] = useState<GameConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'database' | 'json' | 'mixed'>('json')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 useUniversalConfig: Загружаем конфигурацию...')

      // Используем полный URL с текущим origin
      const apiUrl = typeof window !== 'undefined' && window.location
        ? `${window.location.origin}/api/db/config`
        : '/api/db/config'

      console.log('🔄 useUniversalConfig: Запрос к:', apiUrl)

      // Простой fetch запрос без сложной логики fallback с таймаутом
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 секунд таймаут

      const response = await fetch(apiUrl, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('🔄 useUniversalConfig: Статус ответа:', response.status)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('🔄 useUniversalConfig: Данные получены:', { success: data.success })

      if (!data.success) {
        throw new Error(data.error || 'Failed to load config')
      }

      const raw = data.config as any

      // Нормализуем данные под ожидаемую структуру
      const normalized: GameConfig = {
        ...raw,
        characters: Array.isArray(raw?.characters) ? raw.characters : (raw?.characters?.characters ?? []),
        users: Array.isArray(raw?.users) ? raw.users : (raw?.users?.users ?? []),
        equipment: {
          equipment: Array.isArray(raw?.equipment) ? raw.equipment : (raw?.equipment?.equipment ?? [])
        },
        contracts: Array.isArray(raw?.contracts) ? raw.contracts : (raw?.contracts?.available ?? []),
        actions: raw?.actions ?? { categories: {} },
        events: raw?.events ?? { anomalies: [], crises: [], opportunities: [] },
        storyScenes: Array.isArray(raw?.storyScenes)
          ? { scenes: raw.storyScenes }
          : (raw?.storyScenes ?? { scenes: [] }),
        station: raw?.station ? {
          ...raw.station,
          stationEntities: Array.isArray(raw.station.stationEntities)
            ? raw.station.stationEntities
            : (raw.station.stationEntities ? Object.values(raw.station.stationEntities) : [])
        } : { stationEntities: [] },
        characterAI: raw?.characterAI ?? {},
        system: raw?.system ?? {},
        ui: raw?.ui ?? {},
        ai: raw?.ai ?? {},
        conditions: raw?.conditions ?? []
      }

      console.log('✅ useUniversalConfig: Конфигурация загружена:', {
        characters: normalized.characters?.length || 0,
        actions: Object.keys(normalized.actions?.categories || {}).length,
        equipment: normalized.equipment?.equipment?.length || 0,
        contracts: normalized.contracts?.length || 0,
        users: normalized.users?.length || 0
      })

      setConfig(normalized)
      setSource(data.source || 'database')
      console.log('✅ useUniversalConfig: Источник данных установлен:', data.source || 'database')

    } catch (err) {
      console.error('❌ useUniversalConfig: Ошибка:', err)
      const errorMessage = err instanceof Error
        ? (err.name === 'AbortError' ? 'Таймаут запроса (10 сек)' : err.message)
        : String(err)
      setError(errorMessage)

      // В случае ошибки, попробуем загрузить fallback данные
      console.log('🔄 useUniversalConfig: Пробуем fallback...')
      try {
        // Создаем базовую конфигурацию для демонстрации
        const fallbackConfig: GameConfig = {
          characters: [],
          users: [],
          equipment: { equipment: [] },
          contracts: [],
          actions: { categories: {} },
          events: { anomalies: [], crises: [], opportunities: [] },
          storyScenes: { scenes: [] },
          station: { stationEntities: [] },
          characterAI: {},
          system: {},
          ui: {},
          ai: {},
          conditions: []
        }
        setConfig(fallbackConfig)
        setSource('fallback')
      } catch (fallbackErr) {
        console.error('❌ useUniversalConfig: Fallback тоже не удался:', fallbackErr)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    console.log('🚀 useUniversalConfig: useEffect запущен')
    void refresh()
  }, [refresh])


  return { config, loading, error, refresh, source }
}
