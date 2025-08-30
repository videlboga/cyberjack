"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Eye,
  Search,
  Zap,
  Settings,
  Target,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Save,
  Edit,
  RotateCcw
} from "lucide-react"

interface CharacterAnalysisPanelProps {
  character: any
  onUpdateCharacter: (updatedCharacter: any) => void
  onClose: () => void
}

// Компонент для редактирования характеристики
const CharacteristicEditor = ({
  title,
  characteristics,
  categoryKey,
  onUpdate
}: {
  title: string
  characteristics: Record<string, number>
  categoryKey: string
  onUpdate: (category: string, stat: string, value: number) => void
}) => {
  if (!characteristics || Object.keys(characteristics).length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
        <div className="text-sm text-muted-foreground text-center py-4">
          Характеристики не заданы
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
      <div className="space-y-3">
        {Object.entries(characteristics).map(([statName, value]) => (
          <div key={statName} className="space-y-2 p-3 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{statName}</Label>
              <Badge variant="secondary" className="text-xs">
                {value}/10
              </Badge>
            </div>
            <Slider
              value={[value]}
              onValueChange={(newValue) => onUpdate(categoryKey, statName, newValue[0])}
              max={10}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Компонент для редактирования состояний
const StatesEditor = ({
  states,
  onUpdate
}: {
  states: Record<string, number>
  onUpdate: (state: string, value: number) => void
}) => {
  if (!states || Object.keys(states).length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Состояния не заданы
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(states).map(([stateName, value]) => (
        <div key={stateName} className="space-y-2 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{stateName}</Label>
            <Badge variant="secondary" className="text-xs">
              {value}/100
            </Badge>
          </div>
          <Slider
            value={[value]}
            onValueChange={(newValue) => onUpdate(stateName, newValue[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>
      ))}
    </div>
  )
}

// Компонент для редактирования фетишей
const FetishesEditor = ({
  fetishes,
  onUpdate
}: {
  fetishes: Record<string, number>
  onUpdate: (fetish: string, value: number) => void
}) => {
  if (!fetishes || Object.keys(fetishes).length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Фетиши не заданы
      </div>
    )
  }

  const fetishNames: Record<string, string> = {
    innocence: 'Невинность',
    curiosity: 'Любопытство',
    tenderness: 'Нежность',
    trust: 'Доверие',
    submission: 'Подчинение',
    dominance: 'Доминирование',
    pain: 'Боль',
    pleasure: 'Удовольствие',
    bondage: 'Бондаж',
    discipline: 'Дисциплина',
    humiliation: 'Унижение',
    worship: 'Поклонение',
    control: 'Контроль',
    obedience: 'Послушание',
    shyness: 'Застенчивость',
    embarrassment: 'Смущение'
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(fetishes).map(([fetishKey, value]) => (
        <div key={fetishKey} className="space-y-2 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {fetishNames[fetishKey] || fetishKey}
            </Label>
            <Badge variant="secondary" className="text-xs">
              {value}/10
            </Badge>
          </div>
          <Slider
            value={[value]}
            onValueChange={(newValue) => onUpdate(fetishKey, newValue[0])}
            max={10}
            min={0}
            step={1}
            className="w-full"
          />
        </div>
      ))}
    </div>
  )
}

const AnalysisMethodCard = ({
  method,
  methodInfo,
  onSelect,
  disabled = false
}: {
  method: AnalysisMethod
  methodInfo: any
  onSelect: () => void
  disabled?: boolean
}) => {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <Card className={`${disabled ? 'opacity-50' : 'hover:bg-muted/50'} transition-all`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{methodInfo.name}</CardTitle>
          <Badge variant={methodInfo.risk === 'low' ? 'default' : 'destructive'}>
            {methodInfo.risk === 'low' ? '🟢' : methodInfo.risk === 'medium' ? '🟡' : '🔴'}
            {methodInfo.risk === 'low' ? 'Низкий' : methodInfo.risk === 'medium' ? 'Средний' : 'Высокий'}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {methodInfo.description || 'Метод анализа характеристик'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span>{methodInfo.cost} кр.</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>{methodInfo.time} мин.</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Точность: {(methodInfo.accuracy * 100).toFixed(0)}%
          </div>
          <Progress value={methodInfo.accuracy * 100} className="h-2" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium">Раскрывает:</div>
          <div className="flex flex-wrap gap-1">
            {methodInfo.reveals.map((category: string) => (
              <Badge key={category} variant="outline" className="text-xs">
                {category === 'physical' ? 'Физические' :
                 category === 'psychological' ? 'Психологические' :
                 category === 'social' ? 'Социальные' :
                 category === 'special' ? 'Специальные' :
                 category === 'all' ? 'Все' : category}
              </Badge>
            ))}
          </div>
        </div>

        <Button
          onClick={onSelect}
          disabled={disabled}
          className="w-full"
          variant={methodInfo.risk === 'high' ? 'destructive' : 'default'}
        >
          <Search className="h-4 w-4 mr-2" />
          Начать анализ
        </Button>
      </CardContent>
    </Card>
  )
}

export default function CharacterAnalysisPanel({
  character,
  onUpdateCharacter,
  onClose
}: CharacterAnalysisPanelProps) {
  const [editedCharacter, setEditedCharacter] = useState(character)
  const [hasChanges, setHasChanges] = useState(false)

  if (!character) return null

  // Обновление характеристики
  const updateCharacteristic = (category: string, stat: string, value: number) => {
    const updated = {
      ...editedCharacter,
      characteristics: {
        ...editedCharacter.characteristics,
        [category]: {
          ...editedCharacter.characteristics?.[category],
          [stat]: value
        }
      }
    }
    setEditedCharacter(updated)
    setHasChanges(true)
  }

  // Обновление состояния
  const updateState = (state: string, value: number) => {
    const updated = {
      ...editedCharacter,
      states: {
        ...editedCharacter.states,
        [state]: value
      }
    }
    setEditedCharacter(updated)
    setHasChanges(true)
  }

  // Обновление фетиша
  const updateFetish = (fetish: string, value: number) => {
    const updated = {
      ...editedCharacter,
      fetishes: {
        ...editedCharacter.fetishes,
        [fetish]: value
      }
    }
    setEditedCharacter(updated)
    setHasChanges(true)
  }

  // Сохранение изменений
  const handleSave = () => {
    onUpdateCharacter(editedCharacter)
    setHasChanges(false)
  }

  // Сброс изменений
  const handleReset = () => {
    setEditedCharacter(character)
    setHasChanges(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Настройка персонажа</h2>
            <p className="text-muted-foreground">{character.name}</p>
            {hasChanges && (
              <Badge variant="outline" className="mt-2">
                Есть несохраненные изменения
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <Button variant="outline" onClick={handleReset} size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Сбросить
                </Button>
                <Button onClick={handleSave} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={onClose}>
              <XCircle className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="characteristics" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="characteristics">Характеристики</TabsTrigger>
              <TabsTrigger value="states">Состояния</TabsTrigger>
              <TabsTrigger value="fetishes">Фетиши</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Основная информация
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <div className="font-medium">Имя: {editedCharacter.name}</div>
                      <div className="text-muted-foreground">Архетип: {editedCharacter.archetype}</div>
                      <div className="text-muted-foreground">Возраст: {editedCharacter.age}</div>
                      <div className="text-muted-foreground">Категория: {editedCharacter.category}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Характеристики
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-sm">
                        Физических: {Object.keys(editedCharacter.characteristics?.physical || {}).length}
                      </div>
                      <div className="text-sm">
                        Психологических: {Object.keys(editedCharacter.characteristics?.psychological || {}).length}
                      </div>
                      <div className="text-sm">
                        Социальных: {Object.keys(editedCharacter.characteristics?.social || {}).length}
                      </div>
                      <div className="text-sm">
                        Личностных: {Object.keys(editedCharacter.characteristics?.personality || {}).length}
                      </div>
                      <div className="text-sm">
                        Специальных: {Object.keys(editedCharacter.characteristics?.special || {}).length}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Состояния
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-center">
                      {Object.keys(editedCharacter.states || {}).length}
                    </div>
                    <div className="text-sm text-muted-foreground text-center">
                      параметров
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Фетиши
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-center">
                      {Object.keys(editedCharacter.fetishes || {}).length}
                    </div>
                    <div className="text-sm text-muted-foreground text-center">
                      предпочтений
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Описание персонажа</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {editedCharacter.description || 'Описание не задано'}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="characteristics" className="space-y-6">
              <div className="space-y-6">
                <CharacteristicEditor
                  title="Физические характеристики"
                  characteristics={editedCharacter.characteristics?.physical || {}}
                  categoryKey="physical"
                  onUpdate={updateCharacteristic}
                />
                <CharacteristicEditor
                  title="Психологические характеристики"
                  characteristics={editedCharacter.characteristics?.psychological || {}}
                  categoryKey="psychological"
                  onUpdate={updateCharacteristic}
                />
                <CharacteristicEditor
                  title="Социальные характеристики"
                  characteristics={editedCharacter.characteristics?.social || {}}
                  categoryKey="social"
                  onUpdate={updateCharacteristic}
                />
                <CharacteristicEditor
                  title="Личностные характеристики"
                  characteristics={editedCharacter.characteristics?.personality || {}}
                  categoryKey="personality"
                  onUpdate={updateCharacteristic}
                />
                <CharacteristicEditor
                  title="Специальные характеристики"
                  characteristics={editedCharacter.characteristics?.special || {}}
                  categoryKey="special"
                  onUpdate={updateCharacteristic}
                />
              </div>
            </TabsContent>

            <TabsContent value="states" className="space-y-6">
              <StatesEditor
                states={editedCharacter.states || {}}
                onUpdate={updateState}
              />
            </TabsContent>

            <TabsContent value="fetishes" className="space-y-6">
              <FetishesEditor
                fetishes={editedCharacter.fetishes || {}}
                onUpdate={updateFetish}
              />
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  )
}
