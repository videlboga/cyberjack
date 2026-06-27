import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    familiarity?: number;
    exposureCount?: number;
  }>;
  contexts?: { actionId: string; label: string; type: string }[];
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
  control:  ['pose_kneeling', 'verbal_pressure', 'stare', 'close_inspection'],
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

const Bar: React.FC<{ value: number; max?: number; color?: string; baseline?: number }> = ({ value, max = 100, color = '#4caf50', baseline }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-container">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      {baseline !== undefined && baseline > 0 && (
        <div className="bar-baseline" style={{ left: `${(baseline / max) * 100}%` }} />
      )}
      <span className="bar-value">{Math.round(value)}</span>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────

export function GameApp() {
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

  const logRef = useRef<HTMLDivElement>(null);

  // ─── Data fetching ────────────────────────────────────

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
      {/* Left panel: characters + scene */}
      <div className="panel panel-left">
        <div className="panel-section">
          <h3>Персонажи</h3>
          {sceneChars.map(entry => {
            const isFocused = entry.character.id === focusedCharId;
            return (
              <div
                key={entry.character.id}
                className={`char-row ${isFocused ? 'focused' : ''}`}
                onClick={() => setFocusedCharId(entry.character.id)}
              >
                <span className="char-name">{entry.character.name}</span>
                <span className="char-role">{entry.role || ''}</span>
              </div>
            );
          })}
          {!sceneChars.length && <div className="muted">Нет персонажей</div>}
        </div>

        <div className="panel-section">
          <h3>Сцена</h3>
          <select value={sceneId} onChange={e => { setSceneId(e.target.value); setFocusedCharId(null); }} className="select">
            {allScenes.map(s => <option key={s.id} value={s.id}>{s.title || s.id}</option>)}
            {!allScenes.find(s => s.id === sceneId) && <option value={sceneId}>{sceneId}</option>}
          </select>
        </div>
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

        {/* Action area */}
        <div className="action-area">
          {/* Quick action category buttons */}
          <div className="quick-categories">
            {ACTION_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`qbtn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Actions in selected category */}
          {activeCategory && categoryActionList.length > 0 && (
            <div className="quick-actions">
              {categoryActionList.map(a => (
                <button
                  key={a.id}
                  className={`qbtn-small ${selectedAction === a.id ? 'active' : ''}`}
                  onClick={() => setSelectedAction(selectedAction === a.id ? '' : a.id)}
                >
                  {a.label}
                </button>
              ))}
              {categoryActionList.length === 0 && <span className="muted small">Нет действий для этой точки</span>}
            </div>
          )}

          {/* Point selector + text input */}
          <div className="action-row">
            <select value={selectedPoint} onChange={e => setSelectedPoint(e.target.value)} className="select">
              <option value="systemic">— точка воздействия —</option>
              {availablePoints.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          <div className="input-row">
            <input type="text" placeholder="Сказать что-то..." value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isProcessing && (selectedAction || chatInput.trim())) sendAction(); }}
              className="text-input" />
            <label className="checkbox-label">
              <input type="checkbox" checked={useLLM} onChange={e => setUseLLM(e.target.checked)} /> LLM
            </label>
            <button onClick={sendAction} disabled={isProcessing || (!selectedAction && !chatInput.trim())} className="btn btn-primary">
              {isProcessing ? '...' : 'Выполнить'}
            </button>
            <button onClick={sendWait} disabled={isProcessing} className="btn">Ждать</button>
          </div>
        </div>
      </div>

      {/* Right: state + anatomy */}
      <div className="panel panel-right">
        {subjectState ? (
          <>
            <div className="panel-section">
              <h3>{subjectState.name || focusedCharId}</h3>
              {CORE_METRICS.map(m => (
                <div key={m.key} className="metric-row">
                  <span className="metric-label">{m.label}</span>
                  <Bar
                    value={(subjectState as any)[m.key] || 0}
                    baseline={m.baselineKey ? (subjectState as any)[m.baselineKey] : undefined}
                    color={m.color}
                  />
                </div>
              ))}
            </div>

            {activeContexts.length > 0 && (
              <div className="panel-section">
                <h3>Контексты</h3>
                {activeContexts.map(c => (
                  <div key={c.actionId} className="context-tag">{c.label}</div>
                ))}
              </div>
            )}

            <div className="panel-section">
              <h3>Анатомия</h3>
              <div className="anatomy-list">
                {anatomyList.map(pt => (
                  <div
                    key={pt.id}
                    className={`anatomy-row ${selectedPoint === pt.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPoint(pt.id)}
                  >
                    <span className="anatomy-name">{pt.id}</span>
                    <span className="anatomy-sens">S:{Math.round(pt.localSensitivity)}</span>
                    <span className="anatomy-att">A:{Math.round(pt.localAttitude)}</span>
                  </div>
                ))}
              </div>
            </div>

            {lastResult && (
              <div className="panel-section">
                <h3>Последний тик</h3>
                {RESULT_METRICS.map(m => (
                  <div key={m.key} className="metric-row">
                    <span className="metric-label">{m.label}</span>
                    <Bar value={(lastResult as any)[m.key] || 0} max={120} color={m.color} />
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