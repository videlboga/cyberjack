import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Settings } from 'lucide-react'

interface PromptManagerProps {
  character: any
  onUpdate: (updates: any) => void
}

export function PromptManager({ character, onUpdate }: PromptManagerProps) {
  const [activeTab, setActiveTab] = useState('base')



  // Получаем текущие промты или создаем по умолчанию
  const prompts = character.prompts || {
    base: character.basePrompt || '',
    characteristicInterpretations: {
      physical: {},
      psychological: {},
      social: {},
      personality: {},
      special: {}
    },
    situational: []
  }

  // Гарантируем, что characteristicInterpretations существует и имеет все категории
  const safeCharacteristicInterpretations = {
    physical: {},
    psychological: {},
    social: {},
    personality: {},
    special: {},
    ...(prompts.characteristicInterpretations || {})
  }

  // Обновляем prompts с безопасными свойствами
  const safePrompts = {
    ...prompts,
    base: prompts.base || character.basePrompt || '',
    characteristicInterpretations: safeCharacteristicInterpretations,
    situational: prompts.situational || []
  }



  const updatePrompts = (updates: any) => {
    onUpdate({
      ...character,
      prompts: { ...safePrompts, ...updates }
    })
  }

  const updateBasePrompt = (value: string) => {
    updatePrompts({ base: value })
  }

  const updateCharacteristicInterpretation = (category: string, stat: string, value: string) => {
    const updated = {
      ...safePrompts.characteristicInterpretations,
      [category]: {
        ...safePrompts.characteristicInterpretations[category],
        [stat]: value
      }
    }
    updatePrompts({ characteristicInterpretations: updated })
  }

  const addSituationalPrompt = () => {
    const newPrompt = {
      id: `situational_${Date.now()}`,
      name: 'Новый ситуативный промт',
      description: 'Описание условий активации',
      conditions: [],
      prompt: 'Текст промта',
      priority: 5,
      isActive: true
    }
    
    updatePrompts({
      situational: [...safePrompts.situational, newPrompt]
    })
  }

  const updateSituationalPrompt = (id: string, updates: any) => {
    const updated = safePrompts.situational.map((p: any) =>
      p.id === id ? { ...p, ...updates } : p
    )
    updatePrompts({ situational: updated })
  }

  const removeSituationalPrompt = (id: string) => {
    const updated = safePrompts.situational.filter((p: any) => p.id !== id)
    updatePrompts({ situational: updated })
  }

  const addConditionToPrompt = (promptId: string, condition: any) => {
    const updated = safePrompts.situational.map((p: any) =>
      p.id === promptId
        ? { ...p, conditions: [...(p.conditions || []), condition] }
        : p
    )
    updatePrompts({ situational: updated })
  }

  const removeConditionFromPrompt = (promptId: string, conditionIndex: number) => {
    const updated = safePrompts.situational.map((p: any) =>
      p.id === promptId
        ? { ...p, conditions: p.conditions.filter((_: any, i: number) => i !== conditionIndex) }
        : p
    )
    updatePrompts({ situational: updated })
  }

  const updateConditionInPrompt = (promptId: string, conditionIndex: number, updates: any) => {
    const updated = safePrompts.situational.map((p: any) =>
      p.id === promptId
        ? {
            ...p,
            conditions: p.conditions.map((c: any, i: number) =>
              i === conditionIndex ? { ...c, ...updates } : c
            )
          }
        : p
    )
    updatePrompts({ situational: updated })
  }

  // Характеристики по категориям - используем реальные названия из базы данных
  const characteristicCategories = {
    physical: ['Выносливость', 'Чувствительность', 'Гибкость'],
    psychological: ['Эмоциональная стабильность', 'Адаптивность', 'Интеллект'],
    social: ['Общительность', 'Эмпатия', 'Доминантность'],
    personality: ['Самооценка', 'Оптимизм', 'Любопытство'],
    special: ['Сексуальная опытность', 'Сопротивляемость', 'Зависимость', 'Чувствительность к фетишам', 'Готовность открывать фетиши']
  }

  const categoryLabels = {
    physical: 'Физические',
    psychological: 'Психологические',
    social: 'Социальные',
    personality: 'Личностные',
    special: 'Специальные'
  }

  // Убираем statLabels, так как используем реальные названия

  // Компонент для редактирования условий
  const ConditionEditor = ({ prompt, promptId }: { prompt: any, promptId: string }) => {
    const [showConditionForm, setShowConditionForm] = useState(false)
    const [newCondition, setNewCondition] = useState({
      type: 'parameter_combination',
      stat: 'social.Доминантность',
      operator: 'gte',
      value: 5,
      emotionalState: [] as string[]
    })

    const availableStats = [
      // Физические характеристики
      { key: 'physical.Выносливость', label: 'Выносливость' },
      { key: 'physical.Чувствительность', label: 'Чувствительность' },
      { key: 'physical.Гибкость', label: 'Гибкость' },

      // Психологические характеристики
      { key: 'psychological.Эмоциональная стабильность', label: 'Эмоциональная стабильность' },
      { key: 'psychological.Адаптивность', label: 'Адаптивность' },
      { key: 'psychological.Интеллект', label: 'Интеллект' },

      // Социальные характеристики
      { key: 'social.Общительность', label: 'Общительность' },
      { key: 'social.Эмпатия', label: 'Эмпатия' },
      { key: 'social.Доминантность', label: 'Доминантность' },

      // Личностные характеристики
      { key: 'personality.Самооценка', label: 'Самооценка' },
      { key: 'personality.Оптимизм', label: 'Оптимизм' },
      { key: 'personality.Любопытство', label: 'Любопытство' },

      // Специальные характеристики
      { key: 'special.Сексуальная опытность', label: 'Сексуальная опытность' },
      { key: 'special.Сопротивляемость', label: 'Сопротивляемость' },
      { key: 'special.Зависимость', label: 'Зависимость' },
      { key: 'special.Чувствительность к фетишам', label: 'Чувствительность к фетишам' },
      { key: 'special.Готовность открывать фетиши', label: 'Готовность открывать фетиши' }
    ]

    const operators = [
      { key: 'eq', label: '=' },
      { key: 'gt', label: '>' },
      { key: 'lt', label: '<' },
      { key: 'gte', label: '>=' },
      { key: 'lte', label: '<=' },
      { key: 'between', label: 'между' }
    ]

    const emotionalStates = [
      'возбужденный', 'спокойный', 'напряженный', 'испуганный',
      'страдающий', 'удовлетворенный', 'подчиненный', 'доминирующий'
    ]

    const addCondition = () => {
      const condition = {
        type: newCondition.type,
        parameters: [{
          stat: newCondition.stat,
          operator: newCondition.operator,
          value: newCondition.operator === 'between' ? [newCondition.value, newCondition.value + 2] : newCondition.value
        }],
        emotionalState: newCondition.emotionalState
      }
      addConditionToPrompt(promptId, condition)
      setNewCondition({
        type: 'parameter_combination',
        stat: 'social.Доминантность',
        operator: 'gte',
        value: 5,
        emotionalState: []
      })
      setShowConditionForm(false)
    }

    return (
      <div className="space-y-4">
        {/* Существующие условия */}
        {prompt.conditions && prompt.conditions.map((condition: any, index: number) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Badge variant="outline">{condition.type}</Badge>
                  {condition.parameters && condition.parameters.map((param: any, paramIndex: number) => (
                    <div key={paramIndex} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {availableStats.find(s => s.key === param.stat)?.label || param.stat}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {operators.find(o => o.key === param.operator)?.label || param.operator}
                        </Badge>
                        <Badge variant="default" className="text-xs">
                          {Array.isArray(param.value) ? `${param.value[0]}-${param.value[1]}` : param.value}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {condition.emotionalState && condition.emotionalState.length > 0 && (
                    <div className="text-sm">
                      <div className="text-muted-foreground mb-1">Эмоциональное состояние:</div>
                      <div className="flex flex-wrap gap-1">
                        {condition.emotionalState.map((state: string, stateIndex: number) => (
                          <Badge key={stateIndex} variant="outline" className="text-xs">
                            {state}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeConditionFromPrompt(promptId, index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Форма добавления нового условия */}
        {showConditionForm ? (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Новое условие</h4>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addCondition}>Добавить</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowConditionForm(false)}>Отмена</Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Характеристика</Label>
                    <Select value={newCondition.stat} onValueChange={(value) => setNewCondition({...newCondition, stat: value})}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Выберите характеристику" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStats.map(stat => (
                          <SelectItem key={stat.key} value={stat.key} className="text-sm">{stat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Оператор</Label>
                    <Select value={newCondition.operator} onValueChange={(value) => setNewCondition({...newCondition, operator: value})}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Выберите оператор" />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map(op => (
                          <SelectItem key={op.key} value={op.key} className="text-sm">{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Значение</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={newCondition.value}
                      onChange={(e) => setNewCondition({...newCondition, value: parseInt(e.target.value) || 0})}
                      placeholder="0-10"
                      className="text-sm"
                    />
                  </div>
                </div>


              </div>

              <div className="space-y-2">
                <Label>Эмоциональное состояние (опционально)</Label>
                <div className="flex flex-wrap gap-2">
                  {emotionalStates.map(state => (
                    <Badge
                      key={state}
                      variant={newCondition.emotionalState.includes(state) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const updated = newCondition.emotionalState.includes(state)
                          ? newCondition.emotionalState.filter(s => s !== state)
                          : [...newCondition.emotionalState, state]
                        setNewCondition({...newCondition, emotionalState: updated})
                      }}
                    >
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConditionForm(true)}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить условие
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="base">
            📝 Базовый промт
            {safePrompts.base && <Badge variant="secondary" className="ml-2 text-xs">✓</Badge>}
          </TabsTrigger>
          <TabsTrigger value="interpretations">
            🎭 Интерпретации
            {character.characteristics && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {Object.values(character.characteristics).reduce((total: number, cat: any) =>
                  total + (typeof cat === 'object' && cat ? Object.keys(cat).length : 0), 0
                )}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="situational">
            ⚡ Ситуативные
            <Badge variant="secondary" className="ml-2 text-xs">
              {safePrompts.situational.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Базовый промт */}
        <TabsContent value="base" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Базовый промт персонажа</CardTitle>
              <p className="text-sm text-muted-foreground">
                Основной промт, определяющий характер, стиль общения и базовое поведение персонажа
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={safePrompts.base}
                onChange={(e) => updateBasePrompt(e.target.value)}
                placeholder="Опишите базовый характер, стиль общения и поведение персонажа..."
                rows={10}
                className="text-sm"
              />

            </CardContent>
          </Card>
        </TabsContent>

        {/* Интерпретации характеристик */}
        <TabsContent value="interpretations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Интерпретации характеристик</CardTitle>
              <p className="text-sm text-muted-foreground">
                Настройте, как каждая характеристика персонажа влияет на его поведение и реакции
              </p>
              л            </CardHeader>
            <CardContent className="space-y-6">
              {character.characteristics ? (
                Object.entries(character.characteristics).map(([category, stats]) => {
                  // Проверяем, что stats является объектом с характеристиками
                  if (typeof stats !== 'object' || stats === null) return null;

                  const statEntries = Object.entries(stats as Record<string, number>);

                  if (statEntries.length === 0) return null;

                  return (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{categoryLabels[category as keyof typeof categoryLabels] || category}</h3>
                        <Badge variant="outline" className="text-xs">
                          {statEntries.length} характеристик
                        </Badge>
                      </div>
                      <div className="grid gap-4">
                        {statEntries.map(([statName, statValue]) => (
                          <div key={statName} className="space-y-2 p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <Label className="text-base font-medium">{statName}</Label>
                              <Badge variant="secondary" className="text-xs">
                                Значение: {statValue}/10
                              </Badge>
                            </div>

                            {/* Вариации для разных диапазонов */}
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-red-600 dark:text-red-400">
                                  🔴 Низкие значения (1-3)
                                </Label>
                                <Textarea
                                  value={safePrompts.characteristicInterpretations[category]?.[`${statName}_low`] || ''}
                                  onChange={(e) => updateCharacteristicInterpretation(category, `${statName}_low`, e.target.value)}
                                  placeholder={`Как "${statName}" влияет на поведение при низких значениях (1-3)...`}
                                  rows={2}
                                  className="text-sm border-red-200 dark:border-red-800"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                                  🟡 Средние значения (4-7)
                                </Label>
                                <Textarea
                                  value={safePrompts.characteristicInterpretations[category]?.[`${statName}_medium`] || ''}
                                  onChange={(e) => updateCharacteristicInterpretation(category, `${statName}_medium`, e.target.value)}
                                  placeholder={`Как "${statName}" влияет на поведение при средних значениях (4-7)...`}
                                  rows={2}
                                  className="text-sm border-yellow-200 dark:border-yellow-800"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-green-600 dark:text-green-400">
                                  🟢 Высокие значения (8-10)
                                </Label>
                                <Textarea
                                  value={safePrompts.characteristicInterpretations[category]?.[`${statName}_high`] || ''}
                                  onChange={(e) => updateCharacteristicInterpretation(category, `${statName}_high`, e.target.value)}
                                  placeholder={`Как "${statName}" влияет на поведение при высоких значениях (8-10)...`}
                                  rows={2}
                                  className="text-sm border-green-200 dark:border-green-800"
                                />
                              </div>
                            </div>


                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }).filter(Boolean)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>У персонажа нет характеристик для настройки интерпретаций</p>
                  <p className="text-sm mt-2">Характеристики должны быть определены в данных персонажа</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ситуативные промты */}
        <TabsContent value="situational" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Ситуативные промты</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Промты, которые активируются при определенных условиях и ситуациях
                </p>
              </div>
              <Button onClick={addSituationalPrompt} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Добавить промт
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {safePrompts.situational.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет ситуативных промтов. Добавьте первый промт для настройки поведения в различных ситуациях.
                </div>
              ) : (
                safePrompts.situational.map((prompt: any) => (
                  <Card key={prompt.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Input
                            value={prompt.name}
                            onChange={(e) => updateSituationalPrompt(prompt.id, { name: e.target.value })}
                            className="w-64"
                          />
                          <Badge variant={prompt.isActive ? "default" : "secondary"}>
                            {prompt.isActive ? "Активен" : "Неактивен"}
                          </Badge>
                          <Badge variant="outline">Приоритет: {prompt.priority}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            Условий: {(prompt.conditions || []).length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSituationalPrompt(prompt.id, { isActive: !prompt.isActive })}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSituationalPrompt(prompt.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Описание условий активации
                          <Badge variant="outline" className="text-xs">Для пользователя</Badge>
                        </Label>
                        <Textarea
                          value={prompt.description}
                          onChange={(e) => updateSituationalPrompt(prompt.id, { description: e.target.value })}
                          placeholder="Краткое описание ситуации активации промта (для понимания, что делает этот промт)..."
                          rows={2}
                          className="text-sm"
                        />

                      </div>
                      
                      <div className="space-y-2">
                        <Label>Приоритет</Label>
                        <Select
                          value={prompt.priority.toString()}
                          onValueChange={(value) => updateSituationalPrompt(prompt.id, { priority: parseInt(value) })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                              <SelectItem key={p} value={p.toString()}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Текст промта</Label>
                        <Textarea
                          value={prompt.prompt}
                          onChange={(e) => updateSituationalPrompt(prompt.id, { prompt: e.target.value })}
                          placeholder="Текст промта, который будет использоваться в данной ситуации..."
                          rows={4}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Условия активации</Label>
                        <ConditionEditor prompt={prompt} promptId={prompt.id} />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
