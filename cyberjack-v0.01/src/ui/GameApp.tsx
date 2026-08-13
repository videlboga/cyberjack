import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatRelativeValue,
  interpretCoreMetric,
  interpretPointSensitivity,
  InterpretableCoreMetric,
} from '../domain/parameterInterpretation';
import { useI18n } from './i18n';
import './GameApp.css';

const API_BASE = '';
const PLAYER_CHARACTER_ID = 'PL-1';

// ─── Types ──────────────────────────────────────────────

type ActionPreset = {
  id: string;
  label: string;
  occupiesPoints?: string[];
  disabled?: boolean;
  tags?: string[];
  type?: string;
  requiresItem?: string | null;
};

type Character = { id: string; name: string; kind?: string };

type SceneCharPresence = {
  character: Character;
  role?: string;
  canAct?: boolean;
  presenceState?: string;
  slotId?: string | null;
};

type PointInfo = { id: string; label: string };

type SubjectState = {
  name?: string;
  sensitivity: number;
  capacity: number;
  openness: number;
  plasticity: number;
  attitude: number;
  tension: number;
  baselineSensitivity?: number;
  baselineCapacity?: number;
  baselineOpenness?: number;
  baselinePlasticity?: number;
  baselineAttitude?: number;
  anatomy?: Record<string, {
    pointId: string;
    localSensitivity: number;
    localAttitude: number;
    baselineLocalSensitivity?: number;
    baselineLocalAttitude?: number;
    familiarity?: number;
    exposureCount?: number;
  }>;
  contexts?: { actionId: string; label: string; type: string; pointId?: string }[];
};

type TickResult = {
  pleasure: number;
  discomfort: number;
  overload: number;
  engagement: number;
  learningEffect: number;
  experiencedIntensity: number;
  finalValence: number;
};

type ChatMessage = {
  id: number;
  role: 'system' | 'narrator' | 'actor' | 'player' | 'error';
  text: string;
  actorId?: string;
  actorName?: string;
};

type SuggestedChip = {
  text: string;
  actionId?: string;
  pointId?: string;
  type: string;
  speech?: string;
  description?: string;
};

type ContractProgress = {
  contractTitle: string;
  contractDescription: string;
  conditions: { label: string; current: number | boolean; operator: string; value: number; met: boolean }[];
  metAll: boolean;
} | null;

type ContractInfo = {
  id: string;
  title: string;
  description: string;
  issuerId: string;
  conditions: any[];
  rewards: any;
  state: string;
};

// ─── Constants ──────────────────────────────────────────

const CORE_METRICS: { key: keyof SubjectState; label: string; baselineKey?: keyof SubjectState; color: string }[] = [
  { key: 'sensitivity', label: 'Чувствительность', baselineKey: 'baselineSensitivity', color: '#2196f3' },
  { key: 'capacity',    label: 'Выносливость',     baselineKey: 'baselineCapacity',    color: '#2196f3' },
  { key: 'openness',    label: 'Открытость',         baselineKey: 'baselineOpenness',    color: '#2196f3' },
  { key: 'plasticity',  label: 'Пластичность',       baselineKey: 'baselinePlasticity',  color: '#2196f3' },
  { key: 'attitude',    label: 'Отношение',           baselineKey: 'baselineAttitude',    color: '#4caf50' },
  { key: 'tension',     label: 'Напряжение',                                                color: '#ff5722' },
];

const RESULT_METRICS: { key: keyof TickResult; label: string; color: string }[] = [
  { key: 'pleasure',         label: 'Удовольствие',  color: '#4caf50' },
  { key: 'discomfort',       label: 'Дискомфорт',    color: '#f44336' },
  { key: 'overload',         label: 'Перегрузка',    color: '#ff9800' },
  { key: 'engagement',       label: 'Вовлечённость', color: '#2196f3' },
  { key: 'learningEffect',   label: 'Обучение',      color: '#9c27b0' },
];

// Quick action categories — buttons instead of dropdown
const ACTION_CATEGORIES: { id: string; label: string; tag: string }[] = [
  { id: 'caress',    label: 'Ласка',    tag: 'affection' },
  { id: 'kiss',      label: 'Поцелуй',  tag: 'intimate' },
  { id: 'bite',      label: 'Укус',     tag: 'pain' },
  { id: 'slap',      label: 'Шлепок',   tag: 'impact' },
  { id: 'strike',    label: 'Удар',     tag: 'pain' },
  { id: 'medical',   label: 'Медицина', tag: 'medical' },
  { id: 'control',   label: 'Контроль', tag: 'restraint' },
  { id: 'pose',      label: 'Поза',     tag: 'pose' },
];

