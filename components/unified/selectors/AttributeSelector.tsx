"use client"

import React, { useMemo } from 'react'
import { UnifiedSelector } from './UnifiedSelector'
import { AttributeSelectorProps, SelectorOption } from '../types'
import { AttributeParser } from '@/lib/condition-utils'
import systemConfig from '@/data/system-unified.json'

export function AttributeSelector({
  entityType,
  entityId,
  attributeType,
  category,
  value,
  onChange,
  className,
  ...props
}: AttributeSelectorProps) {
  // Генерация опций атрибутов на основе типа сущности
  const options = useMemo(() => {
    const options: SelectorOption[] = []

    switch (entityType) {
      case "asset":
        // Атрибуты из единого system-конфига
        const sysAttrs = (systemConfig as any)?.attributes || []
        const sysAttrsExtra = (systemConfig as any)?.attributes_extra || []
        for (const a of [...sysAttrs, ...sysAttrsExtra]) {
          options.push({ value: a.id, label: a.name || a.id, category: "Атрибуты" })
        }

        // Фетиши из единого конфига
        const sysFetishes = (systemConfig as any)?.fetishes || []
        for (const f of sysFetishes) {
          options.push({ value: f.id, label: f.name || f.id, category: "Фетиши" })
        }

        // Метаданные
        options.push(
          { value: "rank", label: "Ранг", category: "Метаданные" },
          { value: "price", label: "Цена", category: "Метаданные" },
          { value: "status", label: "Статус", category: "Метаданные" },
          { value: "location", label: "Местоположение", category: "Метаданные" },
          { value: "specialization", label: "Специализация", category: "Метаданные" }
        )
        // История (оставляем как было)
        options.push(
          { value: "assignments", label: "Задания", category: "История" },
          { value: "success_rate", label: "Успешность", category: "История" }
        )

        // Трейты и предпочтения
        options.push(
          { value: "traits", label: "Трейты", category: "Трейты и предпочтения" },
          { value: "work_type", label: "Тип работы", category: "Трейты и предпочтения" },
          { value: "environment", label: "Окружение", category: "Трейты и предпочтения" },
          { value: "avoid", label: "Избегает", category: "Трейты и предпочтения" }
        )
        break

      case "player":
        // Аккаунт
        options.push(
          { value: "balance", label: "Баланс", category: "Аккаунт" },
          { value: "currency", label: "Валюта", category: "Аккаунт" }
        )

        // Активы
        options.push(
          { value: "assets_count", label: "Количество активов", category: "Активы" },
          { value: "owned_assets_count", label: "Принадлежащие активы", category: "Активы" }
        )

        // Оборудование
        options.push(
          { value: "equipment_count", label: "Количество оборудования", category: "Оборудование" },
          { value: "has_equipment", label: "Есть оборудование", category: "Оборудование" }
        )

        // Настройки
        options.push(
          { value: "riskTolerance", label: "Толерантность к риску", category: "Настройки" },
          { value: "theme", label: "Тема", category: "Настройки" },
          { value: "notifications", label: "Уведомления", category: "Настройки" },
          { value: "autoAssign", label: "Автоназначение", category: "Настройки" }
        )

        // Метаданные
        options.push(
          { value: "role", label: "Роль", category: "Метаданные" },
          { value: "status", label: "Статус", category: "Метаданные" },
          { value: "created", label: "Дата создания", category: "Метаданные" },
          { value: "lastLogin", label: "Последний вход", category: "Метаданные" }
        )
        break

      case "scene":
        // Выборы сцены
        options.push(
          { value: "choice_made", label: "Выбор сделан", category: "Выборы" },
          { value: "choice_text", label: "Текст выбора", category: "Выборы" },
          { value: "choice_consequences", label: "Последствия выбора", category: "Выборы" }
        )

        // Прогресс сцены
        options.push(
          { value: "scene_completed", label: "Сцена завершена", category: "Прогресс" },
          { value: "scene_progress", label: "Прогресс сцены", category: "Прогресс" },
          { value: "scene_attempts", label: "Попытки сцены", category: "Прогресс" }
        )
        break
    }

    // Фильтрация по категории, если указана
    if (category) {
      return options.filter(option => option.category === category)
    }

    return options
  }, [entityType, category])

  // Фильтрация по типу атрибута, если указан
  const filteredOptions = useMemo(() => {
    if (!attributeType) return options

    return options.filter(option => {
      const optionType = AttributeParser.getAttributeType(option.value)
      return optionType === attributeType
    })
  }, [options, attributeType])

  return (
    <UnifiedSelector
      value={value}
      onChange={onChange}
      options={filteredOptions}
      className={className}
      placeholder="Выберите атрибут..."
      showCategories={true}
      groupByCategory={true}
      searchable={true}
      {...props}
    />
  )
}

export default AttributeSelector

