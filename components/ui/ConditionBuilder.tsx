"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Input } from './input'
import { Label } from './label'
import { EntitySelector } from './EntitySelector'
import { AttributeSelector } from './AttributeSelector'
import { OperatorSelector } from './OperatorSelector'
import { ValueInput } from './ValueInput'
import { 
  Condition, 
  AssetCondition, 
  PlayerCondition, 
  SceneChoiceCondition, 
  StoryPointCondition,
  Character as Asset,
  User
} from '@/lib/unified-entities'
import { 
  AttributeParser,
  ConditionValidator,
  ConditionUtils
} from '@/lib/condition-utils'

interface ConditionBuilderProps {
  condition: Condition
  onConditionChange: (condition: Condition) => void
  assets?: Asset[]
  users?: User[]
  className?: string
}

export function ConditionBuilder({
  condition,
  onConditionChange,
  assets = [],
  users = [],
  className
}: ConditionBuilderProps) {
  const [conditionType, setConditionType] = useState<Condition['type']>(condition.type)
  const [entityId, setEntityId] = useState<string>("")
  const [attribute, setAttribute] = useState<string>("")
  const [operator, setOperator] = useState<string>("=")
  const [value, setValue] = useState<any>(null)
  const [attributeType, setAttributeType] = useState<"numeric" | "string" | "boolean" | "array">("string")

  useEffect(() => {
    // Инициализация из существующего условия
    if (condition.type === "asset_condition") {
      setEntityId(condition.target.entityId)
      setAttribute(condition.target.attribute)
      setOperator(condition.target.operator)
      setValue(condition.target.value)
    } else if (condition.type === "player_condition") {
      setAttribute(condition.target.attribute)
      setOperator(condition.target.operator)
      setValue(condition.target.value)
    }
  }, [condition])

  useEffect(() => {
    // Обновление типа атрибута при изменении атрибута
    if (attribute) {
      setAttributeType(AttributeParser.getAttributeType(attribute))
    }
  }, [attribute])

  const handleConditionTypeChange = (newType: Condition['type']) => {
    setConditionType(newType)
    
    // Сброс значений при смене типа
    setEntityId("")
    setAttribute("")
    setOperator("=")
    setValue(null)
    
    // Создание нового условия
    const newCondition = createEmptyCondition(newType)
    onConditionChange(newCondition)
  }

  const createEmptyCondition = (type: Condition['type']): Condition => {
    const baseCondition = {
      id: ConditionUtils.generateConditionId(),
      name: "",
      description: ""
    }

    switch (type) {
      case "asset_condition":
        return {
          ...baseCondition,
          type: "asset_condition",
          target: {
            entityId: "any",
            attribute: "strength",
            operator: "=",
            value: 0
          }
        } as AssetCondition

      case "player_condition":
        return {
          ...baseCondition,
          type: "player_condition",
          target: {
            attribute: "balance",
            operator: "=",
            value: 0
          }
        } as PlayerCondition

      case "scene_choice_condition":
        return {
          ...baseCondition,
          type: "scene_choice_condition",
          target: {
            sceneId: "",
            choiceId: "",
            status: "completed"
          }
        } as SceneChoiceCondition

      case "story_point_condition":
        return {
          ...baseCondition,
          type: "story_point_condition",
          target: {
            pointId: "",
            operator: "=",
            value: 0
          }
        } as StoryPointCondition

      default:
        return {
          ...baseCondition,
          type: "asset_condition",
          target: {
            entityId: "any",
            attribute: "strength",
            operator: "=",
            value: 0
          }
        } as AssetCondition
    }
  }

  const updateCondition = () => {
    const updatedCondition = {
      ...condition,
      type: conditionType
    }

    switch (conditionType) {
      case "asset_condition":
        (updatedCondition as AssetCondition).target = {
          entityId,
          attribute,
          operator,
          value
        }
        break

      case "player_condition":
        (updatedCondition as PlayerCondition).target = {
          attribute,
          operator,
          value
        }
        break

      case "scene_choice_condition":
        (updatedCondition as SceneChoiceCondition).target = {
          sceneId: entityId,
          choiceId: attribute,
          status: value
        }
        break

      case "story_point_condition":
        (updatedCondition as StoryPointCondition).target = {
          pointId: entityId,
          operator,
          value
        }
        break
    }

    onConditionChange(updatedCondition)
  }

  useEffect(() => {
    updateCondition()
  }, [entityId, attribute, operator, value])

  const renderConditionFields = () => {
    switch (conditionType) {
      case "asset_condition":
        return (
          <div className="space-y-4">
            <div>
              <Label>Актив</Label>
              <EntitySelector
                entityType="asset"
                value={entityId}
                onChange={setEntityId}
                includeSpecial={true}
                assets={assets}
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Атрибут</Label>
              <AttributeSelector
                entityType="asset"
                entityId={entityId}
                value={attribute}
                onChange={setAttribute}
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Оператор</Label>
              <OperatorSelector
                attributeType={attributeType}
                value={operator as any}
                onChange={setOperator}
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Значение</Label>
              <ValueInput
                attributeType={attributeType}
                operator={operator}
                value={value}
                onChange={setValue}
                className="w-full"
              />
            </div>
          </div>
        )

      case "player_condition":
        return (
          <div className="space-y-4">
            <div>
              <Label>Атрибут игрока</Label>
              <AttributeSelector
                entityType="player"
                entityId=""
                value={attribute}
                onChange={setAttribute}
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Оператор</Label>
              <OperatorSelector
                attributeType={attributeType}
                value={operator as any}
                onChange={setOperator}
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Значение</Label>
              <ValueInput
                attributeType={attributeType}
                operator={operator}
                value={value}
                onChange={setValue}
                className="w-full"
              />
            </div>
          </div>
        )

      case "scene_choice_condition":
        return (
          <div className="space-y-4">
            <div>
              <Label>ID сцены</Label>
              <Input
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="Введите ID сцены"
                className="w-full"
              />
            </div>
            
            <div>
              <Label>ID выбора</Label>
              <Input
                value={attribute}
                onChange={(e) => setAttribute(e.target.value)}
                placeholder="Введите ID выбора"
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Статус</Label>
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Завершен</SelectItem>
                  <SelectItem value="not_completed">Не завершен</SelectItem>
                  <SelectItem value="selected">Выбран</SelectItem>
                  <SelectItem value="not_selected">Не выбран</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "story_point_condition":
        return (
          <div className="space-y-4">
            <div>
              <Label>ID сюжетной точки</Label>
              <Input
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="Введите ID сюжетной точки"
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Оператор</Label>
              <OperatorSelector
                attributeType="numeric"
                value={operator as any}
                onChange={setOperator}
                className="w-full"
              />
            </div>
            
            <div>
              <Label>Значение</Label>
              <ValueInput
                attributeType="numeric"
                operator={operator}
                value={value}
                onChange={setValue}
                className="w-full"
              />
            </div>
          </div>
        )

      default:
        return <div>Неизвестный тип условия</div>
    }
  }

  const isValid = ConditionValidator.validateCondition(condition)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Построитель условий</span>
          <div className="flex items-center space-x-2">
            <span className={`text-sm px-2 py-1 rounded ${
              isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isValid ? 'Валидно' : 'Невалидно'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Тип условия</Label>
          <Select value={conditionType} onValueChange={handleConditionTypeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите тип условия" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asset_condition">Условие на актив</SelectItem>
              <SelectItem value="player_condition">Условие на игрока</SelectItem>
              <SelectItem value="scene_choice_condition">Условие на выбор в сцене</SelectItem>
              <SelectItem value="story_point_condition">Условие на сюжетную точку</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {renderConditionFields()}

        {isValid && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              <strong>Описание:</strong> {ConditionUtils.getConditionDescription(condition)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
