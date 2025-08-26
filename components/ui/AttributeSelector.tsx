"use client"

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { AssetAttribute, PlayerAttribute } from '@/lib/unified-entities'
import { AttributeParser } from '@/lib/condition-utils'

interface AttributeSelectorProps {
  entityType: "asset" | "player" | "scene"
  entityId: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export function AttributeSelector({
  entityType,
  entityId,
  value,
  onChange,
  className
}: AttributeSelectorProps) {
  const getAttributeOptions = () => {
    const options: { value: string; label: string; category: string }[] = []

    switch (entityType) {
      case "asset":
        // Основные атрибуты
        options.push(
          { value: "strength", label: "Сила", category: "Основные атрибуты" },
          { value: "empathy", label: "Эмпатия", category: "Основные атрибуты" },
          { value: "intelligence", label: "Интеллект", category: "Основные атрибуты" },
          { value: "temperament", label: "Темперамент", category: "Основные атрибуты" },
          { value: "grit", label: "Стойкость", category: "Основные атрибуты" },
          { value: "ego", label: "Эго", category: "Основные атрибуты" },
          { value: "loyalty", label: "Лояльность", category: "Основные атрибуты" },
          { value: "obedience", label: "Послушание", category: "Основные атрибуты" },
          { value: "resistance", label: "Сопротивление", category: "Основные атрибуты" }
        )

        // Фетиши
        options.push(
          { value: "bdsm", label: "БДСМ", category: "Фетиши" },
          { value: "humiliation", label: "Унижение", category: "Фетиши" },
          { value: "masochism", label: "Мазохизм", category: "Фетиши" },
          { value: "sadism", label: "Садизм", category: "Фетиши" },
          { value: "voyeurism", label: "Вуайеризм", category: "Фетиши" },
          { value: "exhibitionism", label: "Эксгибиционизм", category: "Фетиши" },
          { value: "roleplay", label: "Ролевые игры", category: "Фетиши" },
          { value: "bondage", label: "Связывание", category: "Фетиши" },
          { value: "sensory_deprivation", label: "Сенсорная депривация", category: "Фетиши" },
          { value: "sensory_overload", label: "Сенсорная перегрузка", category: "Фетиши" },
          { value: "electricity", label: "Электричество", category: "Фетиши" },
          { value: "vibration", label: "Вибрация", category: "Фетиши" },
          { value: "temperature", label: "Температура", category: "Фетиши" },
          { value: "pressure", label: "Давление", category: "Фетиши" },
          { value: "tickling", label: "Щекотка", category: "Фетиши" },
          { value: "feet", label: "Фут-фетиш", category: "Фетиши" },
          { value: "hands", label: "Хенд-фетиш", category: "Фетиши" },
          { value: "breasts", label: "Брест-фетиш", category: "Фетиши" },
          { value: "anal", label: "Анал-фетиш", category: "Фетиши" },
          { value: "latex", label: "Латекс", category: "Фетиши" },
          { value: "leather", label: "Кожа", category: "Фетиши" },
          { value: "silk", label: "Шёлк", category: "Фетиши" },
          { value: "rope", label: "Верёвки", category: "Фетиши" },
          { value: "uniform", label: "Униформа", category: "Фетиши" },
          { value: "age_play", label: "Возрастные роли", category: "Фетиши" },
          { value: "pregnancy", label: "Беременность", category: "Фетиши" },
          { value: "lactation", label: "Лактация", category: "Фетиши" }
        )

        // Состояние
        options.push(
          { value: "health", label: "Здоровье", category: "Состояние" },
          { value: "mental_state", label: "Психическое состояние", category: "Состояние" },
          { value: "stress", label: "Стресс", category: "Состояние" },
          { value: "fatigue", label: "Усталость", category: "Состояние" }
        )

        // Метаданные
        options.push(
          { value: "rank", label: "Ранг", category: "Метаданные" },
          { value: "price", label: "Цена", category: "Метаданные" },
          { value: "status", label: "Статус", category: "Метаданные" },
          { value: "location", label: "Местоположение", category: "Метаданные" },
          { value: "specialization", label: "Специализация", category: "Метаданные" }
        )

        // История
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
          { value: "owned_assets_count", label: "Количество принадлежащих активов", category: "Активы" }
        )

        // Оборудование
        options.push(
          { value: "equipment_count", label: "Количество оборудования", category: "Оборудование" },
          { value: "has_equipment", label: "Имеет оборудование", category: "Оборудование" }
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
        // Сцены будут добавлены позже
        break
    }

    return options
  }

  const options = getAttributeOptions()

  // Группировать по категориям
  const groupedOptions = options.reduce((acc, option) => {
    if (!acc[option.category]) {
      acc[option.category] = []
    }
    acc[option.category].push(option)
    return acc
  }, {} as Record<string, typeof options>)

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Выберите атрибут" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groupedOptions).map(([category, categoryOptions]) => (
          <div key={category}>
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {category}
            </div>
            {categoryOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  )
}
