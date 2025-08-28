import { useState, useEffect } from 'react';
import { Talent, Equipment, GameConfig, User } from '../types/game';

export const useGameState = () => {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Состояние пользователя
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRegistration, setShowRegistration] = useState(true);

  // Игровые ресурсы
  const [credits, setCredits] = useState(5000);
  const [neuralPulses, setNeuralPulses] = useState(100);
  const [reputation, setReputation] = useState(75);
  const [currentDay, setCurrentDay] = useState(1);

  // Таланты и оборудование
  const [talents, setTalents] = useState<Talent[]>([]);
  const [userEquipment, setUserEquipment] = useState<Equipment[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<Equipment[]>([]);

  // UI состояние
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState('talents');

  return {
    // Конфигурация
    gameConfig,
    setGameConfig,
    configLoading,
    setConfigLoading,
    configError,
    setConfigError,

    // Пользователь
    currentUser,
    setCurrentUser,
    showRegistration,
    setShowRegistration,

    // Ресурсы
    credits,
    setCredits,
    neuralPulses,
    setNeuralPulses,
    reputation,
    setReputation,
    currentDay,
    setCurrentDay,

    // Таланты и оборудование
    talents,
    setTalents,
    userEquipment,
    setUserEquipment,
    filteredInventory,
    setFilteredInventory,

    // UI
    selectedTalent,
    setSelectedTalent,
    showCharacterPanel,
    setShowCharacterPanel,
    showLogoutModal,
    setShowLogoutModal,
    activeTab,
    setActiveTab,
  };
};

