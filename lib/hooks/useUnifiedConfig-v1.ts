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
        storyScenes: Array.isArray(raw?.storyScenes) ? raw.storyScenes : (raw?.storyScenes?.scenes ?? []),
        actions: raw?.actions ?? {},
        station: raw?.station ? {
          ...raw.station,
          stationEntities: Array.isArray(raw.station.stationEntities)
            ? raw.station.stationEntities
            : (raw.station.stationEntities ? Object.values(raw.station.stationEntities) : [])
        } : { stationEntities: [] }
      }
      setConfig(normalized as GameConfig)
    } catch (err) {
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


