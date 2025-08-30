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
  XCircle
} from "lucide-react"

interface CharacterAnalysisPanelProps {
  character: any
  onClose: () => void
}

const ANALYSIS_METHODS = {
  basic_scan: {
    name: "Базовое сканирование",
    description: "Простой анализ основных характеристик",
    cost: 100,
    time: 30,
    risk: "low",
    reveals: ["physical"]
  },
  psychological_test: {
    name: "Психологическое тестирование",
    description: "Глубокий анализ психологических характеристик",
    cost: 300,
    time: 120,
    risk: "medium",
    reveals: ["psychological"]
  },
  sensory_research: {
    name: "Сенсорное исследование",
    description: "Изучение сенсорных реакций персонажа",
    cost: 500,
    time: 180,
    risk: "high",
    reveals: ["social", "personality"]
  }
}

export default function CharacterAnalysisPanel({ character, onClose }: CharacterAnalysisPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)

  const handleStartAnalysis = async (method: string) => {
    setIsAnalyzing(true)
    setSelectedMethod(method)

    // Имитация анализа
    setTimeout(() => {
      setIsAnalyzing(false)
      setAnalysisResult({
        method,
        success: true,
        revealedCharacteristics: ANALYSIS_METHODS[method as keyof typeof ANALYSIS_METHODS].reveals
      })
    }, 2000)
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400'
      case 'medium': return 'text-yellow-400'
      case 'high': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="w-4 h-4" />
      case 'medium': return <AlertTriangle className="w-4 h-4" />
      case 'high': return <XCircle className="w-4 h-4" />
      default: return <AlertTriangle className="w-4 h-4" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Search className="w-6 h-6 text-cyan-400" />
                Анализ персонажа: {character.name}
              </CardTitle>
              <CardDescription>
                Изучите характеристики персонажа через различные методы анализа
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="methods" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="methods">Методы анализа</TabsTrigger>
              <TabsTrigger value="progress">Прогресс изучения</TabsTrigger>
            </TabsList>

            <TabsContent value="methods" className="space-y-4">
              <div className="grid gap-4">
                {Object.entries(ANALYSIS_METHODS).map(([key, method]) => (
                  <Card key={key} className="border border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg mb-2">{method.name}</h4>
                          <p className="text-gray-400 mb-3">{method.description}</p>

                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4 text-green-400" />
                              <span>{method.cost} кредитов</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-blue-400" />
                              <span>{method.time} сек</span>
                            </div>
                            <div className={`flex items-center gap-1 ${getRiskColor(method.risk)}`}>
                              {getRiskIcon(method.risk)}
                              <span>Риск: {method.risk}</span>
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-sm text-gray-400 mb-2">Раскрывает категории:</p>
                            <div className="flex flex-wrap gap-2">
                              {method.reveals.map(category => (
                                <Badge key={category} variant="outline" className="text-xs">
                                  {category}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleStartAnalysis(key)}
                          disabled={isAnalyzing}
                          className="ml-4"
                        >
                          {isAnalyzing && selectedMethod === key ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Анализ...
                            </>
                          ) : (
                            <>
                              <Target className="w-4 h-4 mr-2" />
                              Начать анализ
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="progress" className="space-y-4">
              <div className="text-center py-8">
                <Eye className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Прогресс изучения</h3>
                <p className="text-gray-400">
                  Здесь будет отображаться прогресс изучения характеристик персонажа
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {analysisResult && (
            <Card className="mt-6 border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-400">Анализ завершен!</span>
                </div>
                <p className="text-gray-400 mb-3">
                  Метод: {ANALYSIS_METHODS[analysisResult.method as keyof typeof ANALYSIS_METHODS].name}
                </p>
                <p className="text-sm">
                  Раскрыты категории: {analysisResult.revealedCharacteristics.join(', ')}
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}






