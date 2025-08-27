"use client"

import React, { useMemo } from 'react'
import { UnifiedSelector } from './UnifiedSelector'
import { AttributeSelectorProps, SelectorOption } from '../types'
import { AttributeParser } from '@/lib/condition-utils'

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

