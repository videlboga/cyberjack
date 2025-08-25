"use client"

import React, { useState, useEffect } from 'react'
import { Input } from './input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Checkbox } from './checkbox'
import { AttributeParser, ConditionValidator } from '@/lib/condition-utils'

interface ValueInputProps {
  attributeType: "numeric" | "string" | "boolean" | "array"
  operator: string
  value: any
  onChange: (value: any) => void
  className?: string
  placeholder?: string
}

export function ValueInput({
  attributeType,
  operator,
  value,
  onChange,
  className,
  placeholder
}: ValueInputProps) {
  const [inputValue, setInputValue] = useState<string>("")
  const [arrayValues, setArrayValues] = useState<string[]>([])

  useEffect(() => {
    // Инициализация значения
    if (attributeType === "array" && Array.isArray(value)) {
      setArrayValues(value)
    } else if (attributeType === "boolean") {
      // Булевые значения обрабатываются отдельно
    } else {
      setInputValue(String(value || ""))
    }
  }, [value, attributeType])

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue)
    
    if (attributeType === "numeric") {
      const numValue = parseFloat(newValue)
      onChange(isNaN(numValue) ? 0 : numValue)
    } else if (attributeType === "string") {
      onChange(newValue)
    }
  }

  const handleBooleanChange = (checked: boolean) => {
    onChange(checked)
  }

  const handleArrayItemAdd = () => {
    if (inputValue.trim()) {
      const newArray = [...arrayValues, inputValue.trim()]
      setArrayValues(newArray)
      setInputValue("")
      onChange(newArray)
    }
  }

  const handleArrayItemRemove = (index: number) => {
    const newArray = arrayValues.filter((_, i) => i !== index)
    setArrayValues(newArray)
    onChange(newArray)
  }

  const handleArrayItemChange = (index: number, newValue: string) => {
    const newArray = [...arrayValues]
    newArray[index] = newValue
    setArrayValues(newArray)
    onChange(newArray)
  }

  // Для операторов "in" и "not_in" показываем интерфейс массива
  const isArrayOperator = ["in", "not_in"].includes(operator)

  if (attributeType === "boolean") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={handleBooleanChange}
        />
        <span className="text-sm text-muted-foreground">
          {value ? "Да" : "Нет"}
        </span>
      </div>
    )
  }

  if (attributeType === "array" || isArrayOperator) {
    return (
      <div className={`space-y-2 ${className}`}>
        {/* Существующие элементы массива */}
        {arrayValues.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <Input
              value={item}
              onChange={(e) => handleArrayItemChange(index, e.target.value)}
              placeholder="Значение элемента"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => handleArrayItemRemove(index)}
              className="px-2 py-1 text-sm text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        ))}
        
        {/* Добавление нового элемента */}
        <div className="flex items-center space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Добавить значение"
            className="flex-1"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleArrayItemAdd()
              }
            }}
          />
          <button
            type="button"
            onClick={handleArrayItemAdd}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            +
          </button>
        </div>
      </div>
    )
  }

  // Обычный ввод для строк и чисел
  return (
    <Input
      type={attributeType === "numeric" ? "number" : "text"}
      value={inputValue}
      onChange={(e) => handleInputChange(e.target.value)}
      placeholder={placeholder || `Введите ${attributeType === "numeric" ? "число" : "значение"}`}
      className={className}
    />
  )
}

