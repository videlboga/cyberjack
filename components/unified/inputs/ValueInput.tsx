"use client"

import React, { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { 
  Plus, 
  Trash2, 
  Minus,
  Hash,
  Type,
  List,
  ToggleLeft
} from 'lucide-react'
import { ValueInputProps, SelectorOption } from '../types'

export function ValueInput({
  attributeType,
  operator,
  value,
  onChange,
  options = [],
  allowCustom = true,
  onOptionsChange,
  className,
  disabled = false,
  placeholder,
  ...props
}: ValueInputProps) {
  const [customValue, setCustomValue] = useState('')

  // Определяем, нужен ли специальный ввод для оператора
  const needsSpecialInput = useMemo(() => {
    const specialOperators = ['between', 'not_between', 'length_between', 'in', 'not_in', 'contains_all', 'contains_any']
    return specialOperators.includes(operator)
  }, [operator])

  // Обработка изменения значения
  const handleValueChange = (newValue: any) => {
    onChange(newValue)
  }

  // Обработка изменения диапазона
  const handleRangeChange = (index: number, rangeValue: string) => {
    const currentRange = Array.isArray(value) ? value : ['', '']
    const newRange = [...currentRange]
    newRange[index] = rangeValue
    handleValueChange(newRange)
  }

  // Обработка изменения массива значений
  const handleArrayChange = (index: number, arrayValue: string) => {
    const currentArray = Array.isArray(value) ? value : []
    const newArray = [...currentArray]
    newArray[index] = arrayValue
    handleValueChange(newArray)
  }

  // Добавление элемента в массив
  const handleAddArrayItem = () => {
    const currentArray = Array.isArray(value) ? value : []
    handleValueChange([...currentArray, customValue])
    setCustomValue('')
  }

  // Удаление элемента из массива
  const handleRemoveArrayItem = (index: number) => {
    const currentArray = Array.isArray(value) ? value : []
    const newArray = currentArray.filter((_, i) => i !== index)
    handleValueChange(newArray)
  }

  // Рендер ввода для числовых значений
  const renderNumericInput = () => {
    if (needsSpecialInput) {
      if (operator === 'between' || operator === 'not_between') {
        const range = Array.isArray(value) ? value : ['', '']
        return (
          <div className="space-y-2">
            <Label>Диапазон значений</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={range[0] || ''}
                onChange={(e) => handleRangeChange(0, e.target.value)}
                placeholder="От"
                disabled={disabled}
                className="flex-1"
              />
              <span className="text-gray-500">—</span>
              <Input
                type="number"
                value={range[1] || ''}
                onChange={(e) => handleRangeChange(1, e.target.value)}
                placeholder="До"
                disabled={disabled}
                className="flex-1"
              />
            </div>
          </div>
        )
      }
    }

    return (
      <Input
        type="number"
        value={value || ''}
        onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
        placeholder={placeholder || "Введите число..."}
        disabled={disabled}
        {...props}
      />
    )
  }

  // Рендер ввода для строковых значений
  const renderStringInput = () => {
    if (needsSpecialInput) {
      if (operator === 'in' || operator === 'not_in' || operator === 'contains_all' || operator === 'contains_any') {
        const array = Array.isArray(value) ? value : []
        return (
          <div className="space-y-2">
            <Label>Список значений</Label>
            <div className="space-y-2">
              {array.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={item}
                    onChange={(e) => handleArrayChange(index, e.target.value)}
                    placeholder={`Значение ${index + 1}`}
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveArrayItem(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <Input
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Новое значение"
                  disabled={disabled}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddArrayItem}
                  disabled={disabled || !customValue}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      }
    }

    return (
      <Input
        value={value || ''}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder={placeholder || "Введите текст..."}
        disabled={disabled}
        {...props}
      />
    )
  }

  // Рендер ввода для булевых значений
  const renderBooleanInput = () => {
    if (operator === 'true' || operator === 'false') {
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={operator === 'true'}
            onCheckedChange={(checked) => handleValueChange(checked)}
            disabled={disabled}
          />
          <Label>Истина</Label>
        </div>
      )
    }

    return (
      <Select
        value={value?.toString() || ''}
        onValueChange={(val) => handleValueChange(val === 'true')}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Выберите значение" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Истина</SelectItem>
          <SelectItem value="false">Ложь</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  // Рендер ввода для массивов
  const renderArrayInput = () => {
    if (operator === 'length' || operator === 'length_gt' || operator === 'length_lt') {
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => handleValueChange(parseInt(e.target.value) || 0)}
          placeholder="Количество элементов"
          disabled={disabled}
          min={0}
          {...props}
        />
      )
    }

    if (operator === 'length_between') {
      const range = Array.isArray(value) ? value : ['', '']
      return (
        <div className="space-y-2">
          <Label>Диапазон длины массива</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={range[0] || ''}
              onChange={(e) => handleRangeChange(0, e.target.value)}
              placeholder="От"
              disabled={disabled}
              className="flex-1"
              min={0}
            />
            <span className="text-gray-500">—</span>
            <Input
              type="number"
              value={range[1] || ''}
              onChange={(e) => handleRangeChange(1, e.target.value)}
              placeholder="До"
              disabled={disabled}
              className="flex-1"
              min={0}
            />
          </div>
        </div>
      )
    }

    // Для операторов contains, not_contains
    const array = Array.isArray(value) ? value : []
    return (
      <div className="space-y-2">
        <Label>Элементы массива</Label>
        <div className="space-y-2">
          {array.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                value={item}
                onChange={(e) => handleArrayChange(index, e.target.value)}
                placeholder={`Элемент ${index + 1}`}
                disabled={disabled}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveArrayItem(index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <Input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Новый элемент"
              disabled={disabled}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddArrayItem}
              disabled={disabled || !customValue}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Выбор типа ввода на основе типа атрибута
  const renderInput = () => {
    switch (attributeType) {
      case 'numeric':
        return renderNumericInput()
      case 'boolean':
        return renderBooleanInput()
      case 'array':
        return renderArrayInput()
      case 'string':
      default:
        return renderStringInput()
    }
  }

  // Иконка для типа атрибута
  const getTypeIcon = () => {
    switch (attributeType) {
      case 'numeric':
        return <Hash className="h-4 w-4" />
      case 'boolean':
        return <ToggleLeft className="h-4 w-4" />
      case 'array':
        return <List className="h-4 w-4" />
      case 'string':
      default:
        return <Type className="h-4 w-4" />
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2">
        {getTypeIcon()}
        <Label className="text-sm font-medium">
          {attributeType === 'numeric' && 'Числовое значение'}
          {attributeType === 'string' && 'Текстовое значение'}
          {attributeType === 'boolean' && 'Логическое значение'}
          {attributeType === 'array' && 'Массив значений'}
        </Label>
      </div>
      
      {renderInput()}
      
      {/* Отображение текущего значения */}
      {value && (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">Текущее значение:</span>
          <Badge variant="outline" className="text-xs">
            {Array.isArray(value) ? value.join(', ') : value.toString()}
          </Badge>
        </div>
      )}
    </div>
  )
}

export default ValueInput
