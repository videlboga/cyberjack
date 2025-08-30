import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Save, RotateCcw, ChevronDown, ChevronRight, Info } from "lucide-react"

interface CharacterEditorProps {
  character: any
  onUpdateCharacter: (character: any) => void
  showSaveButton?: boolean
}

export const CharacterEditor = ({ character, onUpdateCharacter, showSaveButton = false }: CharacterEditorProps) => {
  const [editedCharacter, setEditedCharacter] = useState(character)
  const [hasChanges, setHasChanges] = useState(false)
  const [openCategory, setOpenCategory] = useState<string>('physical')

  // Синхронизация с изменениями персонажа
  useEffect(() => {
    setEditedCharacter(character)
    setHasChanges(false)
  }, [character])

  // Обновление характеристики
  const updateCharacteristic = (category: string, statKey: string, value: number) => {
    // Маппинг внутренних ключей на русские названия для сохранения
    const statNameMapping: { [key: string]: string } = {
      endurance: 'Выносливость',
      sensitivity: 'Чувствительность',
      flexibility: 'Гибкость',
      emotionalStability: 'Эмоциональная стабильность',
      adaptability: 'Адаптивность',
      intelligence: 'Интеллект',
      sociability: 'Общительность',
      empathy: 'Эмпатия',
      dominance: 'Доминантность',
      selfEsteem: 'Самооценка',
      optimism: 'Оптимизм',
      curiosity: 'Любопытство',
      sexualExperience: 'Сексуальная опытность',
      resistance: 'Сопротивляемость',
      dependency: 'Зависимость'
    }

    const statName = statNameMapping[statKey] || statKey

    // Определяем категорию для сохранения
    let categoryKey = ''
    if (['endurance', 'sensitivity', 'flexibility'].includes(statKey)) {
      categoryKey = 'physical'
    } else if (['emotionalStability', 'adaptability', 'intelligence'].includes(statKey)) {
      categoryKey = 'psychological'
    } else if (['sociability', 'empathy', 'dominance'].includes(statKey)) {
      categoryKey = 'social'
    } else if (['selfEsteem', 'optimism', 'curiosity'].includes(statKey)) {
      categoryKey = 'personality'
    } else if (['sexualExperience', 'resistance', 'dependency'].includes(statKey)) {
      categoryKey = 'special'
    }

    const updated = {
      ...editedCharacter,
      characteristics: {
        ...editedCharacter.characteristics,
        [categoryKey]: {
          ...editedCharacter.characteristics?.[categoryKey],
          [statName]: value
        }
      }
    }
    setEditedCharacter(updated)
    setHasChanges(true)
  }

  // Обновление состояния
  const updateState = (stateKey: string, value: number) => {
    // Маппинг внутренних ключей на русские названия для состояний
    const stateNameMapping: { [key: string]: string } = {
      mood: 'Настроение',
      anxiety: 'Тревожность',
      burnout: 'Выгорание',
      engagement: 'Вовлеченность',
      entitlement: 'Чувство права',
      insight: 'Проницательность',
      routine: 'Рутина',
      compliance: 'Послушание',
      neuroplasticity: 'Нейропластичность',
      cognitiveLoad: 'Когнитивная нагрузка'
    }

    const stateName = stateNameMapping[stateKey] || stateKey

    const updated = {
      ...editedCharacter,
      states: {
        ...editedCharacter.states,
        [stateName]: value
      }
    }
    setEditedCharacter(updated)
    setHasChanges(true)
  }

  // Обновление фетиша
  const updateFetish = (fetishKey: string, value: number) => {
    const updated = {
      ...editedCharacter,
      fetishes: {
        ...editedCharacter.fetishes,
        [fetishKey]: value
      }
    }
    setEditedCharacter(updated)
    setHasChanges(true)
  }

  // Сохранение изменений
  const handleSave = () => {
    if (onUpdateCharacter) {
      onUpdateCharacter(editedCharacter)
      setHasChanges(false)
    }
  }

  // Сброс изменений
  const handleReset = () => {
    setEditedCharacter(JSON.parse(JSON.stringify(character))) // Глубокая копия
    setHasChanges(false)
  }

  const toggleCategory = (category: string) => {
    setOpenCategory(openCategory === category ? '' : category)
  }

  const getStatDisplayName = (stat: string): string => {
    const displayNames: { [key: string]: string } = {
      // Физические характеристики
      endurance: 'Выносливость',
      sensitivity: 'Чувствительность',
      flexibility: 'Гибкость',

      // Психологические характеристики
      emotionalStability: 'Эмоциональная стабильность',
      adaptability: 'Адаптивность',
      intelligence: 'Интеллект',

      // Социальные характеристики
      sociability: 'Общительность',
      empathy: 'Эмпатия',
      dominance: 'Доминантность',

      // Личностные характеристики
      selfEsteem: 'Самооценка',
      optimism: 'Оптимизм',
      curiosity: 'Любопытство',

      // Специальные характеристики
      sexualExperience: 'Сексуальная опытность',
      resistance: 'Сопротивляемость',
      dependency: 'Зависимость',

      // Состояния
      mood: 'Настроение',
      anxiety: 'Тревожность',
      burnout: 'Выгорание',
      engagement: 'Вовлеченность',
      entitlement: 'Чувство права',
      insight: 'Проницательность',
      routine: 'Рутина',
      compliance: 'Послушание',
      neuroplasticity: 'Нейропластичность',
      cognitiveLoad: 'Когнитивная нагрузка',

      // Фетиши
      innocence: 'Невинность',
      curiosity: 'Любопытство',
      tenderness: 'Нежность',
      attention: 'Внимание',
      trust: 'Доверие',
      submission: 'Подчинение',
      play: 'Игра',
      dependency: 'Зависимость'
    }

    return displayNames[stat] || stat
  }

  const getStatDescription = (statName: string) => {
    const descriptions: { [key: string]: string } = {
      endurance: "Способность выдерживать физические нагрузки и длительные эксперименты",
      sensitivity: "Восприимчивость к физическим и эмоциональным воздействиям",
      flexibility: "Физическая гибкость и способность принимать различные позы",
      emotionalStability: "Способность контролировать эмоции и сохранять психическое равновесие",
      adaptability: "Способность приспосабливаться к новым условиям и ситуациям",
      intelligence: "Умственные способности и способность анализировать ситуацию",
      sociability: "Способность и желание общаться с другими людьми",
      empathy: "Способность понимать и чувствовать эмоции других людей",
      dominance: "Стремление к лидерству и контролю над ситуацией",
      selfEsteem: "Восприятие собственной ценности и достоинства",
      optimism: "Вера в лучшее будущее и положительный взгляд на жизнь",
      curiosity: "Стремление к новым знаниям и опыту",
      sexualExperience: "Опыт в интимных отношениях и сексуальных практиках",
      resistance: "Способность сопротивляться принуждению и манипуляциям",
      dependency: "Склонность к формированию эмоциональных и физических зависимостей",
      mood: "Текущее эмоциональное состояние",
      anxiety: "Уровень тревожности и беспокойства",
      burnout: "Степень эмоционального выгорания",
      engagement: "Вовлеченность в текущую деятельность",
      entitlement: "Чувство права на определенные вещи",
      insight: "Способность к самоанализу и пониманию",
      routine: "Привычка к рутинным действиям",
      compliance: "Склонность к послушанию и подчинению",
      neuroplasticity: "Способность мозга адаптироваться к изменениям",
      cognitiveLoad: "Текущая нагрузка на когнитивные функции"
    }

    return descriptions[statName] || "Описание недоступно"
  }

  // Безопасное получение данных - адаптация под существующую структуру
  const characteristics = editedCharacter.characteristics || {}
  const states = editedCharacter.states || {}

  const categories = {
    physical: {
      name: "Физические",
      icon: "💪",
      isState: false,
      stats: {
        endurance: characteristics.physical?.["Выносливость"] ?? characteristics.physical?.["endurance"] ?? 0,
        sensitivity: characteristics.physical?.["Чувствительность"] ?? characteristics.physical?.["sensitivity"] ?? 0,
        flexibility: characteristics.physical?.["Гибкость"] ?? characteristics.physical?.["flexibility"] ?? 0,
      }
    },
    psychological: {
      name: "Психологические",
      icon: "🧠",
      isState: false,
      stats: {
        emotionalStability: characteristics.psychological?.["Эмоциональная стабильность"] ?? characteristics.psychological?.["emotionalStability"] ?? 0,
        adaptability: characteristics.psychological?.["Адаптивность"] ?? characteristics.psychological?.["adaptability"] ?? 0,
        intelligence: characteristics.psychological?.["Интеллект"] ?? characteristics.psychological?.["intelligence"] ?? 0,
      }
    },
    social: {
      name: "Социальные",
      icon: "👥",
      isState: false,
      stats: {
        sociability: characteristics.social?.["Общительность"] ?? characteristics.social?.["sociability"] ?? 0,
        empathy: characteristics.social?.["Эмпатия"] ?? characteristics.social?.["empathy"] ?? 0,
        dominance: characteristics.social?.["Доминантность"] ?? characteristics.social?.["dominance"] ?? 0,
      }
    },
    personal: {
      name: "Личностные",
      icon: "🌟",
      isState: false,
      stats: {
        selfEsteem: characteristics.personality?.["Самооценка"] ?? characteristics.personality?.["selfEsteem"] ?? 0,
        optimism: characteristics.personality?.["Оптимизм"] ?? characteristics.personality?.["optimism"] ?? 0,
        curiosity: characteristics.personality?.["Любопытство"] ?? characteristics.personality?.["curiosity"] ?? 0,
      }
    },
    special: {
      name: "Специальные",
      icon: "⭐",
      isState: false,
      stats: {
        sexualExperience: characteristics.special?.["Сексуальная опытность"] ?? characteristics.special?.["sexualExperience"] ?? 0,
        resistance: characteristics.special?.["Сопротивляемость"] ?? characteristics.special?.["resistance"] ?? 0,
        dependency: characteristics.special?.["Зависимость"] ?? characteristics.special?.["dependency"] ?? 0,
      }
    },
    states: {
      name: "Состояния",
      icon: "📊",
      isState: true,
      stats: states
    },
    fetishes: {
      name: "Фетиши",
      icon: "💋",
      isState: false,
      stats: editedCharacter.fetishes || {}
    }
  }

  return (
    <div className="space-y-4">
      {/* Кнопки управления */}
      {showSaveButton && hasChanges && (
        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm" className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Сохранить изменения
          </Button>
          <Button onClick={handleReset} size="sm" variant="outline" className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Сбросить
          </Button>
        </div>
      )}

      {/* Категории характеристик */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {Object.entries(categories).map(([categoryKey, category]) => {
          const isOpen = openCategory === categoryKey
          const hasStats = Object.keys(category.stats).length > 0

          if (!hasStats) return null

          return (
            <Card key={categoryKey} className="border border-gray-600">
              <CardHeader className="pb-3">
                <button
                  onClick={() => toggleCategory(categoryKey)}
                  className="w-full flex items-center justify-between hover:bg-gray-700/30 rounded p-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{category.icon}</span>
                    <span className="font-medium">{category.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(category.stats).length}
                    </Badge>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </CardHeader>

              {isOpen && (
                <CardContent className="space-y-3">
                  {Object.entries(category.stats).map(([statKey, value]) => {
                    const numValue = typeof value === 'number' ? value : 0
                    const maxValue = category.isState ? 100 : 10

                    return (
                      <div key={statKey} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{getStatDisplayName(statKey)}</span>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-500 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 max-w-xs">
                                {getStatDescription(statKey)}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {numValue}/{maxValue}
                          </Badge>
                        </div>

                        <Slider
                          value={[numValue]}
                          onValueChange={(newValue) => {
                            if (category.isState) {
                              updateState(statKey, newValue[0])
                            } else if (categoryKey === 'fetishes') {
                              updateFetish(statKey, newValue[0])
                            } else {
                              updateCharacteristic(categoryKey, statKey, newValue[0])
                            }
                          }}
                          max={maxValue}
                          min={0}
                          step={1}
                          className="w-full"
                        />

                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0</span>
                          <span className="font-medium text-cyan-400">{numValue}</span>
                          <span>{maxValue}</span>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
