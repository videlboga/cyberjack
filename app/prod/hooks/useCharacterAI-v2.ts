import { useState, useEffect, useCallback } from 'react';
import { MessageAnalysisService } from '@/lib/character/message-analysis-service';
import { PoseManagementService } from '@/lib/character/pose-management-service';
import { loadCharacterAIConfig, getCharacterAIConfigForCharacter } from '@/lib/character/config-loader';
import { 
  CharacterAIConfig, 
  InteractiveAction, 
  InteractiveTool, 
  InteractiveArea,
  QuickAction,
  Pose,
  PoseChangeCondition,
  MessageAnalysis,
  LLMPrompt,
  Character
} from '@/lib/unified-entities';

interface UseCharacterAIV2Props {
  characterId?: string; // ID персонажа для загрузки конфигурации
  characterAIConfig?: CharacterAIConfig; // Прямая передача конфигурации (для обратной совместимости)
  characterStates?: { [key: string]: number };
  characterAttributes?: { [key: string]: number };
  characterFetishes?: { [key: string]: number };
  userEquipment?: string[];
  currentPose?: string;
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
  analyzeMessage: (message: string, selectedCharacter?: Character) => Promise<MessageAnalysis>;
  
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
  
  // Утилиты
  refreshConfig: () => Promise<void>;
}

