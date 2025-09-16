"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export interface FilterConfig {
  search?: {
    placeholder: string
    fields: string[]
  }
  selects?: {
    [key: string]: {
      label: string
      options: { value: string; label: string }[]
      multiple?: boolean
    }
  }
  ranges?: {
    [key: string]: {
      label: string
      min: number
      max: number
      step?: number
    }
  }
  sort?: {
    options: { value: string; label: string }[]
    defaultSort?: string
  }
}

export interface FilterState {
  search: string
  selects: Record<string, string[]>
  ranges: Record<string, { min: number; max: number }>
  sort: string
}

interface FilterPanelProps {
  config: FilterConfig
  state: FilterState
  onStateChange: (state: FilterState) => void
  onReset: () => void
  className?: string
}

export function FilterPanel({ config, state, onStateChange, onReset, className = '' }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const updateState = (updates: Partial<FilterState>) => {
    onStateChange({ ...state, ...updates })
  }

  const updateSearch = (search: string) => {
    updateState({ search })
  }

  const updateSelect = (key: string, value: string, multiple: boolean = false) => {
    if (multiple) {
      const currentValues = state.selects[key] || []
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value]
      updateState({ selects: { ...state.selects, [key]: newValues } })
    } else {
      // Если выбрано "all", очищаем фильтр
      const filterValue = value === 'all' ? [] : [value]
      updateState({ selects: { ...state.selects, [key]: filterValue } })
    }
  }

  const updateRange = (key: string, field: 'min' | 'max', value: number) => {
    const currentRange = state.ranges[key] || { min: 0, max: 100 }
    updateState({
      ranges: {
        ...state.ranges,
        [key]: { ...currentRange, [field]: value }
      }
    })
  }

  const updateSort = (sort: string) => {
    updateState({ sort })
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (state.search) count++
    Object.values(state.selects).forEach(values => {
      if (values.length > 0) count += values.length
    })
    Object.values(state.ranges).forEach(range => {
      if (range.min > 0 || range.max < 100) count++
    })
    if (state.sort && state.sort !== config.sort?.defaultSort) count++
    return count
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Фильтры и поиск</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary">{activeFiltersCount}</Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
          >
            Сбросить
          </Button>
        )}
      </div>

      {/* Поиск */}
      {config.search && (
        <div className="mb-4">
          <Input
            placeholder={config.search.placeholder}
            value={state.search}
            onChange={(e) => updateSearch(e.target.value)}
            className="w-full"
          />
        </div>
      )}

      <div className="space-y-4">
          {/* Селекты */}
          {config.selects && Object.entries(config.selects).map(([key, selectConfig]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-2">
                {selectConfig.label}
              </label>
              {selectConfig.multiple ? (
                <div className="flex flex-wrap gap-2">
                  {selectConfig.options.map(option => {
                    const isSelected = (state.selects[key] || []).includes(option.value)
                    return (
                      <Button
                        key={option.value}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateSelect(key, option.value, true)}
                      >
                        {option.label}
                      </Button>
                    )
                  })}
                </div>
              ) : (
                <Select
                  value={(state.selects[key] && state.selects[key][0]) || 'all'}
                  onValueChange={(value) => updateSelect(key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Выберите ${selectConfig.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {selectConfig.options.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}

          {/* Диапазоны */}
          {config.ranges && Object.entries(config.ranges).map(([key, rangeConfig]) => {
            const range = state.ranges[key] || { min: rangeConfig.min, max: rangeConfig.max }
            return (
              <div key={key}>
                <label className="block text-sm font-medium mb-2">
                  {rangeConfig.label}: {range.min} - {range.max}
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">От</label>
                    <Input
                      type="number"
                      min={rangeConfig.min}
                      max={rangeConfig.max}
                      step={rangeConfig.step || 1}
                      value={range.min}
                      onChange={(e) => updateRange(key, 'min', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">До</label>
                    <Input
                      type="number"
                      min={rangeConfig.min}
                      max={rangeConfig.max}
                      step={rangeConfig.step || 1}
                      value={range.max}
                      onChange={(e) => updateRange(key, 'max', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Сортировка */}
          {config.sort && (
            <div>
              <label className="block text-sm font-medium mb-2">Сортировка</label>
              <Select
                value={state.sort}
                onValueChange={updateSort}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сортировку" />
                </SelectTrigger>
                <SelectContent>
                  {config.sort.options.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
      </div>
    </div>
  )
}

export function useFilters<T>(
  items: T[],
  state: FilterState,
  config: FilterConfig,
  getItemValue: (item: T, field: string) => any
) {
  let filteredItems = [...items]

  // Поиск
  if (state.search && config.search) {
    const searchLower = state.search.toLowerCase()
    filteredItems = filteredItems.filter(item =>
      config.search!.fields.some(field => {
        const value = getItemValue(item, field)
        return value && value.toString().toLowerCase().includes(searchLower)
      })
    )
  }

  // Селекты
  if (config.selects) {
    Object.entries(config.selects).forEach(([key, selectConfig]) => {
      const selectedValues = state.selects[key]
      if (selectedValues && selectedValues.length > 0) {
        filteredItems = filteredItems.filter(item => {
          const itemValue = getItemValue(item, key)
          return selectedValues.includes(itemValue)
        })
      }
    })
  }

  // Диапазоны
  if (config.ranges) {
    Object.entries(config.ranges).forEach(([key, rangeConfig]) => {
      const range = state.ranges[key]
      if (range) {
        filteredItems = filteredItems.filter(item => {
          const itemValue = getItemValue(item, key)
          return itemValue >= range.min && itemValue <= range.max
        })
      }
    })
  }

  // Сортировка
  if (state.sort && config.sort) {
    const [field, direction] = state.sort.split(':')
    filteredItems.sort((a, b) => {
      const aValue = getItemValue(a, field)
      const bValue = getItemValue(b, field)

      if (aValue < bValue) return direction === 'desc' ? 1 : -1
      if (aValue > bValue) return direction === 'desc' ? -1 : 1
      return 0
    })
  }

  return filteredItems
}
