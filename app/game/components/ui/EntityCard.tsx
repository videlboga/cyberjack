import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Eye, Package, Search } from "lucide-react"
import { getRankColor, getEventTypeColor, getContractTypeColor, formatPrice, formatTime } from '../../utils/entityHelpers'

export interface EntityCardProps {
  entity: any
  type: 'talent' | 'attribute' | 'skill' | 'contract' | 'event' | 'equipment' | 'storyPoint' | 'scene' | 'market' | 'action' | 'asset' | 'character' | 'user'
  onEdit?: (entity: any) => void
  onDelete?: (entityId: string) => void
  onView?: (entity: any) => void
  onManageAssets?: (user: any) => void
  onAnalyze?: (character: any) => void
  onViewKnowledge?: (user: any) => void // Просмотр знаний пользователя
  showActions?: boolean
  className?: string
  currentUser?: any // Текущий пользователь для получения его знаний
}

export const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  type,
  onEdit,
  onDelete,
  onView,
  onManageAssets,
  onAnalyze,
  onViewKnowledge,
  showActions = true,
  className = "",
  currentUser
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
        // Получаем статистику знаний пользователя о персонажах
        const characterKnowledge = entity.characterKnowledge || {}
        const characterCount = Object.keys(characterKnowledge).length
        const totalAnalyses = Object.values(characterKnowledge).reduce((sum, knowledge) => sum + (knowledge.analysisCount || 0), 0)

        // Вычисляем общий прогресс изучения
        let totalKnownCharacteristics = 0
        let totalCharacteristics = 0
        Object.values(characterKnowledge).forEach(knowledge => {
          if (knowledge.knowledge) {
            Object.values(knowledge.knowledge).forEach(category => {
              if (category && typeof category === 'object') {
                Object.values(category).forEach(char => {
                  totalCharacteristics++
                  if (char && char.level !== 'unknown') {
                    totalKnownCharacteristics++
                  }
                })
              }
            })
          }
        })
        const overallProgress = totalCharacteristics > 0 ? (totalKnownCharacteristics / totalCharacteristics) * 100 : 0

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

              {/* Новая секция - знания о персонажах */}
              <div className="border-t pt-2 mt-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">Изученность персонажей:</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Персонажей изучено:</span>
                    <span>{characterCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Всего анализов:</span>
                    <span>{totalAnalyses}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Общий прогресс:</span>
                    <span>{overallProgress.toFixed(0)}%</span>
                  </div>
                  {characterCount > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">Персонажи:</div>
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {Object.entries(characterKnowledge).slice(0, 3).map(([characterId, knowledge]) => (
                          <div key={characterId} className="text-xs flex justify-between">
                            <span className="truncate">{characterId}</span>
                            <span>{knowledge.analysisCount || 0} ан.</span>
                          </div>
                        ))}
                        {Object.keys(characterKnowledge).length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            ...ещё {Object.keys(characterKnowledge).length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Создан: {new Date(entity.created).toLocaleDateString()}
              </div>
            </div>
          </>
        )

      case 'asset':
      case 'character':
        // Получаем знания текущего пользователя об этом персонаже
        const playerKnowledge = currentUser?.characterKnowledge?.[entity.id]
        const knownPhysicalCount = playerKnowledge?.knowledge?.physical ?
          Object.values(playerKnowledge.knowledge.physical).filter((k: any) => k.level !== 'unknown').length : 0
        const totalPhysicalCount = entity.characteristics?.physical ?
          Object.keys(entity.characteristics.physical).length : 0

        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Персонаж
              </Badge>
              {entity.rank && (
                <Badge className={getRankColor(entity.rank)}>
                  {entity.rank}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {entity.description || 'Персонаж без описания'}
            </p>
            <div className="space-y-2">
              {entity.characteristics && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Основные характеристики:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(entity.characteristics.physical || {}).slice(0, 3).map(([key, value]: [string, any]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}: {value}
                      </Badge>
                    ))}
                    {Object.keys(entity.characteristics.physical || {}).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{Object.keys(entity.characteristics.physical || {}).length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {playerKnowledge && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Изученность игроком:</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      Физические: {knownPhysicalCount}/{totalPhysicalCount}
                    </div>
                    {playerKnowledge.analysisCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Анализов: {playerKnowledge.analysisCount}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
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
              {type === 'user' && onViewKnowledge && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewKnowledge(entity)
                  }}
                  className="h-8 w-8 p-0 hover:bg-green-100 text-green-600 hover:text-green-700"
                  title="Просмотр знаний о персонажах"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {(type === 'asset' || type === 'character') && onAnalyze && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAnalyze(entity)
                  }}
                  className="h-8 w-8 p-0 hover:bg-green-100 text-green-600 hover:text-green-700"
                  title="Анализ характеристик"
                >
                  <Search className="h-4 w-4" />
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
