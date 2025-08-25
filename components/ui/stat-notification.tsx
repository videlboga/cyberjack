import React, { useEffect, useState } from 'react';

interface StatChange {
  stat: string;
  change: number;
  timestamp: number;
}

interface StatNotificationProps {
  changes: StatChange[];
  onRemove: (timestamp: number) => void;
}

export function StatNotification({ changes, onRemove }: StatNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {changes.map((change) => (
        <div
          key={change.timestamp}
          className={`
            p-3 rounded-lg shadow-lg border backdrop-blur-sm
            animate-in slide-in-from-right-2 duration-300
            ${change.change > 0 
              ? 'bg-green-500/20 border-green-400/50 text-green-100' 
              : 'bg-red-500/20 border-red-400/50 text-red-100'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {change.change > 0 ? '↗' : '↘'}
            </span>
            <div>
              <div className="font-medium text-sm">
                {getStatDisplayName(change.stat)}
              </div>
              <div className="text-xs opacity-80">
                {change.change > 0 ? '+' : ''}{change.change}
              </div>
            </div>
          </div>
        </div>
      ))}
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
    fetishSensitivity: 'Чувствительность к фетишам',
    fetishDiscovery: 'Готовность к открытиям',
    
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
