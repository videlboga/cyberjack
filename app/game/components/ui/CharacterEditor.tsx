import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Save, RotateCcw, ChevronDown, ChevronRight, Info } from "lucide-react"
import systemConfig from '@/data/system-unified.json'

interface CharacterEditorProps {
  character: any
  onUpdateCharacter: (character: any) => void
  showSaveButton?: boolean
}

export const CharacterEditor = ({ character, onUpdateCharacter, showSaveButton = false }: CharacterEditorProps) => {
  const [editedCharacter, setEditedCharacter] = useState(character)
  const [hasChanges, setHasChanges] = useState(false)
  const [openCategory, setOpenCategory] = useState<string>('physical')
  const [showOnlyNonZero, setShowOnlyNonZero] = useState<boolean>(false)

  // Синхронизация с изменениями персонажа
  useEffect(() => {
    console.log('🔄 CharacterEditor получил обновленные данные:', character)
    console.log('🔄 Атрибуты:', character?.attributes)
    setEditedCharacter(character)
    setHasChanges(false)
  }, [character])

  // Обновление характеристики по id (attributes/attributes_extra из system)
  const updateAttribute = (attrId: string, value: number) => {
    const updated = {
      ...editedCharacter,
      attributes: {
        ...(editedCharacter.attributes || {}),
        [attrId]: value
      }
    }
    setEditedCharacter(updated)
    
    // Немедленно прокидываем изменения в родителя (модалку)
    if (onUpdateCharacter) {
      console.log('🔄 Обновляем атрибут:', attrId, '=', value)
      onUpdateCharacter(updated)
    }
    setHasChanges(true)
  }

  // Обновление состояния (states из system) — поддерживаем и states, и condition
  const updateState = (stateId: string, value: number) => {
    const updated = {
      ...editedCharacter,
      states: {
        ...(editedCharacter.states || {}),
        [stateId]: value
      },
      condition: {
        ...(editedCharacter.condition || {}),
        [stateId]: value
      }
    }
    setEditedCharacter(updated)
    
    // Немедленно прокидываем изменения в родителя (модалку)
    if (onUpdateCharacter) {
      console.log('🔄 Обновляем состояние:', stateId, '=', value)
      onUpdateCharacter(updated)
    }
    setHasChanges(true)
  }

  // Обновление фетиша (fetishes из system)
  const updateFetish = (fetishId: string, value: number) => {
    const updated = {
      ...editedCharacter,
      fetishes: {
        ...editedCharacter.fetishes,
        [fetishId]: value
      }
    }
    setEditedCharacter(updated)
    
    // Немедленно прокидываем изменения в родителя (модалку)
    if (onUpdateCharacter) {
      console.log('🔄 Обновляем фетиш:', fetishId, '=', value)
      onUpdateCharacter(updated)
    }
    setHasChanges(true)
  }

  // Сохранение изменений
  const handleSave = () => {
    if (onUpdateCharacter) {
      onUpdateCharacter(editedCharacter)
      setHasChanges(false)
    }
  }

  // Сброс изменений
  const handleReset = () => {
    setEditedCharacter(JSON.parse(JSON.stringify(character))) // Глубокая копия
    setHasChanges(false)
  }

  const toggleCategory = (category: string) => {
    setOpenCategory(openCategory === category ? '' : category)
  }

  const getStatDisplayName = (id: string): string => id

  // --- Анатомия: чекбоксы со списком из конфига + добавление своих ---
  const anatomyList: any[] = (systemConfig as any)?.anatomy || []
  const currentAnatomy: string[] = Array.isArray(editedCharacter.anatomy) ? editedCharacter.anatomy : []
  const [newAnatomyItem, setNewAnatomyItem] = useState<string>('')

  const toggleAnatomy = (item: string) => {
    const isSelected = currentAnatomy.includes(item)
    const next = isSelected ? currentAnatomy.filter((i) => i !== item) : [...currentAnatomy, item]

    // Автодобавление чувствительности при выборе анатомии
    let nextAttributes = { ...(editedCharacter.attributes || {}) }
    if (!isSelected) {
      // Маппинг anatomyId -> sensitivity_* по attributes_extra
      const aliases: Record<string, string> = { vulva: 'clitoris' }
      const key = aliases[item] || item
      const extra: any[] = ((systemConfig as any)?.attributes_extra) || []
      const sens = extra.find(a => typeof a.id === 'string' && a.id === `sensitivity_${key}`)
      if (sens) {
        if (typeof nextAttributes[sens.id] !== 'number' || isNaN(nextAttributes[sens.id])) {
          nextAttributes[sens.id] = 5 // базовое значение по умолчанию
        }
      }
    }

    const updated = { ...editedCharacter, anatomy: next, attributes: nextAttributes }
    setEditedCharacter(updated)
    if (onUpdateCharacter) onUpdateCharacter(updated)
    setHasChanges(true)
  }

  const addCustomAnatomy = () => {
    const val = newAnatomyItem.trim()
    if (!val) return
    if (!currentAnatomy.includes(val)) {
      // Добавляем и пробуем автосвязать чувствительность
      const aliases: Record<string, string> = { vulva: 'clitoris' }
      const key = aliases[val] || val
      const extra: any[] = ((systemConfig as any)?.attributes_extra) || []
      const sens = extra.find(a => typeof a.id === 'string' && a.id === `sensitivity_${key}`)

      const nextAnatomy = [...currentAnatomy, val]
      const nextAttributes = { ...(editedCharacter.attributes || {}) }
      if (sens && (typeof nextAttributes[sens.id] !== 'number' || isNaN(nextAttributes[sens.id]))) nextAttributes[sens.id] = 5

      const updated = { ...editedCharacter, anatomy: nextAnatomy, attributes: nextAttributes }
      setEditedCharacter(updated)
      if (onUpdateCharacter) onUpdateCharacter(updated)
      setHasChanges(true)
    }
    setNewAnatomyItem('')
  }

  const getStatDescription = (id: string): string => {
    const all = [
      ...(((systemConfig as any)?.attributes) || []),
      ...(((systemConfig as any)?.attributes_extra) || []),
      ...(((systemConfig as any)?.states) || [])
    ]
    const found = all.find((x: any) => x.id === id)
    return found?.description || 'Описание недоступно'
  }

  // Построение секций на основе system-конфига (динамически)
  const sysAttrs: any[] = (systemConfig as any)?.attributes || []
  const sysAttrsExtra: any[] = (systemConfig as any)?.attributes_extra || []
  const sysStates: any[] = (systemConfig as any)?.states || []
  const sysFetishes: any[] = (systemConfig as any)?.fetishes || []
  const selectedAnatomy = new Set<string>(Array.isArray(editedCharacter.anatomy) ? editedCharacter.anatomy : [])

  const attrByCategory: Record<string, any[]> = {}
  for (const a of [...sysAttrs, ...sysAttrsExtra]) {
    const cat = a.category || 'other'
    if (!attrByCategory[cat]) attrByCategory[cat] = []
    // Фильтруем чувствительности по выбранной анатомии
    if (cat === 'body_sensitivity') {
      const aliases: Record<string, string> = { vulva: 'clitoris' }
      const id: string = a.id || ''
      const key = id.startsWith('sensitivity_') ? id.substring('sensitivity_'.length) : ''
      const matchKey = Object.values(aliases).includes(key)
        ? Object.keys(aliases).find(k => aliases[k] === key) || key
        : key
      if (matchKey && selectedAnatomy.has(matchKey)) {
        attrByCategory[cat].push(a)
      }
    } else {
      attrByCategory[cat].push(a)
    }
  }

  // Формируем секции: все категории атрибутов + states + fetishes
  type Section = { key: string; name: string; icon: string; isState: boolean; isFetish?: boolean; items: any[] }
  const sections: Section[] = [
    ...Object.entries(attrByCategory).map(([cat, items]) => ({
      key: `attr_${cat}`,
      name: cat,
      icon: '🔧',
      isState: false,
      items
    })),
    { key: 'states', name: 'Состояния', icon: '📊', isState: true, items: sysStates },
    { key: 'fetishes', name: 'Фетиши', icon: '💋', isState: false, isFetish: true, items: sysFetishes }
  ]

  // Массовое автозаполнение чувствительности по выбранной анатомии
  const bulkFillSensitivityFromAnatomy = () => {
    const anatomy: string[] = Array.isArray(editedCharacter.anatomy) ? editedCharacter.anatomy : []
    if (anatomy.length === 0) return
    const aliases: Record<string, string> = { vulva: 'clitoris' }
    const extra: any[] = ((systemConfig as any)?.attributes_extra) || []
    const nextAttributes = { ...(editedCharacter.attributes || {}) }
    for (const part of anatomy) {
      const key = aliases[part] || part
      const sens = extra.find(a => typeof a.id === 'string' && a.id === `sensitivity_${key}`)
      if (sens && (typeof nextAttributes[sens.id] !== 'number' || isNaN(nextAttributes[sens.id]) || nextAttributes[sens.id] === 0)) {
        nextAttributes[sens.id] = 5
      }
    }
    const updated = { ...editedCharacter, attributes: nextAttributes }
    setEditedCharacter(updated)
    if (onUpdateCharacter) onUpdateCharacter(updated)
    setHasChanges(true)
  }

  return (
    <div className="space-y-4">
      {/* Анатомия */}
      <Card className="border border-gray-600">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧬</span>
              <span className="font-medium">Анатомия</span>
              <Badge variant="outline" className="text-xs">{currentAnatomy.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={bulkFillSensitivityFromAnatomy}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-700/40"
                title="Заполнить чувствительность для отмеченной анатомии"
              >
                Автозаполнение чувствительности
              </button>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={showOnlyNonZero} onChange={(e) => setShowOnlyNonZero(e.target.checked)} />
                Только ненулевые
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {anatomyList.map((item) => {
              const id = typeof item === 'string' ? item : item.id
              const label = typeof item === 'string' ? item : (item.name || item.id)
              const selected = currentAnatomy.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleAnatomy(id)}
                  className={`px-2 py-1 rounded border text-xs ${selected ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-transparent border-gray-600 text-gray-200 hover:bg-gray-700/40'}`}
                  title={label}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              className="flex-1 border-input rounded-md bg-transparent px-2 py-1 text-sm"
              placeholder="Добавить свою часть тела..."
              value={newAnatomyItem}
              onChange={(e) => setNewAnatomyItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustomAnatomy() }}
            />
            <Button size="sm" variant="outline" onClick={addCustomAnatomy}>Добавить</Button>
          </div>
        </CardContent>
      </Card>

      {/* Кнопки управления */}
      {showSaveButton && hasChanges && (
        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm" className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Сохранить изменения
          </Button>
          <Button onClick={handleReset} size="sm" variant="outline" className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Сбросить
          </Button>
        </div>
      )}

      {/* Категории из system-конфига */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {sections.map((section) => {
          const isOpen = openCategory === section.key
          const count = section.items.length
          if (count === 0) return null
          return (
            <Card key={section.key} className="border border-gray-600">
              <CardHeader className="pb-3">
                <button
                  onClick={() => toggleCategory(section.key)}
                  className="w-full flex items-center justify-between hover:bg-gray-700/30 rounded p-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{section.icon}</span>
                    <span className="font-medium">{section.name}</span>
                    <Badge variant="outline" className="text-xs">{count}</Badge>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </CardHeader>
              {isOpen && (
                <CardContent className="space-y-3">
                  {section.items.map((item: any) => {
                    const id = item.id as string
                    const name = item.name || id
                    const maxValue = section.isState ? (item.maxValue ?? 100) : (item.maxValue ?? 10)
                    const currentValue = section.isState
                      ? (editedCharacter.states?.[id] ?? editedCharacter.condition?.[id] ?? 0)
                      : section.isFetish
                        ? (editedCharacter.fetishes?.[id] ?? 0)
                        : (editedCharacter.attributes?.[id] ?? 0)
                    const numValue = typeof currentValue === 'number' ? currentValue : 0
                    if (showOnlyNonZero && numValue === 0) return null
                    return (
                      <div key={id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{name}</span>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-500 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 max-w-xs">
                                {getStatDescription(id)}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">{numValue}/{maxValue}</Badge>
                        </div>
                        <Slider
                          value={[numValue]}
                          onValueChange={([val]) => {
                            if (section.isState) updateState(id, val)
                            else if (section.isFetish) updateFetish(id, val)
                            else updateAttribute(id, val)
                          }}
                          max={maxValue}
                          min={item.minValue ?? 0}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{item.minValue ?? 0}</span>
                          <span className="font-medium text-cyan-400">{numValue}</span>
                          <span>{maxValue}</span>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
