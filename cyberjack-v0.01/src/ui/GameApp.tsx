import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnatomyView } from './AnatomyView';
import './GameApp.css';

const API_BASE = '';
const PLAYER_CHARACTER_ID = 'PL-1';
const PLAYER_RESOURCE_ID = 'PL-1';

type ActionPreset = {
  id: string;
  label: string;
  occupiesPoints?: string[];
  disabled?: boolean;
  tags?: string[];
  type?: string;
  requiresItem?: string | null;
};

type Character = { id: string; name: string; kind?: string; playerId?: string | null; };

type SceneCharacterPresence = {
  character: Character;
  role?: string;
  canAct?: boolean;
  presenceState?: string;
  slotId?: string | null;
};

type LayoutNode = {
  id: string;
  label?: string;
  name?: string;
  x?: number;
  y?: number;
  position?: { x: number; y: number };
  coords?: { x: number; y: number };
};

type NodePosition = {
  left: string;
  top: string;
  leftValue: number;
  topValue: number;
};

const sanitizeActions = (actions: ActionPreset[] = []) => actions.filter(action => !action.disabled);

const clampPercent = (value: number, min = 12, max = 88) => Math.max(min, Math.min(max, value));
const clampRange = (value: number, min = 5, max = 95) => Math.max(min, Math.min(max, value));

const FALLBACK_BOUNDS = { width: 1000, height: 700 };

const avatarNameMap: Record<string, string> = {
  "Векс": "/avatars/Vex.png",
  "Сайлас": "/avatars/Silas.png",
  "Эли": "/avatars/Eli.png",
  "Никс": "/avatars/Nyx.png",
  "Мара": "/avatars/Mara.png",
  "Кай": "/avatars/Kai.png",
  "Иден": "/avatars/Eden.png",
  "Рунис": "/avatars/Runis.png",
  "Рен": "/avatars/Ren.png",
  "Брокер": "/avatars/Calibrator.png", // Fallback for player
};

const getAvatarUrl = (name: string): string | null => {
  for (const [ru, filename] of Object.entries(avatarNameMap)) {
    if (name.includes(ru)) return filename;
  }
  return null;
};

const RADIAL_GROUPS = [
  { id: 'medical', label: 'Медицинские', tags: ['medical', 'clinical', 'chemical', 'piercing', 'inspection'] },
  { id: 'intimate', label: 'Интимные', tags: ['intimate', 'sensual', 'stimulation', 'affection'] },
  { id: 'pain', label: 'Силовые', tags: ['impact', 'pain', 'punishment', 'dominance', 'struggle'] },
  { id: 'control', label: 'Контроль', tags: ['restraint', 'control', 'metal', 'electronic', 'pose', 'bdsm'] },
  { id: 'support', label: 'Поддержка', tags: ['mental', 'comfort', 'talk', 'trade', 'praise'] }
];

const ACTION_GROUP_OVERRIDES: Record<string, string> = {
  gentle_stroke: 'support',
  tickle: 'support',
  feather_stroke: 'support',
  breath_blow: 'support',
  verbal_pressure: 'support',
  stare: 'support',
  close_inspection: 'support',
  light_kiss: 'intimate',
  deep_kiss: 'intimate',
  deep_massage: 'intimate',
  licking: 'intimate',
  vibrator_pulse: 'intimate',
  gentle_touch: 'intimate',
  firm_grip: 'pain',
  light_bite: 'pain',
  hard_bite: 'pain',
  pinch: 'pain',
  scratching: 'pain',
  slap: 'pain',
  hard_slap: 'pain',
  belt_strike: 'pain',
  whip_strike: 'pain',
  taser_shock: 'pain',
  feint_strike: 'pain',
  hair_pull: 'pain',
  spit: 'control',
  needle_prick: 'medical',
  ice_cube: 'medical',
  hot_wax: 'medical',
  pose_kneeling: 'control',
  restraint_cuffs: 'control'
};

const computeAutoPositions = (nodes: LayoutNode[]): Record<string, NodePosition> => {
  if (!nodes.length) return {};
  const count = nodes.length;
  const rings: number[] = [];
  let remaining = count;
  let ring = 0;
  while (remaining > 0) {
    const baseCapacity = ring === 0 ? Math.min(count, 6) : 6 + ring * 4;
    const capacity = Math.min(remaining, baseCapacity);
    rings.push(capacity);
    remaining -= capacity;
    ring += 1;
  }
  const baseRadius = 24;
  const radiusStep = 14;
  let ringStart = 0;
  let currentRing = 0;
  return nodes.reduce((acc, node, index) => {
    while (index >= ringStart + (rings[currentRing] || 0)) {
      ringStart += rings[currentRing];
      currentRing += 1;
    }
    const ringSize = rings[currentRing] || count;
    const angle = (index - ringStart) / Math.max(ringSize, 1) * Math.PI * 2;
    const radius = baseRadius + currentRing * radiusStep;
    const leftValue = clampPercent(50 + Math.cos(angle) * radius);
    const topValue = clampPercent(50 + Math.sin(angle) * radius * 0.75);
    acc[node.id] = { left: `${leftValue}%`, top: `${topValue}%`, leftValue, topValue };
    return acc;
  }, {} as Record<string, NodePosition>);
};

