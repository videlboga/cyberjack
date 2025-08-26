import { useState, useEffect, useCallback } from 'react';
import { MessageAnalysisService } from '@/lib/character/message-analysis-service';
import { PoseManagementService } from '@/lib/character/pose-management-service';
import { loadCharacterAIConfig } from '@/lib/character/config-loader';
import { 
  CharacterAIConfig, 
  InteractiveAction, 
  InteractiveTool, 
  InteractiveArea,
  QuickAction,
  Pose,
  MessageAnalysis,
  LLMPrompt
} from '@/lib/unified-entities';

interface UseCharacterAIV2Props {
  characterId?: string;
  characterStates: { [key: string]: number };
  characterAttributes: { [key: string]: number };
  characterFetishes: { [key: string]: number };
  userEquipment: string[];
  currentPose: string;
  geminiApiKey?: string;
}

interface UseCharacterAIV2Return {
  // Состояние
  currentPose: string;
  poseHistory: Array<{ poseId: string; timestamp: number; reason: string }>;
  lastAction: string | null;
  lastTool: string | null;
  cooldowns: { [key: string]: number };
  
  // Конфигурация
  characterAIConfig: CharacterAIConfig | null;
  isLoading: boolean;
  error: string | null;
  
  // Сервисы
  messageAnalysisService: MessageAnalysisService | null;
  poseManagementService: PoseManagementService | null;
  
  // Действия
  executeAction: (actionId: string, intensity: number, area?: string) => Promise<void>;
  useTool: (toolId: string, intensity: number, duration: number, area?: string) => Promise<void>;
  changePose: (poseId: string, force?: boolean) => Promise<boolean>;
  executeQuickAction: (actionId: string) => Promise<void>;
  analyzeMessage: (message: string, selectedCharacter?: any) => Promise<MessageAnalysis>;
  
  // Проверки
  canExecuteAction: (actionId: string) => boolean;
  canUseTool: (toolId: string) => boolean;
  canChangePose: (poseId: string) => boolean;
  
  // Получение данных
  getAvailableActions: () => InteractiveAction[];
  getAvailableTools: () => InteractiveTool[];
  getAvailablePoses: () => Pose[];
  getInteractiveAreas: () => InteractiveArea[];
  getQuickActions: () => QuickAction[];
  
  // Автоматические проверки
  checkAutomaticPoseChanges: () => Promise<void>;
}

