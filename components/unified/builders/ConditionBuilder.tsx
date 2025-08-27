"use client"

import React, { useState, useMemo } from 'react'
import { UnifiedBuilder } from './UnifiedBuilder'
import { ConditionBuilderProps, BuilderField, SelectorOption } from '../types'
import { AttributeSelector } from '../selectors/AttributeSelector'
import { EntitySelector } from '../selectors/EntitySelector'
import { OperatorSelector } from '../selectors/OperatorSelector'
import { ValueInput } from '../inputs/ValueInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Plus, 
  Trash2, 
  Settings, 
  Target, 
  Users, 
  Code,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

export function ConditionBuilder({
  condition,
  onConditionChange,
  assets = [],
  users = [],
  className,
  disabled = false,
  loading = false,
  error,
  ...props
}: ConditionBuilderProps) {
  const [activeTab, setActiveTab] = useState<'simple' | 'advanced'>('simple')

  // Генерация полей для построителя условий
  const fields = useMemo((): BuilderField[] => [
    {
      id: 'condition_type',
      name: 'type',
      type: 'select',
      label: 'Тип условия',
      description: 'Выберите тип условия для проверки',
      required: true,
      options: [
        { value: 'asset', label: 'Условие актива' },
        { value: 'player', label: 'Условие игрока' },
        { value: 'scene_choice', label: 'Условие выбора сцены' },
        { value: 'story_point', label: 'Условие точки истории' },
        { value: 'compound', label: 'Составное условие' }
      ]
    },
    {
      id: 'condition_name',
      name: 'name',
      type: 'text',
      label: 'Название условия',
      description: 'Уникальное название для идентификации условия',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9_]+$',
        custom: (value) => value.length >= 3
      }
    },
    {
      id: 'condition_description',
      name: 'description',
      type: 'textarea',
      label: 'Описание',
      description: 'Подробное описание условия и его назначения',
      required: false
    },
    {
      id: 'condition_priority',
      name: 'priority',
      type: 'number',
      label: 'Приоритет',
      description: 'Приоритет выполнения условия (чем выше, тем раньше)',
      required: false,
      validation: {
        min: 1,
        max: 100
      }
    },
    {
      id: 'condition_tags',
      name: 'tags',
      type: 'array',
      label: 'Теги',
      description: 'Теги для категоризации и поиска условий',
      required: false
    }
  ], [])

  // Обработка изменения данных
  const handleDataChange = (data: Record<string, any>) => {
    onConditionChange({
      ...condition,
      ...data
    })
  }

  // Обработка изменения атрибута
  const handleAttributeChange = (attribute: string) => {
    onConditionChange({
      ...condition,
      attribute
    })
  }

  // Обработка изменения оператора
  const handleOperatorChange = (operator: string) => {
    onConditionChange({
      ...condition,
      operator
    })
  }

  // Обработка изменения значения
  const handleValueChange = (value: any) => {
    onConditionChange({
      ...condition,
      value
    })
  }

  // Обработка изменения сущности
  const handleEntityChange = (entityId: string) => {
    onConditionChange({
      ...condition,
      entityId
    })
  }

  // Получение типа атрибута для операторов
  const getAttributeType = () => {
    if (!condition.attribute) return 'string'
    
    // Определяем тип атрибута на основе его названия
    const numericAttributes = ['strength', 'empathy', 'intelligence', 'temperament', 'grit', 'ego', 'loyalty', 'obedience', 'resistance', 'health', 'mental_state', 'stress', 'fatigue', 'rank', 'price', 'balance', 'assets_count', 'equipment_count']
    const booleanAttributes = ['has_equipment', 'scene_completed', 'choice_made']
    const arrayAttributes = ['traits', 'work_type', 'environment', 'avoid', 'tags']
    
    if (numericAttributes.includes(condition.attribute)) return 'numeric'
    if (booleanAttributes.includes(condition.attribute)) return 'boolean'
    if (arrayAttributes.includes(condition.attribute)) return 'array'
    
    return 'string'
  }

  // Рендер простого режима
  const renderSimpleMode = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Тип сущности */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Тип сущности</label>
          <select
            title="Выберите тип сущности для условия"
            value={condition.entityType || 'asset'}
            onChange={(e) => onConditionChange({ ...condition, entityType: e.target.value })}
            disabled={disabled}
            className="w-full p-2 border rounded"
          >
            <option value="asset">Актив</option>
            <option value="player">Игрок</option>
            <option value="scene">Сцена</option>
          </select>
        </div>

        {/* Атрибут */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Атрибут</label>
          <AttributeSelector
            entityType={condition.entityType || 'asset'}
            value={condition.attribute || ''}
            onChange={handleAttributeChange}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Оператор */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Оператор</label>
          <OperatorSelector
            valueType={getAttributeType()}
            value={condition.operator || ''}
            onChange={handleOperatorChange}
            disabled={disabled}
          />
        </div>

        {/* Значение */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Значение</label>
          <ValueInput
            attributeType={getAttributeType()}
            operator={condition.operator || ''}
            value={condition.value || ''}
            onChange={handleValueChange}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Сущность (если нужно) */}
      {condition.entityType === 'asset' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Выберите актив</label>
          <EntitySelector
            entityType="asset"
            value={condition.entityId || ''}
            onChange={handleEntityChange}
            disabled={disabled}
            options={assets.map(asset => ({
              value: asset.id,
              label: asset.name || asset.id,
              description: `Ранг: ${asset.rank}, Специализация: ${asset.specialization}`
            }))}
          />
        </div>
      )}
    </div>
  )

  // Рендер расширенного режима
  const renderAdvancedMode = () => (
    <UnifiedBuilder
      fields={fields}
      data={condition}
      onDataChange={handleDataChange}
      title="Расширенные настройки условия"
      subtitle="Дополнительные параметры и метаданные"
      showPreview={true}
      showCode={true}
      showValidation={true}
      disabled={disabled}
      loading={loading}
      error={error}
      onSave={(data) => {
        console.log('Сохранение условия:', data)
        // Здесь можно добавить логику сохранения
      }}
    />
  )

  // Рендер предварительного просмотра
  const renderPreview = () => (
    <Card className="bg-gray-50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Предварительный просмотр условия</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{condition.entityType || 'asset'}</Badge>
            <span className="text-sm text-gray-600">→</span>
            <Badge variant="secondary">{condition.attribute || 'не выбран'}</Badge>
            <span className="text-sm text-gray-600">→</span>
            <Badge variant="outline">{condition.operator || 'не выбран'}</Badge>
            <span className="text-sm text-gray-600">→</span>
            <Badge variant="secondary">{condition.value || 'не указано'}</Badge>
          </div>
          
          {condition.entityId && (
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Сущность: {condition.entityId}</span>
            </div>
          )}
          
          <Separator />
          
          <div className="text-sm">
            <div className="font-medium mb-2">JSON представление:</div>
            <pre className="bg-white p-3 rounded border text-xs overflow-auto">
              {JSON.stringify(condition, null, 2)}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-xl font-semibold">Построитель условий</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={activeTab === 'simple' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('simple')}
            disabled={disabled}
          >
            Простой режим
          </Button>
          <Button
            variant={activeTab === 'advanced' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('advanced')}
            disabled={disabled}
          >
            Расширенный режим
          </Button>
        </div>
      </div>

      {/* Основной контент */}
      {activeTab === 'simple' ? renderSimpleMode() : renderAdvancedMode()}

      {/* Предварительный просмотр */}
      {activeTab === 'simple' && (
        <div className="mt-6">
          {renderPreview()}
        </div>
      )}

      {/* Информация о валидации */}
      {condition.attribute && condition.operator && condition.value && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-800">
              Условие настроено корректно и готово к использованию
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConditionBuilder
