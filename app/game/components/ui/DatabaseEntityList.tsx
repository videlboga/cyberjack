import React, { useState, useMemo } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Plus, RefreshCw, Edit, Eye, Trash2 } from "lucide-react"

export interface DatabaseEntityListProps {
  entities: any[]
  type: string
  title: string
  onEdit?: (entity: any) => void
  onDelete?: (entityId: string) => void
  onView?: (entity: any) => void
  onAdd?: () => void
  onRefresh?: () => void
  className?: string
}

export const DatabaseEntityList: React.FC<DatabaseEntityListProps> = ({
  entities,
  type,
  title,
  onEdit,
  onDelete,
  onView,
  onAdd,
  onRefresh,
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  // Фильтрация и поиск
  const filteredEntities = useMemo(() => {
    let filtered = entities

    // Поиск по тексту
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(entity => {
        // Универсальный поиск по основным полям
        const searchableFields = [
          entity.name,
          entity.title,
          entity.description,
          entity.client,
          entity.category,
          entity.type,
          entity.specialization
        ].filter(Boolean)

        return searchableFields.some(field =>
          field.toLowerCase().includes(query)
        )
      })
    }

    // Фильтр по типу
    if (filterType !== 'all') {
      filtered = filtered.filter(entity => {
        switch (type) {
          case 'character':
            return entity.rank === filterType || entity.status === filterType
          case 'action':
            return entity.category === filterType || entity.type === filterType
          case 'contract':
            return entity.status === filterType
          case 'equipment':
            return entity.type === filterType || entity.category === filterType
          default:
            return true
        }
      })
    }

    return filtered
  }, [entities, searchQuery, filterType, type])

  const getFilterOptions = () => {
    switch (type) {
      case 'character':
        return [
          { value: 'all', label: 'Все ранги' },
          { value: 'Junior', label: 'Junior' },
          { value: 'Middle', label: 'Middle' },
          { value: 'Senior', label: 'Senior' },
          { value: 'available', label: 'Доступные' },
          { value: 'owned', label: 'Приобретенные' }
        ]
      case 'action':
        return [
          { value: 'all', label: 'Все категории' },
          { value: 'training', label: 'Обучение' },
          { value: 'coaching', label: 'Коучинг' },
          { value: 'therapy', label: 'Терапия' }
        ]
      case 'contract':
        return [
          { value: 'all', label: 'Все статусы' },
          { value: 'available', label: 'Доступные' },
          { value: 'assigned', label: 'Назначенные' },
          { value: 'completed', label: 'Завершенные' }
        ]
      case 'equipment':
        return [
          { value: 'all', label: 'Все типы' },
          { value: 'weapon', label: 'Оружие' },
          { value: 'armor', label: 'Броня' },
          { value: 'gadget', label: 'Гаджет' }
        ]
      default:
        return [{ value: 'all', label: 'Все' }]
    }
  }

  const renderEntityCard = (entity: any, index: number) => {
    return (
      <Card key={entity.id || `entity-${index}`} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {entity.avatar && <span className="text-2xl">{entity.avatar}</span>}
                {entity.name || entity.title || 'Без названия'}
              </CardTitle>
              {entity.archetype && (
                <Badge variant="outline" className="mt-1">
                  {entity.archetype}
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              {onView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(entity)}
                  title="Просмотр"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(entity)}
                  title="Редактировать"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(entity.id)}
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {entity.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {entity.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {entity.rank && (
              <Badge variant="secondary">
                {entity.rank}
              </Badge>
            )}
            {entity.status && (
              <Badge variant={entity.status === 'available' ? 'default' : 'outline'}>
                {entity.status}
              </Badge>
            )}
            {entity.category && (
              <Badge variant="outline">
                {entity.category}
              </Badge>
            )}
            {entity.type && (
              <Badge variant="outline">
                {entity.type}
              </Badge>
            )}
            {entity.price && (
              <Badge variant="outline" className="bg-green-100 text-green-800">
                {entity.price} кредитов
              </Badge>
            )}
          </div>

          {entity.specialization && (
            <div className="mt-2 text-xs text-muted-foreground">
              Специализация: {entity.specialization}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {filteredEntities.length} из {entities.length} элементов
          </p>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              title="Обновить"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {onAdd && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAdd}
              title="Добавить"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Поиск по названию, описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getFilterOptions().map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Entity Grid */}
      {filteredEntities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map((entity, index) => renderEntityCard(entity, index))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Ничего не найдено</h3>
          <p className="text-muted-foreground max-w-sm">
            {searchQuery || filterType !== 'all'
              ? 'Попробуйте изменить параметры поиска или фильтры'
              : 'Добавьте первый элемент для начала работы'
            }
          </p>
        </div>
      )}
    </div>
  )
}