export function useCharacterAIV2({
  characterId,
  characterStates,
  characterAttributes,
  characterFetishes,
  userEquipment,
  currentPose: initialPose,
  geminiApiKey
}: UseCharacterAIV2Props): UseCharacterAIV2Return {
  const [currentPose, setCurrentPose] = useState(initialPose);
  const [poseHistory, setPoseHistory] = useState<Array<{ poseId: string; timestamp: number; reason: string }>>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<{ [key: string]: number }>({});
  
  // Состояние загрузки конфигурации
  const [characterAIConfig, setCharacterAIConfig] = useState<CharacterAIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Инициализация сервисов
  const [messageAnalysisService] = useState(() => {
    console.log('🔑 Gemini API Key:', geminiApiKey ? 'Установлен' : 'Не установлен');
    return geminiApiKey ? new MessageAnalysisService(geminiApiKey) : null;
  });
  
  const [poseManagementService, setPoseManagementService] = useState<PoseManagementService | null>(null);

  // Загрузка конфигурации персонажа
  useEffect(() => {
    if (!characterId) {
      console.log('🎭 Character ID не указан, пропускаем загрузку конфигурации');
      setCharacterAIConfig(null);
      setPoseManagementService(null);
      return;
    }

    const loadConfig = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🔄 Загружаем конфигурацию для персонажа:', characterId);
        const config = await loadCharacterAIConfig(characterId);
        
        if (!config) {
          throw new Error(`Конфигурация для персонажа ${characterId} не найдена`);
        }
        
        setCharacterAIConfig(config);
        
        // Создаем PoseManagementService с загруженной конфигурацией
        const newPoseService = new PoseManagementService(
          config.poses || {},
          config.poseChangeConditions || {},
          config.actions || {},
          config.tools || {}
        );
        setPoseManagementService(newPoseService);
        
        console.log('✅ Конфигурация загружена:', {
          poses: Object.keys(config.poses || {}),
          actions: Object.keys(config.actions || {}),
          tools: Object.keys(config.tools || {})
        });
      } catch (err) {
        console.error('❌ Ошибка загрузки конфигурации:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        setCharacterAIConfig(null);
        setPoseManagementService(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [characterId]);

  // Функция для добавления записи в историю поз
  const addPoseHistory = useCallback((poseId: string, reason: string) => {
    setPoseHistory(prev => [
      { poseId, timestamp: Date.now(), reason },
      ...prev.slice(0, 9) // Оставляем только последние 10 записей
    ]);
  }, []);

  // Функция для установки кулдауна
  const setCooldown = useCallback((actionId: string, duration: number) => {
    setCooldowns(prev => ({ ...prev, [actionId]: duration }));
    
    setTimeout(() => {
      setCooldowns(prev => {
        const newCooldowns = { ...prev };
        delete newCooldowns[actionId];
        return newCooldowns;
      });
    }, duration * 1000);
  }, []);

  // Выполнение действия
  const executeAction = useCallback(async (actionId: string, intensity: number, area?: string) => {
    if (!characterAIConfig) {
      console.error('Конфигурация не загружена');
      return;
    }

    const action = characterAIConfig.actions[actionId];
    if (!action) {
      console.error(`Действие ${actionId} не найдено`);
      return;
    }

    // Проверяем требования
    if (!canExecuteAction(actionId)) {
      console.error(`Нельзя выполнить действие ${actionId}`);
      return;
    }

    // Устанавливаем кулдаун
    if (action.cooldown > 0) {
      setCooldown(actionId, action.cooldown);
    }

    setLastAction(actionId);
    
    console.log(`Выполняется действие: ${action.name} с интенсивностью ${intensity}${area ? ` в области ${area}` : ''}`);
  }, [characterAIConfig, setCooldown]);

  // Использование инструмента
  const useTool = useCallback(async (toolId: string, intensity: number, duration: number, area?: string) => {
    if (!characterAIConfig) {
      console.error('Конфигурация не загружена');
      return;
    }

    const tool = characterAIConfig.tools[toolId];
    if (!tool) {
      console.error(`Инструмент ${toolId} не найден`);
      return;
    }

    // Проверяем требования
    if (!canUseTool(toolId)) {
      console.error(`Нельзя использовать инструмент ${toolId}`);
      return;
    }

    // Устанавливаем кулдаун
    if (tool.cooldown > 0) {
      setCooldown(toolId, tool.cooldown);
    }

    setLastTool(toolId);
    
    console.log(`Используется инструмент: ${tool.name} с интенсивностью ${intensity} на ${duration}с${area ? ` в области ${area}` : ''}`);
  }, [characterAIConfig, setCooldown]);

  // Смена позы
  const changePose = useCallback(async (poseId: string, force: boolean = false): Promise<boolean> => {
    if (!characterAIConfig) {
      console.error('Конфигурация не загружена');
      return false;
    }

    const pose = characterAIConfig.poses[poseId];
    if (!pose) {
      console.error(`Поза ${poseId} не найдена`);
      return false;
    }

    // Проверяем требования (если не принудительно)
    if (!force && !canChangePose(poseId)) {
      console.error(`Нельзя принять позу ${poseId}`);
      return false;
    }

    const oldPose = currentPose;
    setCurrentPose(poseId);
    addPoseHistory(poseId, force ? 'Принудительная смена' : 'Добровольная смена');
    
    console.log(`Смена позы: ${oldPose} -> ${poseId}`);
    return true;
  }, [currentPose, characterAIConfig, addPoseHistory]);

  // Выполнение быстрого действия
  const executeQuickAction = useCallback(async (actionId: string) => {
    if (!characterAIConfig) {
      console.error('Конфигурация не загружена');
      return;
    }

    const quickAction = characterAIConfig.quickActions[actionId];
    if (!quickAction) {
      console.error(`Быстрое действие ${actionId} не найдено`);
      return;
    }

    // Проверяем кулдаун
    if (cooldowns[actionId]) {
      console.error(`Быстрое действие ${actionId} в кулдауне`);
      return;
    }

    // Устанавливаем кулдаун
    if (quickAction.requirements.cooldown) {
      setCooldown(actionId, quickAction.requirements.cooldown);
    }

    // Выполняем действие в зависимости от типа
    switch (quickAction.action.type) {
      case 'pose_change':
        await changePose(quickAction.action.target, quickAction.action.parameters?.force);
        break;
      case 'interactive_action':
        await executeAction(quickAction.action.target, quickAction.action.parameters?.intensity || 5);
        break;
      case 'tool_use':
        await useTool(quickAction.action.target, quickAction.action.parameters?.intensity || 5, quickAction.action.parameters?.duration || 30);
        break;
      case 'command':
        console.log(`Выполняется команда: ${quickAction.action.target}`);
        break;
      case 'message':
        console.log(`Отправляется сообщение: ${quickAction.action.target}`);
        break;
    }
  }, [characterAIConfig, cooldowns, setCooldown, changePose, executeAction, useTool]);

  // Анализ сообщения
  const analyzeMessage = useCallback(async (message: string, selectedCharacter?: any): Promise<MessageAnalysis> => {
    console.log('🔍 Анализ сообщения:', message);
    console.log('🔧 MessageAnalysisService:', messageAnalysisService ? 'Доступен' : 'Недоступен');
    console.log('🎭 Выбранный персонаж:', selectedCharacter?.name || 'Не указан');
    
    if (!messageAnalysisService) {
      console.warn('⚠️ MessageAnalysisService недоступен - возвращаем базовый ответ');
      return {
        emotionalContent: { threat: 0, pleasure: 0, pain: 0, fear: 0, arousal: 0 },
        commands: {},
        fetishTriggers: [],
        statChanges: {},
        response: "Я слушаю вас... (ИИ недоступен)"
      };
    }

    try {
      // Используем данные выбранного персонажа, если он передан
      const characterName = selectedCharacter?.name || "Персонаж";
      const characterPersonality = selectedCharacter?.personality || "Покорный и послушный";
      const characterRole = selectedCharacter?.role || "Подчиненный";
      const characterState = selectedCharacter?.currentState || "Готов к взаимодействию";
      
      // Используем характеристики персонажа, если они есть
      const characterAttributes = selectedCharacter?.attributes || {};
      const characterStates = selectedCharacter?.states || {};
      const characterFetishes = selectedCharacter?.fetishes || {};
      
      // Получаем базовый промт персонажа из unified конфигурации
      const characterBasePrompt = selectedCharacter?.prompt?.character || 
        selectedCharacter?.description || 
        characterAIConfig?.llmPrompts?.basePrompt ||
        "Ты покорный персонаж в BDSM игре";
      
      const llmPrompt: LLMPrompt = {
        basePrompt: characterBasePrompt,
        characterContext: {
          name: characterName,
          role: characterRole,
          personality: characterPersonality,
          currentState: characterState
        },
        characteristics: Object.entries(characterAttributes).reduce((acc, [key, value]) => {
          acc[key] = { value: value as number, interpretation: "Характеристика персонажа" };
          return acc;
        }, {} as { [key: string]: { value: number; interpretation: string } }),
        fetishes: Object.entries(characterFetishes).reduce((acc, [key, value]) => {
          acc[key] = { intensity: value as number, triggers: [], responses: [] };
          return acc;
        }, {} as { [key: string]: { intensity: number; triggers: string[]; responses: string[] } }),
        memory: { recent: [], important: [], traumatic: [] },
        currentSituation: {
          location: "Лаборатория",
          equipment: userEquipment,
          pose: currentPose,
          emotionalState: characterStates.mood ? `Настроение: ${characterStates.mood}` : "Спокойный",
          activeFetishes: Object.entries(characterFetishes).filter(([_, value]) => (value as number) > 0.3).map(([key, _]) => key)
        }
      };

      console.log('🔧 === ФОРМИРОВАНИЕ КОНТЕКСТА ===');
      console.log('📝 Сообщение пользователя:', message);
      console.log('🎭 Конфигурация персонажа:', {
        name: characterName,
        personality: characterPersonality,
        role: characterRole,
        currentState: characterState,
        attributes: characterAttributes,
        states: characterStates,
        fetishes: characterFetishes
      });
      console.log('🔧 === КОНЕЦ ФОРМИРОВАНИЯ КОНТЕКСТА ===');

      console.log('📤 Отправляем запрос к ИИ...');
      const result = await messageAnalysisService.analyzeMessage(message, llmPrompt, characterStates);
      console.log('📥 Получен ответ от ИИ:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка анализа сообщения:', error);
      return {
        emotionalContent: { threat: 0, pleasure: 0, pain: 0, fear: 0, arousal: 0 },
        commands: {},
        fetishTriggers: [],
        statChanges: {},
        response: "Извините, произошла ошибка при обработке сообщения. Попробуйте еще раз."
      };
    }
  }, [messageAnalysisService, characterAIConfig, userEquipment, currentPose]);

  // Проверка автоматических смен позы
  const checkAutomaticPoseChanges = useCallback(async () => {
    if (!poseManagementService || !characterAIConfig) {
      return;
    }

    const validConditions = poseManagementService.checkPoseChangeConditions(
      currentPose,
      characterStates,
      characterAttributes,
      characterFetishes,
      [lastAction, lastTool].filter(Boolean) as string[],
      {
        equipment: userEquipment,
        location: "Лаборатория",
        privacy: "private"
      }
    );

    for (const { condition, probability, reason } of validConditions) {
      if (Math.random() < probability) {
        await changePose(condition.targetPose);
        addPoseHistory(condition.targetPose, reason);
        break; // Применяем только первое подходящее условие
      }
    }
  }, [poseManagementService, characterAIConfig, currentPose, characterStates, characterAttributes, characterFetishes, lastAction, lastTool, userEquipment, changePose, addPoseHistory]);

  // Проверки доступности
  const canExecuteAction = useCallback((actionId: string): boolean => {
    if (!characterAIConfig) return false;

    const action = characterAIConfig.actions[actionId];
    if (!action) return false;

    // Проверяем кулдаун
    if (cooldowns[actionId]) return false;

    // Проверяем требования
    const requirements = action.requirements;
    if (requirements.trustLevel && characterStates.trust < requirements.trustLevel) return false;
    if (requirements.relationshipLevel && characterStates.relationship < requirements.relationshipLevel) return false;
    if (requirements.equipment) {
      const hasEquipment = requirements.equipment.some(equip => userEquipment.includes(equip));
      if (!hasEquipment) return false;
    }

    return true;
  }, [characterAIConfig, cooldowns, characterStates, userEquipment]);

  const canUseTool = useCallback((toolId: string): boolean => {
    if (!characterAIConfig) return false;

    const tool = characterAIConfig.tools[toolId];
    if (!tool) return false;

    // Проверяем кулдаун
    if (cooldowns[toolId]) return false;

    // Проверяем требования
    const requirements = tool.requirements;
    if (requirements.equipment) {
      const hasEquipment = requirements.equipment.some(equip => userEquipment.includes(equip));
      if (!hasEquipment) return false;
    }
    if (requirements.powerLevel && characterStates.power < requirements.powerLevel) return false;

    return true;
  }, [characterAIConfig, cooldowns, characterStates, userEquipment]);

  const canChangePose = useCallback((poseId: string): boolean => {
    if (!characterAIConfig) return false;

    const pose = characterAIConfig.poses[poseId];
    if (!pose) return false;

    const requirements = pose.requirements;
    if (requirements.flexibility && characterAttributes.flexibility < requirements.flexibility) return false;
    if (requirements.strength && characterAttributes.strength < requirements.strength) return false;
    if (requirements.trustLevel && characterStates.trust < requirements.trustLevel) return false;
    if (requirements.relationshipLevel && characterStates.relationship < requirements.relationshipLevel) return false;

    return true;
  }, [characterAIConfig, characterAttributes, characterStates]);

  // Получение доступных данных
  const getAvailableActions = useCallback((): InteractiveAction[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.actions).filter(action => canExecuteAction(action.id));
  }, [characterAIConfig, canExecuteAction]);

  const getAvailableTools = useCallback((): InteractiveTool[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.tools).filter(tool => canUseTool(tool.id));
  }, [characterAIConfig, canUseTool]);

  const getAvailablePoses = useCallback((): Pose[] => {
    if (!poseManagementService) return [];
    return poseManagementService.getAvailablePoses(characterAttributes, characterStates, userEquipment);
  }, [poseManagementService, characterAttributes, characterStates, userEquipment]);

  const getInteractiveAreas = useCallback((): InteractiveArea[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.interactiveAreas);
  }, [characterAIConfig]);

  const getQuickActions = useCallback((): QuickAction[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.quickActions).filter(action => !cooldowns[action.id]);
  }, [characterAIConfig, cooldowns]);

  // Автоматическая проверка смены позы каждые 30 секунд
  useEffect(() => {
    if (!poseManagementService) return;
    
    const interval = setInterval(checkAutomaticPoseChanges, 30000);
    return () => clearInterval(interval);
  }, [checkAutomaticPoseChanges, poseManagementService]);

  return {
    // Состояние
    currentPose,
    poseHistory,
    lastAction,
    lastTool,
    cooldowns,
    
    // Конфигурация
    characterAIConfig,
    isLoading,
    error,
    
    // Сервисы
    messageAnalysisService,
    poseManagementService,
    
    // Действия
    executeAction,
    useTool,
    changePose,
    executeQuickAction,
    analyzeMessage,
    
    // Проверки
    canExecuteAction,
    canUseTool,
    canChangePose,
    
    // Получение данных
    getAvailableActions,
    getAvailableTools,
    getAvailablePoses,
    getInteractiveAreas,
    getQuickActions,
    
    // Автоматические проверки
    checkAutomaticPoseChanges
  };
}
