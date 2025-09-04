"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Brain,
  Heart,
  Users,
  Star,
  Lock,
  Unlock
} from "lucide-react"
import {
  UniversalCharacterKnowledge,
  UniversalAttributeKnowledge,
  getUniversalAttributeDisplayValue,
  getUniversalKnowledgeLevelColor,
  getUniversalKnowledgeLevelIcon,
  calculateUniversalAnalysisProgress,
  getUniversalKnowledgeStats
} from "@/lib/universal-hidden-attributes"
import {
  UniversalAnalysisMethod,
  UNIVERSAL_ANALYSIS_METHODS,
  getAvailableUniversalAnalysisMethods,
  checkAnalysisMethodRequirements
} from "@/lib/universal-analysis-methods"

interface UniversalCharacterKnowledgePanelProps {
  character: any
  onUpdateCharacter: (updatedCharacter: any) => void
  onClose: () => void
}

// Компонент для отображения категории атрибутов
const AttributeCategoryCard = ({
  title,
  icon: Icon,
  color,
  attributes,
  onAnalyze,
  characterLevel = 1
}: {
  title: string
  icon: any
  color: string
  attributes: Record<string, UniversalAttributeKnowledge>
  onAnalyze: (category: string, attributeId: string) => void
  characterLevel?: number
}) => {
  const analyzedCount = Object.values(attributes).filter(attr => attr.level !== 'unknown').length
  const totalCount = Object.keys(attributes).length
  const progress = totalCount > 0 ? (analyzedCount / totalCount) * 100 : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {analyzedCount}/{totalCount}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Прогресс</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(attributes).map(([attributeId, knowledge]) => {
            const icon = getUniversalKnowledgeLevelIcon(knowledge.level)
            const colorClass = getUniversalKnowledgeLevelColor(knowledge.level)
            const displayValue = knowledge.value !== undefined
              ? getUniversalAttributeDisplayValue(knowledge, knowledge.value)
              : '❓'

            return (
              <div key={attributeId} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm">{attributeId}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${colorClass}`}>
                    {icon} {displayValue}
                  </Badge>
                  {knowledge.level === 'unknown' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAnalyze(title.toLowerCase(), attributeId)}
                      className="h-6 w-6 p-0"
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Компонент для отображения метода анализа
const AnalysisMethodCard = ({
  method,
  methodInfo,
  onSelect,
  disabled = false,
  characterLevel = 1
}: {
  method: UniversalAnalysisMethod
  methodInfo: any
  onSelect: () => void
  disabled?: boolean
  characterLevel?: number
}) => {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="h-4 w-4" />
      case 'medium': return <AlertTriangle className="h-4 w-4" />
      case 'high': return <XCircle className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <Card className={`${disabled ? 'opacity-50' : 'hover:bg-muted/50'} transition-all`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{methodInfo.name}</CardTitle>
          <Badge variant={methodInfo.risk === 'low' ? 'default' : 'destructive'}>
            {getRiskIcon(methodInfo.risk)}
            {methodInfo.risk === 'low' ? 'Низкий' : methodInfo.risk === 'medium' ? 'Средний' : 'Высокий'}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {methodInfo.description}
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
            Точность: {(methodInfo.baseAccuracy * 100).toFixed(0)}%
          </div>
          <Progress value={methodInfo.baseAccuracy * 100} className="h-2" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium">Раскрывает:</div>
          <div className="flex flex-wrap gap-1">
            {methodInfo.reveals.attributes.map((category: string) => (
              <Badge key={category} variant="outline" className="text-xs">
                {category === 'physical' ? 'Физические' :
                 category === 'psychological' ? 'Психологические' :
                 category === 'social' ? 'Социальные' :
                 category === 'personality' ? 'Личностные' :
                 category === 'special' ? 'Специальные' : category}
              </Badge>
            ))}
            {methodInfo.reveals.fetishes.map((category: string) => (
              <Badge key={category} variant="outline" className="text-xs">
                {category === 'bdsm' ? 'БДСМ' :
                 category === 'psychological' ? 'Псих. фетиши' :
                 category === 'sensory' ? 'Сенсорные' :
                 category === 'body_parts' ? 'Телесные' :
                 category === 'material' ? 'Материальные' :
                 category === 'social' ? 'Социальные' :
                 category === 'physiological' ? 'Физиологические' :
                 category === 'extreme' ? 'Экстремальные' :
                 category === 'additional' ? 'Дополнительные' : category}
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

export default function UniversalCharacterKnowledgePanel({
  character,
  onUpdateCharacter,
  onClose
}: UniversalCharacterKnowledgePanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<UniversalAnalysisMethod | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  if (!character) return null

  const knowledge = character.universalKnowledge || character.knowledge
  if (!knowledge) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
          </CardHeader>
          <CardContent>
            <p>У персонажа нет данных о знаниях</p>
            <Button onClick={onClose} className="w-full mt-4">
              Закрыть
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = getUniversalKnowledgeStats(knowledge)
  const overallProgress = calculateUniversalAnalysisProgress(knowledge)
  const availableMethods = getAvailableUniversalAnalysisMethods(knowledge)

  const handleAnalyze = async (method: UniversalAnalysisMethod) => {
    setIsAnalyzing(true)
    setSelectedMethod(method)

    // Имитация анализа
    setTimeout(() => {
      setIsAnalyzing(false)
      setSelectedMethod(null)
      // Здесь должна быть логика обновления знаний персонажа
    }, 2000)
  }

  const handleAnalyzeAttribute = (category: string, attributeId: string) => {
    // Логика для быстрого анализа конкретного атрибута
    console.log(`Анализ атрибута: ${category}.${attributeId}`)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Универсальный анализ персонажа</h2>
            <p className="text-muted-foreground">{character.name}</p>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline">
                <Lock className="h-3 w-3 mr-1" />
                {stats.attributes.total + stats.fetishes.total + stats.states.total} скрыто
              </Badge>
              <Badge variant="outline">
                <Unlock className="h-3 w-3 mr-1" />
                {stats.attributes.analyzed + stats.fetishes.analyzed + stats.states.analyzed} раскрыто
              </Badge>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <XCircle className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="attributes">Атрибуты</TabsTrigger>
              <TabsTrigger value="fetishes">Фетиши</TabsTrigger>
              <TabsTrigger value="analysis">Анализ</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Атрибуты
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.attributes.analyzed}</div>
                    <div className="text-sm text-muted-foreground">
                      из {stats.attributes.total} раскрыто
                    </div>
                    <Progress value={(stats.attributes.analyzed / stats.attributes.total) * 100} className="h-2 mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Фетиши
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.fetishes.analyzed}</div>
                    <div className="text-sm text-muted-foreground">
                      из {stats.fetishes.total} раскрыто
                    </div>
                    <Progress value={(stats.fetishes.analyzed / stats.fetishes.total) * 100} className="h-2 mt-2" />
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
                    <div className="text-2xl font-bold">{stats.states.analyzed}</div>
                    <div className="text-sm text-muted-foreground">
                      из {stats.states.total} раскрыто
                    </div>
                    <Progress value={(stats.states.analyzed / stats.states.total) * 100} className="h-2 mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Общий прогресс
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(overallProgress * 100).toFixed(0)}%</div>
                    <div className="text-sm text-muted-foreground">
                      изучения персонажа
                    </div>
                    <Progress value={overallProgress * 100} className="h-2 mt-2" />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attributes" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AttributeCategoryCard
                  title="Физические"
                  icon={Target}
                  color="bg-blue-500"
                  attributes={knowledge.attributes.physical || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Психологические"
                  icon={Brain}
                  color="bg-purple-500"
                  attributes={knowledge.attributes.psychological || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Социальные"
                  icon={Users}
                  color="bg-green-500"
                  attributes={knowledge.attributes.social || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Личностные"
                  icon={Heart}
                  color="bg-pink-500"
                  attributes={knowledge.attributes.personality || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Специальные"
                  icon={Star}
                  color="bg-yellow-500"
                  attributes={knowledge.attributes.special || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
              </div>
            </TabsContent>

            <TabsContent value="fetishes" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AttributeCategoryCard
                  title="БДСМ"
                  icon={Zap}
                  color="bg-red-500"
                  attributes={knowledge.fetishes.bdsm || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Психологические"
                  icon={Brain}
                  color="bg-purple-500"
                  attributes={knowledge.fetishes.psychological || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Сенсорные"
                  icon={Settings}
                  color="bg-blue-500"
                  attributes={knowledge.fetishes.sensory || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Телесные"
                  icon={Heart}
                  color="bg-pink-500"
                  attributes={knowledge.fetishes.body_parts || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Материальные"
                  icon={Target}
                  color="bg-gray-500"
                  attributes={knowledge.fetishes.material || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
                <AttributeCategoryCard
                  title="Экстремальные"
                  icon={AlertTriangle}
                  color="bg-red-600"
                  attributes={knowledge.fetishes.extreme || {}}
                  onAnalyze={handleAnalyzeAttribute}
                />
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableMethods.map(method => {
                  const methodInfo = UNIVERSAL_ANALYSIS_METHODS[method]
                  const requirements = checkAnalysisMethodRequirements(method, knowledge, character.level || 1)

                  return (
                    <AnalysisMethodCard
                      key={method}
                      method={method}
                      methodInfo={methodInfo}
                      onSelect={() => handleAnalyze(method)}
                      disabled={!requirements.canUse || isAnalyzing}
                      characterLevel={character.level || 1}
                    />
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