const getEdgeNode = (edge: any, key: 'from' | 'to') => {
  if (!edge) return null;
  return edge[key] ?? edge[key === 'from' ? 'source' : 'target'] ?? edge[key === 'from' ? 'start' : 'end'] ?? null;
};

const normalizeTags = (tags?: string[]) => (tags || []).map(tag => tag.toLowerCase());

const classifyAction = (action: ActionPreset): string | null => {
  if (ACTION_GROUP_OVERRIDES[action.id]) {
    return ACTION_GROUP_OVERRIDES[action.id];
  }
  const categories = ((action as any).categories || []) as string[];
  const baseTags = [...(action.tags || []), ...categories];
  const tags = normalizeTags(baseTags);
  for (const group of RADIAL_GROUPS) {
    if (tags.some(tag => group.tags.includes(tag))) {
      return group.id;
    }
  }
  if (action.requiresItem) {
    return 'control';
  }
  if (tags.length === 0) {
    return 'pain';
  }
  return null;
};

const filterActionsForPoint = (actions: ActionPreset[], pointId?: string | null) => {
  if (!pointId) {
    return actions.filter(action => !action.occupiesPoints || action.occupiesPoints.length === 0);
  }
  return actions.filter(action => {
    if (!action.occupiesPoints || action.occupiesPoints.length === 0) return true;
    return action.occupiesPoints.includes(pointId);
  });
};

