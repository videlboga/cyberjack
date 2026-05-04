import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnatomyView } from './AnatomyView';
import DiegeticUI from './DiegeticUI';
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
  if (!pointId || pointId === 'systemic') {
    return actions.filter(action => !action.occupiesPoints || action.occupiesPoints.length === 0);
  }
  const pid = pointId.toLowerCase();
  return actions.filter(action => {
    if (!action.occupiesPoints || action.occupiesPoints.length === 0) return true;
    return action.occupiesPoints.some(p => p.toLowerCase() === pid);
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
    return urlParams.get('sceneId') || 'scene_lab_calibrator';
  });

  const [allScenes, setAllScenes] = useState<any[]>([]);
  const sceneCharacters: SceneCharacterPresence[] = sceneData?.characters || [];

  useEffect(() => {
    if (!focusedCharId && !!sceneCharacters?.length) {
      const npc = sceneCharacters.find(c => c.character.id !== PLAYER_CHARACTER_ID);
      if (npc) setFocusedCharId(npc.character.id);
    }
  }, [sceneCharacters, focusedCharId]);


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
        const pointsMap = (body.availablePoints || []).reduce((acc: any, pt: any) => {
          acc[pt.id] = pt;
          return acc;
        }, {});
        setSubjectState({ ...body.subject, points: pointsMap });
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

  // Relaxed focus dropping to allow targeting entities outside the explicit scene config
  // useEffect(() => {
  //   if (focusedCharId && sceneCharacters.length) {
  //     const stillPresent = sceneCharacters.some(entry => entry.character.id === focusedCharId);
  //     if (!stillPresent) {
  //       setFocusedCharId(null);
  //     }
  //   }
  // }, [sceneCharacters, focusedCharId]);

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
        // Мы не добавляем сообщение о физическом действии в лог здесь, 
        // чтобы не засорять художественный нарратив техническими строками.
        // Оно все равно отобразится через реакцию Рассказчика.
      } else if (presetId === 'wait') {
        // addMessage({ role: 'system', text: `Вы ждете... Проходит время.`, actorId: 'system' });
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
        const actionApplied = !!data.actionApplied;
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
          if (reaction && actionApplied) {
            addMessage({ role: 'narrator', text: reaction });
          }
        } else if (data.reply) {
          if (data.reply.speech) addMessage({ role: 'subject', text: data.reply.speech, actorId: targetCharId });
          if (data.reply.reaction && actionApplied) {
            addMessage({ role: 'narrator', text: data.reply.reaction });
          }
        } else if (data.narratorReaction && actionApplied) {
          addMessage({ role: 'narrator', text: data.narratorReaction });
        } else {
          // Если нет ни речи, ни реакции нарратора, и действие не выполнилось (филлерная заглушка) - ничего не выводим
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
    // 1. Убрано ограничение на сектора: теперь мы полагаемся на то, что если 
    //    игрок смог кликнуть на персонажа (в Unity или интерфейсе), значит он рядом.
    // 2. Не отображаем вербальные действия (они идут через инпут чата).
    // 3. Проверка предметов пока идет по инвентарю (позже Unity сможет передавать фокус на предметы сцены).
    
    // Получаем список предметов в текущей сцене или инвентаре для проверки access'а
    // (Пока оставляем проверку по playerInventory)
    const validActions = availableActions.filter(a => {
      // Если предмет не в руках, проверяем, нет ли его в комнате (в sceneObjects)
      if (a.requiresItem) {
        const hasInInventory = playerInventory.some(item => item.id === a.requiresItem);
        // Если у нас будет механизм проверки предметов сцены - можно добавить его сюда
        // const hasInRoom = sceneObjects.some(obj => obj.itemId === a.requiresItem);
        if (!hasInInventory) return false;
      }
      
      if (a.type === 'verbal') return false;
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
    <>
      <DiegeticUI 
        messages={messages}
        groupedActions={groupedActions}
        radialCategories={radialCategories}
        sendAction={sendAction}
        isProcessing={isProcessing}
        focusedCharacter={focusedCharacter}
        targetSubjectId={focusedCharId}
        playerResources={playerResources}
        playerInventory={playerInventory}
        subjectState={subjectState}
        setSelectedPoint={setSelectedPoint}
        onFocusSubject={setFocusedCharId}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleChatSubmit={handleChatSubmit}
        relationsList={relationsList}
      />
    </>
  );
}
