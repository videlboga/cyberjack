"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  User,
  Eye,
  Search,
  XCircle,
  Calendar,
  Target,
  TrendingUp,
  Brain,
  Heart,
  Users,
  Star
} from "lucide-react"
import {
  getCharacteristicDisplayValue,
  getKnowledgeLevelIcon,
  getKnowledgeLevelColor,
  calculateAnalysisProgress
} from "@/lib/character-analysis"

interface UserKnowledgePanelProps {
  user: any
  characters: any[]
  onClose: () => void
}

const KnowledgeProgressCard = ({ characterKnowledge, character }: { characterKnowledge: any, character: any }) => {
  const progress = calculateAnalysisProgress(characterKnowledge.knowledge || {})
  const analysisCount = characterKnowledge.analysisCount || 0
  const lastAnalyzed = characterKnowledge.lastAnalyzed ? new Date(characterKnowledge.lastAnalyzed).toLocaleDateString() : 'Никогда'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{character?.name || characterKnowledge.characterId}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {analysisCount} анализов
          </Badge>
        </div>
        <CardDescription className="text-sm">
          Последний анализ: {lastAnalyzed}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Прогресс изучения</span>
              <span>{(progress * 100).toFixed(0)}%</span>
            </div>
            <Progress value={progress * 100} className="h-2" />
          </div>

          {/* Краткая статистика по категориям */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {characterKnowledge.knowledge && Object.entries(characterKnowledge.knowledge).map(([category, chars]: [string, any]) => {
              if (!chars || typeof chars !== 'object') return null

              const known = Object.values(chars).filter((k: any) => k && k.level !== 'unknown').length
              const total = Object.keys(chars).length

              const categoryNames = {
                physical: 'Физ.',
                psychological: 'Псих.',
                social: 'Социал.',
                special: 'Особые',
                personality: 'Личн.'
              }

              return (
                <div key={category} className="flex justify-between">
                  <span className="text-muted-foreground">{categoryNames[category] || category}:</span>
                  <span>{known}/{total}</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const CharacterDetailedKnowledge = ({ characterKnowledge, character }: { characterKnowledge: any, character: any }) => {
  if (!characterKnowledge.knowledge) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Нет данных об изучении этого персонажа
      </div>
    )
  }

  const categories = [
    { key: 'physical', name: 'Физические характеристики', icon: Target, color: 'bg-blue-500' },
    { key: 'psychological', name: 'Психологические характеристики', icon: Brain, color: 'bg-purple-500' },
    { key: 'social', name: 'Социальные характеристики', icon: Users, color: 'bg-green-500' },
    { key: 'personality', name: 'Личностные характеристики', icon: Heart, color: 'bg-pink-500' },
    { key: 'special', name: 'Специальные характеристики', icon: Star, color: 'bg-yellow-500' }
  ]

  return (
    <div className="space-y-6">
      {categories.map(({ key, name, icon: Icon, color }) => {
        const categoryChars = characterKnowledge.knowledge[key]
        if (!categoryChars || Object.keys(categoryChars).length === 0) return null

        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                {name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(categoryChars).map(([charKey, knowledge]: [string, any]) => {
                  if (!knowledge) return null

                  const actualValue = character?.characteristics?.[key]?.[charKey] || 0
                  const displayValue = getCharacteristicDisplayValue(knowledge, actualValue)
                  const icon = getKnowledgeLevelIcon(knowledge.level)
                  const colorClass = getKnowledgeLevelColor(knowledge.level)

                  return (
                    <div key={charKey} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-sm">{charKey}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${colorClass}`}>
                          {icon} {displayValue}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

const AnalysisHistory = ({ characterKnowledge }: { characterKnowledge: any }) => {
  const history = characterKnowledge.analysisHistory || []

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        История анализов пуста
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.map((session: any, index: number) => (
        <Card key={session.id || index}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  {session.method ? `Метод: ${session.method}` : 'Анализ'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(session.startTime).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-sm">{session.cost} кр.</div>
                <div className="text-xs text-muted-foreground">Стоимость</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function UserKnowledgePanel({ user, characters, onClose }: UserKnowledgePanelProps) {
  if (!user) return null

  const characterKnowledge = user.characterKnowledge || {}

  // Получаем персонажей с знаниями
  const knownCharacters = Object.entries(characterKnowledge).map(([characterId, knowledge]: [string, any]) => {
    const character = characters.find((c: any) => c.id === characterId)
    return { characterId, character, knowledge }
  })

  // Общая статистика
  const totalCharacters = Object.keys(characterKnowledge).length
  const totalAnalyses = Object.values(characterKnowledge).reduce((sum: number, knowledge: any) => sum + (knowledge.analysisCount || 0), 0)

  let totalKnownCharacteristics = 0
  let totalCharacteristics = 0

  Object.values(characterKnowledge).forEach((knowledge: any) => {
    if (knowledge.knowledge) {
      Object.values(knowledge.knowledge).forEach((category: any) => {
        if (category && typeof category === 'object') {
          Object.values(category).forEach((char: any) => {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Знания пользователя</h2>
            <p className="text-muted-foreground">{user.username} ({user.email})</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <XCircle className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="characters">Персонажи</TabsTrigger>
              <TabsTrigger value="history">История</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Персонажей изучено
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalCharacters}</div>
                    <div className="text-sm text-muted-foreground">
                      из {characters.length} доступных
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Всего анализов
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalAnalyses}</div>
                    <div className="text-sm text-muted-foreground">
                      проведено исследований
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Общий прогресс
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overallProgress.toFixed(0)}%</div>
                    <div className="text-sm text-muted-foreground">
                      {totalKnownCharacteristics} из {totalCharacteristics} характеристик
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Средний прогресс
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {totalCharacters > 0 ? (overallProgress / totalCharacters).toFixed(0) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      по персонажу
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="characters" className="space-y-6">
              {knownCharacters.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Нет изученных персонажей</h3>
                  <p>Пользователь еще не проводил анализ ни одного персонажа</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {knownCharacters.map(({ characterId, character, knowledge }) => (
                      <KnowledgeProgressCard
                        key={characterId}
                        characterKnowledge={knowledge}
                        character={character}
                      />
                    ))}
                  </div>

                  {/* Детальная информация о первом персонаже (можно расширить) */}
                  {knownCharacters.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-4">Детальная информация</h3>
                      <Tabs value={knownCharacters[0].characterId} className="w-full">
                        <TabsList className="mb-4">
                          {knownCharacters.slice(0, 5).map(({ characterId, character }) => (
                            <TabsTrigger key={characterId} value={characterId} className="text-xs">
                              {character?.name || characterId}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {knownCharacters.slice(0, 5).map(({ characterId, character, knowledge }) => (
                          <TabsContent key={characterId} value={characterId}>
                            <CharacterDetailedKnowledge
                              characterKnowledge={knowledge}
                              character={character}
                            />
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              {knownCharacters.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">История пуста</h3>
                  <p>Пользователь еще не проводил ни одного анализа</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">История всех анализов</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {knownCharacters.map(({ characterId, character, knowledge }) => (
                      <Card key={characterId}>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {character?.name || characterId}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <AnalysisHistory characterKnowledge={knowledge} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