export function GameApp({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('cyberjack_ui_messages');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });

  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('cyberjack_ui_messages', JSON.stringify(messages.slice(-500)));
      }
    } catch(e) {}
  }, [messages]);

  const [playerResources, setPlayerResources] = useState<Record<string, number>>({});
  const [playerInventory, setPlayerInventory] = useState<any[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showCardParams, setShowCardParams] = useState(false);
  const [subjectState, setSubjectState] = useState<any>(null);
  const [availableActions, setAvailableActions] = useState<ActionPreset[]>([]);
  const [sceneObjects, setSceneObjects] = useState<any[]>([]);
  const [actionPresetMap, setActionPresetMap] = useState<Record<string,string>>({});

  // fallback labels for item IDs that are not present in action presets
  const ITEM_LABELS: Record<string,string> = {
    'eq_suspension': 'Подвес',
    'eq_collar': 'Управляемый ошейник',
    'eq_handcuffs': 'Наручники'
  };
  const [layout, setLayout] = useState<any>(null);
  const [sceneData, setSceneData] = useState<any>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedCharId, setFocusedCharId] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string>('systemic');
  const [intensity, setIntensity] = useState<number>(1.0);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [availablePointsList, setAvailablePointsList] = useState<{ id: string; label: string }[]>([]);
  const [relationsList, setRelationsList] = useState<any[]>([]);
  const [actionCache, setActionCache] = useState<{ uid: string; presetId: string; label: string; pointId: string; intensity: number; targetCharId: string; targetCharName: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  const [sceneId, setSceneId] = useState(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
    return urlParams.get('sceneId') || 'lab';
  });

  const [allScenes, setAllScenes] = useState<any[]>([]);
  const sceneCharacters: SceneCharacterPresence[] = sceneData?.characters || [];


  const fetchInteractionState = async (targetId: string, hydrateState: boolean) => {
    try {
      const search = new URLSearchParams({
        subjectId: targetId,
        sceneId,
        pointId: selectedPoint || 'systemic'
      });
      const res = await fetch(`${API_BASE}/api/state?${search.toString()}`);
      const body = await res.json();
      if (!body.success) return;
      setAvailableActions(sanitizeActions(body.availableActions || []));
      if (body.player?.resources) {
        setPlayerResources(body.player.resources);
      }
      if (body.player?.inventory) {
        setPlayerInventory(body.player.inventory);
      }
      if (hydrateState && focusedCharId === targetId) {
        setSubjectState(body.subject);
        setRelationsList(body.relations || []);
        setAvailablePointsList(body.availablePoints || []);
        if (!body.availablePoints?.some((pt: any) => pt.id === selectedPoint)) {
          setSelectedPoint(body.availablePoints?.[0]?.id || 'systemic');
        }
      }
    } catch (err) {
      console.error('failed to fetch interaction state', err);
    }
  };

  const refreshSceneInfo = async () => {
    try {
      const [layoutRes, scenesRes] = await Promise.all([
        fetch(`${API_BASE}/api/scene/layout?sceneId=${sceneId}`),
        fetch(`${API_BASE}/api/scenes`)
      ]);

      const layoutBody = await layoutRes.json();
      if (layoutBody.success) {
        setLayout(layoutBody.layout || null);
      }

      const scenesBody = await scenesRes.json();
      if (scenesBody.success) {
        setAllScenes(scenesBody.scenes || []);
        const nextScene = scenesBody.scenes.find((x: any) => x.id === sceneId) || scenesBody.scenes[0];
        setSceneData(nextScene || null);
      }
      // additionally fetch scene objects (furniture / equipment) via state endpoint
      try {
        const stateRes = await fetch(`${API_BASE}/api/state?subjectId=S-01&sceneId=${sceneId}`);
        const stateBody = await stateRes.json();
        if (stateBody && stateBody.success) {
          setSceneObjects(stateBody.sceneObjects || []);
        }
      } catch (e) {
        console.warn('failed to load scene objects', e);
      }
    } catch (err) {
      console.error('failed to load scene info', err);
    }
  };

  useEffect(() => {
    (async () => {
      clearFocus();
      await Promise.all([
        refreshSceneInfo(),
        // Just fetch the lab scene state, the UI will focus the first character if needed.
        fetchInteractionState('S-AV-01', false)
      ]);

      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'system',
          text: `Связь установлена. Карта сцены: ${sceneId}`
        }
      ]);
    })();
    // fetch global action presets so we can map itemId -> human label
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/actions`);
        const all = await resp.json();
        if (Array.isArray(all)) {
          const map: Record<string,string> = {};
          all.forEach((a: any) => { if (a.id && a.label) map[a.id] = a.label; });
          setActionPresetMap(map);
        }
      } catch (e) {
        console.warn('failed to load action presets', e);
      }
    })();
  }, [sceneId]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!focusedCharId) {
      setSubjectState(null);
      return;
    }
    fetchInteractionState(focusedCharId, true);
  }, [focusedCharId, selectedPoint]);

  useEffect(() => {
    if (focusedCharId && sceneCharacters.length) {
      const stillPresent = sceneCharacters.some(entry => entry.character.id === focusedCharId);
      if (!stillPresent) {
        setFocusedCharId(null);
      }
    }
  }, [sceneCharacters, focusedCharId]);

  useEffect(() => {
    setActiveGroup(null);
  }, [focusedNodeId]);

  useEffect(() => {
    setActiveGroup(null);
  }, [focusedCharId]);

  useEffect(() => {
    if (!focusedCharId) return;
    setSelectedPoint('systemic');
  }, [focusedCharId]);

  const slotMap = useMemo(() => {
    if (!sceneData?.slots) return new Map<string, any>();
    return new Map(sceneData.slots.map((slot: any) => [slot.id, slot]));
  }, [sceneData]);

  const layoutNodes: LayoutNode[] = useMemo(() => {
    if (layout?.nodes?.length) return layout.nodes;
    if (sceneData?.slots?.length) {
      return sceneData.slots.map((slot: any) => ({ id: slot.id, label: slot.name, capacity: slot.capacity }));
    }
    return [];
  }, [layout, sceneData]);

  const nodePositions = useMemo(() => {
    if (!layoutNodes.length) return {} as Record<string, NodePosition>;
    const bounds = layout?.bounds || FALLBACK_BOUNDS;
    const nodesWithCoords = layoutNodes.filter(node => {
      const rawX = node.x ?? node.position?.x ?? node.coords?.x;
      const rawY = node.y ?? node.position?.y ?? node.coords?.y;
      return typeof rawX === 'number' && typeof rawY === 'number';
    });

    if (!nodesWithCoords.length) {
      return computeAutoPositions(layoutNodes);
    }

    const xs = nodesWithCoords.map(node => node.x ?? node.position?.x ?? node.coords?.x ?? 0);
    const ys = nodesWithCoords.map(node => node.y ?? node.position?.y ?? node.coords?.y ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || bounds.width || 1;
    const rangeY = maxY - minY || bounds.height || 1;

    return layoutNodes.reduce((acc, node, index) => {
      const rawX = node.x ?? node.position?.x ?? node.coords?.x;
      const rawY = node.y ?? node.position?.y ?? node.coords?.y;
      if (typeof rawX === 'number' && typeof rawY === 'number') {
        const leftValue = clampPercent(25 + ((rawX - minX) / rangeX) * 50);
        const topValue = clampPercent(25 + ((rawY - minY) / rangeY) * 50);
        acc[node.id] = { left: `${leftValue}%`, top: `${topValue}%`, leftValue, topValue };
      } else {
        const fallback = clampPercent(25 + (index / Math.max(layoutNodes.length - 1, 1)) * 50);
        acc[node.id] = { left: `${fallback}%`, top: `${50}%`, leftValue: fallback, topValue: 50 };
      }
      return acc;
    }, {} as Record<string, NodePosition>);
  }, [layoutNodes, layout]);

  const nodeLabelMap = useMemo(() => {
    const entries = layoutNodes.map(node => [node.id, node.label || node.name || slotMap.get(node.id)?.name || node.id]);
    return new Map<string, string>(entries as [string, string][]);
  }, [layoutNodes, slotMap]);

  const speechBubbles = useMemo(() => {
    const store = new Map<string, string>();
    // Показываем облачко только для последней партии сообщений (группы с одним timestamp)
    if (messages.length === 0) return store;
    
    // Находим все сообщения, которые пришли одновременно с самым последним
    const lastMsgTime = messages[messages.length - 1].timestamp || messages[messages.length - 1].id;
    // Упрощенный подход: берем несколько последних сообщений, если они близки по времени,
    // или еще надежнее: собираем только из последнего "тика".
    // Так как у нас нет явного tickId в messages, будем считать,
    // что мы просто оставляем облачка только для самых недавних сообщений (последние 3 секунды).
    const recentTimeThreshold = Date.now() - 3000; 

    // Найдем самую позднюю отметку времени генерации ID (id у нас Date.now() + random)
    const latestIdBase = Math.floor(messages[messages.length - 1].id);
    
    messages.forEach(msg => {
      // Показывать облачко только если сообщение было добавлено только что
      // Примечание: msg.id это Date.now() + Math.random(), поэтому Math.floor(msg.id) это timestamp
      if (Math.floor(msg.id) >= latestIdBase - 500) {
        if (msg.actorId && msg.actorId !== 'player') {
          store.set(msg.actorId, msg.text);
        }
      }
    });
    return store;
  }, [messages]);

  const characterNameMap = useMemo(() => {
    const map = new Map<string, string>();
    sceneCharacters.forEach(entry => {
      map.set(entry.character.id, entry.character.name);
    });
    return map;
  }, [sceneCharacters]);

  const focusedPresence = useMemo(() => {
    if (!focusedCharId) return null;
    return sceneCharacters.find(entry => entry.character.id === focusedCharId) || null;
  }, [sceneCharacters, focusedCharId]);

  const focusedCharacter = focusedPresence?.character || null;

  const focusedBubblePosition = focusedPresence?.slotId ? nodePositions[focusedPresence.slotId] : undefined;
  const focusedNodePosition = focusedNodeId ? nodePositions[focusedNodeId] : undefined;
  const focusedNodeLabel = focusedNodeId ? (nodeLabelMap.get(focusedNodeId) || focusedNodeId) : null;
  const focusedNodeMeta = focusedNodeId ? slotMap.get(focusedNodeId) : null;

  const sectorCharacters = useMemo(() => {
    if (!focusedNodeId) return [] as SceneCharacterPresence[];
    return sceneCharacters.filter(entry => entry.slotId === focusedNodeId);
  }, [sceneCharacters, focusedNodeId]);

  const sectorCardStyle = useMemo(() => {
    if (!focusedNodePosition) return { left: '50%', top: '40%' };
    const left = clampRange(focusedNodePosition.leftValue + 4, 10, 85);
    const top = clampRange(focusedNodePosition.topValue - 15, 10, 75);
    return { left: `${left}%`, top: `${top}%` };
  }, [focusedNodePosition]);

  const overlayPlacement = useMemo(() => {
    if (!focusedBubblePosition) {
      return {
        horizontal: 'right',
        vertical: 'down',
        style: { left: '55%', top: '40%', transform: 'translate(-40%, -20%)' }
      } as { horizontal: 'left' | 'right' | 'center'; vertical: 'up' | 'down'; style: React.CSSProperties };
    }
    const { leftValue, topValue } = focusedBubblePosition;
    const horizontal: 'left' | 'right' | 'center' = leftValue > 62 ? 'left' : leftValue < 38 ? 'right' : 'center';
    const vertical: 'up' | 'down' = topValue > 55 ? 'up' : 'down';
    const leftOffset = horizontal === 'left' ? -12 : horizontal === 'right' ? 18 : 5;
    const topOffset = vertical === 'up' ? -14 : 10;
    const left = clampRange(leftValue + leftOffset, 12, 88);
    const top = clampRange(topValue + topOffset, 12, 88);
    const translateX = horizontal === 'left' ? '-90%' : horizontal === 'right' ? '-5%' : '-50%';
    const translateY = vertical === 'up' ? '-95%' : '-15%';
    return {
      horizontal,
      vertical,
      style: { left: `${left}%`, top: `${top}%`, transform: `translate(${translateX}, ${translateY})` }
    };
  }, [focusedBubblePosition]);

  const latestNarrative = useMemo(() => {
    const reversed = [...messages].reverse();
    const narrator = reversed.find(msg => msg.role === 'narrator');
    const system = reversed.find(msg => msg.role === 'system');
    return narrator?.text || system?.text || 'Ожидание событий...';
  }, [messages]);

  const addMessage = (msg: any) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random() }]);
  };

  const clearFocus = () => {
    setFocusedNodeId(null);
    setFocusedCharId(null);
  };

  const movePlayerToSector = async (nodeId: string, label: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/scene/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: PLAYER_CHARACTER_ID,
          sceneId,
          slotId: nodeId
        })
      });
      const body = await res.json();
      if (!body.success) {
        throw new Error(body.error || 'move failed');
      }
      await refreshSceneInfo();
      setFocusedNodeId(nodeId);
      addMessage({ role: 'system', text: `Игрок перемещён в сектор «${label}».` });
    } catch (error) {
      console.error('failed to move player', error);
      addMessage({ role: 'system', text: 'Не удалось перейти в сектор.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getActorName = (actorId?: string, role?: string) => {
    if (actorId === 'player') return 'Вы';
    if (actorId) return characterNameMap.get(actorId) || actorId;
    if (role === 'narrator') return 'Рассказчик';
    if (role === 'system') return 'Система';
    return 'Персонаж';
  };

  const sendAction = async (presetId?: string, text?: string, targetPoint?: string, targetCharIdOverride?: string, customIntensity?: number) => {
    let targetCharId = targetCharIdOverride || focusedCharId;
    if (!targetCharId && presetId === 'wait') {
      const npcInScene = sceneCharacters.find(c => c.character.id !== PLAYER_CHARACTER_ID)?.character.id;
      targetCharId = npcInScene || 'S-01'; // Fallback so tick has a subject context
    }
    
    if (!targetCharId) {
      return;
    }

    setIsProcessing(true);

    try {
      const resolvedPoint = targetPoint || selectedPoint || 'systemic';
      const actualIntensity = customIntensity ?? intensity;
      const reqBody: any = {
        subjectId: targetCharId,
        pointId: resolvedPoint,
        intensity: actualIntensity,
        sceneId,
        playerId: PLAYER_RESOURCE_ID,
        skipLLM: false
      };

      if (presetId) reqBody.presetId = presetId;
      if (text) reqBody.textMessage = text;

      if (presetId && presetId !== 'wait') {
        const actionLabel = availableActions.find(a => a.id === presetId)?.label || presetId;
        addMessage({ role: 'player', text: `[Действие] ${actionLabel} -> ${resolvedPoint}`, actorId: 'player' });
      } else if (presetId === 'wait') {
        addMessage({ role: 'system', text: `Вы ждете... Проходит время.`, actorId: 'system' });
      } else if (text) {
        addMessage({ role: 'player', text, actorId: 'player' });
      }

      setChatInput('');

      const res = await fetch(`${API_BASE}/api/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      const data = await res.json();

      if (!data.success) {
        const errorText = data.error || 'Действие недоступно.';
        addMessage({ role: 'system', text: errorText });
        return;
      }

      if (data.success) {
        await Promise.all([
          refreshSceneInfo(),
          fetchInteractionState(targetCharId, true)
        ]);

        if (data.actorReplies && data.actorReplies.length > 0) {
          data.actorReplies.forEach((repl: any) => {
            if (repl.speech) {
              addMessage({ role: 'subject', text: repl.speech, actorId: repl.actorId });
            }
          });
          const reaction = data.narratorReaction || data.actorReplies[0]?.reaction;
          if (reaction) {
            addMessage({ role: 'narrator', text: reaction });
          }
        } else if (data.reply) {
          if (data.reply.speech) addMessage({ role: 'subject', text: data.reply.speech, actorId: targetCharId });
          if (data.reply.reaction) addMessage({ role: 'narrator', text: data.reply.reaction });
        } else if (data.narratorReaction) {
          addMessage({ role: 'narrator', text: data.narratorReaction });
        } else {
          const fallback = data.diagnostics?.semanticNarrative || data.llmResponse?.content || 'Действие выполнено.';
          addMessage({ role: 'narrator', text: fallback });
        }
      }
    } catch (e) {
      console.error(e);
      addMessage({ role: 'system', text: e instanceof Error ? e.message : 'Ошибка выполнения действия.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !focusedCharId) return;
    
    if (chatInput.trim() === '/clear') {
      setMessages([]);
      localStorage.removeItem('cyberjack_ui_messages');
      setChatInput('');
      return;
    }

    sendAction(undefined, chatInput.trim());
  };

  const groupedActions = useMemo(() => {
    // 1. Ограничение: физические действия недоступны, если сектора разные
    // 2. Не отображаем вербальные действия
    // 3. Только доступные по ресурсам
    const playerSector = sceneCharacters.find(c => c.character.id === PLAYER_CHARACTER_ID)?.slotId;
    const targetSector = sceneCharacters.find(c => c.character.id === focusedCharId)?.slotId;
    const sameSector = playerSector === targetSector;

    const validActions = availableActions.filter(a => {
      if (a.requiresItem && !playerInventory.some(item => item.id === a.requiresItem)) return false;
      if (a.type === 'verbal') return false;
      if (a.type === 'physical' && !sameSector) return false;
      return true;
    });

    const actions = filterActionsForPoint(validActions, selectedPoint);
    const base: Record<string, ActionPreset[]> = {};
    RADIAL_GROUPS.forEach(group => {
      base[group.id] = [];
    });
    actions.forEach(action => {
      const groupId = classifyAction(action);
      if (groupId) {
        if (!base[groupId]) base[groupId] = [];
        base[groupId].push(action);
      }
    });
    return base;
  }, [availableActions, selectedPoint, sceneCharacters, focusedCharId, playerResources]);

  const radialCategories = RADIAL_GROUPS.filter(group => groupedActions[group.id]?.length);

  return (
    <div className="game-app-container">
      <div className="map-stage">
        <div className="map-canvas" onClick={clearFocus}>
          {layout?.edges?.length && (
            <svg className="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
              {layout.edges.map((edge: any, idx: number) => {
                const fromId = getEdgeNode(edge, 'from');
                const toId = getEdgeNode(edge, 'to');
                const fromPos = fromId ? nodePositions[fromId] : null;
                const toPos = toId ? nodePositions[toId] : null;
                if (!fromPos || !toPos) return null;
                return (
                  <line key={`${fromId}-${toId}-${idx}`} x1={fromPos.leftValue} y1={fromPos.topValue} x2={toPos.leftValue} y2={toPos.topValue} />
                );
              })}
            </svg>
          )}

          {layoutNodes.length === 0 && (
            <div className="map-empty">Нет данных о карте сцены</div>
          )}

          {layoutNodes.map(node => {
            const nodePosition = nodePositions[node.id];
            const nodeLabel = nodeLabelMap.get(node.id) || node.id;
            const slotMeta = slotMap.get(node.id);
            const nodeChars = sceneCharacters.filter(entry => entry.slotId === node.id);
            return (
              <div
                key={node.id}
                className={`map-node ${focusedNodeId === node.id ? 'active' : ''}`}
                style={nodePosition}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedNodeId(node.id);
                  setFocusedCharId(null);
                }}
              >
                <button
                  className="node-core"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedNodeId(node.id);
                    setFocusedCharId(null);
                  }}
                >
                  <span className="node-label">{nodeLabel}</span>
                  <span className="node-capacity">
                    {nodeChars.length}
                    {slotMeta?.capacity ? `/${slotMeta.capacity}` : ''}
                  </span>
                </button>

                <div className="node-avatars" onClick={e => e.stopPropagation()}>
                  {nodeChars.map(entry => {
                    const avatarUrl = getAvatarUrl(entry.character.name);
                    return (
                      <div
                        key={entry.character.id}
                        className={`avatar ${entry.character.playerId ? 'player' : 'subject'} ${focusedCharId === entry.character.id ? 'focused' : ''}`}
                        title={entry.character.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedCharId(entry.character.id);
                          setFocusedNodeId(null);
                        }}
                        style={avatarUrl ? {
                          backgroundImage: `url("${avatarUrl}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          color: 'transparent'
                        } : {}}
                      >
                        {!avatarUrl ? entry.character.name.split(' ').slice(0, 2).map(part => part[0]).join('') : ''}
                        {speechBubbles.get(entry.character.id) && (
                          <div className="avatar-bubble" style={{color: '#fff'}}>{speechBubbles.get(entry.character.id)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}


          {focusedNodeId && (
            <div className="sector-card" style={sectorCardStyle} onClick={e => e.stopPropagation()}>
              <div className="sector-card-header">
                <div>
                  <span className="card-label">Сектор</span>
                  <h3>{focusedNodeLabel || focusedNodeId}</h3>
                </div>
                {focusedNodeMeta?.capacity && (
                  <span className="presence-state">{sectorCharacters.length}/{focusedNodeMeta.capacity}</span>
                )}
              </div>
              <div className="sector-body">
                <div className="sector-meta">
                  <button
                    type="button"
                    onClick={() => movePlayerToSector(focusedNodeId, focusedNodeLabel || focusedNodeId)}
                    disabled={isProcessing}
                  >
                    Перейти
                  </button>
                </div>
                <div className="sector-occupants">
                  <span className="card-label">Оборудование</span>
                  <div className="occupant-list">
                    {(() => {
                      const objs = sceneObjects.filter(o => o.nodeId === focusedNodeId);
                      if (objs.length === 0) return <span className="node-menu-empty">Нет оборудования</span>;
                      return objs.map(obj => {
                        const label = actionPresetMap[obj.itemId] || availableActions.find(a => a.id === obj.itemId)?.label || ITEM_LABELS[obj.itemId] || obj.itemId;
                        return (
                          <div key={obj.id} style={{ padding: '6px 8px', margin: '4px 0', background: '#0b1220', border: '1px solid #233044', borderRadius: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ color: '#fff' }}>{label}</div>
                              <div style={{ color: '#94a3b8', fontSize: 12 }}>{obj.state || '—'}</div>
                            </div>
                            {obj.metadata && Object.keys(obj.metadata).length > 0 && (
                              <div style={{ color: '#98a8c7', fontSize: 12, marginTop: 6 }}>{JSON.stringify(obj.metadata)}</div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {focusedCharacter && (
            <div
              className="anatomy-modal-container"
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'row',
                gap: '16px',
                background: 'transparent',
                zIndex: 1000
              }}
              onClick={e => e.stopPropagation()}
            >
              
                <AnatomyView relationsList={relationsList}
                subjectState={subjectState}
                character={focusedCharacter}
                avatarUrl={getAvatarUrl(focusedCharacter.name)}
                activeContexts={subjectState?.contexts || []}
                availablePoints={availablePointsList}
                availableActions={availableActions}
                onActionSelect={(pointId: string, actionId: string, intensity: number) => {
                  if (!focusedCharId) return;
                  sendAction(actionId, undefined, pointId, focusedCharId, intensity);
                }}
              />

            </div>
          )}
        </div>

        {actionCache.length > 0 && (
          <div className="action-cache-panel" style={{
            position: 'absolute', bottom: 120, right: 20, // Меню кэша в нижнем правом углу
            background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1000,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', minWidth: 500, maxWidth: 800
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Кэш действий ({actionCache.length} / 10)</h4>
              <button onClick={() => setActionCache([])} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', fontSize: 11, cursor: 'pointer', padding: '2px 8px', borderRadius: 4 }}>Очистить всё</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {actionCache.map(cacheItem => (
              <div key={cacheItem.uid} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(30, 41, 59, 0.8)', padding: '8px 12px', border: '1px solid #475569', borderRadius: 6, fontSize: 13 }}>
                
                <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 150 }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 'bold' }} title={cacheItem.label}>{cacheItem.label}</span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>Цель: {cacheItem.targetCharName}</span>
                </div>

                <select
                  value={cacheItem.pointId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActionCache(prev => prev.map(p => p.uid === cacheItem.uid ? { ...p, pointId: val } : p));
                  }}
                  style={{ width: 140, padding: '4px 8px', background: '#0f172a', color: '#fff', border: '1px solid #64748b', borderRadius: 4, fontSize: 12, outline: 'none' }}
                >
                  <option value="" disabled>Выберите точку</option>
                  {availablePointsList.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.label}</option>
                  ))}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', padding: '4px 8px', borderRadius: 4, border: '1px solid #64748b' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Сила:</span>
                  <input
                    type="range" min="0.1" max="2.0" step="0.1"
                    value={cacheItem.intensity}
                    title={`Интенсивность: ${cacheItem.intensity.toFixed(1)}`}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setActionCache(prev => prev.map(p => p.uid === cacheItem.uid ? { ...p, intensity: val } : p));
                    }}
                    style={{ width: 80, cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                  <span style={{ fontSize: 12, color: '#e2e8f0', width: 24, textAlign: 'right', fontWeight: 'bold' }}>{cacheItem.intensity.toFixed(1)}</span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button 
                    type="button" 
                    disabled={isProcessing || !cacheItem.pointId}
                    onClick={() => {
                        sendAction(cacheItem.presetId, undefined, cacheItem.pointId, cacheItem.targetCharId, cacheItem.intensity);
                    }}
                    style={{ background: isProcessing || !cacheItem.pointId ? '#475569' : '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: isProcessing || !cacheItem.pointId ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: 12, transition: 'background 0.2s' }}
                    title={!cacheItem.pointId ? "Выберите точку применения" : "Применить действие"}
                  >
                    Применить
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setActionCache(prev => prev.filter(p => p.uid !== cacheItem.uid))}
                    style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 4, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, transition: 'background 0.2s' }}
                    title="Удалить из списка"
                  >
                    ✕
                  </button>
                </div>

              </div>
            ))}
            </div>
          </div>
        )}

        <div className="hud-panel">
          <div className="resource-strip">
            {Object.entries(playerResources).map(([key, value]) => (
              <div key={key} className="resource-chip">
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="hud-buttons">
            <button type="button" onClick={() => { setShowLocations(!showLocations); setShowInventory(false); }}>Локации</button>
            <button type="button" onClick={() => { setShowInventory(!showInventory); setShowLocations(false); }}>Инвентарь</button>
            <button type="button">Журнал</button>
            <button type="button" onClick={() => sendAction('wait')} disabled={isProcessing}>
              {isProcessing ? 'Ход...' : 'Ждать тик'}
            </button>
          </div>
          <div className="narrator-card">
            <span className="card-label">Рассказчик</span>
            <p>{latestNarrative}</p>
          </div>
        </div>

        {showLocations && (
          <div style={{
            position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8, padding: 20, zIndex: 2000,
            width: 450, color: '#e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16 }}>Навигация</h3>
              <button 
                onClick={() => setShowLocations(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
              >×</button>
            </div>
            
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #475569' }}>
               <h4 style={{ margin: '0 0 8px 0', color: '#e2e8f0', fontSize: 14 }}>{sceneData?.description || sceneData?.id}</h4>
               <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Доступные переходы в другие сектора:</p>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                 {sceneData?.transitions?.length > 0 ? (
                   sceneData.transitions.map((tr: any) => {
                     const target = allScenes.find(s => s.id === (tr.targetSceneId || tr.toSceneId));
                     const label = target?.description ? target.description.split('.')[0] : tr.targetSceneId || tr.toSceneId;
                     return (
                       <button
                         key={tr.targetSceneId || tr.toSceneId}
                         onClick={() => {
                           const searchParams = new URLSearchParams(window.location.search);
                           searchParams.set('sceneId', tr.targetSceneId || tr.toSceneId);
                           window.history.pushState({}, '', '?' + searchParams.toString());
                           setSceneId(tr.targetSceneId || tr.toSceneId);
                           setShowLocations(false);
                         }}
                         style={{ textAlign: 'left', background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                       >
                         <span>{label}</span>
                         <span>→</span>
                       </button>
                     );
                   })
                 ) : (
                   <div style={{ padding: '12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: 6, color: '#64748b', fontSize: 13 }}>Нет доступных путей из этой локации</div>
                 )}
               </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px' }}>Системный телепорт</h4>
              <select 
                value={sceneId}
                onChange={(e) => {
                  const newId = e.target.value;
                  const searchParams = new URLSearchParams(window.location.search);
                  searchParams.set('sceneId', newId);
                  window.history.pushState({}, '', '?' + searchParams.toString());
                  setSceneId(newId);
                  setShowLocations(false);
                }}
                style={{ width: '100%', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '8px 12px', outline: 'none', cursor: 'pointer' }}
              >
                {allScenes.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.description ? sc.description.slice(0, 30) + '...' : sc.id}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showInventory && (
          <div style={{
            position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8, padding: 20, zIndex: 2000,
            width: 500, color: '#e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16 }}>Инвентарь</h3>
              <button 
                onClick={() => setShowInventory(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
              >×</button>
            </div>
            {playerInventory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>Инвентарь пуст</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                {playerInventory.map(item => (
                  <div key={item.id} style={{
                    background: 'rgba(30, 41, 59, 0.8)', padding: 12, borderRadius: 6, border: '1px solid #475569'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: '#e2e8f0', fontSize: 14 }}>{item.name}</strong>
                      <span style={{ fontSize: 11, color: '#94a3b8', background: '#0f172a', padding: '2px 6px', borderRadius: 4 }}>{item.type}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1' }}>{item.description}</p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, color: '#64748b' }}>
                      <span>Состояние: <span style={{ color: item.state === 'active' ? '#4ade80' : '#f87171' }}>{item.state}</span></span>
                      {item.charges >= 0 && <span>Заряды: {item.charges}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="chat-overlay">
          <div className="chat-header">
            <div>
              <span>Адресат:</span>
              <strong>{focusedCharacter ? focusedCharacter.name : 'нет фокуса'}</strong>
            </div>
            {focusedNodeId && (
              <div className="chat-node-indicator">
                <span>Сектор:</span>
                <strong>{nodeLabelMap.get(focusedNodeId) || focusedNodeId}</strong>
              </div>
            )}
          </div>
          <div className="chat-body">
            <div className="log-entries" ref={logRef}>
              {messages.filter(m => m.role !== 'narrator').map((m, i) => (
                <div key={`${m.id}-${i}`} className={`log-entry ${m.role}`}>
                  <strong>{getActorName(m.actorId, m.role)}:</strong> {m.text}
                </div>
              ))}
            </div>
            <form className="chat-input-bar" onSubmit={handleChatSubmit}>
              <div className="chat-target-hint">
                {focusedCharacter ? `Фраза адресована: ${focusedCharacter.name}` : 'Выберите персонажа на карте, чтобы активировать чат'}
              </div>
              <div className="chat-input-row">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={focusedCharacter ? `Сообщение для ${focusedCharacter.name}` : 'Нет активного фокуса'}
                  disabled={isProcessing || !focusedCharacter}
                />
                <button type="submit" disabled={isProcessing || !focusedCharacter}>
                  Отправить
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
