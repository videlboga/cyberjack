"use client"

import React, { useMemo } from 'react'
import { UnifiedSelector } from './UnifiedSelector'
import { OperatorSelectorProps, SelectorOption } from '../types'

export function OperatorSelector({
  valueType,
  supportedOperators,
  value,
  onChange,
  className,
  ...props
}: OperatorSelectorProps) {
  // Генерация опций операторов на основе типа значения
  const options = useMemo(() => {
    const allOperators: Record<string, SelectorOption[]> = {
      numeric: [
        { value: '==', label: 'Равно (=)', category: 'Сравнение' },
        { value: '!=', label: 'Не равно (≠)', category: 'Сравнение' },
        { value: '>', label: 'Больше (>)', category: 'Сравнение' },
        { value: '>=', label: 'Больше или равно (≥)', category: 'Сравнение' },
        { value: '<', label: 'Меньше (<)', category: 'Сравнение' },
        { value: '<=', label: 'Меньше или равно (≤)', category: 'Сравнение' },
        { value: 'between', label: 'В диапазоне', category: 'Диапазоны' },
        { value: 'not_between', label: 'Вне диапазона', category: 'Диапазоны' },
        { value: 'mod', label: 'Остаток от деления', category: 'Математические' },
        { value: 'divisible_by', label: 'Делится на', category: 'Математические' }
      ],
      string: [
        { value: '==', label: 'Равно (=)', category: 'Сравнение' },
        { value: '!=', label: 'Не равно (≠)', category: 'Сравнение' },
        { value: 'contains', label: 'Содержит', category: 'Поиск' },
        { value: 'not_contains', label: 'Не содержит', category: 'Поиск' },
        { value: 'starts_with', label: 'Начинается с', category: 'Поиск' },
        { value: 'ends_with', label: 'Заканчивается на', category: 'Поиск' },
        { value: 'regex', label: 'Регулярное выражение', category: 'Поиск' },
        { value: 'in', label: 'В списке', category: 'Списки' },
        { value: 'not_in', label: 'Не в списке', category: 'Списки' },
        { value: 'empty', label: 'Пустое', category: 'Проверки' },
        { value: 'not_empty', label: 'Не пустое', category: 'Проверки' }
      ],
      boolean: [
        { value: '==', label: 'Равно (=)', category: 'Сравнение' },
        { value: '!=', label: 'Не равно (≠)', category: 'Сравнение' },
        { value: 'true', label: 'Истина', category: 'Логические' },
        { value: 'false', label: 'Ложь', category: 'Логические' }
      ],
      array: [
        { value: 'contains', label: 'Содержит элемент', category: 'Содержание' },
        { value: 'not_contains', label: 'Не содержит элемент', category: 'Содержание' },
        { value: 'contains_all', label: 'Содержит все элементы', category: 'Содержание' },
        { value: 'contains_any', label: 'Содержит любой элемент', category: 'Содержание' },
        { value: 'empty', label: 'Пустой массив', category: 'Проверки' },
        { value: 'not_empty', label: 'Не пустой массив', category: 'Проверки' },
        { value: 'length', label: 'Длина массива', category: 'Размер' },
        { value: 'length_gt', label: 'Длина больше', category: 'Размер' },
        { value: 'length_lt', label: 'Длина меньше', category: 'Размер' },
        { value: 'length_between', label: 'Длина в диапазоне', category: 'Размер' }
      ]
    }

    let operators = allOperators[valueType] || allOperators.string

    // Фильтруем по поддерживаемым операторам, если указаны
    if (supportedOperators) {
      operators = operators.filter(op => supportedOperators.includes(op.value))
    }

    return operators
  }, [valueType, supportedOperators])

  return (
    <UnifiedSelector
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      placeholder="Выберите оператор..."
      showCategories={true}
      groupByCategory={true}
      searchable={false}
      {...props}
    />
  )
}

export default OperatorSelector