export function useCharacterAIV2({
  characterId,
  characterAIConfig: directConfig,
  characterStates = {},
  characterAttributes = {},
  characterFetishes = {},
  userEquipment = [],
  currentPose: initialPose = "standing_normal",
  geminiApiKey
}: UseCharacterAIV2Props): UseCharacterAIV2Return {
  const [currentPose, setCurrentPose] = useState(initialPose);
  const [poseHistory, setPoseHistory] = useState<Array<{ poseId: string; timestamp: number; reason: string }>>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<{ [key: string]: number }>({});
  
  // Состояние загрузки
  const [characterAIConfig, setCharacterAIConfig] = useState<CharacterAIConfig | null>(directConfig || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Инициализация сервисов
  const [messageAnalysisService] = useState(() => {
    console.log('🔑 Gemini API Key:', geminiApiKey ? 'Установлен' : 'Не установлен');
    return geminiApiKey ? new MessageAnalysisService(geminiApiKey) : null;
  });
  
  const [poseManagementService, setPoseManagementService] = useState<PoseManagementService | null>(null);
  
  // Загрузка конфигурации
  const loadConfig = useCallback(async () => {
    if (directConfig) {
      setCharacterAIConfig(directConfig);
      return;
    }
    
    if (!characterId) {
      console.log('🎭 CharacterAI: нет characterId, загружаем общую конфигурацию');
      try {
        setIsLoading(true);
        setError(null);
        const config = await loadCharacterAIConfig();
        setCharacterAIConfig(config);
      } catch (err) {
        console.error('❌ Ошибка загрузки общей конфигурации:', err);
        setError('Ошибка загрузки конфигурации');
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    console.log(`🎭 CharacterAI: загружаем конфигурацию для персонажа ${characterId}`);
    try {
      setIsLoading(true);
      setError(null);
      const config = await getCharacterAIConfigForCharacter(characterId);
      if (config) {
        setCharacterAIConfig(config);
      } else {
        console.warn(`⚠️ Конфигурация для персонажа ${characterId} не найдена, загружаем общую`);
        const generalConfig = await loadCharacterAIConfig();
        setCharacterAIConfig(generalConfig);
      }
    } catch (err) {
      console.error(`❌ Ошибка загрузки конфигурации для персонажа ${characterId}:`, err);
      setError('Ошибка загрузки конфигурации персонажа');
    } finally {
      setIsLoading(false);
    }
  }, [characterId, directConfig]);
  
  // Инициализация PoseManagementService при изменении конфигурации
  useEffect(() => {
    if (!characterAIConfig) {
      setPoseManagementService(null);
      return;
    }
    
    const hasConfig = characterAIConfig.poses || characterAIConfig.actions || characterAIConfig.tools;
    if (!hasConfig) {
      console.log('🎭 PoseManagementService: пропускаем инициализацию (пустая конфигурация)');
      setPoseManagementService(null);
      return;
    }
    
    console.log('🎭 PoseManagementService init with config:', {
      poses: Object.keys(characterAIConfig.poses || {}),
      actions: Object.keys(characterAIConfig.actions || {}),
      tools: Object.keys(characterAIConfig.tools || {})
    });
    
    const service = new PoseManagementService(
      characterAIConfig.poses || {},
      characterAIConfig.poseChangeConditions || {},
      characterAIConfig.actions || {},
      characterAIConfig.tools || {}
    );
    setPoseManagementService(service);
  }, [characterAIConfig]);
  
  // Загрузка конфигурации при монтировании
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);
  
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
      console.error('Конфигурация Character AI не загружена');
      return;
    }
    
    const action = characterAIConfig.actions[actionId];
    if (!action) {
      console.error(`Действие ${actionId} не найдено`);
      return;
    }

    if (!canExecuteAction(actionId)) {
      console.error(`Нельзя выполнить действие ${actionId}`);
      return;
    }

    console.log(`🎯 Выполняем действие: ${actionId} с интенсивностью ${intensity}`);
    setLastAction(actionId);
    setCooldown(actionId, action.cooldown || 5);
    
    // Здесь можно добавить логику выполнения действия
  }, [characterAIConfig, setCooldown]);

  // Использование инструмента
  const useTool = useCallback(async (toolId: string, intensity: number, duration: number, area?: string) => {
    if (!characterAIConfig) {
      console.error('Конфигурация Character AI не загружена');
      return;
    }
    
    const tool = characterAIConfig.tools[toolId];
    if (!tool) {
      console.error(`Инструмент ${toolId} не найден`);
      return;
    }

    if (!canUseTool(toolId)) {
      console.error(`Нельзя использовать инструмент ${toolId}`);
      return;
    }

    console.log(`🔧 Используем инструмент: ${toolId} с интенсивностью ${intensity}`);
    setLastTool(toolId);
    setCooldown(toolId, tool.cooldown || 10);
    
    // Здесь можно добавить логику использования инструмента
  }, [characterAIConfig, setCooldown]);

  // Смена позы
  const changePose = useCallback(async (poseId: string, force: boolean = false): Promise<boolean> => {
    if (!poseManagementService) {
      console.error('PoseManagementService не инициализирован');
      return false;
    }

    const success = await poseManagementService.changePose(poseId, force);
    if (success) {
      setCurrentPose(poseId);
      addPoseHistory(poseId, force ? 'принудительная смена' : 'автоматическая смена');
    }
    
    return success;
  }, [poseManagementService, addPoseHistory]);

  // Выполнение быстрого действия
  const executeQuickAction = useCallback(async (actionId: string) => {
    if (!characterAIConfig) {
      console.error('Конфигурация Character AI не загружена');
      return;
    }
    
    const quickAction = characterAIConfig.quickActions[actionId];
    if (!quickAction) {
      console.error(`Быстрое действие ${actionId} не найдено`);
      return;
    }

    console.log(`⚡ Выполняем быстрое действие: ${actionId}`);
    await executeAction(actionId, quickAction.defaultIntensity || 5);
  }, [characterAIConfig, executeAction]);

  // Анализ сообщения
  const analyzeMessage = useCallback(async (message: string, selectedCharacter?: Character): Promise<MessageAnalysis> => {
    if (!messageAnalysisService) {
      console.error('MessageAnalysisService не инициализирован');
      return {
        sentiment: 'neutral',
        intensity: 0,
        suggestedActions: [],
        emotionalState: 'neutral'
      };
    }

    return await messageAnalysisService.analyzeMessage(message, selectedCharacter);
  }, [messageAnalysisService]);

  // Проверки доступности
  const canExecuteAction = useCallback((actionId: string): boolean => {
    if (!characterAIConfig) return false;
    
    const action = characterAIConfig.actions[actionId];
    if (!action) return false;
    
    const cooldown = cooldowns[actionId];
    return !cooldown || cooldown <= 0;
  }, [characterAIConfig, cooldowns]);

  const canUseTool = useCallback((toolId: string): boolean => {
    if (!characterAIConfig) return false;
    
    const tool = characterAIConfig.tools[toolId];
    if (!tool) return false;
    
    const cooldown = cooldowns[toolId];
    return !cooldown || cooldown <= 0;
  }, [characterAIConfig, cooldowns]);

  const canChangePose = useCallback((poseId: string): boolean => {
    if (!poseManagementService) return false;
    return poseManagementService.canChangePose(poseId);
  }, [poseManagementService]);

  // Получение доступных данных
  const getAvailableActions = useCallback((): InteractiveAction[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.actions);
  }, [characterAIConfig]);

  const getAvailableTools = useCallback((): InteractiveTool[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.tools);
  }, [characterAIConfig]);

  const getAvailablePoses = useCallback((): Pose[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.poses);
  }, [characterAIConfig]);

  const getInteractiveAreas = useCallback((): InteractiveArea[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.interactiveAreas);
  }, [characterAIConfig]);

  const getQuickActions = useCallback((): QuickAction[] => {
    if (!characterAIConfig) return [];
    return Object.values(characterAIConfig.quickActions);
  }, [characterAIConfig]);

  // Автоматические проверки
  const checkAutomaticPoseChanges = useCallback(async () => {
    if (!poseManagementService) return;
    
    const shouldChange = await poseManagementService.checkAutomaticPoseChanges();
    if (shouldChange) {
      // Логика автоматической смены позы
      console.log('🔄 Автоматическая смена позы');
    }
  }, [poseManagementService]);

  // Обновление конфигурации
  const refreshConfig = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

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
    checkAutomaticPoseChanges,
    
    // Утилиты
    refreshConfig
  };
}
