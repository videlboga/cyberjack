import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Info, Edit, Save, RotateCcw } from 'lucide-react';

interface CharacterStatsPanelProps {
  talent: any;
  isVisible: boolean;
  onClose: () => void;
  onUpdateCharacter?: (updatedCharacter: any) => void;
}

export function CharacterStatsPanel({ talent, isVisible, onClose, onUpdateCharacter }: CharacterStatsPanelProps) {
  const [position, setPosition] = useState(() => {
    // Центрируем панель при первом открытии
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(0, (window.innerWidth - 400) / 2),
        y: Math.max(0, (window.innerHeight - 500) / 2)
      }
    }
    return { x: 100, y: 100 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [openCategory, setOpenCategory] = useState<string>('physical'); // Только один раздел открыт
  const [isEditMode, setIsEditMode] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [editedTalent, setEditedTalent] = useState<any>(talent)

  // Переключение режима редактирования
  const toggleEditMode = () => {
    if (isEditMode && hasChanges) {
      // Если есть изменения, спросить о сохранении
      if (confirm('Есть несохраненные изменения. Сохранить их?')) {
        handleSave()
      } else {
        // Отменить изменения
        setEditedTalent(talent)
        setHasChanges(false)
      }
    }
    setIsEditMode(!isEditMode)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Ограничиваем позицию границами экрана
      const maxX = window.innerWidth - 400 // w-96 = 400px
      const maxY = window.innerHeight - 500 // примерная высота панели
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  // Синхронизируем editedTalent при изменении talent
  useEffect(() => {
    setEditedTalent(talent)
    setHasChanges(false)
  }, [talent])

  const toggleCategory = (category: string) => {
    setOpenCategory(openCategory === category ? '' : category);
  };

  // Обновление характеристики
  const updateCharacteristic = (category: string, statKey: string, value: number) => {
    const updated = {
      ...editedTalent,
      attributes: {
        ...editedTalent.attributes,
        [statKey]: value
      }
    }
    setEditedTalent(updated)
    setHasChanges(true)
  }

  // Обновление состояния
  const updateState = (stateKey: string, value: number) => {
    const updated = {
      ...editedTalent,
      states: {
        ...editedTalent.states,
        [stateKey]: value
      }
    }
    setEditedTalent(updated)
    setHasChanges(true)
  }

  // Обновление фетиша
  const updateFetish = (fetishKey: string, value: number) => {
    const updated = {
      ...editedTalent,
      fetishes: {
        ...editedTalent.fetishes,
        [fetishKey]: value
      }
    }
    setEditedTalent(updated)
    setHasChanges(true)
  }

  // Сохранение изменений
  const handleSave = () => {
    if (onUpdateCharacter) {
      onUpdateCharacter(editedTalent)
      setHasChanges(false)
    }
  }

  // Сброс изменений
  const handleReset = () => {
    setEditedTalent(talent)
    setHasChanges(false)
  }

  const getStatColor = (value: number, isState: boolean = false) => {
    const maxValue = isState ? 100 : 10;
    const normalizedValue = value / maxValue * 100;
    
    if (normalizedValue >= 80) return "text-green-400";
    if (normalizedValue >= 60) return "text-blue-400";
    if (normalizedValue >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getStatDescription = (statName: string) => {
    const descriptions: { [key: string]: string } = {
      // Физические характеристики (0-10)
      endurance: "Способность выдерживать физические нагрузки и длительные эксперименты",
      sensitivity: "Восприимчивость к физическим и эмоциональным воздействиям",
      flexibility: "Физическая гибкость и способность принимать различные позы",
      
      // Психологические характеристики (0-10)
      emotionalStability: "Способность контролировать эмоции и сохранять психическое равновесие",
      adaptability: "Способность приспосабливаться к новым условиям и ситуациям",
      intelligence: "Умственные способности и способность анализировать ситуацию",
      
      // Социальные характеристики (0-10)
      sociability: "Способность и желание общаться с другими людьми",
      empathy: "Способность понимать и чувствовать эмоции других людей",
      dominance: "Стремление к лидерству и контролю над ситуацией",
      
      // Личностные характеристики (0-10)
      selfEsteem: "Восприятие собственной ценности и достоинства",
      optimism: "Вера в лучшее будущее и положительный взгляд на жизнь",
      curiosity: "Стремление к новым знаниям и опыту",
      
      // Специальные характеристики (0-10)
      sexualExperience: "Опыт в интимных отношениях и сексуальных практиках",
      resistance: "Способность сопротивляться принуждению и манипуляциям",
      dependency: "Склонность к формированию эмоциональных и физических зависимостей",
      
      // Состояния (0-100)
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
    };
    
    return descriptions[statName] || "Описание недоступно";
  };

  if (!isVisible || !talent) return null;

  // Безопасное получение данных с проверками
  const currentTalent = isEditMode ? editedTalent : talent;
  const attributes = currentTalent.attributes || {};
  const states = currentTalent.states || {};

  // Эталонная система характеристик согласно документации
  const categories = {
    physical: {
      name: "Физические",
      icon: "💪",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        endurance: attributes.endurance ?? 0,
        sensitivity: attributes.sensitivity ?? 0,
        flexibility: attributes.flexibility ?? 0,
      }
    },
    psychological: {
      name: "Психологические", 
      icon: "🧠",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        emotionalStability: attributes.emotionalStability ?? 0,
        adaptability: attributes.adaptability ?? 0,
        intelligence: attributes.intelligence ?? 0,
      }
    },
    social: {
      name: "Социальные",
      icon: "👥", 
      isState: false, // Характеристики по шкале 0-10
      stats: {
        sociability: attributes.sociability ?? 0,
        empathy: attributes.empathy ?? 0,
        dominance: attributes.dominance ?? 0,
      }
    },
    personal: {
      name: "Личностные",
      icon: "🌟",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        selfEsteem: attributes.selfEsteem ?? 0,
        optimism: attributes.optimism ?? 0,
        curiosity: attributes.curiosity ?? 0,
      }
    },
    special: {
      name: "Специальные",
      icon: "⭐",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        sexualExperience: attributes.sexualExperience ?? 0,
        resistance: attributes.resistance ?? 0,
        dependency: attributes.dependency ?? 0,
      }
    },
    states: {
      name: "Состояния",
      icon: "📊",
      isState: true, // Состояния по шкале 0-100
      stats: states
    },
    fetishes: {
      name: "Фетиши",
      icon: "💋",
      isState: false, // Фетиши по шкале 0-10
      stats: currentTalent.fetishes || {}
    }
  };

  return (
    <div 
      className="fixed glass-panel border border-cyan-500/50 rounded-lg z-50 w-96 flex flex-col cursor-move"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="p-3 border-b border-gray-600 flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center justify-between flex-1">
          <h3 className="font-semibold text-cyan-400 flex items-center gap-2">
            <span className="text-2xl">{isEditMode ? '✏️' : '📊'}</span>
            <span>
              {isEditMode ? 'Редактирование' : 'Характеристики'} {currentTalent.name || 'Персонажа'}
            </span>
            {hasChanges && (
              <Badge variant="outline" className="text-xs text-orange-400 border-orange-400">
                Изменения не сохранены
              </Badge>
            )}
            {isEditMode && (
              <Badge variant="outline" className="text-xs text-green-400 border-green-400">
                Режим редактирования
              </Badge>
            )}
          </h3>
          {onUpdateCharacter && (
            <div className="flex items-center gap-1">
              {isEditMode ? (
                <>
                  {hasChanges && (
                    <Button
                      onClick={handleReset}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-orange-400 hover:text-orange-300"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
                    disabled={!hasChanges}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                </>
              ) : null}
              <Button
                onClick={toggleEditMode}
                size="sm"
                variant="ghost"
                className={`h-6 w-6 p-0 hover:text-cyan-300 ${isEditMode ? 'text-green-400' : 'text-cyan-400'}`}
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      <div className="p-4">
        {Object.entries(categories).map(([categoryKey, category]) => {
          const isOpen = openCategory === categoryKey;
          const hasStats = Object.keys(category.stats).length > 0;
          
          if (!hasStats) return null;
          
          return (
            <div key={categoryKey} className="mb-3">
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-700/50 rounded transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  <span className="font-medium text-white">{category.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {Object.keys(category.stats).length}
                  </Badge>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              
              {isOpen && (
                <div className="mt-2 space-y-2">
                  {Object.entries(category.stats).map(([statKey, value]) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    const maxValue = category.isState ? 100 : 10;
                    const isHidden = !category.isState && numValue === 0;
                    const displayValue = category.isState ? numValue : (isHidden ? '❓' : numValue);
                    
                    return (
                      <div key={statKey} className="p-2 bg-gray-800/50 rounded border border-gray-600">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-300">
                              {getStatDisplayName(statKey)}
                            </span>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-500 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {getStatDescription(statKey)}
                              </div>
                            </div>
                          </div>
                          {isEditMode && onUpdateCharacter ? (
                            <Badge variant="secondary" className="text-xs">
                              {displayValue}/{maxValue}
                            </Badge>
                          ) : (
                            <span className={`text-sm font-bold ${isHidden ? 'text-gray-500' : getStatColor(numValue, category.isState)}`}>
                              {displayValue}/{maxValue}
                            </span>
                          )}
                        </div>

                        {isEditMode && onUpdateCharacter ? (
                          <div className="mt-2">
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
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>0</span>
                              <span className="font-medium text-cyan-400">{numValue}</span>
                              <span>{maxValue}</span>
                            </div>
                          </div>
                        ) : (
                          <Progress value={category.isState ? numValue : (isHidden ? 0 : numValue * 10)} className={`h-1 ${isHidden ? 'opacity-30' : ''}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatDisplayName(stat: string): string {
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
    
    // Дополнительные состояния
    fear: 'Страх',
    despair: 'Отчаяние',
    devotion: 'Преданность',
    trust: 'Доверие',
    relationship: 'Отношения',
    pleasure: 'Удовольствие',
    pain: 'Боль',
    arousal: 'Возбуждение',
    stress: 'Стресс',
    happiness: 'Счастье',
    sadness: 'Грусть',
    anger: 'Гнев',
    shame: 'Стыд',
    guilt: 'Вина',
    pride: 'Гордость',
    humiliation: 'Унижение',
    vulnerability: 'Уязвимость',
    confidence: 'Уверенность',
    helplessness: 'Беспомощность',
    submission: 'Подчинение',
    dominance_state: 'Доминирование',
    fatigue: 'Усталость',
    health: 'Здоровье',
    endurance_state: 'Выносливость',
    sensuality: 'Чувственность',
    awareness: 'Осознанность',
    sensory_overload: 'Сенсорная перегрузка',
    mental_state: 'Психическое состояние',
    strength: 'Сила',
    creativity: 'Креативность',

    // Фетиши
    innocence: 'Невинность',
    curiosity: 'Любопытство',
    tenderness: 'Нежность',
    attention: 'Внимание',
    trust: 'Доверие',
    submission: 'Подчинение',
    play: 'Игра',
    dependency: 'Зависимость'
  };
  
  return displayNames[stat] || stat;
}