// Map category → action IDs (from seed data)
const CATEGORY_ACTIONS: Record<string, string[]> = {
  caress:   ['gentle_stroke', 'tickle', 'feather_stroke', 'deep_massage', 'licking', 'breath_blow', 'vibrator_pulse'],
  kiss:     ['light_kiss', 'deep_kiss'],
  bite:     ['light_bite', 'hard_bite', 'pinch', 'scratching'],
  slap:     ['slap', 'hard_slap', 'spit', 'hair_pull'],
  strike:   ['belt_strike', 'whip_strike', 'taser_shock', 'feint_strike'],
  medical:  ['needle_prick', 'ice_cube', 'hot_wax'],
  control:  ['pose_kneeling', 'stare', 'close_inspection'],
  pose:     ['pose_standing', 'pose_sitting', 'pose_lying_down', 'pose_all_fours', 'pose_spread_eagle'],
};

// ─── Helpers ────────────────────────────────────────────

const filterActionsForPoint = (actions: ActionPreset[], pointId?: string | null) => {
  if (!pointId || pointId === 'systemic') {
    return actions.filter(a => !a.occupiesPoints || a.occupiesPoints.length === 0);
  }
  const pid = pointId.toLowerCase();
  return actions.filter(a => {
    if (!a.occupiesPoints || a.occupiesPoints.length === 0) return true;
    return a.occupiesPoints.some(p => p.toLowerCase() === pid);
  });
};

const Bar: React.FC<{ value: number; max?: number; color?: string; baseline?: number; displayValue?: string; title?: string }> = ({ value, max = 100, color = '#4caf50', baseline, displayValue, title }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-container">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      {baseline !== undefined && baseline > 0 && (
        <div className="bar-baseline" style={{ left: `${(baseline / max) * 100}%` }} />
      )}
      <span className="bar-value" title={title}>{displayValue || Math.round(value)}</span>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────

