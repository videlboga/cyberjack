import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Eye, Package } from "lucide-react"
import { getRankColor, getEventTypeColor, getContractTypeColor, formatPrice, formatTime } from '../../utils/entityHelpers'

export interface EntityCardProps {
  entity: any
  type: 'talent' | 'attribute' | 'skill' | 'contract' | 'event' | 'equipment' | 'storyPoint' | 'scene' | 'market' | 'action' | 'user'
  onEdit?: (entity: any) => void
  onDelete?: (entityId: string) => void
  onView?: (entity: any) => void
  onManageAssets?: (user: any) => void
  showActions?: boolean
  className?: string
}

export const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  type,
  onEdit,
  onDelete,
  onView,
  onManageAssets,
  showActions = true,
  className = ""
}) => {
  const renderEntityContent = () => {
    switch (type) {
      case 'talent':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge className={getRankColor(entity.rank)}>
                {entity.rank}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatPrice(entity.price)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {Array.isArray(entity.skills) ? (
                <>
                  {entity.skills?.slice(0, 3).map((skill: any, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {entity.skills?.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{entity.skills.length - 3}
                    </Badge>
                  )}
                </>
              ) : (
                entity.skills && typeof entity.skills === 'object' && (
                  <>
                    {Object.entries(entity.skills).slice(0, 3).map(([skillName, skillLevel]: [string, any], index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skillName}: {skillLevel}
                      </Badge>
                    ))}
                    {Object.keys(entity.skills).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{Object.keys(entity.skills).length - 3}
                      </Badge>
                    )}
                  </>
                )
              )}
            </div>
          </>
        )

      case 'attribute':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">
                Макс: {entity.maxValue}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatPrice(entity.cost)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {entity.description}
            </p>
          </>
        )

      case 'skill':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">
                {entity.category}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Ур. {entity.maxLevel}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="text-sm text-muted-foreground">
              Стоимость: {formatPrice(entity.cost)}
            </div>
          </>
        )

      case 'contract':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge className={getContractTypeColor(entity.type)}>
                {entity.type}
              </Badge>
              <Badge variant={entity.difficulty === 'easy' ? 'default' : 
                           entity.difficulty === 'medium' ? 'secondary' :
                           entity.difficulty === 'hard' ? 'destructive' : 'outline'}>
                {entity.difficulty}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Награда: {formatPrice(entity.reward)}</span>
              <span>Время: {formatTime(entity.timeLimit)}</span>
            </div>
          </>
        )

      case 'event':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge className={getEventTypeColor(entity.type)}>
                {entity.type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {(entity.probability * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {entity.description}
            </p>
          </>
        )

      case 'equipment':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">
                {entity.type}
              </Badge>
              <Badge variant={entity.rarity === 'common' ? 'default' :
                           entity.rarity === 'uncommon' ? 'secondary' :
                           entity.rarity === 'rare' ? 'destructive' :
                           entity.rarity === 'epic' ? 'outline' : 'default'}>
                {entity.rarity}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="text-sm text-muted-foreground">
              Цена: {formatPrice(entity.price)}
            </div>
          </>
        )

      case 'storyPoint':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">
                {entity.type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Ур. {entity.requirements?.level || 1}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {entity.triggers?.slice(0, 2).map((trigger: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {trigger}
                </Badge>
              ))}
              {entity.triggers?.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{entity.triggers.length - 2}
                </Badge>
              )}
            </div>
          </>
        )

      case 'scene':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">
                {entity.type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {entity.characters?.length || 0} персонажей
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="text-sm text-muted-foreground">
              Выборов: {entity.choices?.length || 0}
            </div>
          </>
        )

      case 'market':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">
                {entity.type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatPrice(entity.price || 0)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="text-sm text-muted-foreground">
              Риск: {(entity.risk * 100 || 0).toFixed(1)}%
            </div>
          </>
        )

      case 'action':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">
                {entity.category}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatPrice(entity.cost || 0)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.description}
            </p>
            <div className="text-sm text-muted-foreground">
              Длительность: {entity.duration || 0} мин
            </div>
          </>
        )

      case 'user':
        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant={entity.status === 'active' ? 'default' : 'secondary'}>
                {entity.status === 'active' ? 'Активен' : entity.status === 'inactive' ? 'Неактивен' : 'Заблокирован'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {entity.role}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {entity.email}
            </p>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Баланс: {formatPrice(entity.account?.balance || 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                Активов: {entity.assets?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Оборудования: {entity.equipment?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Создан: {new Date(entity.created).toLocaleDateString()}
              </div>
            </div>
          </>
        )

      default:
        return (
          <p className="text-sm text-muted-foreground">
            {entity.description || 'Описание недоступно'}
          </p>
        )
    }
  }

  const getEntityTitle = () => {
    return entity.name || entity.title || entity.id || 'Без названия'
  }

  return (
    <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-border ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold truncate pr-2">
            {getEntityTitle()}
          </CardTitle>
          {showActions && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onView(entity)
                  }}
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(entity)
                  }}
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('🗑️ Кнопка удаления нажата для:', entity.id, entity)
                    onDelete(entity.id)
                  }}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {type === 'user' && onManageAssets && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onManageAssets(entity)
                  }}
                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 hover:text-blue-700"
                  title="Управление активами"
                >
                  <Package className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {renderEntityContent()}
      </CardContent>
    </Card>
  )
}
