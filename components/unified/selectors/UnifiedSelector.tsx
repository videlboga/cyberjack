"use client"

import React, { useState, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, X, Check } from 'lucide-react'
import { SelectorProps, SelectorOption } from '../types'

interface UnifiedSelectorProps extends SelectorProps {
  // Дополнительные пропсы для унифицированного селектора
  showCategories?: boolean
  showIcons?: boolean
  showDescriptions?: boolean
  maxHeight?: number
  groupByCategory?: boolean
}

export function UnifiedSelector({
  value,
  onChange,
  options,
  multiple = false,
  searchable = false,
  clearable = true,
  loading = false,
  disabled = false,
  className,
  placeholder = "Выберите опцию...",
  emptyMessage = "Нет доступных опций",
  onSearch,
  showCategories = false,
  showIcons = false,
  showDescriptions = false,
  maxHeight = 300,
  groupByCategory = false,
  ...props
}: UnifiedSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Фильтрация опций по поиску
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options

    return options.filter(option => 
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.value.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchQuery])

  // Группировка опций по категориям
  const groupedOptions = useMemo(() => {
    if (!groupByCategory) return { '': filteredOptions }

    return filteredOptions.reduce((groups, option) => {
      const category = option.category || 'Без категории'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(option)
      return groups
    }, {} as Record<string, SelectorOption[]>)
  }, [filteredOptions, groupByCategory])

  // Обработка поиска
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }

  // Очистка поиска
  const handleClearSearch = () => {
    setSearchQuery('')
    onSearch?.('')
  }

  // Очистка выбора
  const handleClear = () => {
    onChange('')
  }

  // Получение отображаемого значения
  const getDisplayValue = () => {
    if (multiple) {
      const selectedOptions = Array.isArray(value) 
        ? value.map(v => options.find(opt => opt.value === v)?.label).filter(Boolean)
        : []
      return selectedOptions.length > 0 ? `${selectedOptions.length} выбрано` : placeholder
    }

    const selectedOption = options.find(opt => opt.value === value)
    return selectedOption?.label || placeholder
  }

  // Рендер опции
  const renderOption = (option: SelectorOption) => (
    <div
      key={option.value}
      className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${
        option.disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      onClick={() => !option.disabled && onChange(option.value)}
    >
      {showIcons && option.icon && (
        <div className="flex-shrink-0">
          {option.icon}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{option.label}</div>
        {showDescriptions && option.description && (
          <div className="text-xs text-gray-500 truncate">{option.description}</div>
        )}
      </div>

      {value === option.value && (
        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
      )}
    </div>
  )

  // Рендер группы опций
  const renderOptionGroup = (category: string, options: SelectorOption[]) => (
    <div key={category} className="space-y-1">
      {showCategories && category !== '' && (
        <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
          {category}
        </div>
      )}
      {options.map(renderOption)}
    </div>
  )

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Поиск */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Поиск..."
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={handleClearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Селектор */}
      <Select
        value={value?.toString() || ''}
        onValueChange={onChange}
        disabled={disabled || loading}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            <div className="flex items-center space-x-2">
              {getDisplayValue()}
              {clearable && value && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-auto"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClear()
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </SelectValue>
        </SelectTrigger>

        <SelectContent className="w-full max-w-md">
          <ScrollArea className="max-h-[300px]">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                Загрузка...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery ? 'Ничего не найдено' : emptyMessage}
              </div>
            ) : (
              <div className="space-y-1">
                {Object.entries(groupedOptions).map(([category, options]) =>
                  renderOptionGroup(category, options)
                )}
              </div>
            )}
          </ScrollArea>
        </SelectContent>
      </Select>

      {/* Выбранные значения (для множественного выбора) */}
      {multiple && Array.isArray(value) && value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => {
            const option = options.find(opt => opt.value === v)
            return option ? (
              <Badge
                key={v}
                variant="secondary"
                className="flex items-center space-x-1"
              >
                <span>{option.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-3 w-3 p-0 ml-1"
                  onClick={() => {
                    const newValue = value.filter(val => val !== v)
                    onChange(newValue)
                  }}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}

export default UnifiedSelector

