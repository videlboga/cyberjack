"use client"

import React from 'react'
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
  XCircle
} from "lucide-react"
import {
  getCharacteristicDisplayValue,
  getKnowledgeLevelIcon,
  getKnowledgeLevelColor,
  calculateAnalysisProgress,
  getAvailableAnalysisMethods,
  ANALYSIS_METHODS,
  type AnalysisMethod,
  type CharacterAttributeKnowledge
} from "@/lib/character-analysis"

import {
  ANALYSIS_TOOLS,
  getAvailableToolsForUser,
  calculateToolEffectiveness,
  calculateToolRisk,
  type AnalysisTool,
  type AnalysisToolType
} from "@/lib/analysis-tools"

interface CharacterAnalysisPanelProps {
  character: any
  onStartAnalysis: (character: any, method: AnalysisMethod) => void
  onStartToolAnalysis: (character: any, tool: AnalysisTool) => void
  onClose: () => void
}

const CharacteristicGroup = ({
  title,
  characteristics,
  knowledge,
  groupKey
}: {
  title: string
  characteristics: Record<string, number>
  knowledge: any
  groupKey: string
}) => {
  // Проверяем, есть ли характеристики для отображения
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
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
      <div className="space-y-2">
        {Object.entries(characteristics).map(([key, value]) => {
          const knowledgeLevel = knowledge?.[groupKey]?.[key] || { level: 'unknown' }
          const displayValue = getCharacteristicDisplayValue(knowledgeLevel, value)
          const icon = getKnowledgeLevelIcon(knowledgeLevel.level)
          const colorClass = getKnowledgeLevelColor(knowledgeLevel.level)

          return (
            <div key={key} className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <span className="text-sm">{key}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${colorClass}`}>
                  {icon} {displayValue}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
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
  onStartAnalysis,
  onStartToolAnalysis,
  onClose
}: CharacterAnalysisPanelProps) {
  if (!character) return null

  // Проверяем наличие системы знаний персонажа
  if (!character.knowledge) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-lg shadow-xl max-w-md w-full max-h-[50vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-2xl font-bold">Ошибка анализа</h2>
            <Button variant="ghost" onClick={onClose}>
              <XCircle className="h-6 w-6" />
            </Button>
          </div>
          <div className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Персонаж не готов к анализу</h3>
            <p className="text-muted-foreground mb-4">
              У этого персонажа отсутствует система скрытых характеристик.
              Необходимо сначала инициализировать его в системе.
            </p>
            <Button onClick={onClose} variant="outline">
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const availableMethods = getAvailableAnalysisMethods(character.playerKnowledge?.knowledge || {})
  const analysisProgress = calculateAnalysisProgress(character.playerKnowledge?.knowledge || {})

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Анализ характеристик</h2>
            <p className="text-muted-foreground">{character.name}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <XCircle className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="characteristics">Характеристики</TabsTrigger>
              <TabsTrigger value="analysis">Методы анализа</TabsTrigger>
              <TabsTrigger value="tools">Инструменты</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Прогресс анализа
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Изучено</span>
                        <span>{(analysisProgress * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={analysisProgress * 100} className="h-3" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Доступные методы
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-center">
                      {availableMethods.length}
                    </div>
                    <div className="text-sm text-muted-foreground text-center">
                      из 6 методов
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Последний анализ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      {character.playerKnowledge?.analysisHistory && character.playerKnowledge.analysisHistory.length > 0 ? (
                        <div>
                          <div className="font-medium">
                            {ANALYSIS_METHODS[character.playerKnowledge.analysisHistory[character.playerKnowledge.analysisHistory.length - 1].method]?.name}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(character.playerKnowledge.analysisHistory[character.playerKnowledge.analysisHistory.length - 1].startTime).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Не проводился</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="characteristics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CharacteristicGroup
                  title="Физические характеристики"
                  characteristics={character.characteristics?.physical || {}}
                  knowledge={character.playerKnowledge?.knowledge || {}}
                  groupKey="physical"
                />
                <CharacteristicGroup
                  title="Психологические характеристики"
                  characteristics={character.characteristics?.psychological || {}}
                  knowledge={character.playerKnowledge?.knowledge || {}}
                  groupKey="psychological"
                />
                <CharacteristicGroup
                  title="Социальные характеристики"
                  characteristics={character.characteristics?.social || {}}
                  knowledge={character.playerKnowledge?.knowledge || {}}
                  groupKey="social"
                />
                <CharacteristicGroup
                  title="Личностные характеристики"
                  characteristics={character.characteristics?.personality || {}}
                  knowledge={character.playerKnowledge?.knowledge || {}}
                  groupKey="personality"
                />
                <CharacteristicGroup
                  title="Специальные характеристики"
                  characteristics={character.characteristics?.special || {}}
                  knowledge={character.playerKnowledge?.knowledge || {}}
                  groupKey="special"
                />
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Выберите метод анализа</h3>
                  <p className="text-muted-foreground">
                    Каждый метод имеет разную стоимость, точность и последствия для персонажа
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(ANALYSIS_METHODS).map(([methodKey, methodInfo]) => {
                    const method = methodKey as AnalysisMethod

                    // Дополнительная проверка на существование метода
                    if (!ANALYSIS_METHODS[method]) {
                      console.warn(`Метод анализа ${method} не найден в ANALYSIS_METHODS`)
                      return null
                    }

                    const isAvailable = availableMethods.includes(method)

                    return (
                      <AnalysisMethodCard
                        key={method}
                        method={method}
                        methodInfo={methodInfo}
                        onSelect={() => {
                          try {
                            onStartAnalysis(character, method)
                          } catch (error) {
                            console.error('❌ Ошибка при выборе метода анализа:', error)
                          }
                        }}
                        disabled={!isAvailable}
                      />
                    )
                  })}
                </div>

                {!availableMethods.includes('deep_immersion') && (
                  <Card className="border-yellow-500/50 bg-yellow-500/5">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <div>
                          <h4 className="font-medium">Глубокая иммерсия заблокирована</h4>
                          <p className="text-sm text-muted-foreground">
                            Для разблокировки проведите анализ всех других характеристик
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tools" className="space-y-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Инструменты анализа</h3>
                  <p className="text-muted-foreground">
                    Специализированные инструменты для глубокого анализа характеристик
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(ANALYSIS_TOOLS).slice(0, 8).map((tool) => {
                    const effectiveness = calculateToolEffectiveness(tool, [])
                    const risk = calculateToolRisk(tool, 1)
                    const isAvailable = !tool.requirements?.userLevel || tool.requirements.userLevel <= 3

                    return (
                      <Card key={tool.id} className={`${!isAvailable ? 'opacity-50' : 'hover:bg-muted/50'} transition-all`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{tool.name}</CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant={tool.riskLevel === 'low' ? 'default' : 'destructive'} className="text-xs">
                                {tool.riskLevel === 'low' ? '🟢' : tool.riskLevel === 'medium' ? '🟡' : '🔴'}
                                {tool.riskLevel === 'low' ? 'Низкий' : tool.riskLevel === 'medium' ? 'Средний' : 'Высокий'}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {tool.level}
                              </Badge>
                            </div>
                          </div>
                          <CardDescription className="text-sm">
                            {tool.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-green-500" />
                              <span>{tool.cost} кр.</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-blue-500" />
                              <span>{tool.speed} мин.</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Эффективность: {(effectiveness * 100).toFixed(0)}%
                            </div>
                            <Progress value={effectiveness * 100} className="h-2" />
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Риск: {(risk * 100).toFixed(0)}%
                            </div>
                            <Progress value={risk * 100} className="h-2" />
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs font-medium">Раскрывает:</div>
                            <div className="flex flex-wrap gap-1">
                              {tool.reveals.physical && tool.reveals.physical.slice(0, 2).map((char) => (
                                <Badge key={char} variant="outline" className="text-xs">
                                  {char === 'endurance' ? 'Выносливость' :
                                   char === 'sensitivity' ? 'Чувствительность' :
                                   char === 'flexibility' ? 'Гибкость' : char}
                                </Badge>
                              ))}
                              {((tool.reveals.physical?.length || 0) > 2 ||
                                (tool.reveals.psychological?.length || 0) > 0 ||
                                (tool.reveals.social?.length || 0) > 0) && (
                                <Badge variant="outline" className="text-xs">
                                  +ещё
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Button
                            onClick={() => onStartToolAnalysis(character, tool)}
                            disabled={!isAvailable}
                            className="w-full"
                            variant={tool.riskLevel === 'high' ? 'destructive' : 'default'}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Использовать инструмент
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                <Card className="border-blue-500/50 bg-blue-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-blue-500" />
                      <div>
                        <h4 className="font-medium">Система инструментов</h4>
                        <p className="text-sm text-muted-foreground">
                          Показаны только базовые инструменты. Доступность зависит от уровня пользователя и ранга персонажа.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
