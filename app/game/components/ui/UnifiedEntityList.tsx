import React, { useState, useMemo } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Plus, RefreshCw } from "lucide-react"
import { 
  UnifiedEntityCard,
  EntityCardProps 
} from './UnifiedEntityCard'
import { 
  Character, 
  Action, 
  Event, 
  Contract, 
  Equipment, 
  StoryScene, 
  User,
  EntityType 
} from '@/lib/unified-types'

export interface UnifiedEntityListProps {
  entities: (Character | Action | Event | Contract | Equipment | StoryScene | User)[]
  type: EntityType
  title: string
  onEdit?: (entity: any) => void
  onDelete?: (entityId: string) => void
  onView?: (entity: any) => void
  onAdd?: () => void
  onRefresh?: () => void
  filters?: {
    [key: string]: string[]
  }
  className?: string
}

export const UnifiedEntityList: React.FC<UnifiedEntityListProps> = ({
  entities,
  type,
  title,
  onEdit,
  onDelete,
  onView,
  onAdd,
  onRefresh,
  filters = {},
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

  // Фильтрация и поиск
  const filteredEntities = useMemo(() => {
    let filtered = entities

    // Поиск по тексту
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(entity => {
        switch (type) {
          case 'character':
            const char = entity as Character
            return char.name.toLowerCase().includes(query) ||
                   char.specialization.toLowerCase().includes(query) ||
                   char.description.toLowerCase().includes(query)
          case 'action':
            const action = entity as Action
            return action.title.toLowerCase().includes(query) ||
                   action.description.toLowerCase().includes(query) ||
                   action.category.toLowerCase().includes(query)
          case 'event':
            const event = entity as Event
            return event.title.toLowerCase().includes(query) ||
                   event.description.toLowerCase().includes(query) ||
                   event.type.toLowerCase().includes(query)
          case 'contract':
            const contract = entity as Contract
            return contract.title.toLowerCase().includes(query) ||
                   contract.client.toLowerCase().includes(query) ||
                   contract.description.toLowerCase().includes(query)
          case 'equipment':
            const equipment = entity as Equipment
            return equipment.name.toLowerCase().includes(query) ||
                   equipment.description.toLowerCase().includes(query) ||
                   equipment.type.toLowerCase().includes(query)
          case 'storyScene':
            const scene = entity as StoryScene
            return scene.title.toLowerCase().includes(query) ||
                   scene.description.toLowerCase().includes(query) ||
                   scene.type.toLowerCase().includes(query)
          case 'user':
            const user = entity as User
            return user.username.toLowerCase().includes(query) ||
                   user.email.toLowerCase().includes(query) ||
                   user.role.toLowerCase().includes(query)
          default:
            return true
        }
      })
    }

    // Применение фильтров
    Object.entries(activeFilters).forEach(([filterKey, filterValue]) => {
      if (filterValue && filterValue !== 'all') {
        filtered = filtered.filter(entity => {
          switch (filterKey) {
            case 'source':
              return (entity as Character).metadata?.source === filterValue
            case 'rank':
              return (entity as Character).rank === filterValue
            case 'status':
              return (entity as Character).status === filterValue
            case 'category':
              return (entity as Action).category === filterValue
            case 'type':
              return (entity as Event).type === filterValue
            case 'client':
              return (entity as Contract).client === filterValue
            case 'equipmentType':
              return (entity as Equipment).type === filterValue
            case 'sceneType':
              return (entity as StoryScene).type === filterValue
            case 'userRole':
              return (entity as User).role === filterValue
            default:
              return true
          }
        })
      }
    })

    return filtered
  }, [entities, searchQuery, activeFilters, type])

  // Получение доступных значений для фильтров
  const getFilterOptions = (filterKey: string) => {
    const values = new Set<string>()
    
    entities.forEach(entity => {
      let value: string | undefined
      
      switch (filterKey) {
        case 'source':
          value = (entity as Character).metadata?.source
          break
        case 'rank':
          value = (entity as Character).rank
          break
        case 'status':
          value = (entity as Character).status
          break
        case 'category':
          value = (entity as Action).category
          break
        case 'type':
          value = (entity as Event).type
          break
        case 'client':
          value = (entity as Contract).client
          break
        case 'equipmentType':
          value = (entity as Equipment).type
          break
        case 'sceneType':
          value = (entity as StoryScene).type
          break
        case 'userRole':
          value = (entity as User).role
          break
      }
      
      if (value) {
        values.add(value)
      }
    })
    
    return Array.from(values).sort()
  }

  const handleFilterChange = (filterKey: string, value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: value
    }))
  }

  const clearFilters = () => {
    setActiveFilters({})
    setSearchQuery('')
  }

  const getFilterLabel = (filterKey: string) => {
    const labels: Record<string, string> = {
      source: 'Источник',
      rank: 'Ранг',
      status: 'Статус',
      category: 'Категория',
      type: 'Тип',
      client: 'Клиент',
      equipmentType: 'Тип оборудования',
      sceneType: 'Тип сцены',
      userRole: 'Роль'
    }
    return labels[filterKey] || filterKey
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Заголовок и действия */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">
            {filteredEntities.length} из {entities.length} элементов
          </p>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </Button>
          )}
          {onAdd && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          )}
        </div>
      </div>

      {/* Поиск и фильтры */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Поиск и фильтры
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Поиск */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button variant="outline" onClick={clearFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Очистить
            </Button>
          </div>

          {/* Фильтры */}
          {Object.keys(filters).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.keys(filters).map(filterKey => (
                <div key={filterKey} className="space-y-2">
                  <label className="text-sm font-medium">
                    {getFilterLabel(filterKey)}
                  </label>
                  <Select
                    value={activeFilters[filterKey] || 'all'}
                    onValueChange={(value) => handleFilterChange(filterKey, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Все" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      {getFilterOptions(filterKey).map(value => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          {/* Активные фильтры */}
          {Object.keys(activeFilters).some(key => activeFilters[key] && activeFilters[key] !== 'all') && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Активные фильтры:</span>
              {Object.entries(activeFilters).map(([key, value]) => {
                if (value && value !== 'all') {
                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {getFilterLabel(key)}: {value}
                    </Badge>
                  )
                }
                return null
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Список сущностей */}
      {filteredEntities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery || Object.keys(activeFilters).some(key => activeFilters[key] && activeFilters[key] !== 'all')
                ? 'Ничего не найдено по заданным критериям'
                : 'Нет данных для отображения'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEntities.map((entity) => (
            <UnifiedEntityCard
              key={entity.id}
              entity={entity}
              type={type}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              showActions={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}

