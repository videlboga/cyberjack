"use client"

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Asset, User } from '@/lib/types'

interface EntitySelectorProps {
  entityType: "asset" | "player" | "scene"
  value: string
  onChange: (value: string) => void
  includeSpecial?: boolean // "any", "current", "owned"
  assets?: Asset[]
  users?: User[]
  className?: string
}

export function EntitySelector({
  entityType,
  value,
  onChange,
  includeSpecial = false,
  assets = [],
  users = [],
  className
}: EntitySelectorProps) {
  const getEntityOptions = () => {
    const options: { value: string; label: string }[] = []

    // Специальные опции
    if (includeSpecial) {
      if (entityType === "asset") {
        options.push(
          { value: "any", label: "Любой актив" },
          { value: "current", label: "Текущий актив" },
          { value: "owned", label: "Принадлежащий актив" }
        )
      }
    }

    // Конкретные сущности
    switch (entityType) {
      case "asset":
        assets.forEach(asset => {
          options.push({
            value: asset.id,
            label: `${asset.name} (${asset.rank})`
          })
        })
        break
      case "player":
        users.forEach(user => {
          options.push({
            value: user.id,
            label: `${user.username} (${user.role})`
          })
        })
        break
      case "scene":
        // Сцены будут добавлены позже
        break
    }

    return options
  }

  const options = getEntityOptions()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Выберите сущность" />
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

