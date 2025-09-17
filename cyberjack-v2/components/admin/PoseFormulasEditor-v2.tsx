"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SimpleFormulaBuilder } from './formulas/SimpleFormulaBuilder'
import { PoseFormulas, PoseCondition, PoseEffect, PoseModifier, PoseFormulaTemplate } from '@/types/pose-formulas'

interface PoseFormulasEditorProps {
  poseId: string
  poseName: string
  initialFormulas?: PoseFormulas
  onSave?: (formulas: PoseFormulas) => void
  onCancel?: () => void
}

export function PoseFormulasEditor({
  poseId,
  poseName,
  initialFormulas,
  onSave,
  onCancel
}: PoseFormulasEditorProps) {
  const [formulas, setFormulas] = useState<PoseFormulas>(initialFormulas || {
    conditions: [],
    effects: [],
    modifiers: []
  })

  const [activeTab, setActiveTab] = useState<'conditions' | 'effects' | 'modifiers'>('conditions')
  const [editingItem, setEditingItem] = useState<{
    type: 'condition' | 'effect' | 'modifier'
    item: PoseCondition | PoseEffect | PoseModifier
    index: number
  } | null>(null)

  // Шаблоны формул для поз
  const poseTemplates: PoseFormulaTemplate[] = [
    // Условия
    {
      id: 'mood-condition',
      name: 'Условие по настроению',
      category: 'condition',
      description: 'Поза доступна только при определенном настроении',
      formula: 'character.mood >= 50',
      variables: [
        { name: 'character.mood', type: 'number', description: 'Текущее настроение персонажа', example: 75 }
      ],
      example: {
        context: { character: { id: 'char1', name: 'Character', characteristics: { mood: 75 }, anatomy: {}, currentPoses: [], timeInCurrentPose: 0 } },
        result: true
      }
    },
    {
      id: 'equipment-condition',
      name: 'Условие по оборудованию',
      category: 'condition',
      description: 'Поза требует наличия определенного оборудования',
      formula: 'user.equipment.rope >= 1',
      variables: [
        { name: 'user.equipment.rope', type: 'number', description: 'Количество веревки у пользователя', example: 2 }
      ],
      example: {
        context: { user: { id: 'user1', name: 'User', modifiers: {}, credits: 1000, equipment: { rope: 2 } } },
        result: true
      }
    },
    // Эффекты
    {
      id: 'mood-effect',
      name: 'Эффект на настроение',
      category: 'effect',
      description: 'Увеличивает настроение каждую минуту',
      formula: 'character.mood + 2',
      variables: [
        { name: 'character.mood', type: 'number', description: 'Текущее настроение', example: 50 }
      ],
      example: {
        context: { character: { id: 'char1', name: 'Character', characteristics: { mood: 50 }, anatomy: {}, currentPoses: [], timeInCurrentPose: 0 } },
        result: 52
      }
    },
    {
      id: 'energy-effect',
      name: 'Эффект на энергию',
      category: 'effect',
      description: 'Восстанавливает энергию с учетом времени в позе',
      formula: 'min(100, character.energy + (pose.duration * 0.5))',
      variables: [
        { name: 'character.energy', type: 'number', description: 'Текущая энергия', example: 60 },
        { name: 'pose.duration', type: 'number', description: 'Время в позе (минуты)', example: 10 }
      ],
      example: {
        context: { character: { id: 'char1', name: 'Character', characteristics: { energy: 60 }, anatomy: {}, currentPoses: [], timeInCurrentPose: 0 }, pose: { id: 'pose1', name: 'Pose', category: 'test', duration: 10, isActive: true } },
        result: 65
      }
    },
    // Модификаторы
    {
      id: 'intensity-modifier',
      name: 'Модификатор интенсивности',
      category: 'modifier',
      description: 'Увеличивает интенсивность действий в этой позе',
      formula: 'action.intensity * 1.5',
      variables: [
        { name: 'action.intensity', type: 'number', description: 'Базовая интенсивность действия', example: 50 }
      ],
      example: {
        context: { action: { id: 'action1', name: 'Action', category: 'test', intensity: 50, duration: 10, isActive: true } },
        result: 75
      }
    },
    {
      id: 'cost-modifier',
      name: 'Модификатор стоимости',
      category: 'modifier',
      description: 'Уменьшает стоимость действий в этой позе',
      formula: 'action.cost * 0.8',
      variables: [
        { name: 'action.cost', type: 'number', description: 'Базовая стоимость действия', example: 100 }
      ],
      example: {
        context: { action: { cost: 100 } },
        result: 80
      }
    }
  ]

  const addCondition = () => {
    const newCondition: PoseCondition = {
      id: `condition_${Date.now()}`,
      type: 'characteristic',
      target: 'character.mood',
      operator: 'gte',
      value: 50,
      description: 'Новое условие'
    }
    setFormulas(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }))
  }

  const addEffect = () => {
    const newEffect: PoseEffect = {
      id: `effect_${Date.now()}`,
      type: 'characteristic',
      target: 'character.mood',
      formula: 'character.mood + 1',
      frequency: 'per_minute',
      description: 'Новый эффект'
    }
    setFormulas(prev => ({
      ...prev,
      effects: [...prev.effects, newEffect]
    }))
  }

  const addModifier = () => {
    const newModifier: PoseModifier = {
      id: `modifier_${Date.now()}`,
      type: 'intensity',
      target: 'all',
      formula: 'action.intensity * 1.2',
      description: 'Новый модификатор'
    }
    setFormulas(prev => ({
      ...prev,
      modifiers: [...prev.modifiers, newModifier]
    }))
  }

  const editItem = (type: 'condition' | 'effect' | 'modifier', item: PoseCondition | PoseEffect | PoseModifier, index: number) => {
    setEditingItem({ type, item, index })
  }

  const deleteItem = (type: 'condition' | 'effect' | 'modifier', index: number) => {
    setFormulas(prev => ({
      ...prev,
      [type === 'condition' ? 'conditions' : type === 'effect' ? 'effects' : 'modifiers']:
        prev[type === 'condition' ? 'conditions' : type === 'effect' ? 'effects' : 'modifiers'].filter((_, i) => i !== index)
    }))
  }

  const updateItem = (type: 'condition' | 'effect' | 'modifier', index: number, updatedItem: PoseCondition | PoseEffect | PoseModifier) => {
    setFormulas(prev => ({
      ...prev,
      [type === 'condition' ? 'conditions' : type === 'effect' ? 'effects' : 'modifiers']:
        prev[type === 'condition' ? 'conditions' : type === 'effect' ? 'effects' : 'modifiers'].map((item, i) =>
          i === index ? updatedItem : item
        )
    }))
    setEditingItem(null)
  }

  const applyTemplate = (template: PoseFormulaTemplate) => {
    if (template.category === 'condition') {
      const newCondition: PoseCondition = {
        id: `condition_${Date.now()}`,
        type: 'custom',
        target: 'custom',
        operator: 'eq',
        value: template.formula,
        description: template.description
      }
      setFormulas(prev => ({
        ...prev,
        conditions: [...prev.conditions, newCondition]
      }))
    } else if (template.category === 'effect') {
      const newEffect: PoseEffect = {
        id: `effect_${Date.now()}`,
        type: 'custom',
        target: 'custom',
        formula: template.formula,
        frequency: 'per_minute',
        description: template.description
      }
      setFormulas(prev => ({
        ...prev,
        effects: [...prev.effects, newEffect]
      }))
    } else if (template.category === 'modifier') {
      const newModifier: PoseModifier = {
        id: `modifier_${Date.now()}`,
        type: 'effect',
        target: 'all',
        formula: template.formula,
        description: template.description
      }
      setFormulas(prev => ({
        ...prev,
        modifiers: [...prev.modifiers, newModifier]
      }))
    }
  }

  const handleSave = () => {
    if (onSave) {
      onSave(formulas)
    }
  }

  const renderConditions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Условия активации позы</h3>
        <Button onClick={addCondition} size="sm">
          Добавить условие
        </Button>
      </div>

      {formulas.conditions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Условия не заданы</p>
          <p className="text-sm mt-2">Поза будет доступна всегда</p>
        </div>
      ) : (
        <div className="space-y-3">
          {formulas.conditions.map((condition, index) => (
            <div key={condition.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{condition.description || 'Условие'}</span>
                    <span className="text-sm text-gray-500">({condition.type})</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      {condition.target} {condition.operator} {condition.value}
                    </code>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editItem('condition', condition, index)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteItem('condition', index)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderEffects = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Эффекты позы</h3>
        <Button onClick={addEffect} size="sm">
          Добавить эффект
        </Button>
      </div>

      {formulas.effects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Эффекты не заданы</p>
          <p className="text-sm mt-2">Поза не будет влиять на характеристики</p>
        </div>
      ) : (
        <div className="space-y-3">
          {formulas.effects.map((effect, index) => (
            <div key={effect.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{effect.description || 'Эффект'}</span>
                    <span className="text-sm text-gray-500">({effect.frequency})</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      {effect.formula}
                    </code>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Цель: {effect.target}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editItem('effect', effect, index)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteItem('effect', index)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderModifiers = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Модификаторы действий</h3>
        <Button onClick={addModifier} size="sm">
          Добавить модификатор
        </Button>
      </div>

      {formulas.modifiers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Модификаторы не заданы</p>
          <p className="text-sm mt-2">Поза не будет влиять на действия</p>
        </div>
      ) : (
        <div className="space-y-3">
          {formulas.modifiers.map((modifier, index) => (
            <div key={modifier.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{modifier.description || 'Модификатор'}</span>
                    <span className="text-sm text-gray-500">({modifier.type})</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      {modifier.formula}
                    </code>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Цель: {modifier.target}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editItem('modifier', modifier, index)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteItem('modifier', index)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderTemplates = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Готовые шаблоны</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {poseTemplates.map((template) => (
          <div
            key={template.id}
            className="p-3 border rounded-lg cursor-pointer hover:border-blue-300 transition-colors"
            onClick={() => applyTemplate(template)}
          >
            <h4 className="font-medium text-sm">{template.name}</h4>
            <p className="text-xs text-gray-600 mt-1">{template.description}</p>
            <div className="text-xs font-mono bg-gray-100 p-1 rounded mt-2">
              {template.formula}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Заголовок */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Редактор формул позы</h2>
            <p className="text-gray-600">{poseName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>

        {/* Основной контент */}
        <div className="flex-1 flex overflow-hidden">
          {/* Левая панель - редактор */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Вкладки */}
            <div className="flex gap-1 mb-6">
              <Button
                variant={activeTab === 'conditions' ? 'default' : 'outline'}
                onClick={() => setActiveTab('conditions')}
                size="sm"
              >
                Условия ({formulas.conditions.length})
              </Button>
              <Button
                variant={activeTab === 'effects' ? 'default' : 'outline'}
                onClick={() => setActiveTab('effects')}
                size="sm"
              >
                Эффекты ({formulas.effects.length})
              </Button>
              <Button
                variant={activeTab === 'modifiers' ? 'default' : 'outline'}
                onClick={() => setActiveTab('modifiers')}
                size="sm"
              >
                Модификаторы ({formulas.modifiers.length})
              </Button>
            </div>

            {/* Контент вкладок */}
            {activeTab === 'conditions' && renderConditions()}
            {activeTab === 'effects' && renderEffects()}
            {activeTab === 'modifiers' && renderModifiers()}
          </div>

          {/* Правая панель - шаблоны */}
          <div className="w-80 border-l bg-gray-50 p-6 overflow-y-auto">
            {renderTemplates()}
          </div>
        </div>

        {/* Модальное окно редактирования */}
        {editingItem && (
          <SimpleFormulaBuilder
            initialFormula={editingItem.item.formula || ''}
            onSave={(formula) => {
              const updatedItem = { ...editingItem.item, formula }
              updateItem(editingItem.type, editingItem.index, updatedItem)
            }}
            onCancel={() => setEditingItem(null)}
          />
        )}
      </div>
    </div>
  )
}
