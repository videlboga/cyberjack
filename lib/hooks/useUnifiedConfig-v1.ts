"use client"

import { useCallback, useEffect, useState } from "react"
import type { GameConfig } from "@/lib/unified-entities"

type UseUnifiedConfigResult = {
  config: GameConfig | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useUnifiedConfig(): UseUnifiedConfigResult {
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      console.log('🔄 useUnifiedConfig: Начинаем загрузку данных...')
      setLoading(true)
      setError(null)
      const res = await fetch('/api/config', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Config load failed')
      const raw = data.config as any
      const normalized: any = {
        ...raw,
        characters: Array.isArray(raw?.characters) ? raw.characters : (raw?.characters?.characters ?? []),
        users: Array.isArray(raw?.users) ? raw.users : (raw?.users?.users ?? []),
        equipment: Array.isArray(raw?.equipment) ? raw.equipment : (raw?.equipment?.equipment ?? []),
        contracts: Array.isArray(raw?.contracts) ? raw.contracts : (raw?.contracts?.available ?? []),
        // Храним storyScenes как объект с полем scenes (ожидается прод-страницей)
        storyScenes: Array.isArray(raw?.storyScenes)
          ? { scenes: raw.storyScenes }
          : (raw?.storyScenes ?? { scenes: [] }),
        actions: raw?.actions ?? {},
        station: raw?.station ? {
          ...raw.station,
          stationEntities: Array.isArray(raw.station.stationEntities)
            ? raw.station.stationEntities
            : (raw.station.stationEntities ? Object.values(raw.station.stationEntities) : [])
        } : { stationEntities: [] }
      }
      console.log('✅ useUnifiedConfig: Данные загружены:', {
        characters: normalized.characters?.length || 0,
        users: normalized.users?.length || 0,
        equipment: normalized.equipment?.length || 0,
        actions: Object.keys(normalized.actions?.categories || {}).length
      })
      setConfig(normalized as GameConfig)
    } catch (err) {
      console.error('❌ useUnifiedConfig: Ошибка загрузки:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { config, loading, error, refresh }
}
