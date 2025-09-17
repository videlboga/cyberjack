'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  X,
  Play,
  ArrowRight,
  Clock,
  User,
  Zap,
  Monitor
} from 'lucide-react'
import { StoryScene as BaseStoryScene, StoryScreen as BaseStoryScreen, StoryChoice } from '@/types/screen-based-story'

// Локальные типы, совместимые с данными из админ-панели
interface StoryScreen extends Omit<BaseStoryScreen, 'sceneId' | 'content'> {
  content: {
    text?: string
    background?: string
    music?: string
    images?: string[]
    videos?: string[]
    audio?: string[]
  }
}

interface StoryScene extends Omit<BaseStoryScene, 'screens'> {
  screens: StoryScreen[]
}

interface ScenePreviewProps {
  scene: StoryScene
  onClose: () => void
}

export function ScenePreview({ scene, onClose }: ScenePreviewProps) {
  const [currentScreen, setCurrentScreen] = useState<StoryScreen | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [screenHistory, setScreenHistory] = useState<string[]>([])

  // Инициализация - находим стартовый экран
  useEffect(() => {
    if (scene.screens.length === 0) return

    let startScreen: StoryScreen | null = null

    // Сначала ищем экран по startScreenId
    if (scene.startScreenId) {
      startScreen = scene.screens.find(screen => screen.id === scene.startScreenId) || null
    }

    // Если не найден по startScreenId, берем первый экран
    if (!startScreen) {
      startScreen = scene.screens[0]
    }

    setCurrentScreen(startScreen)
    setScreenHistory([startScreen.id])
  }, [scene])

  const handleChoiceClick = async (choice: StoryChoice) => {
    if (isProcessing) return

    try {
      setIsProcessing(true)
      setSelectedChoice(choice.id)

      // Показываем уведомление о выборе
      toast.success('Выбор сделан', {
        description: choice.text
      })

      // Обрабатываем последствия
      if (choice.consequences && choice.consequences.length > 0) {
        for (const consequence of choice.consequences) {
          await processConsequence(consequence)
        }
      }

      // Переходим к следующему экрану
      if (choice.nextScreenId) {
        const nextScreen = scene.screens.find(s => s.id === choice.nextScreenId)
        if (nextScreen) {
          setCurrentScreen(nextScreen)
          setScreenHistory(prev => [...prev, nextScreen.id])
        }
      } else if (choice.isFinal) {
        // Финальный выбор - завершаем сцену
        toast.info('Сцена завершена', {
          description: 'Вы достигли конца сцены'
        })
      }

    } catch (error) {
      console.error('Ошибка при выборе:', error)
      toast.error('Ошибка при выборе', {
        description: 'Попробуйте еще раз'
      })
    } finally {
      setIsProcessing(false)
      setSelectedChoice(null)
    }
  }

  const processConsequence = async (consequence: any) => {
    switch (consequence.type) {
      case 'change_credits':
        if (consequence.creditsChange) {
          toast.success('Кредиты изменены', {
            description: `${consequence.creditsChange > 0 ? '+' : ''}${consequence.creditsChange} кредитов`
          })
        }
        break

      case 'add_character':
        toast.success('Персонаж добавлен', {
          description: 'Новый персонаж добавлен в вашу коллекцию'
        })
        break

      case 'remove_character':
        toast.warning('Персонаж удален', {
          description: 'Персонаж удален из вашей коллекции'
        })
        break

      case 'trigger_action':
        toast.info('Действие выполнено', {
          description: `Действие "${consequence.actionId}" выполнено с интенсивностью ${consequence.actionIntensity || 1}`
        })
        break

      case 'end_scene':
        toast.info('Сцена завершена', {
          description: 'Сцена была завершена этим выбором'
        })
        break

      case 'change_story_point':
        toast.success('Сюжетная точка изменена', {
          description: `Сюжетная точка "${consequence.storyPointId}" изменена на ${consequence.storyPointChange}`
        })
        break

      default:
        toast.info('Последствие применено', {
          description: `Тип: ${consequence.type}`
        })
    }
  }

  const goBack = () => {
    if (screenHistory.length > 1) {
      const newHistory = [...screenHistory]
      newHistory.pop() // Убираем текущий экран
      const previousScreenId = newHistory[newHistory.length - 1]
      const previousScreen = scene.screens.find(s => s.id === previousScreenId)

      if (previousScreen) {
        setCurrentScreen(previousScreen)
        setScreenHistory(newHistory)
      }
    }
  }

  if (!currentScreen) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-gray-900 border-gray-700 text-white">
          <CardContent className="p-6 text-center">
            <p className="text-gray-400">Загрузка предпросмотра...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-gray-900 border-gray-700 text-white overflow-hidden">
        {/* Заголовок сцены */}
        <CardHeader className="border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-white">Предпросмотр: {scene.name}</CardTitle>
                {scene.description && (
                  <p className="text-gray-400 text-sm mt-1">{scene.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Экран {screenHistory.length} из {scene.screens.length}
                {scene.probability && ` • ${scene.probability}%`}
              </Badge>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Навигация */}
          {screenHistory.length > 1 && (
            <div className="mb-4">
              <Button
                onClick={goBack}
                variant="outline"
                size="sm"
                className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
              >
                ← Назад
              </Button>
            </div>
          )}

          {/* Контент экрана */}
          <div className="space-y-6">
            {/* Текст экрана */}
            {currentScreen.content?.text && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-600 rounded-lg flex-shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-2">{currentScreen.name}</h3>
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {currentScreen.content.text}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Фоновое изображение */}
            {currentScreen.content?.background && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-white font-medium">Фоновое изображение</p>
                </div>
                <img
                  src={currentScreen.content.background}
                  alt="Фон сцены"
                  className="w-full max-h-64 object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* Дополнительные изображения */}
            {currentScreen.content?.images && currentScreen.content.images.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-white font-medium">Изображения</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {currentScreen.content.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`Изображение ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Фоновая музыка */}
            {currentScreen.content?.music && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-white font-medium">Фоновая музыка</p>
                </div>
                <audio controls className="w-full">
                  <source src={currentScreen.content.music} type="audio/mpeg" />
                  Ваш браузер не поддерживает аудио элемент.
                </audio>
              </div>
            )}

            {/* Дополнительные аудио файлы */}
            {currentScreen.content?.audio && currentScreen.content.audio.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-white font-medium">Аудио файлы</p>
                </div>
                <div className="space-y-2">
                  {currentScreen.content.audio.map((audio, index) => (
                    <audio key={index} controls className="w-full">
                      <source src={audio} type="audio/mpeg" />
                      Аудио файл {index + 1}
                    </audio>
                  ))}
                </div>
              </div>
            )}

            {/* Видео файлы */}
            {currentScreen.content?.videos && currentScreen.content.videos.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-white font-medium">Видео файлы</p>
                </div>
                <div className="space-y-3">
                  {currentScreen.content.videos.map((video, index) => (
                    <video key={index} controls className="w-full max-h-64">
                      <source src={video} type="video/mp4" />
                      Видео файл {index + 1}
                    </video>
                  ))}
                </div>
              </div>
            )}

            {/* Выборы */}
            {currentScreen.choices && currentScreen.choices.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  Ваш выбор:
                </h3>

                <div className="grid gap-3">
                  {currentScreen.choices.map((choice) => (
                    <Button
                      key={choice.id}
                      onClick={() => handleChoiceClick(choice)}
                      disabled={isProcessing}
                      className="w-full justify-start bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white p-4 h-auto"
                      variant="outline"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-shrink-0">
                          {selectedChoice === choice.id && isProcessing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{choice.text}</p>
                          {choice.description && (
                            <p className="text-sm text-gray-400 mt-1">{choice.description}</p>
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
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="text-gray-400 mb-4">Сцена завершена</p>
                  <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-500">
                    Закрыть предпросмотр
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