export function GameApp() {
  const { t, locale } = useI18n();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('cyberjack_chat');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('cyberjack_chat', JSON.stringify(messages.slice(-200)));
      } else {
        localStorage.removeItem('cyberjack_chat');
      }
    } catch {}
  }, [messages]);
  const [subjectState, setSubjectState] = useState<SubjectState | null>(null);
  const [availableActions, setAvailableActions] = useState<ActionPreset[]>([]);
  const [availablePoints, setAvailablePoints] = useState<PointInfo[]>([]);
  const [sceneChars, setSceneChars] = useState<SceneCharPresence[]>([]);
  const [allScenes, setAllScenes] = useState<any[]>([]);
  const [focusedCharId, setFocusedCharId] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string>('systemic');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [useLLM, setUseLLM] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<TickResult | null>(null);
  const [sceneId, setSceneId] = useState('scene_lab_calibrator');
  const [error, setError] = useState<string | null>(null);
  const [suggestedChips, setSuggestedChips] = useState<SuggestedChip[]>([]);
  const [stateDescription, setStateDescription] = useState<string>('');
  const [contractProgress, setContractProgress] = useState<ContractProgress>(null);
  const [availableContracts, setAvailableContracts] = useState<ContractInfo[]>([]);
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);

  // ─── Localized metrics ───────────────────────────────
  const coreMetrics = useMemo(() => [
    { key: 'sensitivity' as const, label: t('game.state.sensitivity'), baselineKey: 'baselineSensitivity' as const, color: '#2196f3' },
    { key: 'capacity' as const, label: t('game.state.capacity'), baselineKey: 'baselineCapacity' as const, color: '#2196f3' },
    { key: 'openness' as const, label: t('game.state.openness'), baselineKey: 'baselineOpenness' as const, color: '#2196f3' },
    { key: 'plasticity' as const, label: t('game.state.plasticity'), baselineKey: 'baselinePlasticity' as const, color: '#2196f3' },
    { key: 'attitude' as const, label: t('game.state.attitude'), baselineKey: 'baselineAttitude' as const, color: '#4caf50' },
    { key: 'tension' as const, label: t('game.state.tension'), color: '#ff5722' },
  ], [locale]);

  const resultMetrics = useMemo(() => [
    { key: 'pleasure' as const, label: t('game.result.pleasure'), color: '#4caf50' },
    { key: 'discomfort' as const, label: t('game.result.discomfort'), color: '#f44336' },
    { key: 'overload' as const, label: t('game.result.overload'), color: '#ff9800' },
    { key: 'engagement' as const, label: t('game.result.engagement'), color: '#2196f3' },
    { key: 'learningEffect' as const, label: t('game.result.learning'), color: '#9c27b0' },
  ], [locale]);

  // ─── WebSocket: приём сгенерированных изображений сцены ──
  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'scene_image' && msg.payload?.imageUrl) {
              setSceneImageUrl(msg.payload.imageUrl);
            }
          } catch {}
        };
        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // ─── Data fetching ────────────────────────────────────

  const fetchContracts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contracts`);
      const body = await res.json();
      if (body.success) {
        setAvailableContracts(body.available || []);
      }
    } catch {}
  };

  useEffect(() => { fetchContracts(); }, []);

  const acceptContract = async (contractId: string) => {
    if (!focusedCharId) return;
    try {
      const res = await fetch(`${API_BASE}/api/contracts/${contractId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: focusedCharId, playerId: PLAYER_CHARACTER_ID }),
      });
      const data = await res.json();
      if (data.success) {
        addMsg('system', `Контракт принят: ${data.contract?.title || contractId}`);
        fetchContracts();
      } else {
        setError(data.error || 'Не удалось принять контракт');
      }
    } catch (e: any) { setError(e.message); }
  };

  const deliverContract = async (contractId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/contracts/${contractId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        addMsg('system', `Контракт выполнен! Награда зачислена.`);
        fetchContracts();
      } else if (data.metRequirements === false) {
        const unmet = (data.unmet || []).join('; ');
        addMsg('system', `Условия не выполнены: ${unmet}`);
      }
    } catch (e: any) { setError(e.message); }
  };

  const fetchState = async (targetId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/state?subjectId=${targetId}&sceneId=${sceneId}&pointId=${selectedPoint}`);
      const body = await res.json();
      if (!body.success) { setError(body.error || 'Failed to load state'); return; }

      setSubjectState(body.subject);
      setAvailableActions((body.availableActions || []).filter((a: ActionPreset) => !a.disabled));
      setAvailablePoints(body.availablePoints || []);
      setSceneChars(body.scene?.characters || []);
      if (!focusedCharId) {
        const npc = (body.scene?.characters || []).find((c: SceneCharPresence) => c.character.id !== PLAYER_CHARACTER_ID);
        if (npc) setFocusedCharId(npc.character.id);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchScenes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scenes`);
      const body = await res.json();
      if (body.success) setAllScenes(body.scenes || []);
    } catch {}
  };

  // ─── Effects ───────────────────────────────────────────

  useEffect(() => {
    fetchScenes();
    // Only show init message if no saved messages
    if (messages.length === 0) {
      setMessages([{ id: Date.now(), role: 'system', text: `Связь установлена. Сцена: ${sceneId}` }]);
    }
  }, []);

  useEffect(() => {
    if (focusedCharId) fetchState(focusedCharId);
  }, [focusedCharId, selectedPoint]);

  useEffect(() => {
    fetchState(focusedCharId || 'S-AV-01');
  }, [sceneId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  // ─── Actions ──────────────────────────────────────────

  const addMsg = (role: ChatMessage['role'], text: string, actorId?: string, actorName?: string) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, text, actorId, actorName }]);
  };

  const sendAction = async () => {
    if (!focusedCharId || (!selectedAction && !chatInput)) return;
    setIsProcessing(true);
    setError(null);
    try {
      const body: any = {
        subjectId: focusedCharId,
        sceneId,
        pointId: selectedPoint,
        presetId: selectedAction || undefined,
        textMessage: chatInput.trim() || undefined,
        skipLLM: !useLLM,
      };

      // Log the action mechanically BEFORE the tick result
      if (selectedAction) {
        const actionLabel = availableActions.find(a => a.id === selectedAction)?.label || selectedAction;
        const pointLabel = availablePoints.find(p => p.id === selectedPoint)?.label || selectedPoint;
        addMsg('system', `[${actionLabel} → ${pointLabel}]`);
      }
      if (chatInput.trim()) {
        addMsg('player', chatInput.trim());
      }

      const res = await fetch(`${API_BASE}/api/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Tick failed');
        addMsg('error', `Ошибка: ${data.error}`);
      } else {
        if (data.tickResult) setLastResult(data.tickResult);

        // System notes (refusals, context changes, described action results)
        if (data.systemNotes && data.systemNotes.length > 0) {
          for (const note of data.systemNotes) {
            addMsg('system', note);
          }
        }

        // Update narrative state description + chips + contract progress
        if (data.stateDescription) setStateDescription(data.stateDescription);
        if (data.contractProgress) setContractProgress(data.contractProgress);
        if (data.suggestedChips && data.suggestedChips.length > 0) {
          setSuggestedChips(data.suggestedChips);
        } else {
          setSuggestedChips([]);
        }

        // Narrator goes first (cinematic description)
        // API returns narratorReaction as string, not {reaction: string}
        const narratorText = typeof data.narratorReaction === 'string'
          ? data.narratorReaction
          : data.narratorReaction?.reaction;
        if (narratorText) {
          addMsg('narrator', narratorText);
        }

        // Then character speech
        // reply is the primary (subject) reply; actorReplies includes ALL actors
        // actorReplies already contains the subject's reply, so only show extras
        if (data.reply?.speech) {
          addMsg('actor', data.reply.speech, focusedCharId, subjectState?.name || focusedCharId);
        }
        if (data.actorReplies) {
          for (const ar of data.actorReplies) {
            // Skip the subject — already shown via data.reply above
            if (ar.speech && ar.actorId !== focusedCharId) {
              addMsg('actor', ar.speech, ar.actorId, ar.actorName);
            }
          }
        }
      }
      // refresh state
      fetchState(focusedCharId);
      setChatInput('');
      setSelectedAction('');
      setActiveCategory(null);
    } catch (e: any) {
      setError(e.message);
      addMsg('error', `Сеть: ${e.message}`);
    }
    setIsProcessing(false);
  };

  const handleChipClick = (chip: SuggestedChip) => {
    if (chip.type === 'wait') {
      sendWait();
      return;
    }
    if (chip.type === 'verbal' && chip.speech) {
      // Verbal: send speech as plain text (what calibrator says)
      setChatInput(chip.speech);
      setTimeout(() => sendAction(), 50);
      return;
    }
    if (chip.type === 'action') {
      if (chip.actionId) setSelectedAction(chip.actionId);
      if (chip.pointId) setSelectedPoint(chip.pointId);
      if (chip.description) {
        // Action with RP description: send as *description*
        setChatInput(`*${chip.description}*`);
      }
      setTimeout(() => sendAction(), 50);
      return;
    }
    // Default: just set the text
    setChatInput(chip.text);
  };

  const sendWait = async () => {
    if (!focusedCharId) return;
    setIsProcessing(true);
    try {
      addMsg('system', '[ждать]');
      const res = await fetch(`${API_BASE}/api/wait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: focusedCharId, ticks: 1, eventId: sceneId, callLLM: useLLM }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.narratorReaction?.reaction) addMsg('narrator', data.narratorReaction.reaction);
        if (data.reply?.speech) addMsg('actor', data.reply.speech, focusedCharId, subjectState?.name || focusedCharId);
        fetchState(focusedCharId);
      }
    } catch (e: any) { setError(e.message); }
    setIsProcessing(false);
  };

  // ─── Derived ──────────────────────────────────────────

  const pointActions = useMemo(() => filterActionsForPoint(availableActions, selectedPoint), [availableActions, selectedPoint]);

  const anatomyList = useMemo(() => {
    if (!subjectState?.anatomy) return [];
    return Object.entries(subjectState.anatomy)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => (b.localSensitivity || 0) - (a.localSensitivity || 0));
  }, [subjectState]);

  const activeContexts = useMemo(() => {
    const ctxs = subjectState?.contexts || [];
    // Deduplicate by actionId — one pose can occupy multiple points
    const seen = new Set<string>();
    return ctxs.filter(c => {
      if (seen.has(c.actionId)) return false;
      seen.add(c.actionId);
      return true;
    });
  }, [subjectState]);

  // Actions for the selected category, filtered by point
  const categoryActionList = useMemo(() => {
    if (!activeCategory) return [];
    const ids = CATEGORY_ACTIONS[activeCategory] || [];
    return pointActions.filter(a => ids.includes(a.id));
  }, [activeCategory, pointActions]);

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="game-app">
      {/* Left panel: scene image + body state */}
      <div className="panel panel-left">
        {sceneImageUrl && (
          <div className="panel-section scene-image-section">
            <img src={sceneImageUrl} alt="Сцена" style={{ width: '100%', borderRadius: '6px', display: 'block' }} />
          </div>
        )}
        {subjectState && (
          <div className="panel-section">
            <h3>{subjectState.name || focusedCharId}</h3>
            {coreMetrics.map(m => (
              (() => {
                const value = Number((subjectState as any)[m.key] || 0);
                const baseline = m.baselineKey ? Number((subjectState as any)[m.baselineKey] ?? value) : undefined;
                const relative = ['sensitivity', 'capacity', 'openness', 'plasticity'].includes(String(m.key))
                  ? interpretCoreMetric(m.key as InterpretableCoreMetric, value, baseline)
                  : null;
                return <div key={m.key} className="metric-row">
                  <span className="metric-label">{m.label}</span>
                  <Bar
                    value={value}
                    baseline={baseline}
                    color={m.color}
                    displayValue={relative ? `${relative.humanPercent}% · ${Math.round(value)}` : undefined}
                    title={relative ? formatRelativeValue(relative) : undefined}
                  />
                </div>;
              })()
            ))}
          </div>
        )}
        {subjectState && (() => {
          // Compact body+contexts visualization
          const TECHNICAL_POINTS = new Set(['global_pose','slot_room','slot_social','posture','mind_state','systemic']);
          const POINT_LABELS: Record<string, string> = {
            head: 'Голова', face: 'Лицо', lips: 'Губы', neck: 'Шея',
            shoulders: 'Плечи', chest: 'Грудь', nipples: 'Соски',
            belly: 'Живот', back: 'Спина', waist: 'Талия',
            arms: 'Руки', hands: 'Кисти', inner_thighs: 'Внутр. бёдра',
            legs: 'Ноги', feet: 'Ступни',
            buttocks: 'Ягодицы', anus: 'Анус',
            vulva: 'Вульва', vagina: 'Влагалище', clitoris: 'Клитор',
            penis: 'Член', testicles: 'Яички', prostate: 'Простата',
          };
          const ctxs = subjectState.contexts || [];
          const anatomy = subjectState.anatomy || {};
          const byPoint: Record<string, string[]> = {};
          for (const c of ctxs) {
            const pt = c.pointId || '';
            if (TECHNICAL_POINTS.has(pt)) {
              if (!byPoint['global']) byPoint['global'] = [];
              if (!byPoint['global'].includes(c.label)) byPoint['global'].push(c.label);
              continue;
            }
            if (!byPoint[pt]) byPoint[pt] = [];
            if (!byPoint[pt].includes(c.label)) byPoint[pt].push(c.label);
          }
          const anatomyEntries = Object.entries(anatomy)
            .filter(([id]) => !TECHNICAL_POINTS.has(id))
            .map(([id, data]: [string, any]) => ({
              id,
              label: POINT_LABELS[id] || id,
              ...data
            }))
            .sort((a: any, b: any) => (b.localSensitivity || 0) - (a.localSensitivity || 0));

          return (
            <div className="panel-section">
              <h3>Тело и состояния</h3>
              <div className="body-state-grid">
                {byPoint['global'] && byPoint['global'].length > 0 && (
                  <div className="body-zone active global-zone">
                    <span className="zone-name">состояние</span>
                    {byPoint['global'].map((label, i) => (
                      <span key={i} className="zone-ctx">{label}</span>
                    ))}
                  </div>
                )}
                {anatomyEntries.map((pt: any) => {
                  const ctxLabels = byPoint[pt.id] || [];
                  const hasCtx = ctxLabels.length > 0;
                  const sens = Math.round(pt.localSensitivity || 0);
                  const interpretedSensitivity = interpretPointSensitivity(pt.id, sens, pt.baselineLocalSensitivity);
                  const sensHigh = sens > 70;
                  return (
                    <div key={pt.id} className={`body-zone ${hasCtx ? 'active' : ''} ${sensHigh ? 'sensitive' : ''}`}>
                      <span className="zone-name">{pt.label}</span>
                      {sens > 0 && <span className="zone-sens" title={formatRelativeValue(interpretedSensitivity)}>
                        чувств. {interpretedSensitivity.humanPercent}% · индекс {sens}
                      </span>}
                      {ctxLabels.map((label, i) => (
                        <span key={i} className="zone-ctx">{label}</span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {lastResult && (
          <div className="panel-section">
            <h3>Последний тик</h3>
            {resultMetrics.map(m => (
              <div key={m.key} className="metric-row">
                <span className="metric-label">{m.label}</span>
                <Bar value={(lastResult as any)[m.key] || 0} max={120} color={m.color} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center: chat + actions */}
      <div className="panel panel-center">
        {/* Chat log — main focus */}
        <div className="panel-section flex-1 chat-section">
          <div className="chat-log" ref={logRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`msg msg-${msg.role}`}>
                {msg.role === 'narrator' && <span className="msg-text">*{msg.text}*</span>}
                {msg.role === 'actor' && <span className="msg-author">{msg.actorName}: </span>}
                {msg.role === 'actor' && <span className="msg-text">"{msg.text}"</span>}
                {msg.role === 'player' && <span className="msg-text">→ {msg.text}</span>}
                {msg.role === 'system' && <span className="msg-text">{msg.text}</span>}
                {msg.role === 'error' && <span className="msg-text">{msg.text}</span>}
              </div>
            ))}
            {!messages.length && <div className="muted">Нет сообщений</div>}
          </div>
        </div>

        {error && <div className="error-bar">{error}</div>}

        {/* Narrative state description */}
        {stateDescription && (
          <div className="state-description">
            <span className="state-label">Состояние: </span>
            {stateDescription}
          </div>
        )}

        {/* Action area */}
        <div className="action-area">
          {/* Suggested chips — LLM-generated contextual action hints */}
          {suggestedChips.length > 0 && (
            <div className="suggested-chips">
              {suggestedChips.map((chip, i) => (
                <button
                  key={i}
                  className={`chip chip-${chip.type}`}
                  onClick={() => handleChipClick(chip)}
                  disabled={isProcessing}
                >
                  {chip.text}
                </button>
              ))}
            </div>
          )}

          <div className="input-row">
            <input type="text" placeholder="Сказать что-то... или *описать действие*" value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isProcessing && chatInput.trim()) sendAction(); }}
              className="text-input" />
            <label className="checkbox-label">
              <input type="checkbox" checked={useLLM} onChange={e => setUseLLM(e.target.checked)} /> LLM
            </label>
            <button onClick={sendAction} disabled={isProcessing || !chatInput.trim()} className="btn btn-primary">
              {isProcessing ? '...' : 'Отправить'}
            </button>
            <button onClick={sendWait} disabled={isProcessing} className="btn">Ждать</button>
          </div>
        </div>
      </div>

      {/* Right: contracts only */}
      <div className="panel panel-right">
        {subjectState ? (
          <>
            {/* Active contract */}
            {contractProgress && (
              <div className="panel-section contract-panel">
                <h3>Контракт</h3>
                <div className="contract-title">{contractProgress.contractTitle}</div>
                <div className="contract-desc">{contractProgress.contractDescription}</div>
                <div className="contract-conditions">
                  {contractProgress.conditions.map((c, i) => (
                    <div key={i} className={`contract-cond-row ${c.met ? 'met' : 'unmet'}`}>
                      <span className="contract-cond-label">{c.label}</span>
                      <span className="contract-cond-val">
                        {typeof c.current === 'number' ? Math.round(c.current) : String(c.current)} {c.operator} {c.value}
                      </span>
                      <span className="contract-cond-status">{c.met ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
                {contractProgress.metAll && (
                  <button className="btn btn-contract-deliver" onClick={() => {
                    const activeContract = availableContracts.find(c => c.state === 'accepted');
                    if (activeContract) deliverContract(activeContract.id);
                  }}>
                    Сдать актив
                  </button>
                )}
              </div>
            )}

            {/* Available contracts (if no active) */}
            {!contractProgress && availableContracts.length > 0 && (
              <div className="panel-section">
                <h3>Контракты</h3>
                {availableContracts.map(c => (
                  <div key={c.id} className="contract-card">
                    <div className="contract-card-info">
                      <span className="contract-name">{c.title}</span>
                      <span className="contract-desc">{c.description}</span>
                      <div className="contract-conds-mini">
                        {c.conditions.map((cond: any, i: number) => (
                          <span key={i} className="contract-cond-mini">
                            {cond.type === 'attitude' ? 'Покорность' : cond.key || cond.type} {cond.operator} {cond.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    {focusedCharId && (
                      <button className="btn btn-small" onClick={() => acceptContract(c.id)}>Принять</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="muted panel-section">Загрузка...</div>
        )}
      </div>
    </div>
  );
}
