import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

interface CharacterStatsPanelProps {
  talent: any;
  isVisible: boolean;
  onClose: () => void;
}

export function CharacterStatsPanel({ talent, isVisible, onClose }: CharacterStatsPanelProps) {
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

  const toggleCategory = (category: string) => {
    setOpenCategory(openCategory === category ? '' : category);
  };

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
  const attributes = talent.attributes || {};
  const states = talent.states || {};

  // Эталонная система характеристик согласно документации
  const categories = {
    physical: {
      name: "Физические",
      icon: "💪",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        endurance: attributes.endurance || 0,
        sensitivity: attributes.sensitivity || 0,
        flexibility: attributes.flexibility || 0,
      }
    },
    psychological: {
      name: "Психологические", 
      icon: "🧠",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        emotionalStability: attributes.emotionalStability || 0,
        adaptability: attributes.adaptability || 0,
        intelligence: attributes.intelligence || 0,
      }
    },
    social: {
      name: "Социальные",
      icon: "👥", 
      isState: false, // Характеристики по шкале 0-10
      stats: {
        sociability: attributes.sociability || 0,
        empathy: attributes.empathy || 0,
        dominance: attributes.dominance || 0,
      }
    },
    personal: {
      name: "Личностные",
      icon: "🌟",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        selfEsteem: attributes.selfEsteem || 0,
        optimism: attributes.optimism || 0,
        curiosity: attributes.curiosity || 0,
      }
    },
    special: {
      name: "Специальные",
      icon: "⭐",
      isState: false, // Характеристики по шкале 0-10
      stats: {
        sexualExperience: attributes.sexualExperience || 0,
        resistance: attributes.resistance || 0,
        dependency: attributes.dependency || 0,
      }
    },
    states: {
      name: "Состояния",
      icon: "📊",
      isState: true, // Состояния по шкале 0-100
      stats: states
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
        <h3 className="font-semibold text-cyan-400 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <span>Характеристики {talent.name || 'Персонажа'}</span>
        </h3>
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
                    const displayValue = category.isState ? numValue : numValue;
                    
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
                          <span className={`text-sm font-bold ${getStatColor(numValue, category.isState)}`}>
                            {displayValue}/{maxValue}
                          </span>
                        </div>
                        <Progress value={category.isState ? numValue : numValue * 10} className="h-1" />
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
    cognitiveLoad: 'Когнитивная нагрузка'
  };
  
  return displayNames[stat] || stat;
}
