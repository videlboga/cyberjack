import React from "react"
import { loadGameConfig } from "@/lib/simple-db-loader"
import type { GameConfig } from "@/lib/unified-entities"
import ProdPageClient from "./components/ProdPageClient"

export default async function ProdPage() {
  console.log('🚀 ProdPage: Загружаем данные на сервере...')

  try {
    const config = await loadGameConfig()
    console.log('✅ ProdPage: Данные загружены на сервере:', {
      characters: config.characters?.length || 0,
      actions: Object.keys(config.actions?.categories || {}).length,
      equipment: config.equipment?.equipment?.length || 0,
      contracts: config.contracts?.length || 0,
      users: config.users?.length || 0,
      characterAI: Object.keys(config.characterAI || {}).length
    })

    return <ProdPageClient initialConfig={config} />
  } catch (error) {
    console.error('❌ ProdPage: Ошибка загрузки данных:', error)

    // Возвращаем пустую конфигурацию в случае ошибки
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

    return <ProdPageClient initialConfig={fallbackConfig} />
  }
}
