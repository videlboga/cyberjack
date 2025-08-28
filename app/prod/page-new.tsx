'use client';

import * as React from 'react';
import { useGameState } from './components/hooks/useGameState';
import { MainLayout } from './components/layout/MainLayout';
import { LoadingSpinner, ErrorDisplay, ConfigNotFound } from './components/ui/LoadingStates';
import { TalentList } from './components/game/TalentList';
import { Talent, GameConfig } from './components/types/game';

export default function TalentArchitectProdNew() {
  const gameState = useGameState();
  const {
    gameConfig,
    setGameConfig,
    configLoading,
    setConfigLoading,
    configError,
    setConfigError,
    currentUser,
    setCurrentUser,
    showRegistration,
    setShowRegistration,
    talents,
    setTalents,
    userEquipment,
    setUserEquipment,
    filteredInventory,
    setFilteredInventory,
    selectedTalent,
    setSelectedTalent,
    activeTab,
    setActiveTab,
  } = gameState;

  // Загрузка конфигурации
  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        setConfigLoading(true);

        // Временный мок конфигурации для тестирования
        const mockConfig: GameConfig = {
          assets: {
            assets: [
              {
                id: 'talent-1',
                name: 'Тестовый Талант',
                role: 'Разработчик',
                level: 3,
                attributes: {
                  strength: 50,
                  empathy: 70,
                  intelligence: 85,
                  creativity: 60,
                  temperament: 55,
                  endurance: 65,
                  sensitivity: 75,
                  flexibility: 70,
                  emotionalStability: 80,
                  adaptability: 75,
                  sociability: 70,
                  dominance: 60,
                  selfEsteem: 75,
                  optimism: 80,
                  curiosity: 85,
                  engagement: 70,
                  entitlement: 65,
                  insight: 80,
                  routine: 60,
                  compliance: 75,
                  neuroplasticity: 85,
                  cognitiveLoad: 55,
                },
                skills: { programming: 80, design: 70 },
                states: { mood: 75, energy: 80 },
                statusEffects: [],
                memories: ['Создан для тестирования'],
                experience: 1500,
                equippedItems: [],
                inventory: [],
                affinities: {},
                stressors: {},
              }
            ]
          },
          equipment: {
            equipment: []
          },
          users: {
            users: []
          },
          contracts: {
            available: []
          },
          events: {
            events: []
          },
          actions: {
            categories: {}
          }
        };

        setGameConfig(mockConfig);
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигурации:', error);
        setConfigError(error instanceof Error ? error.message : 'Неизвестная ошибка загрузки');
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, [setGameConfig, setConfigLoading, setConfigError]);

  // Загрузка данных пользователя
  React.useEffect(() => {
    if (gameConfig?.users?.users) {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);
          setShowRegistration(false);
        } catch (error) {
          console.error('Ошибка загрузки пользователя:', error);
        }
      }
    }
  }, [gameConfig, setCurrentUser, setShowRegistration]);

  // Загрузка талантов и оборудования
  React.useEffect(() => {
    if (gameConfig?.assets?.assets && gameConfig?.equipment?.equipment && currentUser) {
      // Загружаем таланты пользователя
      const userTalents = gameConfig.assets.assets.filter(asset =>
        currentUser.characters?.includes(asset.id) || currentUser.assets?.includes(asset.id)
      );
      setTalents(userTalents);

      // Загружаем оборудование пользователя
      const userEquipmentList = gameConfig.equipment.equipment.filter(equipment =>
        currentUser.userEquipment?.includes(equipment.id)
      );
      setUserEquipment(userEquipmentList);
      setFilteredInventory(userEquipmentList);
    }
  }, [gameConfig, currentUser, setTalents, setUserEquipment, setFilteredInventory]);

  // Обработка загрузки
  if (configLoading) {
    return <LoadingSpinner />;
  }

  // Обработка ошибок
  if (configError) {
    return <ErrorDisplay error={configError} onRetry={() => window.location.reload()} />;
  }

  // Обработка отсутствия конфигурации
  if (!gameConfig) {
    return <ConfigNotFound onRetry={() => window.location.reload()} />;
  }

  // Рендер основного интерфейса
  return (
    <MainLayout
      talents={talents}
      userEquipment={userEquipment}
      credits={5000} // TODO: взять из gameState
      neuralPulses={100} // TODO: взять из gameState
      reputation={75} // TODO: взять из gameState
      currentDay={1} // TODO: взять из gameState
      selectedTalent={selectedTalent}
      onTalentSelect={setSelectedTalent}
      onEquipmentToggle={(id) => console.log('Toggle equipment:', id)}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="p-6">
        {activeTab === 'talents' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Таланты</h2>
            <TalentList
              talents={talents}
              selectedTalent={selectedTalent}
              onTalentSelect={setSelectedTalent}
            />
          </div>
        )}

        {activeTab === 'market' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Рынок</h2>
            <p className="text-gray-400">Функционал рынка в разработке...</p>
          </div>
        )}

        {activeTab === 'station' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Станция</h2>
            <p className="text-gray-400">Функционал станции в разработке...</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
