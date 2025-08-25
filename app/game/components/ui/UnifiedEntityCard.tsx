import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Eye } from "lucide-react"
import { 
  Character, 
  Action, 
  Event, 
  Contract, 
  Equipment, 
  StoryScene, 
  User,
  EntityType,
  EntityCardProps 
} from '@/lib/unified-types'

// Утилиты для форматирования
const formatPrice = (price: number) => `${price.toLocaleString()} ₽`
const formatDate = (date: string) => new Date(date).toLocaleDateString('ru-RU')

const getRankColor = (rank: string) => {
  const colors: Record<string, string> = {
    'F-': 'bg-red-100 text-red-800',
    'F': 'bg-red-200 text-red-900',
    'F+': 'bg-orange-100 text-orange-800',
    'D-': 'bg-orange-200 text-orange-900',
    'D': 'bg-yellow-100 text-yellow-800',
    'D+': 'bg-yellow-200 text-yellow-900',
    'C-': 'bg-green-100 text-green-800',
    'C': 'bg-green-200 text-green-900',
    'C+': 'bg-blue-100 text-blue-800',
    'B-': 'bg-blue-200 text-blue-900',
    'B': 'bg-purple-100 text-purple-800',
    'B+': 'bg-purple-200 text-purple-900',
    'A-': 'bg-pink-100 text-pink-800',
    'A': 'bg-pink-200 text-pink-900',
    'A+': 'bg-indigo-100 text-indigo-800',
    'S-': 'bg-indigo-200 text-indigo-900',
    'S': 'bg-violet-100 text-violet-800',
    'S+': 'bg-violet-200 text-violet-900'
  }
  return colors[rank] || 'bg-gray-100 text-gray-800'
}

const getSourceColor = (source: string) => {
  const colors: Record<string, string> = {
    'market': 'bg-blue-100 text-blue-800',
    'void': 'bg-purple-100 text-purple-800',
    'corporate': 'bg-green-100 text-green-800',
    'custom': 'bg-gray-100 text-gray-800'
  }
  return colors[source] || 'bg-gray-100 text-gray-800'
}

const getEventTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    'anomaly': 'bg-red-100 text-red-800',
    'crisis': 'bg-orange-100 text-orange-800',
    'opportunity': 'bg-green-100 text-green-800',
    'story': 'bg-blue-100 text-blue-800',
    'random': 'bg-gray-100 text-gray-800'
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

const getActionTypeColor = (category: string) => {
  const colors: Record<string, string> = {
    'training': 'bg-blue-100 text-blue-800',
    'coaching': 'bg-green-100 text-green-800',
    'therapy': 'bg-purple-100 text-purple-800',
    'punishment': 'bg-red-100 text-red-800',
    'reward': 'bg-yellow-100 text-yellow-800',
    'medical': 'bg-pink-100 text-pink-800',
    'neural': 'bg-indigo-100 text-indigo-800'
  }
  return colors[category] || 'bg-gray-100 text-gray-800'
}

