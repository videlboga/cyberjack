import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageAnalysisService } from '@/lib/character/message-analysis-service';
import { PoseManagementService } from '@/lib/character/pose-management-service';
import { 
  CharacterAIConfig, 
  InteractiveAction, 
  InteractiveTool, 
  InteractiveArea,
  QuickAction,
  Pose,
  PoseChangeCondition,
  MessageAnalysis,
  LLMPrompt
} from '@/lib/unified-entities';

interface UseCharacterAIProps {
  characterAIConfig: CharacterAIConfig;
  characterStates: { [key: string]: number };
  characterAttributes: { [key: string]: number };
  characterFetishes: { [key: string]: number };
  userEquipment: string[];
  currentPose: string;
  geminiApiKey?: string;
}

interface UseCharacterAIReturn {
  // Состояние
  currentPose: string;
  poseHistory: Array<{ poseId: string; timestamp: number; reason: string }>;
  lastAction: string | null;
  lastTool: string | null;
  cooldowns: { [key: string]: number };
  
  // Конфигурация
  characterAIConfig: CharacterAIConfig;
  
  // Сервисы
  messageAnalysisService: MessageAnalysisService | null;
  poseManagementService: PoseManagementService | null;
  
  // Действия
  executeAction: (actionId: string, intensity: number, area?: string) => Promise<void>;
  useTool: (toolId: string, intensity: number, duration: number, area?: string) => Promise<void>;
  startToolUse: (toolId: string, intensity: number, area?: string) => Promise<void>;
  stopToolUse: () => void;
  startActionUse: (actionId: string, intensity: number, area?: string) => void;
  stopActionUse: () => void;
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

export function useCharacterAI({
  characterAIConfig,
  characterStates,
  characterAttributes,
  characterFetishes,
  userEquipment,
  currentPose: initialPose,
  geminiApiKey
}: UseCharacterAIProps): UseCharacterAIReturn {
  const [currentPose, setCurrentPose] = useState(initialPose);
  const [poseHistory, setPoseHistory] = useState<Array<{ poseId: string; timestamp: number; reason: string }>>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<{ [key: string]: number }>({});
  const autoMessageTimers = useRef<{ intervalId: any; stopId: any } | null>(null)
  const activeToolRef = useRef<{ toolId: string; area?: string; intensity: number; clickCount: number; startAt: number; intervals?: any } | null>(null)
  const activeActionRef = useRef<{ actionId: string; area?: string; intensity: number; clickCount: number; startAt: number } | null>(null)
  
  // Инициализация сервисов - создаем только один раз
  const [messageAnalysisService] = useState(() => {
    return geminiApiKey ? new MessageAnalysisService(geminiApiKey) : null;
  });
  
  const [poseManagementService] = useState(() => {
    // Создаем сервис только если есть конфигурация
    if (!characterAIConfig?.poses && !characterAIConfig?.actions && !characterAIConfig?.tools) {
      return null;
    }
    return new PoseManagementService(
      characterAIConfig?.poses || {},
      characterAIConfig?.poseChangeConditions || {},
      characterAIConfig?.actions || {},
      characterAIConfig?.tools || {}
    );
  });

  // Обновляем сервисы при изменении конфигурации
  useEffect(() => {
    // Конфигурация обновлена
  }, [characterAIConfig]);

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

  // Универсальная агрегация эффектов -> плоские изменения статов
  const aggregateEffects = (effects: any, multiplier: number): Record<string, number> => {
    const result: Record<string, number> = {}
    if (!effects) return result
    const stack = [{ key: '', value: effects }]
    while (stack.length) {
      const { key, value } = stack.pop() as any
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [k, v] of Object.entries(value)) {
          stack.push({ key: key ? `${key}.${k}` : k, value: v })
        }
      } else if (typeof value === 'number') {
        // храним по конечному ключу (последний сегмент)
        const flatKey = key.split('.').pop() as string
        result[flatKey] = (result[flatKey] || 0) + value * multiplier
      }
    }
    return result
  }

  // Выполнение действия
  const executeAction = useCallback(async (actionId: string, intensity: number, area?: string) => {
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

    // Применяем эффекты (мультипликатор завязываем на интенсивность 1..10)
    const multiplier = Math.max(1, Math.min(10, intensity)) / 10
    const statChanges = aggregateEffects((action as any).effects, multiplier)
    const areaPrompt = (characterAIConfig.interactiveAreas as any)?.[area || '']?.prompt
    const actionPrompt = (action as any)?.prompt || action.name
    const feeling = buildFeelingPrompt(statChanges)
    const chatText = areaPrompt
      ? `Он ${actionPrompt} мне ${areaPrompt}. ${feeling}`
      : `Он ${actionPrompt}. ${feeling}`
    console.log('⚡ Применены эффекты действия:', { actionId, intensity, area, statChanges, chatText })

  }, [characterAIConfig.actions, setCooldown, aggregateEffects]);

  // Использование инструмента
  const useTool = useCallback(async (toolId: string, intensity: number, duration: number, area?: string) => {
    const tool = characterAIConfig?.tools?.[toolId];
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

    // Применяем эффекты инструмента с учетом базовой/макс интенсивности
    const base = Number((tool as any).baseIntensity ?? 5)
    const max = Number((tool as any).maxIntensity ?? 10)
    const clamped = Math.max(1, Math.min(10, intensity))
    const multiplier = max > 0 ? (clamped / max) : (clamped / 10)
    const statChanges = aggregateEffects((tool as any).effects, multiplier)
    const areaPrompt = (characterAIConfig.interactiveAreas as any)?.[area || '']?.prompt
    const toolPrompt = (tool as any)?.prompt || tool.name
    const feeling = buildFeelingPrompt(statChanges)
    const chatText = areaPrompt
      ? `Он ${toolPrompt} мне ${areaPrompt}. ${feeling}`
      : `Он ${toolPrompt}. ${feeling}`
    console.log('🛠️ Применены эффекты инструмента:', { toolId, intensity: clamped, duration, area, statChanges, chatText })

    // Автосообщения каждые 10 сек на протяжении duration
    if (typeof window !== 'undefined') {
      const dispatchAuto = () => {
        try {
          const event = new CustomEvent('characterAI:autoMessage', { detail: { content: chatText } })
          window.dispatchEvent(event)
        } catch (_) {}
      }
      // Сброс прежних таймеров
      if (autoMessageTimers.current) {
        clearInterval(autoMessageTimers.current.intervalId)
        clearTimeout(autoMessageTimers.current.stopId)
      }
      const intervalId = setInterval(dispatchAuto, 10000)
      const stopId = setTimeout(() => {
        clearInterval(intervalId)
        autoMessageTimers.current = null
      }, Math.max(1, duration) * 1000)
      autoMessageTimers.current = { intervalId, stopId }
      // Мгновенное первое сообщение (опционально)
      dispatchAuto()
    }

  }, [characterAIConfig.tools, setCooldown, aggregateEffects]);

  // Запуск непрерывного режима инструмента (без траектории, только нажатие/удержание)
  const startToolUse = useCallback(async (toolId: string, intensity: number, area?: string) => {
    const tool = characterAIConfig?.tools?.[toolId]
    if (!tool) return
    const modes: string[] = Array.isArray((tool as any).modes) ? (tool as any).modes : ['click']
    const effectRate: any = (tool as any).effectRate || {}
    const llmTrigger: any = (tool as any).llmTrigger || {}

    console.log('🔧 StartToolUse - конфигурация:', { toolId, modes, effectRate, llmTrigger })

    const clamped = Math.max(1, Math.min(10, intensity))
    const max = Number((tool as any).maxIntensity ?? 10)
    const multiplier = max > 0 ? (clamped / max) : (clamped / 10)

    const areaPrompt = (characterAIConfig.interactiveAreas as any)?.[area || '']?.prompt
    const toolPrompt = (tool as any)?.prompt || tool.name

    const toolTick = () => {
      const statChanges = aggregateEffects((tool as any).effects, multiplier)
      const feeling = buildFeelingPrompt(statChanges)
      const chatText = areaPrompt ? `Он ${toolPrompt} мне ${areaPrompt}. ${feeling}` : `Он ${toolPrompt}. ${feeling}`
      console.log('🛠️ Применены эффекты инструмента:', { toolId, intensity: clamped, area, statChanges, chatText })
    }

    // Сбрасываем прежние интервалы, если есть
    if (autoMessageTimers.current) {
      clearInterval(autoMessageTimers.current.intervalId)
      clearTimeout(autoMessageTimers.current.stopId)
      autoMessageTimers.current = null
    }

    // Регистрируем активное состояние
    const state: any = { toolId, area, intensity: clamped, clickCount: 0, startAt: Date.now(), intervals: {} }
    activeToolRef.current = state

    // Click модель
    if (modes.includes('click') && typeof effectRate.perClick === 'number') {
      state.clickCount += 1
      toolTick()
      if (typeof llmTrigger.clicks === 'number' && state.clickCount % llmTrigger.clicks === 0) {
        try {
          const event = new CustomEvent('characterAI:autoMessage', { detail: { content: areaPrompt ? `Он ${toolPrompt} мне ${areaPrompt}.` : `Он ${toolPrompt}.` } })
          window.dispatchEvent(event)
        } catch {}
      }
    }

    // Hold модель: применяем раз в секунду, отправляем LLM по таймеру
    if (modes.includes('hold') && typeof effectRate.perSecond === 'number' && typeof window !== 'undefined') {
      const perSecondInterval = setInterval(toolTick, 1000)
      let llmInterval: any = null
      if (typeof llmTrigger.seconds === 'number' && llmTrigger.seconds > 0) {
        llmInterval = setInterval(() => {
          try {
            const event = new CustomEvent('characterAI:autoMessage', { detail: { content: areaPrompt ? `Он ${toolPrompt} мне ${areaPrompt}.` : `Он ${toolPrompt}.` } })
            window.dispatchEvent(event)
          } catch {}
        }, llmTrigger.seconds * 1000)
      }
      state.intervals = { perSecondInterval, llmInterval }
    }
  }, [characterAIConfig?.tools, characterAIConfig?.interactiveAreas, aggregateEffects])

  // Остановка непрерывного режима инструмента
  const stopToolUse = useCallback(() => {
    const ref: any = activeToolRef.current
    activeToolRef.current = null
    if (autoMessageTimers.current) {
      clearInterval(autoMessageTimers.current.intervalId)
      clearTimeout(autoMessageTimers.current.stopId)
      autoMessageTimers.current = null
    }
    if (ref?.intervals) {
      clearInterval(ref.intervals.perSecondInterval)
      if (ref.intervals.llmInterval) clearInterval(ref.intervals.llmInterval)
    }
  }, [])

  // Непрерывный режим для действий (hold) и клик-счетчик (click)
  const startActionUse = useCallback((actionId: string, intensity: number, area?: string) => {
    const action = characterAIConfig?.actions?.[actionId]
    if (!action) return
    const modes: string[] = Array.isArray(action.modes) ? action.modes : ['click']
    const effectRate = action.effectRate || {}
    const llmTrigger = action.llmTrigger || {}

    console.log('⚡ StartActionUse - конфигурация:', { actionId, modes, effectRate, llmTrigger })

    // инициализируем состояние
    activeActionRef.current = { actionId, intensity, area, clickCount: 0, startAt: Date.now() }

    const sendLLM = () => {
      const areaPrompt = (characterAIConfig.interactiveAreas as any)?.[area || '']?.prompt
      const name = (action as any)?.prompt || action.name
      const chatText = areaPrompt ? `Он ${name} мне ${areaPrompt}.` : `Он ${name}.`
      try {
        const event = new CustomEvent('characterAI:autoMessage', { detail: { content: chatText } })
        window.dispatchEvent(event)
      } catch {}
    }

    // click-модель: применяем разово и учитываем триггеры
    if (modes.includes('click') && typeof effectRate.perClick === 'number') {
      executeAction(actionId, intensity, area)
      activeActionRef.current.clickCount += 1
      if (typeof llmTrigger.clicks === 'number' && activeActionRef.current.clickCount % llmTrigger.clicks === 0) {
        sendLLM()
      }
    }

    // hold-модель: таймер по секундам
    if (modes.includes('hold') && typeof effectRate.perSecond === 'number') {
      if (typeof window !== 'undefined') {
        const perSecondInterval = setInterval(() => {
          executeAction(actionId, intensity, area)
        }, 1000)
        // LLM каждые llmTrigger.seconds
        let llmInterval: any = null
        if (typeof llmTrigger.seconds === 'number' && llmTrigger.seconds > 0) {
          llmInterval = setInterval(() => sendLLM(), llmTrigger.seconds * 1000)
        }
        // остановка привязана к stopActionUse
        ;(activeActionRef.current as any).intervals = { perSecondInterval, llmInterval }
      }
    }
  }, [characterAIConfig?.actions, executeAction])

  const stopActionUse = useCallback(() => {
    const ref: any = activeActionRef.current
    activeActionRef.current = null
    if (ref?.intervals) {
      clearInterval(ref.intervals.perSecondInterval)
      if (ref.intervals.llmInterval) clearInterval(ref.intervals.llmInterval)
    }
  }, [])

  // Генератор короткого промта ощущений на основе изменений статов
  const buildFeelingPrompt = (changes: Record<string, number>): string => {
    const phrases: string[] = []
    const addByLevel = (value: number | undefined, tiers: Array<{ t: number; text: string }>) => {
      if (typeof value !== 'number' || value <= 0) return
      const abs = Math.abs(value)
      for (let i = tiers.length - 1; i >= 0; i--) {
        if (abs >= tiers[i].t) { phrases.push(tiers[i].text); break }
      }
    }

    // Эмоции/состояния
    addByLevel(changes.fear, [
      { t: 0.8, text: 'я очень боюсь!!' },
      { t: 0.5, text: 'мне страшно' },
      { t: 0.2, text: 'мне неспокойно…' },
    ])
    addByLevel(changes.arousal, [
      { t: 0.8, text: 'я на грани, так возбуждена!' },
      { t: 0.5, text: 'я сильно возбуждаюсь' },
      { t: 0.2, text: 'меня это возбуждает…' },
    ])
    addByLevel(changes.pleasure, [
      { t: 0.8, text: 'это невероятно приятно!' },
      { t: 0.5, text: 'мне очень приятно' },
      { t: 0.2, text: 'мне приятно…' },
    ])
    addByLevel(changes.pain, [
      { t: 0.8, text: 'очень больно!!' },
      { t: 0.5, text: 'мне больно' },
      { t: 0.2, text: 'немного больно…' },
    ])
    addByLevel(changes.anxiety, [
      { t: 0.8, text: 'паника…' },
      { t: 0.5, text: 'тревожно' },
      { t: 0.2, text: 'есть лёгкая тревога…' },
    ])
    addByLevel(changes.submission, [
      { t: 0.8, text: 'хочу подчиняться полностью' },
      { t: 0.5, text: 'чувствую себя покорной' },
      { t: 0.2, text: 'становлюсь покорнее…' },
    ])

    // Сенсорные/когнитивные
    addByLevel(changes.sensitivity, [
      { t: 0.5, text: 'чувствительность растёт' },
      { t: 0.2, text: 'становится чувствительнее…' },
    ])
    addByLevel(changes.cognitiveLoad, [
      { t: 0.8, text: 'мысли путаются…' },
      { t: 0.5, text: 'мне сложно думать' },
      { t: 0.2, text: 'немного сложнее сосредоточиться…' },
    ])

    if (phrases.length === 0) return 'Я чувствую изменения внутри.'
    return phrases.slice(0, 2).join(', ')
  }

  // Смена позы
  const changePose = useCallback(async (poseId: string, force: boolean = false): Promise<boolean> => {
    const pose = characterAIConfig?.poses?.[poseId];
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
    

    return true;
  }, [currentPose, characterAIConfig.poses, addPoseHistory]);

  // Выполнение быстрого действия
  const executeQuickAction = useCallback(async (actionId: string) => {
    const quickAction = (characterAIConfig.quickActions || {})[actionId];
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
    if (quickAction.requirements?.cooldown) {
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
        break;
      case 'message':
        break;
    }
  }, [characterAIConfig.quickActions, cooldowns, setCooldown, changePose, executeAction, useTool]);

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
      } as any;
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
        characterAIConfig?.llmPrompts?.basePrompt || '';
      
      // Составляем контекст текущего взаимодействия (инструменты/действия прямо сейчас)
      const currentInteraction: Array<{
        type: 'action' | 'tool'
        id: string
        name: string
        area?: string
        intensity: number
        mode: 'click' | 'hold'
        elapsedSec?: number
        effectPreview?: Record<string, number>
        feelingHint?: string
      }> = []

      // Активное действие (hold/click)
      if (activeActionRef.current) {
        const { actionId, intensity, area, startAt } = activeActionRef.current
        const actionCfg: any = characterAIConfig?.actions?.[actionId]
        if (actionCfg) {
          const multiplier = Math.max(1, Math.min(10, intensity)) / 10
          const effectPreview = aggregateEffects(actionCfg.effects, multiplier)
          const mode: 'click' | 'hold' = (activeActionRef.current as any).intervals?.perSecondInterval ? 'hold' : 'click'
          currentInteraction.push({
            type: 'action',
            id: actionId,
            name: actionCfg?.prompt || actionCfg?.name || actionId,
            area,
            intensity,
            mode,
            elapsedSec: startAt ? Math.floor((Date.now() - startAt) / 1000) : undefined,
            effectPreview,
            feelingHint: buildFeelingPrompt(effectPreview)
          })
        }
      }

      // Активный инструмент (hold/click)
      if (activeToolRef.current) {
        const { toolId, intensity, area, startAt } = activeToolRef.current
        const toolCfg: any = characterAIConfig?.tools?.[toolId]
        if (toolCfg) {
          const max = Number(toolCfg?.maxIntensity ?? 10)
          const clamped = Math.max(1, Math.min(10, intensity))
          const multiplier = max > 0 ? (clamped / max) : (clamped / 10)
          const effectPreview = aggregateEffects(toolCfg.effects, multiplier)
          const mode: 'click' | 'hold' = activeToolRef.current.intervals?.perSecondInterval ? 'hold' : 'click'
          currentInteraction.push({
            type: 'tool',
            id: toolId,
            name: toolCfg?.prompt || toolCfg?.name || toolId,
            area,
            intensity: clamped,
            mode,
            elapsedSec: startAt ? Math.floor((Date.now() - startAt) / 1000) : undefined,
            effectPreview,
            feelingHint: buildFeelingPrompt(effectPreview)
          })
        }
      }

      const llmPrompt: any = {
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
        },
        currentInteraction
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

      // Немедленно применяем смену позы из команд ИИ, если есть
      try {
        const nextPose: string | undefined = (result as any)?.commands?.poseChange;
        if (nextPose && typeof nextPose === 'string') {
          console.log('🧍 Запрошена смена позы от ИИ:', nextPose);
          const ok = await changePose(nextPose, true);
          console.log('✅ Смена позы результат:', { ok, pose: nextPose });
        }
      } catch (e) {
        console.warn('⚠️ Не удалось применить смену позы:', e);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка анализа сообщения:', error);
      return {
        emotionalContent: { threat: 0, pleasure: 0, pain: 0, fear: 0, arousal: 0 },
        commands: {},
        fetishTriggers: [],
        statChanges: {},
        response: "Извините, произошла ошибка при обработке сообщения. Попробуйте еще раз."
      } as any;
    }
  }, [messageAnalysisService, characterAIConfig, userEquipment, currentPose]);

  // Проверка автоматических смен позы
  const checkAutomaticPoseChanges = useCallback(async () => {
    if (!poseManagementService) return;
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
        const target = (condition as any).targetPose;
        await changePose(target);
        addPoseHistory(target, reason);
        break; // Применяем только первое подходящее условие
      }
    }
  }, [poseManagementService, currentPose, characterStates, characterAttributes, characterFetishes, lastAction, lastTool, userEquipment, changePose, addPoseHistory]);

  // Проверки доступности
  const canExecuteAction = useCallback((actionId: string): boolean => {
    const action = characterAIConfig?.actions?.[actionId];
    if (!action) return false;

    // Проверяем кулдаун
    if (cooldowns[actionId]) return false;

    // Проверяем требования (безопасно при отсутствии полей)
    const requirements: any = action.requirements || {};
    const trust = Number(characterStates?.trust ?? 0);
    const relationship = Number(characterStates?.relationship ?? 0);
    if (typeof requirements.trustLevel === 'number' && trust < requirements.trustLevel) return false;
    if (typeof requirements.relationshipLevel === 'number' && relationship < requirements.relationshipLevel) return false;
    if (Array.isArray(requirements.equipment) && requirements.equipment.length > 0) {
      const hasEquipment = requirements.equipment.some((equip: string) => userEquipment?.includes(equip));
      if (!hasEquipment) return false;
    }

    return true;
  }, [characterAIConfig?.actions, cooldowns, characterStates, userEquipment]);

  const canUseTool = useCallback((toolId: string): boolean => {
    const tool = characterAIConfig?.tools?.[toolId];
    if (!tool) return false;

    // Проверяем кулдаун
    if (cooldowns[toolId]) return false;

    // Проверяем требования (безопасно)
    const requirements: any = tool.requirements || {};
    if (Array.isArray(requirements.equipment) && requirements.equipment.length > 0) {
      const hasEquipment = requirements.equipment.some((equip: string) => userEquipment?.includes(equip));
      if (!hasEquipment) return false;
    }
    const power = Number(characterStates?.power ?? 0);
    if (typeof requirements.powerLevel === 'number' && power < requirements.powerLevel) return false;

    return true;
  }, [characterAIConfig?.tools, cooldowns, characterStates, userEquipment]);

  const canChangePose = useCallback((poseId: string): boolean => {
    const pose = characterAIConfig?.poses?.[poseId];
    if (!pose) return false;

    const requirements: any = pose.requirements || {};
    const flexibility = Number(characterAttributes?.flexibility ?? 0);
    const strength = Number(characterAttributes?.strength ?? 0);
    const trust = Number(characterStates?.trust ?? 0);
    const relationship = Number(characterStates?.relationship ?? 0);
    if (typeof requirements.flexibility === 'number' && flexibility < requirements.flexibility) return false;
    if (typeof requirements.strength === 'number' && strength < requirements.strength) return false;
    if (typeof requirements.trustLevel === 'number' && trust < requirements.trustLevel) return false;
    if (typeof requirements.relationshipLevel === 'number' && relationship < requirements.relationshipLevel) return false;

    return true;
  }, [characterAIConfig?.poses, characterAttributes, characterStates]);

  // Получение доступных данных
  const getAvailableActions = useCallback((): InteractiveAction[] => {
    const actions = characterAIConfig?.actions || {};
    return Object.values(actions).filter((action: any) => action?.id && canExecuteAction(action.id));
  }, [characterAIConfig?.actions, canExecuteAction]);

  const getAvailableTools = useCallback((): InteractiveTool[] => {
    const tools = characterAIConfig?.tools || {};
    return Object.values(tools).filter((tool: any) => tool?.id && canUseTool(tool.id));
  }, [characterAIConfig?.tools, canUseTool]);

  const getAvailablePoses = useCallback((): Pose[] => {
    if (!poseManagementService) return [] as Pose[];
    return poseManagementService.getAvailablePoses(characterAttributes, characterStates, userEquipment);
  }, [poseManagementService, characterAttributes, characterStates, userEquipment]);

  const getInteractiveAreas = useCallback((): InteractiveArea[] => {
    return Object.values(characterAIConfig.interactiveAreas || {});
  }, [characterAIConfig.interactiveAreas]);

  const getQuickActions = useCallback((): QuickAction[] => {
    const quick = characterAIConfig?.quickActions || {};
    return Object.values(quick).filter((action: any) => action?.id && !cooldowns[action.id]);
  }, [characterAIConfig?.quickActions, cooldowns]);

  // Автоматическая проверка смены позы каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(checkAutomaticPoseChanges, 30000);
    return () => clearInterval(interval);
  }, [checkAutomaticPoseChanges]);

  return {
    // Состояние
    currentPose,
    poseHistory,
    lastAction,
    lastTool,
    cooldowns,
    
    // Конфигурация
    characterAIConfig,
    
    // Сервисы
    messageAnalysisService,
    poseManagementService,
    
    // Действия
    executeAction,
    useTool,
    startToolUse,
    stopToolUse,
    startActionUse,
    stopActionUse,
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
