'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Play,
  ArrowRight,
  Clock,
  User,
  Zap
} from 'lucide-react'

interface SceneData {
  id: string
  name: string
  description?: string
  type: string
}

interface ScreenData {
  id: string
  name: string
  description?: string
  content: {
    text?: string
    background?: string
    music?: string
  }
  choices: ChoiceData[]
}

interface ChoiceData {
  id: string
  text: string
  description?: string
  nextScreenId?: string
  consequences?: any[]
  showConditions?: any[]
}

interface SceneDisplayProps {
  sceneData: SceneData
  currentScreen: ScreenData
  onChoiceSelect: (choiceId: string) => void
  onClose: () => void
  onNotification?: (notification: any) => void
}

export function SceneDisplay({
  sceneData,
  currentScreen,
  onChoiceSelect,
  onClose,
  onNotification
}: SceneDisplayProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleChoiceClick = async (choiceId: string) => {
    if (isProcessing) return

    try {
      setIsProcessing(true)
      setSelectedChoice(choiceId)

      // Показываем уведомление о выборе
      if (onNotification) {
        onNotification({
          id: Date.now(),
          type: 'choice',
          message: 'Выбор сделан',
          timestamp: new Date()
        })
      }

      // Уведомляем родительский компонент
      onChoiceSelect(choiceId)

    } catch (error) {
      console.error('Ошибка при выборе:', error)

      if (onNotification) {
        onNotification({
          id: Date.now(),
          type: 'error',
          message: 'Ошибка при выборе',
          timestamp: new Date()
        })
      }
    } finally {
      setIsProcessing(false)
      setSelectedChoice(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] liquid-glass-card text-white overflow-hidden neon-border">
        {/* Заголовок сцены */}
        <CardHeader className="border-b border-cyan-400 border-opacity-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg neon-border-blue">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-white ">{sceneData.name}</CardTitle>
                {sceneData.description && (
                  <p className="text-cyan-300 text-sm mt-1">{sceneData.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-cyan-400 text-cyan-300">
                {sceneData.type}
              </Badge>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="text-cyan-400 hover:text-cyan-300 hover:-fast"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Контент экрана */}
          <div className="space-y-6">
            {/* Текст экрана */}
            {currentScreen.content?.text && (
              <div className="liquid-glass-card rounded-lg p-4 border border-green-400 border-opacity-20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-600 rounded-lg flex-shrink-0 neon-border-green">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-2 ">{currentScreen.name}</h3>
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {currentScreen.content.text}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Фоновое изображение */}
            {currentScreen.content?.background && (
              <div className="liquid-glass-card rounded-lg p-4 border border-blue-400 border-opacity-20">
                <img
                  src={currentScreen.content.background}
                  alt="Фон сцены"
                  className="w-full max-h-64 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Фоновая музыка */}
            {currentScreen.content?.music && (
              <div className="liquid-glass-card rounded-lg p-4 border border-purple-400 border-opacity-20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600 rounded-lg neon-border-purple">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-white font-medium ">Фоновая музыка</p>
                    <audio controls className="mt-2">
                      <source src={currentScreen.content.music} type="audio/mpeg" />
                      Ваш браузер не поддерживает аудио элемент.
                    </audio>
                  </div>
                </div>
              </div>
            )}

            {/* Выборы */}
            {currentScreen.choices && currentScreen.choices.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 ">
                  <ArrowRight className="h-5 w-5" />
                  Ваш выбор:
                </h3>

                <div className="grid gap-3">
                  {currentScreen.choices.map((choice) => (
                    <Button
                      key={choice.id}
                      onClick={() => handleChoiceClick(choice.id)}
                      disabled={isProcessing}
                      className="w-full justify-start glass-button border border-cyan-400 border-opacity-30 text-white p-4 h-auto liquid-shimmer"
                      variant="outline"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-shrink-0">
                          {selectedChoice === choice.id && isProcessing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{choice.text}</p>
                          {choice.description && (
                            <p className="text-sm text-cyan-300 mt-1">{choice.description}</p>
                          )}
                          {choice.consequences && choice.consequences.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Clock className="h-3 w-3 text-yellow-400" />
                              <span className="text-xs text-yellow-400">
                                {choice.consequences.length} последствий
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Если нет выборов - это финальный экран */}
            {(!currentScreen.choices || currentScreen.choices.length === 0) && (
              <div className="text-center py-8">
                <div className="p-4 liquid-glass-card rounded-lg border border-orange-400 border-opacity-20">
                  <p className="text-cyan-300 mb-4">Сцена завершена</p>
                  <Button onClick={onClose} className="glass-button neon-border-blue">
                    Закрыть
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
