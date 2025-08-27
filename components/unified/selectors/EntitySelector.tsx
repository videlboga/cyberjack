"use client"

import React, { useMemo } from 'react'
import { UnifiedSelector } from './UnifiedSelector'
import { EntitySelectorProps, SelectorOption } from '../types'

export function EntitySelector({
  entityType,
  filter,
  displayField = 'name',
  valueField = 'id',
  value,
  onChange,
  className,
  ...props
}: EntitySelectorProps) {
  // Генерация опций сущностей на основе типа
  const options = useMemo(() => {
    // В реальном приложении здесь будет загрузка данных из API или контекста
    // Пока используем заглушки для демонстрации
    const mockEntities: Record<string, any[]> = {
      asset: [
        { id: 'asset_1', name: 'Анна', rank: 'A', specialization: 'Доминирование' },
        { id: 'asset_2', name: 'Мария', rank: 'B', specialization: 'Подчинение' },
        { id: 'asset_3', name: 'Елена', rank: 'C', specialization: 'Универсал' }
      ],
      user: [
        { id: 'user_1', name: 'Игрок 1', role: 'admin', balance: 1000 },
        { id: 'user_2', name: 'Игрок 2', role: 'user', balance: 500 },
        { id: 'user_3', name: 'Игрок 3', role: 'user', balance: 750 }
      ],
      equipment: [
        { id: 'eq_1', name: 'Кожаные наручники', type: 'bondage', price: 100 },
        { id: 'eq_2', name: 'Кляп', type: 'gag', price: 50 },
        { id: 'eq_3', name: 'Плеть', type: 'impact', price: 200 }
      ],
      station: [
        { id: 'station_1', name: 'Тренировочная комната', type: 'training' },
        { id: 'station_2', name: 'Терапевтический кабинет', type: 'therapy' },
        { id: 'station_3', name: 'Аукционный зал', type: 'auction' }
      ],
      story_point: [
        { id: 'sp_1', name: 'Начало истории', type: 'start' },
        { id: 'sp_2', name: 'Ключевой момент', type: 'key' },
        { id: 'sp_3', name: 'Финал', type: 'end' }
      ]
    }

    let entities = mockEntities[entityType] || []

    // Применяем фильтр, если указан
    if (filter) {
      entities = entities.filter(filter)
    }

    // Преобразуем в опции
    return entities.map(entity => ({
      value: entity[valueField],
      label: entity[displayField] || entity[valueField],
      description: getEntityDescription(entity, entityType),
      category: getEntityCategory(entity, entityType)
    }))
  }, [entityType, filter, displayField, valueField])

  // Получение описания сущности
  const getEntityDescription = (entity: any, type: string) => {
    switch (type) {
      case 'asset':
        return `Ранг: ${entity.rank}, Специализация: ${entity.specialization}`
      case 'user':
        return `Роль: ${entity.role}, Баланс: ${entity.balance}`
      case 'equipment':
        return `Тип: ${entity.type}, Цена: ${entity.price}`
      case 'station':
        return `Тип: ${entity.type}`
      case 'story_point':
        return `Тип: ${entity.type}`
      default:
        return ''
    }
  }

  // Получение категории сущности
  const getEntityCategory = (entity: any, type: string) => {
    switch (type) {
      case 'asset':
        return `Ранг ${entity.rank}`
      case 'user':
        return entity.role === 'admin' ? 'Администраторы' : 'Пользователи'
      case 'equipment':
        return entity.type
      case 'station':
        return entity.type
      case 'story_point':
        return entity.type
      default:
        return 'Общие'
    }
  }

  return (
    <UnifiedSelector
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      placeholder={`Выберите ${getEntityTypeLabel(entityType)}...`}
      showCategories={true}
      groupByCategory={true}
      searchable={true}
      {...props}
    />
  )
}

// Получение человекочитаемого названия типа сущности
const getEntityTypeLabel = (type: string) => {
  switch (type) {
    case 'asset': return 'актив'
    case 'user': return 'пользователя'
    case 'equipment': return 'оборудование'
    case 'station': return 'станцию'
    case 'story_point': return 'точку истории'
    default: return 'сущность'
  }
}

export default EntitySelector

