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

  const updatePrompts = (updates: any) => {
    onUpdate({
      ...character,
      prompts: { ...prompts, ...updates }
    })
  }

  const updateBasePrompt = (value: string) => {
    updatePrompts({ base: value })
  }

  const updateCharacteristicInterpretation = (category: string, stat: string, value: string) => {
    const updated = {
      ...prompts.characteristicInterpretations,
      [category]: {
        ...prompts.characteristicInterpretations[category],
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
      situational: [...prompts.situational, newPrompt]
    })
  }

  const updateSituationalPrompt = (id: string, updates: any) => {
    const updated = prompts.situational.map((p: any) => 
      p.id === id ? { ...p, ...updates } : p
    )
    updatePrompts({ situational: updated })
  }

  const removeSituationalPrompt = (id: string) => {
    const updated = prompts.situational.filter((p: any) => p.id !== id)
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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="base">Базовый промт</TabsTrigger>
          <TabsTrigger value="interpretations">Интерпретации</TabsTrigger>
          <TabsTrigger value="situational">Ситуативные</TabsTrigger>
        </TabsList>

        {/* Базовый промт */}
        <TabsContent value="base" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Базовый промт персонажа</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prompts.base}
                onChange={(e) => updateBasePrompt(e.target.value)}
                placeholder="Опишите базовый характер, стиль общения и поведение персонажа..."
                rows={10}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Интерпретации характеристик */}
        <TabsContent value="interpretations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Интерпретации характеристик</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(characteristicCategories).map(([category, stats]) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-lg font-semibold">{categoryLabels[category as keyof typeof categoryLabels]}</h3>
                  <div className="grid gap-4">
                    {stats.map((stat) => (
                      <div key={stat} className="space-y-2">
                        <Label>{stat}</Label>
                        <Textarea
                          value={prompts.characteristicInterpretations[category]?.[stat] || ''}
                          onChange={(e) => updateCharacteristicInterpretation(category, stat, e.target.value)}
                          placeholder={`Опишите, как ${stat.toLowerCase()} влияет на поведение персонажа...`}
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ситуативные промты */}
        <TabsContent value="situational" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ситуативные промты</CardTitle>
              <Button onClick={addSituationalPrompt} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Добавить промт
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {prompts.situational.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет ситуативных промтов. Добавьте первый промт для настройки поведения в различных ситуациях.
                </div>
              ) : (
                prompts.situational.map((prompt: any) => (
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
                        <Label>Описание условий</Label>
                        <Textarea
                          value={prompt.description}
                          onChange={(e) => updateSituationalPrompt(prompt.id, { description: e.target.value })}
                          placeholder="Опишите, когда этот промт должен активироваться..."
                          rows={2}
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
