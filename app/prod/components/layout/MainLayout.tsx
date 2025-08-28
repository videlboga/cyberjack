import * as React from 'react';
import { Talent, Equipment } from '../types/game';

interface MainLayoutProps {
  children: React.ReactNode;
  talents: Talent[];
  userEquipment: Equipment[];
  credits: number;
  neuralPulses: number;
  reputation: number;
  currentDay: number;
  selectedTalent?: Talent | null;
  onTalentSelect: (talent: Talent) => void;
  onEquipmentToggle: (equipmentId: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  talents,
  userEquipment,
  credits,
  neuralPulses,
  reputation,
  currentDay,
  selectedTalent,
  onTalentSelect,
  onEquipmentToggle,
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: 'talents', label: 'Таланты', icon: '👥' },
    { id: 'market', label: 'Рынок', icon: '🛒' },
    { id: 'station', label: 'Станция', icon: '🏢' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      {/* Фоновое изображение */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center"
        style={{ backgroundImage: "url(/futuristic-space-station.png)" }}
      />

      <div className="relative z-10 flex h-screen">
        {/* Левая панель - Список талантов */}
        <div className="w-80 glass-panel border-r border-cyan-500/30 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Nexus Enslaver
              </h1>
              <div className="text-sm text-gray-300 mt-1">
                День {currentDay} | Кредиты: {credits} | Нейрон: {neuralPulses}
              </div>
            </div>
          </div>

          {/* Список талантов */}
          <div className="space-y-2">
            {talents.map((talent) => (
              <div
                key={talent.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedTalent?.id === talent.id
                    ? 'bg-cyan-600/30 border border-cyan-500/50'
                    : 'bg-gray-800/50 hover:bg-gray-700/50'
                }`}
                onClick={() => onTalentSelect(talent)}
              >
                <div className="font-medium">{talent.name}</div>
                <div className="text-sm text-gray-300">{talent.role} • Ур. {talent.level}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Центральная область */}
        <div className="flex-1 flex flex-col">
          {/* Верхняя панель с вкладками */}
          <div className="h-16 bg-gray-900/80 border-b border-cyan-500/30 flex items-center px-6">
            <div className="flex space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Статистика в правом углу */}
            <div className="ml-auto flex items-center space-x-4 text-sm">
              <div>Репутация: {reputation}</div>
              <div>Оборудование: {userEquipment.length}</div>
            </div>
          </div>

          {/* Основной контент */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
