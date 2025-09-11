'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useCharacterAI } from '../../prod/hooks/useCharacterAI'
import { loadGameConfig } from '../../../lib/simple-db-loader'
import { MessageAnalysisService } from '../../../lib/character/message-analysis-service'

interface MechanicsTesterProps {}

export default function MechanicsTester({}: MechanicsTesterProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>('')
  const [selectedTool, setSelectedTool] = useState<string>('')
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [toolIntensity, setToolIntensity] = useState<number>(5)
  const [actionIntensity, setActionIntensity] = useState<number>(5)
  const [activeZones, setActiveZones] = useState<{[key: string]: boolean}>({})
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState<{[key: string]: number}>({})
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTimers, setActiveTimers] = useState<{[key: string]: NodeJS.Timeout}>({})
  const [llmMessages, setLlmMessages] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [characterStatsView, setCharacterStatsView] = useState<'current' | 'knowledge'>('current')
  const [editedCharacter, setEditedCharacter] = useState<any>(null)
  const [editJson, setEditJson] = useState<string>("")
  const [showEditJson, setShowEditJson] = useState<boolean>(false)
  const [llmBasePrompt, setLlmBasePrompt] = useState<string>("")
  const [chat2Messages, setChat2Messages] = useState<Array<{role: 'user'|'assistant', content: string}>>([])
  const [chat2Input, setChat2Input] = useState<string>("")
  const [charViewMode, setCharViewMode] = useState<'values'|'openness'>('values')
  const [knowledgeMap, setKnowledgeMap] = useState<Record<string, number>>({})
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const masRef = useRef<MessageAnalysisService | null>(null)

  // Таймер для отслеживания времени
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Загружаем конфигурацию
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await loadGameConfig()
        setConfig(cfg)
        const base = cfg?.characterAI?.llmPrompts?.basePrompt || ''
        setLlmBasePrompt(base)
        console.log('✅ Конфигурация загружена:', {
          charactersCount: cfg?.characters?.length || 0,
          toolsCount: Object.keys(cfg?.characterAI?.tools || {}).length,
          actionsCount: Object.keys(cfg?.characterAI?.actions || {}).length,
          fullConfig: cfg
        })
        addLog(`Конфигурация загружена: ${cfg?.characters?.length || 0} персонажей, ${Object.keys(cfg?.characterAI?.tools || {}).length} инструментов, ${Object.keys(cfg?.characterAI?.actions || {}).length} действий`)
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигурации:', error)
        addLog('Ошибка загрузки конфигурации: ' + error)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  // Инициализация MessageAnalysisService (GLM 4.5 через OpenRouter)
  useEffect(() => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || ''
      masRef.current = new MessageAnalysisService(apiKey, 'z-ai/glm-4.5')
    } catch {}
  }, [])

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      Object.values(activeTimers).forEach(timer => clearInterval(timer))
    }
  }, [activeTimers])

  // Подписка на авто-сообщения в чат-2 (прогон через анализатор)
  useEffect(() => {
    const handler = async (e: any) => {
      const content = e?.detail?.content
      if (!content || !selectedCharacterData) return
      try {
        const ctx = buildLLMContext()
        const analysis = await masRef.current?.analyzeMessage(content, ctx, {})
        const reply = analysis?.response || content
        setChat2Messages(prev => [...prev, { role: 'assistant', content: reply }])
      } catch {
        setChat2Messages(prev => [...prev, { role: 'assistant', content }])
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('characterAI:autoMessage', handler as any)
      return () => window.removeEventListener('characterAI:autoMessage', handler as any)
    }
  }, [])

  // Синхронизация выбранного персонажа для редактирования
  useEffect(() => {
    const ch = (config?.characters || []).find((c: any) => c.id === selectedCharacter)
    if (ch) {
      setEditedCharacter(JSON.parse(JSON.stringify(ch)))
      setEditJson(JSON.stringify(ch, null, 2))
      // Инициализируем карту открытости по ключам характеристик (по умолчанию 1)
      const kc: Record<string, number> = {}
      const cs = ch?.characteristics || {}
      ;['physical','psychological','social','personality','special','emotionalState'].forEach((cat) => {
        const data = (cs as any)[cat] || {}
        Object.keys(data).forEach((k) => {
          kc[`${cat}.${k}`] = typeof knowledgeMap[`${cat}.${k}`] === 'number' ? knowledgeMap[`${cat}.${k}`] : 1
        })
      })
      setKnowledgeMap(kc)
    } else {
      setEditedCharacter(null)
      setEditJson("")
      setKnowledgeMap({})
    }
  }, [selectedCharacter, config])

  // Текущий пользователь (для механики открытости, если она есть в users)
  const users = config?.users || []
  const currentUser = users.find((u: any) => u.id === currentUserId) || users[0]
  const currentUserKnowledge = currentUser?.knowledge || {}

  const getOpenness = (charId: string, cat: string, key: string) => {
    // Пробуем взять из знаний пользователя, если есть известная структура
    // Ожидаемые варианты: knowledge.characters[charId].characteristics[cat][key] -> number 0..1
    try {
      const k1 = currentUserKnowledge?.characters?.[charId]?.characteristics?.[cat]?.[key]
      if (typeof k1 === 'number') return k1
    } catch {}
    // Фолбек: локальная карта
    const local = knowledgeMap[`${cat}.${key}`]
    return typeof local === 'number' ? local : 1
  }

  const maskValueByOpenness = (value: any, openness: number) => {
    if (openness >= 0.8) return Number(value).toFixed(2)
    if (openness >= 0.5) return '≈' + Number(value).toFixed(1)
    return '—'
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`])
  }

  const addLlmMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLlmMessages(prev => [...prev.slice(-4), `[${timestamp}] ${message}`])
    addLog(`🤖 LLM: ${message}`)
  }

  const simulateToolEffects = (tool: any, area: string, isHold: boolean = false) => {
    if (!tool?.effects) return

    const multiplier = (toolIntensity / 10) * (tool.intensityMultiplier || 1)

    Object.entries(tool.effects).forEach(([category, effects]: [string, any]) => {
      if (effects && typeof effects === 'object') {
        Object.entries(effects).forEach(([stat, baseValue]: [string, any]) => {
          const intensityMult = tool.intensityMultiplier?.[stat] || 1
          const finalValue = baseValue * (toolIntensity / 10) * intensityMult

          setStats(prev => ({
            ...prev,
            [stat]: (prev[stat] || 0) + finalValue
          }))

          const modeText = isHold ? '(hold)' : '(click)'
          addLog(`${stat}: +${finalValue.toFixed(2)} ${modeText}`)
        })
      }
    })
  }

  const simulateActionEffects = (action: any, area: string, isHold: boolean = false) => {
    if (!action?.effects) return

    Object.entries(action.effects).forEach(([category, effects]: [string, any]) => {
      if (effects && typeof effects === 'object') {
        Object.entries(effects).forEach(([stat, baseValue]: [string, any]) => {
          const finalValue = baseValue * (actionIntensity / 10)

          setStats(prev => ({
            ...prev,
            [stat]: (prev[stat] || 0) + finalValue
          }))

          const modeText = isHold ? '(hold)' : '(click)'
          addLog(`${stat}: +${finalValue.toFixed(2)} ${modeText}`)
        })
      }
    })
  }

  const renderCharacterStats = (character: any) => {
    if (!character) return null

    const fetishes = character.fetishes || {}
    const src = editedCharacter || character
    const characteristics = src.characteristics || {}
    const categories: Array<{ id: string; title: string; data: any }> = [
      { id: 'physical', title: 'Физические', data: characteristics.physical || {} },
      { id: 'psychological', title: 'Психологические', data: characteristics.psychological || {} },
      { id: 'social', title: 'Социальные', data: characteristics.social || {} },
      { id: 'personality', title: 'Личностные', data: characteristics.personality || {} },
      { id: 'special', title: 'Специальные', data: characteristics.special || {} },
      { id: 'emotionalState', title: 'Эмоциональное состояние', data: characteristics.emotionalState || {} },
    ]

    if (characterStatsView === 'current') {
      return (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-green-400">Таблица характеристик</h4>
            <button
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
              onClick={async () => {
                try {
                  if (!editedCharacter?.id) throw new Error('Нет выбранного персонажа')
                  const newChars = (config?.characters || []).map((c: any) => c.id === editedCharacter.id ? editedCharacter : c)
                  const res = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: 'characters', data: { characters: newChars } })
                  })
                  const j = await res.json()
                  if (!j.success) throw new Error(j.error || 'Не удалось сохранить')
                  setConfig((prev: any) => ({ ...prev, characters: newChars }))
                  addLog(`💾 Изменения характеристик сохранены для ${editedCharacter.name}`)
                } catch (e: any) {
                  addLog(`❌ Ошибка сохранения: ${e?.message || e}`)
                }
              }}
            >
              💾 Сохранить изменения
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-700 rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-300">Категория</th>
                  <th className="text-left px-3 py-2 text-gray-300">Параметр</th>
                  <th className="text-right px-3 py-2 text-gray-300">Значение</th>
                </tr>
              </thead>
              <tbody>
                {categories.flatMap(({ id, title, data }) => (
                  Object.entries(data).map(([key, value]: [string, any]) => (
                    <tr key={`${id}.${key}`} className="odd:bg-gray-900 even:bg-gray-800/60">
                      <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{title}</td>
                      <td className="px-3 py-2 text-gray-200">{key}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.1"
                          value={Number(value)}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            setEditedCharacter((prev: any) => {
                              const next = JSON.parse(JSON.stringify(prev))
                              if (!next.characteristics) next.characteristics = {}
                              if (!next.characteristics[id]) next.characteristics[id] = {}
                              next.characteristics[id][key] = isNaN(v) ? 0 : v
                              return next
                            })
                          }}
                          className="w-28 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-cyan-300 text-right"
                          title={`Изменить ${title} / ${key}`}
                        />
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    } else {
      // Режим уровня знания
      return (
        <div className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-4">
            <h4 className="font-semibold text-yellow-400 mb-2">🔍 Уровень знания о персонаже</h4>
            <p className="text-sm text-gray-300 mb-3">
              Этот режим показывает, насколько хорошо игрок знает персонажа и его характеристики.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl mb-1">📊</div>
                <div className="text-yellow-400 font-semibold">Базовые</div>
                <div className="text-xs text-gray-400">Имя, внешность</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🎭</div>
                <div className="text-yellow-400 font-semibold">Характер</div>
                <div className="text-xs text-gray-400">Личность, эмоции</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🔥</div>
                <div className="text-yellow-400 font-semibold">Фетиши</div>
                <div className="text-xs text-gray-400">Предпочтения</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🎯</div>
                <div className="text-yellow-400 font-semibold">Триггеры</div>
                <div className="text-xs text-gray-400">Реакции, слабости</div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-pink-400 mb-2">💕 Фетиши</h4>
            <div className="space-y-2">
              {['primary', 'secondary', 'discovered', 'hidden'].map(category => (
                <div key={category} className="bg-gray-700 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="capitalize font-medium">{category}:</span>
                    <span className="text-sm text-gray-400">
                      {(fetishes[category] || []).length} фетишей
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">
                    {fetishes[category]?.length > 0
                      ? fetishes[category].join(', ')
                      : 'Не обнаружены'
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-cyan-400 mb-2">📈 Прогресс взаимодействия</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Всего взаимодействий:</span>
                  <span className="text-cyan-400">{character.totalInteractions || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Последнее взаимодействие:</span>
                  <span className="text-cyan-400">
                    {character.lastInteraction
                      ? new Date(character.lastInteraction).toLocaleDateString()
                      : 'Никогда'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Стиль общения:</span>
                  <span className="text-cyan-400">{character.communicationStyle || 'Неизвестен'}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-green-400 mb-2">🎭 Эмоциональный профиль</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Текущее состояние:</span>
                  <span className="text-green-400">{character.emotionalState || 'Нейтральное'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Уровень доверия:</span>
                  <span className="text-green-400">Неизвестен</span>
                </div>
                <div className="flex justify-between">
                  <span>Уровень подчинения:</span>
                  <span className="text-green-400">Неизвестен</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  }

  const characters = config?.characters || []
  const tools = config?.characterAI?.tools || {}
  const actions = config?.characterAI?.actions || {}

  const selectedCharacterData = characters.find((c: any) => c.id === selectedCharacter)

  const interactiveAreas = [
    { id: 'head', name: 'Голова', x: 45, y: 15, width: 10, height: 15, description: 'Нейроинтерфейсы' },
    { id: 'chest', name: 'Грудь', x: 40, y: 35, width: 20, height: 20, description: 'Основная область' },
    { id: 'hands', name: 'Руки', x: 30, y: 50, width: 15, height: 15, description: 'Тактильные зоны' },
    { id: 'thighs', name: 'Бедра', x: 42, y: 65, width: 16, height: 25, description: 'Чувствительная область' }
  ]

  const handleZoneClick = (areaId: string, mode: 'click' | 'hold') => {
    if (!selectedCharacterData) {
      addLog('Сначала выберите персонажа')
      return
    }

    const areaName = interactiveAreas.find(a => a.id === areaId)?.name || areaId

    if (mode === 'click') {
      addLog(`🎯 Клик по зоне: ${areaId} (${areaName})`)

      // Обработка инструмента
      if (selectedTool) {
        const tool = tools[selectedTool]
        if (tool && tool.modes?.includes('click')) {
          addLog(`🔧 Применение инструмента: ${tool.name} (интенсивность: ${toolIntensity})`)
          simulateToolEffects(tool, areaId, false)

          // Обработка LLM триггера по кликам
          if (tool.llmTrigger?.clicks && currentTime % tool.llmTrigger.clicks === 0) {
            addLlmMessage(`Применен ${tool.name} к ${areaName}`)
          }
        }
      }

      // Обработка действия
      if (selectedAction) {
        const action = actions[selectedAction]
        if (action && action.modes?.includes('click')) {
          addLog(`⚡ Выполнение действия: ${action.name} (интенсивность: ${actionIntensity})`)
          simulateActionEffects(action, areaId, false)

          // Обработка LLM триггера по кликам
          if (action.llmTrigger?.clicks && currentTime % action.llmTrigger.clicks === 0) {
            addLlmMessage(`Выполнено ${action.name} над ${areaName}`)
          }
        }
      }
    }
  }

  const handleZoneHoldStart = (areaId: string) => {
    if (!selectedCharacterData) return

    const areaName = interactiveAreas.find(a => a.id === areaId)?.name || areaId
    const timerKey = `${areaId}_hold`

    addLog(`🎮 Начало удержания зоны: ${areaId} (${areaName})`)

    // Активируем визуальную индикацию
    setActiveZones(prev => ({ ...prev, [areaId]: true }))

    // Запускаем таймеры для инструмента
    if (selectedTool) {
      const tool = tools[selectedTool]
      if (tool && tool.modes?.includes('hold')) {
        const perSecondTimer = setInterval(() => {
          simulateToolEffects(tool, areaId, true)
        }, (tool.effectRate?.perSecond || 1) * 1000)

        let llmTimer: NodeJS.Timeout | null = null
        if (tool.llmTrigger?.seconds) {
          llmTimer = setInterval(() => {
            addLlmMessage(`${tool.name} применяется к ${areaName}`)
          }, tool.llmTrigger.seconds * 1000)
        }

        setActiveTimers(prev => ({
          ...prev,
          [`${timerKey}_effect`]: perSecondTimer,
          ...(llmTimer && { [`${timerKey}_llm`]: llmTimer })
        }))

        addLog(`⏰ Запущен hold-цикл для ${tool.name}`)
      }
    }

    // Запускаем таймеры для действия
    if (selectedAction) {
      const action = actions[selectedAction]
      if (action && action.modes?.includes('hold')) {
        const perSecondTimer = setInterval(() => {
          simulateActionEffects(action, areaId, true)
        }, (action.effectRate?.perSecond || 1) * 1000)

        let llmTimer: NodeJS.Timeout | null = null
        if (action.llmTrigger?.seconds) {
          llmTimer = setInterval(() => {
            addLlmMessage(`${action.name} выполняется над ${areaName}`)
          }, action.llmTrigger.seconds * 1000)
        }

        setActiveTimers(prev => ({
          ...prev,
          [`${timerKey}_action_effect`]: perSecondTimer,
          ...(llmTimer && { [`${timerKey}_action_llm`]: llmTimer })
        }))

        addLog(`⏰ Запущен hold-цикл для ${action.name}`)
      }
    }
  }

  const handleZoneHoldEnd = (areaId: string) => {
    const areaName = interactiveAreas.find(a => a.id === areaId)?.name || areaId
    const timerKey = `${areaId}_hold`

    addLog(`🛑 Окончание удержания зоны: ${areaId} (${areaName})`)

    // Деактивируем визуальную индикацию
    setActiveZones(prev => ({ ...prev, [areaId]: false }))

    // Останавливаем все таймеры для этой зоны
    setActiveTimers(prev => {
      const newTimers = { ...prev }

      // Останавливаем таймеры эффектов
      if (newTimers[`${timerKey}_effect`]) {
        clearInterval(newTimers[`${timerKey}_effect`])
        delete newTimers[`${timerKey}_effect`]
      }
      if (newTimers[`${timerKey}_llm`]) {
        clearInterval(newTimers[`${timerKey}_llm`])
        delete newTimers[`${timerKey}_llm`]
      }

      // Останавливаем таймеры действий
      if (newTimers[`${timerKey}_action_effect`]) {
        clearInterval(newTimers[`${timerKey}_action_effect`])
        delete newTimers[`${timerKey}_action_effect`]
      }
      if (newTimers[`${timerKey}_action_llm`]) {
        clearInterval(newTimers[`${timerKey}_action_llm`])
        delete newTimers[`${timerKey}_action_llm`]
      }

      return newTimers
    })

    addLog(`🧹 Очищены таймеры для зоны ${areaName}`)
  }

  const clearStats = () => {
    setStats({})
    addLog('Статистика очищена')
  }

  const clearLogs = () => {
    setLogs([])
  }

  const buildFinalPrompt = () => {
    const charName = selectedCharacterData?.name || 'Персонаж'
    const persona = (selectedCharacterData?.prompt?.character || selectedCharacterData?.prompts?.base || llmBasePrompt || '').trim()
    const toolName = selectedTool ? tools[selectedTool]?.name : null
    const actionName = selectedAction ? actions[selectedAction]?.name : null
    const parts: string[] = []
    if (persona) parts.push(persona)
    parts.push(`Персонаж: ${charName}.`)
    if (toolName) parts.push(`Инструмент: ${toolName} (интенсивность ${toolIntensity}).`)
    if (actionName) parts.push(`Действие: ${actionName} (интенсивность ${actionIntensity}).`)
    parts.push(`Контекст: тестовая страница механик, имитация click/hold.`)
    return parts.join(' ')
  }

  const buildLLMContext = () => {
    const ch = selectedCharacterData
    const characteristics: any = {}
    const cs = ch?.characteristics || {}
    ;['physical','psychological','social','personality','special'].forEach((cat) => {
      const data = (cs as any)[cat] || {}
      Object.entries(data).forEach(([k, v]: [string, any]) => {
        characteristics[`${cat}.${k}`] = { value: Number(v) || 0, interpretation: k }
      })
    })
    const fetishes: any = {}
    const f = ch?.fetishes || {}
    Object.entries(f).forEach(([k, v]: [string, any]) => {
      if (typeof v === 'number') fetishes[k] = { intensity: v, triggers: [], responses: [] }
    })
    return {
      basePrompt: (ch?.prompt?.character || ch?.prompts?.base || llmBasePrompt || '').trim(),
      characterContext: {
        name: ch?.name || 'Персонаж',
        role: ch?.archetype || 'актив',
        personality: ch?.communicationStyle || 'естественный стиль',
        currentState: ch?.emotionalState || 'нейтральное'
      },
      characteristics,
      fetishes,
      memory: { recent: [], important: [], traumatic: [] },
      currentSituation: {
        location: 'Лаборатория',
        equipment: [],
        pose: 'neutral',
        emotionalState: ch?.emotionalState || 'нейтральное',
        activeFetishes: Object.keys(fetishes)
      }
    }
  }

  const sendChat2 = async () => {
    const text = chat2Input.trim()
    if (!text) return
    setChat2Messages(prev => [...prev, { role: 'user', content: text }])
    setChat2Input("")
    try {
      const ctx = buildLLMContext()
      const analysis = await masRef.current?.analyzeMessage(text, ctx, {})
      const reply = analysis?.response || '...'
      setChat2Messages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      const reply = `(${selectedCharacterData?.name || 'Персонаж'}): (временный офлайн-ответ) ${text}`
      setChat2Messages(prev => [...prev, { role: 'assistant', content: reply }])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="text-center">
          <div className="text-2xl mb-4">🔄 Загрузка конфигурации...</div>
          <div className="animate-pulse">Пожалуйста, подождите</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-cyan-400">
          🧪 Тестирование механик CyberJack
        </h1>

        {/* Панель управления */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Выбор персонажа */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-purple-400">👤 Персонаж</h2>
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              title="Выбор персонажа"
            >
              <option value="">Выберите персонажа</option>
              {characters.map((char: any) => (
                <option key={char.id} value={char.id}>
                  {char.name} ({char.archetype})
                </option>
              ))}
            </select>
            {selectedCharacterData && (
              <div className="mt-4 text-sm text-gray-300">
                <p><strong>Фетиши:</strong> {selectedCharacterData.fetishes?.primary?.length || 0}</p>
                <p><strong>Уровень:</strong> {selectedCharacterData.characteristics?.physical?.Выносливость || 0}</p>
              </div>
            )}
          </div>

          {/* Характеристики персонажа */}
          {selectedCharacterData && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-green-400">📊 Характеристики</h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCharacterStatsView('current')}
                    className={`px-2 py-1 rounded text-xs ${
                      characterStatsView === 'current'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    📊
                  </button>
                  <button
                    onClick={() => setCharacterStatsView('knowledge')}
                    className={`px-2 py-1 rounded text-xs ${
                      characterStatsView === 'knowledge'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🔍
                  </button>
                  <button
                    onClick={() => setShowEditJson(v => !v)}
                    className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                    title="Редактировать JSON персонажа"
                  >
                    🧾 JSON
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-300">
                Подробная таблица характеристик вынесена ниже на странице.
                <a href="#big-stats" className="ml-2 text-cyan-400 hover:text-cyan-300 underline">Перейти к таблице</a>
              </div>

              {showEditJson && (
                <div className="mt-4">
                  <h3 className="text-sm text-gray-300 mb-2">Редактирование персонажа (JSON)</h3>
                  <textarea
                    className="w-full h-48 bg-black text-green-300 font-mono text-xs rounded p-3 border border-gray-700"
                    value={editJson}
                    onChange={(e) => setEditJson(e.target.value)}
                    title="Редактирование JSON персонажа"
                    placeholder="Вставьте JSON персонажа"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                      onClick={async () => {
                        try {
                          const parsed = JSON.parse(editJson)
                          if (!parsed?.id) throw new Error('Отсутствует id у персонажа')
                          // Обновляем локальную конфигурацию
                          const newChars = (config?.characters || []).map((c: any) => c.id === parsed.id ? parsed : c)
                          const newConfig = { ...config, characters: newChars }
                          setConfig(newConfig)
                          setEditedCharacter(parsed)
                          // Сохраняем в файл
                          const res = await fetch('/api/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ target: 'characters', data: { characters: newChars } })
                          })
                          const j = await res.json()
                          if (!j.success) throw new Error(j.error || 'Не удалось сохранить')
                          addLog(`💾 Персонаж ${parsed.name} сохранён`)
                        } catch (e: any) {
                          addLog(`❌ Ошибка сохранения: ${e?.message || e}`)
                        }
                      }}
                    >
                      💾 Сохранить
                    </button>
                    <button
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                      onClick={() => {
                        setEditJson(JSON.stringify(selectedCharacterData, null, 2))
                        setEditedCharacter(JSON.parse(JSON.stringify(selectedCharacterData)))
                        addLog('⟲ Сброс правок персонажа')
                      }}
                    >
                      ⟲ Сбросить
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Инструменты */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-400">🔧 Инструмент</h2>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white mb-3"
              title="Выбор инструмента"
              aria-label="Выбор инструмента"
            >
              <option value="">Выберите инструмент</option>
              {Object.entries(tools).map(([id, tool]: [string, any]) => (
                <option key={id} value={id}>
                  {tool.icon} {tool.name}
                </option>
              ))}
            </select>
            {selectedTool && (
              <div className="space-y-2">
                <label className="block text-sm">Интенсивность: {toolIntensity}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={toolIntensity}
                  onChange={(e) => setToolIntensity(Number(e.target.value))}
                  className="w-full"
                  title="Интенсивность инструмента"
                  aria-label="Интенсивность инструмента"
                />
                {tools[selectedTool]?.modes && (
                  <p className="text-xs text-gray-400">
                    Режимы: {tools[selectedTool].modes.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Действия */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-400">⚡ Действие</h2>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white mb-3"
              title="Выбор действия"
              aria-label="Выбор действия"
            >
              <option value="">Выберите действие</option>
              {Object.entries(actions).map(([id, action]: [string, any]) => (
                <option key={id} value={id}>
                  {action.icon} {action.name}
                </option>
              ))}
            </select>
            {selectedAction && (
              <div className="space-y-2">
                <label className="block text-sm">Интенсивность: {actionIntensity}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={actionIntensity}
                  onChange={(e) => setActionIntensity(Number(e.target.value))}
                  className="w-full"
                  title="Интенсивность действия"
                  aria-label="Интенсивность действия"
                />
                {actions[selectedAction]?.modes && (
                  <p className="text-xs text-gray-400">
                    Режимы: {actions[selectedAction].modes.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Основная область тестирования */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Зоны взаимодействия */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-cyan-400">🎯 Зоны взаимодействия</h2>
            <div className="relative bg-gray-700 rounded-lg overflow-hidden" style={{ height: '400px' }}>
              {/* Силуэт персонажа */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-500 text-6xl">👤</div>
              </div>

              {/* Интерактивные зоны */}
              {interactiveAreas.map((area) => (
                <button
                  key={area.id}
                  className={`absolute border-2 rounded transition-all hover:scale-105 ${
                    activeZones[area.id]
                      ? 'border-green-400 bg-green-400/20 animate-pulse shadow-lg shadow-green-400/50'
                      : 'border-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/30'
                  }`}
                  style={{
                    left: `${area.x}%`,
                    top: `${area.y}%`,
                    width: `${area.width}%`,
                    height: `${area.height}%`,
                  }}
                  onClick={() => handleZoneClick(area.id, 'click')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleZoneHoldStart(area.id)
                  }}
                  onMouseUp={() => handleZoneHoldEnd(area.id)}
                  onMouseLeave={() => handleZoneHoldEnd(area.id)}
                  title={`${area.name}: ${area.description}`}
                >
                  <span className="text-xs text-white font-medium">{area.name}</span>
                  {activeZones[area.id] && (
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                      <div className="bg-green-500 text-white text-xs px-2 py-1 rounded animate-bounce">
                        HOLD
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-400">
              <p><strong>Левый клик:</strong> мгновенное применение</p>
              <p><strong>Удержание:</strong> активация hold-режима</p>
            </div>
          </div>

          {/* Статистика эффектов */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-yellow-400">📊 Эффекты</h2>
              <button
                onClick={clearStats}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                Очистить
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {Object.entries(stats).map(([stat, value]) => (
                <div key={stat} className="flex justify-between items-center bg-gray-700 rounded px-3 py-2">
                  <span className="font-medium">{stat.replace('_', ' ')}</span>
                  <span className={`font-bold ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {value > 0 ? '+' : ''}{value.toFixed(2)}
                  </span>
                </div>
              ))}
              {Object.keys(stats).length === 0 && (
                <p className="text-gray-500 text-center py-8">Эффекты появятся здесь</p>
              )}
            </div>
          </div>

          {/* LLM Сообщения */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-purple-400">🤖 LLM Сообщения</h2>
              <button
                onClick={() => setLlmMessages([])}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                Очистить
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-gray-300">Базовый промпт</label>
                <textarea
                  className="w-full h-24 bg-black text-green-300 font-mono text-xs rounded p-3 border border-gray-700"
                  value={llmBasePrompt}
                  onChange={(e) => setLlmBasePrompt(e.target.value)}
                  title="Базовый промпт LLM"
                  placeholder="Опишите базовую личность/персону для диалога"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                    onClick={async () => {
                      try {
                        const newConfig = { ...config, characterAI: { ...config.characterAI, llmPrompts: { ...config.characterAI.llmPrompts, basePrompt: llmBasePrompt } } }
                        setConfig(newConfig)
                        // На данный момент сохраняем в game-config-unified.json в секцию characterAI, если она там есть
                        const res = await fetch('/api/config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ target: 'game', data: { ...config } })
                        })
                        const j = await res.json()
                        if (!j.success) throw new Error(j.error || 'Не удалось сохранить')
                        addLog('💾 Базовый промпт сохранён')
                      } catch (e: any) {
                        addLog(`❌ Ошибка сохранения промпта: ${e?.message || e}`)
                      }
                    }}
                  >
                    💾 Сохранить промпт
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-300">Итоговый промпт (предпросмотр)</label>
                <div className="bg-black text-gray-200 font-mono text-xs rounded p-3 border border-gray-700 min-h-[80px]">
                  {buildFinalPrompt()}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-300">Автосообщения</label>
                <div className="bg-black rounded p-4 max-h-40 overflow-y-auto font-mono text-sm">
                  {llmMessages.length === 0 ? (
                    <p className="text-gray-500">LLM сообщения появятся здесь...</p>
                  ) : (
                    llmMessages.map((message, index) => (
                      <div key={index} className="mb-2 text-purple-400 border-l-2 border-purple-400 pl-2">
                        {message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Второй чат с персонажем */}
        {selectedCharacterData && (
          <div className="bg-gray-800 rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">💬 Чат-2 с {selectedCharacterData.name}</h2>
            <div className="bg-black rounded p-3 max-h-64 overflow-y-auto font-mono text-sm mb-2 border border-gray-700">
              {chat2Messages.length === 0 ? (
                <p className="text-gray-500">Начните диалог в рамках текущего финального промпта...</p>
              ) : (
                chat2Messages.map((m, idx) => (
                  <div key={idx} className={`mb-1 ${m.role === 'user' ? 'text-cyan-300' : 'text-gray-200'}`}>
                    {m.role === 'user' ? 'Вы: ' : `${selectedCharacterData.name}: `}{m.content}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={chat2Input}
                onChange={(e) => setChat2Input(e.target.value)}
                placeholder="Сообщение..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
              />
              <button
                onClick={sendChat2}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-white"
              >
                Отправить
              </button>
            </div>
          </div>
        )}

        {/* Логи */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-blue-400">📋 Логи событий</h2>
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Очистить
            </button>
          </div>
          <div className="bg-black rounded p-4 max-h-60 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">Логи событий появятся здесь...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1 text-green-400">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Информация о конфигурации */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-300">ℹ️ Состояние системы</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Персонажи:</span>
              <span className="ml-2 text-white">{characters.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Инструменты:</span>
              <span className="ml-2 text-white">{Object.keys(config?.characterAI?.tools || {}).length}</span>
            </div>
            <div>
              <span className="text-gray-400">Действия:</span>
              <span className="ml-2 text-white">{Object.keys(config?.characterAI?.actions || {}).length}</span>
            </div>
            <div>
              <span className="text-gray-400">Активных зон:</span>
              <span className="ml-2 text-white">{Object.values(activeZones).filter(Boolean).length}</span>
            </div>
            <div>
              <span className="text-gray-400">Таймеров:</span>
              <span className="ml-2 text-white">{Object.keys(activeTimers).length}</span>
            </div>
            <div>
              <span className="text-gray-400">Время:</span>
              <span className="ml-2 text-white">{currentTime}с</span>
            </div>
          </div>
        </div>

        {/* Большая таблица характеристик (внизу страницы) */}
        {selectedCharacterData && (
          <div id="big-stats" className="mt-8 bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold text-green-400">🧬 Характеристики — большая таблица для {selectedCharacterData.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Режим:</span>
                <button
                  className={`px-2 py-1 rounded text-xs ${charViewMode==='values'?'bg-blue-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  onClick={() => setCharViewMode('values')}
                  title="Показывать значения"
                >Значения</button>
                <button
                  className={`px-2 py-1 rounded text-xs ${charViewMode==='openness'?'bg-yellow-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  onClick={() => setCharViewMode('openness')}
                  title="Показывать открытость (уровень знания)"
                >Открытость</button>
                <a href="#" className="text-sm text-cyan-400 hover:text-cyan-300 underline ml-2">Наверх</a>
              </div>
            </div>
            {/* Таблица характеристик с режимами */}
            <div className="overflow-x-auto border border-gray-700 rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-300">Категория</th>
                    <th className="text-left px-3 py-2 text-gray-300">Параметр</th>
                    {charViewMode==='values' ? (
                      <th className="text-right px-3 py-2 text-gray-300">Значение</th>
                    ) : (
                      <th className="text-right px-3 py-2 text-gray-300">Открытость (0-1)</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(function(){
                    const src = editedCharacter || selectedCharacterData
                    const cs = src?.characteristics || {}
                    const categories: Array<{ id: string; title: string; data: any }> = [
                      { id: 'physical', title: 'Физические', data: cs.physical || {} },
                      { id: 'psychological', title: 'Психологические', data: cs.psychological || {} },
                      { id: 'social', title: 'Социальные', data: cs.social || {} },
                      { id: 'personality', title: 'Личностные', data: cs.personality || {} },
                      { id: 'special', title: 'Специальные', data: cs.special || {} },
                      { id: 'emotionalState', title: 'Эмоциональное состояние', data: cs.emotionalState || {} },
                    ]
                    return categories.flatMap(({ id, title, data }) => (
                      Object.entries(data).map(([key, value]: [string, any]) => (
                        <tr key={`${id}.${key}`} className="odd:bg-gray-900 even:bg-gray-800/60">
                          <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{title}</td>
                          <td className="px-3 py-2 text-gray-200">{key}</td>
                          <td className="px-3 py-2 text-right">
                            {charViewMode==='values' ? (
                              <input
                                type="number"
                                step="0.1"
                                value={Number(value)}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value)
                                  setEditedCharacter((prev: any) => {
                                    const next = JSON.parse(JSON.stringify(prev || selectedCharacterData))
                                    if (!next.characteristics) next.characteristics = {}
                                    if (!next.characteristics[id]) next.characteristics[id] = {}
                                    next.characteristics[id][key] = isNaN(v) ? 0 : v
                                    return next
                                  })
                                }}
                                className="w-28 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-cyan-300 text-right"
                                title={`Изменить ${title} / ${key}`}
                              />
                            ) : (
                              <div className="inline-flex items-center gap-3 justify-end">
                                <div className="w-32 h-2 bg-gray-700 rounded">
                                  <div
                                    className="h-2 bg-yellow-500 rounded"
                                    style={{ width: `${Math.round(getOpenness(selectedCharacterData.id, id, key)*100)}%` }}
                                    title={`Открытость ${Math.round(getOpenness(selectedCharacterData.id, id, key)*100)}%`}
                                  />
                                </div>
                                <span className="text-gray-300 w-14 inline-block text-right" title="Видимое значение">
                                  {maskValueByOpenness(value, getOpenness(selectedCharacterData.id, id, key))}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ))
                  })()}
                </tbody>
              </table>
            </div>

            {/* Секции: Состояния и Фетиши */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Состояния */}
              <div className="bg-gray-900 rounded p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-yellow-400 mb-3">📉 Состояния</h3>
                {(editedCharacter?.statusEffects || editedCharacter?.states) ? (
                  <div className="space-y-2 text-sm">
                    {(function(){
                      const se = editedCharacter?.statusEffects
                      const st = editedCharacter?.states
                      let items: any[] = []
                      if (Array.isArray(se)) items = se
                      else if (Array.isArray(st)) items = st
                      else if (st && typeof st === 'object') items = Object.values(st)
                      return items.map((s: any, idx: number) => (
                        <div key={idx} className="flex justify-between bg-gray-800 rounded px-3 py-2">
                          <span className="text-gray-300">{s?.name || s?.id || `state_${idx}`}</span>
                          {typeof s?.duration !== 'undefined' && (
                            <span className="text-gray-400">{s.duration}s</span>
                          )}
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <p className="text-gray-500">Состояния отсутствуют</p>
                )}
              </div>

              {/* Фетиши */}
              <div className="bg-gray-900 rounded p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-pink-400 mb-3">💕 Фетиши</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['primary','secondary','discovered','hidden'].map((cat) => (
                    <div key={cat} className="bg-gray-800 rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="capitalize text-gray-200">{cat}</span>
                        <span className="text-xs text-gray-400">{(Array.isArray(editedCharacter?.fetishes?.[cat]) ? editedCharacter?.fetishes?.[cat] : (editedCharacter?.fetishes?.[cat] && typeof editedCharacter?.fetishes?.[cat] === 'object' ? Object.values(editedCharacter?.fetishes?.[cat]) : [])).length}</span>
                      </div>
                      <div className="text-xs text-gray-300 space-y-1 max-h-28 overflow-y-auto">
                        {(Array.isArray(editedCharacter?.fetishes?.[cat]) ? editedCharacter?.fetishes?.[cat] : (editedCharacter?.fetishes?.[cat] && typeof editedCharacter?.fetishes?.[cat] === 'object' ? Object.values(editedCharacter?.fetishes?.[cat]) : [])).map((f: any, i: number) => (
                          <div key={`${cat}_${i}`} className="bg-gray-700/60 rounded px-2 py-1">{String(f)}</div>
                        ))}
                        {!((Array.isArray(editedCharacter?.fetishes?.[cat]) ? editedCharacter?.fetishes?.[cat] : (editedCharacter?.fetishes?.[cat] && typeof editedCharacter?.fetishes?.[cat] === 'object' ? Object.values(editedCharacter?.fetishes?.[cat]) : [])) as any[]).length && (
                          <div className="text-gray-500">Пусто</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
