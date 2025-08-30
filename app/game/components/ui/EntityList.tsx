import React, { useState, useMemo } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Grid, List, Plus } from "lucide-react"
import { EntityCard } from './EntityCard'
import { searchInConfig, getConfigStats } from '../../utils/configHelpers'

export interface EntityListProps {
  entities: any[]
  entityType: 'talent' | 'attribute' | 'skill' | 'contract' | 'event' | 'equipment' | 'storyPoint' | 'scene' | 'market' | 'action' | 'asset' | 'character' | 'user' | 'station'
  configType: keyof typeof searchInConfig
  onEdit?: (entity: any) => void
  onDelete?: (entityId: string) => void
  onView?: (entity: any) => void
  onManageAssets?: (user: any) => void
  onAnalyze?: (character: any) => void
  onConfigure?: (character: any) => void
  onViewKnowledge?: (user: any) => void // Просмотр знаний пользователя
  onAdd?: () => void
  title?: string
  className?: string
  showActions?: boolean
  currentUser?: any // Текущий пользователь для отображения его знаний
}

export const EntityList: React.FC<EntityListProps> = ({
  entities,
  entityType,
  configType,
  onEdit,
  onDelete,
  onView,
  onManageAssets,
  onAnalyze,
  onConfigure,
  onViewKnowledge,
  onAdd,
  title,
  className = "",
  showActions = true,
  currentUser
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<string>('name')

  // Получаем статистику для фильтров
  const stats = useMemo(() => getConfigStats({ [configType]: entities }, configType), [entities, configType])

  // Фильтрация и поиск
  const filteredEntities = useMemo(() => {
    let filtered = entities

    // Поиск
    if (searchQuery) {
      const searchResults = searchInConfig({ [configType]: entities }, searchQuery, configType)
      filtered = searchResults
    }

    // Фильтр по типу
    if (filterType !== 'all') {
      filtered = filtered.filter((entity: any) => {
        switch (entityType) {
          case 'market':
            if (filterType === 'asset') return entity.rank // talentExchange assets have rank
            if (filterType === 'void') return entity.risk // voidRescues have risk
            return true
          case 'contract':
            return entity.type === filterType
          case 'event':
            return entity.type === filterType
          case 'equipment':
            return entity.type === filterType || entity.rarity === filterType
          case 'skill':
            return entity.category === filterType
          case 'storyPoint':
            return entity.type === filterType
          default:
            return true
        }
      })
    }

    // Сортировка
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'name':
          return (a.name || a.title || '').localeCompare(b.name || b.title || '')
        case 'type':
          return (a.type || '').localeCompare(b.type || '')
        case 'price':
          return (a.price || 0) - (b.price || 0)
        case 'reward':
          return (a.reward || 0) - (b.reward || 0)
        case 'rarity':
          const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary']
          return rarityOrder.indexOf(a.rarity || '') - rarityOrder.indexOf(b.rarity || '')
        default:
          return 0
      }
    })

    return filtered
  }, [entities, searchQuery, filterType, sortBy, entityType, configType])

  const getFilterOptions = () => {
    switch (entityType) {
      case 'market':
        return [
          { value: 'all', label: 'Все типы' },
          { value: 'asset', label: 'Активы' },
          { value: 'void', label: 'Void Rescues' }
        ]
      case 'contract':
        return [
          { value: 'all', label: 'Все типы' },
          { value: 'rescue', label: 'Спасение' },
          { value: 'escort', label: 'Эскорт' },
          { value: 'delivery', label: 'Доставка' },
          { value: 'investigation', label: 'Расследование' },
          { value: 'elimination', label: 'Устранение' }
        ]
      case 'event':
        return [
          { value: 'all', label: 'Все типы' },
          { value: 'anomaly', label: 'Аномалия' },
          { value: 'crisis', label: 'Кризис' },
          { value: 'opportunity', label: 'Возможность' },
          { value: 'market', label: 'Рынок' },
          { value: 'story', label: 'Сюжет' }
        ]
      case 'equipment':
        return [
          { value: 'all', label: 'Все типы' },
          { value: 'weapon', label: 'Оружие' },
          { value: 'armor', label: 'Броня' },
          { value: 'gadget', label: 'Гаджет' },
          { value: 'consumable', label: 'Расходник' },
          { value: 'common', label: 'Обычное' },
          { value: 'uncommon', label: 'Необычное' },
          { value: 'rare', label: 'Редкое' },
          { value: 'epic', label: 'Эпическое' },
          { value: 'legendary', label: 'Легендарное' }
        ]
      case 'skill':
        return [
          { value: 'all', label: 'Все категории' },
          { value: 'combat', label: 'Бой' },
          { value: 'social', label: 'Социальное' },
          { value: 'technical', label: 'Техническое' },
          { value: 'survival', label: 'Выживание' }
        ]
      case 'storyPoint':
        return [
          { value: 'all', label: 'Все типы' },
          { value: 'intro', label: 'Введение' },
          { value: 'main', label: 'Основной' },
          { value: 'side', label: 'Побочный' },
          { value: 'ending', label: 'Завершение' }
        ]
      default:
        return [{ value: 'all', label: 'Все' }]
    }
  }

  const getSortOptions = () => {
    const baseOptions = [
      { value: 'name', label: 'По названию' },
      { value: 'type', label: 'По типу' }
    ]

    switch (entityType) {
      case 'talent':
        return [...baseOptions, { value: 'price', label: 'По цене' }]
      case 'equipment':
        return [...baseOptions, { value: 'price', label: 'По цене' }, { value: 'rarity', label: 'По редкости' }]
      case 'contract':
        return [...baseOptions, { value: 'reward', label: 'По награде' }]
      default:
        return baseOptions
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Modern Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">{title || `${entityType}s`}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filteredEntities.length} из {entities.length} элементов</span>
            {stats && Object.keys(stats).length > 0 && (
              <div className="flex items-center gap-2">
                {Object.entries(stats).slice(0, 3).map(([key, count]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {showActions && onAdd && (
          <Button onClick={onAdd} className="flex items-center gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        )}
      </div>

      {/* Modern Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Поиск по названию, описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 h-10">
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
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getSortOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg overflow-hidden bg-muted/50">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-none h-9 px-3"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-none h-9 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {stats.types && stats.types.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.types.map((type: string) => (
            <Badge
              key={`stat-${type}`}
              variant={filterType === type ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
            >
              {type}: {entities.filter((e: any) => e.type === type).length}
            </Badge>
          ))}
        </div>
      )}

      {/* Modern Entity Grid/List */}
      {filteredEntities.length > 0 ? (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-3'
        }>
          {filteredEntities.map((entity: any, index: number) => (
            <EntityCard
              key={entity.id || `entity-${index}`}
              entity={entity}
              type={entityType}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              onManageAssets={onManageAssets}
              onAnalyze={onAnalyze}
              onConfigure={onConfigure}
              onViewKnowledge={onViewKnowledge}
              showActions={showActions}
              className={viewMode === 'list' ? 'flex-row items-center' : ''}
              currentUser={currentUser}
            />
          ))}
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