export const UnifiedEntityCard: React.FC<EntityCardProps> = ({
  entity,
  type,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  className = ""
}) => {
  const renderCharacterContent = (character: Character) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2">
          <Badge className={getRankColor(character.rank)}>
            {character.rank}
          </Badge>
          <Badge className={getSourceColor(character.metadata.source)}>
            {character.metadata.source}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {formatPrice(character.price)}
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2">
        {character.description}
      </p>
      
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div>
          <span className="font-medium">Настроение:</span> {character.states.mood}/100
        </div>
        <div>
          <span className="font-medium">Стресс:</span> {character.states.stress}/100
        </div>
        <div>
          <span className="font-medium">Послушание:</span> {character.states.obedience}/5
        </div>
        <div>
          <span className="font-medium">Преданность:</span> {character.states.devotion}/5
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {Object.entries(character.skills).slice(0, 3).map(([skillName, skillLevel]) => (
          <Badge key={skillName} variant="outline" className="text-xs">
            {skillName}: {skillLevel}
          </Badge>
        ))}
        {Object.keys(character.skills).length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{Object.keys(character.skills).length - 3}
          </Badge>
        )}
      </div>
      
      {character.traits && character.traits.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1">Трейты:</div>
          <div className="flex flex-wrap gap-1">
            {character.traits.slice(0, 2).map((trait, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {trait}
              </Badge>
            ))}
            {character.traits.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{character.traits.length - 2}
              </Badge>
            )}
          </div>
        </div>
      )}
    </>
  )

  const renderActionContent = (action: Action) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <Badge className={getActionTypeColor(action.category)}>
          {action.category}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Стоимость: {action.cost}
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2">
        {action.description}
      </p>
      
      {action.risk && (
        <div className="mb-2">
          <Badge variant="outline" className="text-xs">
            Риск: {typeof action.risk === 'number' ? `${action.risk}%` : action.risk}
          </Badge>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        Создано: {formatDate(action.metadata.createdAt)}
      </div>
    </>
  )

  const renderEventContent = (event: Event) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <Badge className={getEventTypeColor(event.type)}>
          {event.type}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {event.probability}%
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2">
        {event.description}
      </p>
      
      <div className="text-xs text-muted-foreground">
        Триггер: {event.trigger}
      </div>
    </>
  )

  const renderContractContent = (contract: Contract) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline">
          {contract.client}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatPrice(contract.reward)}
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2">
        {contract.description}
      </p>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="font-medium">Срок:</span> {contract.deadline} дн.
        </div>
        <div>
          <span className="font-medium">KPI:</span> {contract.kpi.length}
        </div>
      </div>
    </>
  )

  const renderEquipmentContent = (equipment: Equipment) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline">
          {equipment.type}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatPrice(equipment.cost)}
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2">
        {equipment.description}
      </p>
    </>
  )

  const renderStorySceneContent = (scene: StoryScene) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline">
          {scene.type}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2">
        {scene.description}
      </p>
      
      <div className="text-xs text-muted-foreground">
        Создано: {formatDate(scene.metadata.createdAt)}
      </div>
    </>
  )

  const renderUserContent = (user: User) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline">
          {user.role}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatPrice(user.account.balance)}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <span className="font-medium">Персонажи:</span> {user.characters.length}
        </div>
        <div>
          <span className="font-medium">Последний вход:</span> {formatDate(user.lastLogin)}
        </div>
      </div>
    </>
  )

  const renderEntityContent = () => {
    switch (type) {
      case 'character':
        return renderCharacterContent(entity as Character)
      case 'action':
        return renderActionContent(entity as Action)
      case 'event':
        return renderEventContent(entity as Event)
      case 'contract':
        return renderContractContent(entity as Contract)
      case 'equipment':
        return renderEquipmentContent(entity as Equipment)
      case 'storyScene':
        return renderStorySceneContent(entity as StoryScene)
      case 'user':
        return renderUserContent(entity as User)
      default:
        return <p className="text-sm text-muted-foreground">Неизвестный тип сущности</p>
    }
  }

  const getEntityTitle = () => {
    switch (type) {
      case 'character':
        return (entity as Character).name
      case 'action':
        return (entity as Action).title
      case 'event':
        return (entity as Event).title
      case 'contract':
        return (entity as Contract).title
      case 'equipment':
        return (entity as Equipment).name
      case 'storyScene':
        return (entity as StoryScene).title
      case 'user':
        return (entity as User).username
      default:
        return 'Неизвестная сущность'
    }
  }

  const getEntityDescription = () => {
    switch (type) {
      case 'character':
        return (entity as Character).specialization
      case 'action':
        return (entity as Action).category
      case 'event':
        return (entity as Event).type
      case 'contract':
        return (entity as Contract).client
      case 'equipment':
        return (entity as Equipment).type
      case 'storyScene':
        return (entity as StoryScene).type
      case 'user':
        return (entity as User).email
      default:
        return ''
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{getEntityTitle()}</CardTitle>
            <CardDescription>{getEntityDescription()}</CardDescription>
          </div>
          {showActions && (
            <div className="flex gap-1">
              {onView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(entity)}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(entity)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(entity.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
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

