"use client"

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Operator } from '@/lib/unified-entities'
import { AttributeParser, ConditionValidator } from '@/lib/condition-utils'

interface OperatorSelectorProps {
  attributeType: "numeric" | "string" | "boolean" | "array"
  value: Operator
  onChange: (value: Operator) => void
  className?: string
}

export function OperatorSelector({
  attributeType,
  value,
  onChange,
  className
}: OperatorSelectorProps) {
  const getOperatorOptions = (): { value: Operator; label: string }[] => {
    const validOperators = ConditionValidator.getValidOperators(attributeType)
    
    const operatorLabels: Record<Operator, string> = {
      "=": "равно",
      "!=": "не равно",
      ">": "больше",
      "<": "меньше",
      ">=": "больше или равно",
      "<=": "меньше или равно",
      "contains": "содержит",
      "not_contains": "не содержит",
      "in": "входит в",
      "not_in": "не входит в"
    }

    return validOperators.map(operator => ({
      value: operator,
      label: operatorLabels[operator]
    }))
  }

  const options = getOperatorOptions()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Выберите оператор" />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
