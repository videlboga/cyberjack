import React, { useEffect, useMemo, useState } from 'react';
import { ConfigEditor } from './ConfigEditor';

type ChatEntry = {
  role: 'player' | 'subject' | 'system';
  text: string;
  label?: string;
  actorId?: string;
  kind?: string;
  tone?: string;
};

type QueuedAction = {
  id: string;
  actionId: string;
  label: string;
  targetId: string;
  targetName: string;
  intensity: number;
  duration?: number;
  textMessage?: string;
  occupiesPoints?: string[];
};

type RelationEntry = {
  toId: string;
  knows: boolean;
  present: boolean;
  canInteract: boolean;
  attitude: number;
  target?: {
    id: string;
    name: string;
    kind: string;
  };
};

type CharacterInfo = {
  id: string;
  name: string;
  kind: string;
  currentSceneId?: string | null;
};

const API_BASE = '';

const CORE_FIELDS = [
  { key: 'sensitivity', label: 'Sensitivity (Чувствительность)' },
  { key: 'attitude', label: 'Attitude (Отношение)' },
  { key: 'capacity', label: 'Capacity (Ресурс)' },
  { key: 'openness', label: 'Openness (Открытость)' },
  { key: 'plasticity', label: 'Plasticity (Пластичность)' }
] as const;

export function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'prompts'>('console');
  const [subject, setSubject] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [points, setPoints] = useState<any[]>([]);
  const [pointId, setPointId] = useState('hands');
  const [actions, setActions] = useState<any[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [intensity, setIntensity] = useState(1);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [actionQueue, setActionQueue] = useState<QueuedAction[]>([]);
  const [actionDuration, setActionDuration] = useState<number>(0);

  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [engineResult, setEngineResult] = useState<any>(null);
  const [physicalReaction, setPhysicalReaction] = useState('');
  const [promptLog, setPromptLog] = useState<any[]>([]);
  const [actionTrace, setActionTrace] = useState<any[]>([]);
  const [tabState, setTabState] = useState<'prompt' | 'trace'>('prompt');
  const [contexts, setContexts] = useState<any[]>([]);
  const [activeContexts, setActiveContexts] = useState<string[]>([]);
  const [relations, setRelations] = useState<RelationEntry[]>([]);
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  const [perspectiveId, setPerspectiveId] = useState<string>('');
  const [relationDrafts, setRelationDrafts] = useState<Record<string, RelationEntry>>({});
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [savingRelation, setSavingRelation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scene, setScene] = useState<any>(null);
  const [scenesList, setScenesList] = useState<any[]>([]);
  const [moveCharacterId, setMoveCharacterId] = useState<string>('');
  const [moveSceneId, setMoveSceneId] = useState<string>('');
  const [movingCharacter, setMovingCharacter] = useState(false);
  const [playerDraft, setPlayerDraft] = useState<Record<string, number>>({});
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [coreDraft, setCoreDraft] = useState({
    sensitivity: 0,
    attitude: 0,
    capacity: 0,
    openness: 0,
    plasticity: 0
  });
  const [savingCore, setSavingCore] = useState(false);
  const [classifierLog, setClassifierLog] = useState<any>(null);
  const [newResourceKey, setNewResourceKey] = useState('');
  const [newResourceValue, setNewResourceValue] = useState('0');
  const [errorMessage, setErrorMessage] = useState('');

  const [actionTargetId, setActionTargetId] = useState<string>('S-01');

  const subjectId = actionTargetId || subject?.id || 'S-01';
  const sceneId = scene?.id || 'lab';

  useEffect(() => {
    fetchState(pointId);
  }, [actionTargetId, pointId]);

useEffect(() => {
  fetchContexts();
}, []);

useEffect(() => {
  fetchScenesList();
}, []);

  useEffect(() => {
    if (!relations.length) {
      setRelationDrafts({});
      setSelectedRelationId(null);
      return;
    }
    const map: Record<string, RelationEntry> = {};
    relations.forEach((rel) => {
      map[rel.toId] = { ...rel };
    });
    setRelationDrafts(map);
    if (!selectedRelationId || !map[selectedRelationId]) {
      setSelectedRelationId(relations[0].toId);
    }
  }, [relations, selectedRelationId]);

  useEffect(() => {
    if (subject) {
      setCoreDraft({
        sensitivity: Number(subject.sensitivity ?? 0),
        attitude: Number(subject.attitude ?? 0),
        capacity: Number(subject.capacity ?? 0),
        openness: Number(subject.openness ?? 0),
        plasticity: Number(subject.plasticity ?? 0)
      });
    }
  }, [subject]);

useEffect(() => {
  if (player?.resources) {
    setPlayerDraft(player.resources);
  }
}, [player]);

useEffect(() => {
  if (!moveCharacterId && characters.length) {
    setMoveCharacterId(characters[0].id);
  }
}, [characters, moveCharacterId]);

useEffect(() => {
  if (!moveSceneId && scenesList.length) {
    setMoveSceneId(scenesList[0].id);
  }
}, [scenesList, moveSceneId]);

  const groupedContexts = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const ctx of contexts) {
      const key = ctx.slot || ctx.type || 'misc';
      if (!groups[key]) groups[key] = [];
      groups[key].push(ctx);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contexts]);

  const formatCosts = (costs?: Record<string, number> | null) => {
    if (!costs || !Object.keys(costs).length) return '';
    return Object.entries(costs)
      .map(([resource, value]) => `${resource}-${value}`)
      .join(', ');
  };

  const selectedActionInfo = actions.find((a) => a.id === selectedAction);
  const selectedActionCosts = selectedActionInfo?.costs || null;

  const perspectiveCharacter = useMemo(() => {
    if (!perspectiveId) return null;
    return characters.find((c) => c.id === perspectiveId) || null;
  }, [characters, perspectiveId]);

  const locationMap = useMemo(() => {
    const map: Record<string, string | null | undefined> = {};
    characters.forEach((ch) => {
      map[ch.id] = ch.currentSceneId ?? null;
    });
    return map;
  }, [characters]);

  const isNear = (targetId?: string | null) => {
    if (!targetId) return false;
    const base = perspectiveCharacter ? locationMap[perspectiveCharacter.id] : null;
    if (!base) return false;
    return (locationMap[targetId] ?? null) === base;
  };

  const selectedRelation = selectedRelationId ? relationDrafts[selectedRelationId] : null;

  const formatNumber = (value: any, digits = 1) => {
    if (value === undefined || value === null || value === '') return '—';
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return num.toFixed(digits);
  };

  const fetchRelations = async (fromId: string) => {
    if (!fromId) return;
    try {
      const res = await fetch(`${API_BASE}/api/relations?fromId=${fromId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Не удалось получить связи');
      setRelations(data.relations || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ошибка загрузки связей');
    }
  };

  const perspectiveOptions = useMemo(() => {
    if (characters.length) return characters;
    if (subject) return [{ id: subject.id, name: subject.name, kind: 'subject' }];
    return [];
  }, [characters, subject]);

  const handlePerspectiveChange = (id: string) => {
    setPerspectiveId(id);
    setSelectedRelationId(null);
    fetchRelations(id);
  };

  const updateRelationDraft = (field: keyof RelationEntry, value: boolean | number) => {
    if (!selectedRelationId) return;
    setRelationDrafts((prev) => ({
      ...prev,
      [selectedRelationId]: {
        ...prev[selectedRelationId],
        [field]: value
      }
    }));
  };

  const saveSelectedRelation = async () => {
    if (!selectedRelation) return;
    setSavingRelation(true);
    setErrorMessage('');
    try {
      const ownerId = perspectiveId || subject?.id || 'S-01';
      const res = await fetch(`${API_BASE}/api/relations/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: ownerId,
          toId: selectedRelation.toId,
          knows: selectedRelation.knows,
          present: selectedRelation.present,
          canInteract: selectedRelation.canInteract,
          attitude: selectedRelation.attitude
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось обновить связь');
      }
      await fetchRelations(ownerId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка обновления связи');
    } finally {
      setSavingRelation(false);
    }
  };

  const moveCharacter = async () => {
    if (!moveCharacterId || !moveSceneId) return;
    setMovingCharacter(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/scene/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: moveCharacterId,
          sceneId: moveSceneId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось переместить персонажа');
      }
      await fetchScenesList();
      await fetchState(pointId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка перемещения персонажа');
    } finally {
      setMovingCharacter(false);
    }
  };

  async function fetchState(targetPointId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/state?subjectId=${subjectId}&pointId=${targetPointId}`);
      const data = await res.json();
      if (!data.success) throw new Error('Не удалось получить состояние');

      setSubject(data.subject);
      setPoints(data.availablePoints || []);
      setActions(data.availableActions || []);
      setScene(data.scene);
      setPlayer(data.player);
      setCharacters(data.characters || []);
      if (data.scene?.id) {
        setMoveSceneId((prev) => prev || data.scene.id);
      }

      const currentPerspective = perspectiveId || data.subject?.id || 'S-01';
      if (!perspectiveId) {
        setPerspectiveId(currentPerspective);
      }
      await fetchRelations(currentPerspective);

      const availablePointIds = (data.availablePoints || []).map((p: any) => p.id);
      if (availablePointIds.length && !availablePointIds.includes(targetPointId)) {
        setPointId(availablePointIds[0]);
      }

      if (!selectedAction && data.availableActions?.length) {
        setSelectedAction(data.availableActions[0].id);
      } else if (selectedAction && !data.availableActions?.some((a: any) => a.id === selectedAction)) {
        setSelectedAction(data.availableActions[0]?.id || '');
      }
      setErrorMessage('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ошибка загрузки состояния');
    }
  }

  async function fetchContexts() {
    try {
      const res = await fetch(`${API_BASE}/api/contexts`);
      const data = await res.json();
      if (!data.success) throw new Error('Не удалось загрузить контексты');
      setContexts(data.allPresets || []);
      setActiveContexts((data.activeIds || []).map((item: any) => item.id || item.context_id || item));
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchScenesList() {
    try {
      const res = await fetch(`${API_BASE}/api/scenes`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Не удалось получить сцены');
      setScenesList(data.scenes || []);
    } catch (err) {
      console.error(err);
    }
  }

  const handleCoreValueChange = (field: keyof typeof coreDraft, value: number) => {
    setCoreDraft((prev) => ({ ...prev, [field]: value }));
  };

  async function saveCoreState() {
    if (!subject) return;
    setSavingCore(true);
    try {
      const res = await fetch(`${API_BASE}/api/subject/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          ...coreDraft
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Не удалось сохранить параметры');
      setSubject(data.state);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCore(false);
    }
  }

  const handlePlayerDraftChange = (key: string, value: number) => {
    setPlayerDraft((prev) => ({ ...prev, [key]: value }));
  };

  async function savePlayerResources() {
    setSavingPlayer(true);
    try {
      const res = await fetch(`${API_BASE}/api/player/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player?.id || 'PL-1',
          resources: playerDraft
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Не удалось обновить ресурсы');
      setPlayer(data.player);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPlayer(false);
    }
  }

  const addNewResourceField = () => {
    if (!newResourceKey.trim()) return;
    setPlayerDraft((prev) => ({
      ...prev,
      [newResourceKey.trim()]: Number(newResourceValue) || 0
    }));
    setNewResourceKey('');
    setNewResourceValue('0');
  };

    function addToQueue(options?: { presetId?: string; textMessage?: string; labelOverride?: string; intensityOverride?: number; }) {
    const actionId = options?.presetId || selectedAction;
    if (!actionId) return;

    const actionPreset = actions.find((a) => a.id === actionId);
    const label = options?.labelOverride || actionPreset?.label || actionId;
    const textMessage = options?.textMessage;
    const targetName = characters.find(c => c.id === actionTargetId)?.name || actionTargetId;

    const newAction: QueuedAction = {
      id: Math.random().toString(36).substring(7),
      actionId,
      label,
      targetId: actionTargetId,
      targetName,
      intensity: options?.intensityOverride ?? intensity,
      duration: actionDuration,
      textMessage,
      occupiesPoints: actionPreset?.occupiesPoints || []
    };

    if (newAction.occupiesPoints && newAction.occupiesPoints.length > 0) {
      for (const q of actionQueue) {
        if (q.occupiesPoints && q.occupiesPoints.some(pt => newAction.occupiesPoints!.includes(pt))) {
          setErrorMessage(`Слот перекрывается с "${q.label}"`);
          return;
        }
      }
    }

    setActionQueue(prev => [...prev, newAction]);
    if (textMessage) setChatInput('');
    setErrorMessage('');
  }

  const removeFromQueue = (id: string) => {
    setActionQueue(q => q.filter(x => x.id !== id));
  };

  async function executeQueue() {
    if (!actionQueue.length) return;
    setLoading(true);
    setErrorMessage('');

    const chatAdditions: ChatEntry[] = actionQueue.map(q => {
      if (q.textMessage) return { role: 'player', text: q.textMessage };
      return { role: 'player', text: `[На: ${q.targetName}] ${q.label}${q.duration ? ` (${q.duration}т)` : ''}` };
    });
    setChat(prev => [...prev, ...chatAdditions]);

    try {
      let finalData: any = null;
      for (let i = 0; i < actionQueue.length; i++) {
        const item = actionQueue[i];
        const isLast = i === actionQueue.length - 1;

        const res = await fetch(`${API_BASE}/api/tick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId: item.targetId,
            pointId,
            sceneId,
            presetId: item.actionId,
            intensity: item.intensity,
            textMessage: item.textMessage,
            skipLLM: !isLast,
            skipTimeTick: !isLast,
            dynamicModifiers: {
                contextConfig: (item.duration || 0) > 0 ? { duration: item.duration || -1 } : undefined
            }
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Tick failed');
        finalData = data;
      }

      if (finalData) {
        setSubject(finalData.state);
        setPlayer(finalData.player);
        setDiagnostics(finalData.diagnostics);
        setEngineResult(finalData.tickResult);
        setClassifierLog(finalData.classifierLog);

        if (finalData.narratorReaction || finalData.reply?.reaction) {
          setPhysicalReaction(finalData.narratorReaction || finalData.reply?.reaction || '');
        }

        const actorReplies: Array<{ actorId: string; kind: string; tone?: string; speech: string }> = finalData.actorReplies || [];
        if (actorReplies.length) {
          const subjectName = finalData.state?.name || finalData.state?.subject?.name || 'Субъект';
          setChat((prev) => [
            ...prev,
            ...actorReplies.map((reply: any) => {
              return {
                role: 'subject' as const,
                text: reply.speech || '(молчит)',
                actorId: reply.actorId,
                kind: reply.kind,
                tone: reply.tone,
                label: reply.actorId === finalData.state?.subject?.id ? subjectName : reply.actorId
              };
            })
          ]);
        } else if (finalData.reply) {
          if (finalData.reply.speech !== undefined || finalData.reply.reaction !== undefined) {
            setChat((prev) => [
              ...prev,
              { role: 'subject', text: finalData.reply.speech || '(молчит)' }
            ]);
          }
        }
        if (finalData.promptMessages) setPromptLog(finalData.promptMessages);
        if (finalData.actionTrace) setActionTrace(finalData.actionTrace);
      }
      
      await fetchState(pointId);
      await fetchContexts();
      setActionQueue([]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ошибка выполнения действия');
    } finally {
      setLoading(false);
      setChatInput('');
    }
  }

  async function handleWait(ticks: number, callLLM = false) {
    setChat((prev) => [
      ...prev,
      { role: 'system', text: `⏳ Прокрутка времени: +${ticks} тик(ов) (${callLLM ? 'с ответом' : 'без ответа'})` }
    ]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          ticks,
          eventId: sceneId,
          callLLM
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Не удалось прокрутить время');
      setSubject(data.state);
      setPlayer(data.player);
      setEngineResult(data.tickResult);
      setDiagnostics(data.diagnostics || data.bundle?.diagnostics || null);
      if (data.reply) {
        setPhysicalReaction(data.reply.reaction || '');
        if (data.reply.speech) {
          setChat((prev) => [...prev, { role: 'subject', text: data.reply.speech }]);
        } else {
          setChat((prev) => [...prev, { role: 'subject', text: '(молчит)' }]);
        }
      }
      if (data.promptMessages) setPromptLog(data.promptMessages);
      if (data.actionTrace) setActionTrace(data.actionTrace);
      await fetchState(pointId);
      await fetchContexts();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ошибка ожидания');
    } finally {
      setLoading(false);
    }
  }

  async function toggleContext(contextId: string, enable: boolean, label: string) {
    try {
      const res = await fetch(`${API_BASE}/api/contexts/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextId,
          isActive: enable,
          subjectId,
          eventId: sceneId
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error('Контекст не изменён');
      await fetchContexts();
      if (Array.isArray(data.narratives) && data.narratives.length) {
        const narrativeText = data.narratives.join('\n');
        setChat((prev) => [...prev, { role: 'system', text: narrativeText }]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    addToQueue({
      presetId: 'verbal_pressure',
      textMessage: chatInput.trim()
    });
  };

  const renderBadges = () => {
    if (!subject) return null;
    const badges: string[] = [];
    const c = Number(subject.capacity || 0);
    const o = Number(subject.openness || 0);
    const s = Number(subject.sensitivity || 0);
    const a = Number(subject.attitude || 0);
    const p = Number(subject.plasticity || 0);

    if (c < 10) badges.push('Апатия');
    if (c <= 25 && o > 80) badges.push('Сабспейс');
    if (c <= 25 && o < 30 && a < 20) badges.push('Паника');
    if (c <= 25 && s > 80) badges.push('Перегрузка (сенс)');
    if (p > 80 && c <= 40) badges.push('Внушаемость');
    if (p < 30 && c <= 30) badges.push('Оцепенение');
    if (s > 80 && c > 50) badges.push('Гиперестезия');
    if (a < 0 && c > 50) badges.push('Активное сопротивление');

    if (!badges.length) {
      return <span className="badge muted">Стабильно</span>;
    }
    return badges.map((badge) => (
      <span key={badge} className="badge">
        {badge}
      </span>
    ));
  };

  if (!subject) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="logo">Cyberjack Control</div>
        </header>
        <div className="loading-state">Загрузка состояния... (запустите npx tsx src/api/server.ts)</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo">Cyberjack · Simulation Console</div>
        <div className="view-tabs">
          <button className={activeTab === 'console' ? 'active' : ''} onClick={() => setActiveTab('console')}>
            Консоль симуляции
          </button>
          <button className={activeTab === 'prompts' ? 'active' : ''} onClick={() => setActiveTab('prompts')}>
            Конфигуратор промптов
          </button>
        </div>
        <div className="header-status">
          <span>Сцена: {scene?.id || 'lab'}</span>
          <span>Точка: {pointId}</span>
          {loading && <span className="spinner">⟳</span>}
        </div>
      </header>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      {activeTab === 'prompts' ? (
        <div className="config-tab">
          <ConfigEditor />
        </div>
      ) : (
        <div className="dashboard">
          <div className="column">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3>{subject.name}</h3>
                  <span className="subtitle">ID: {subject.id}</span>
                </div>
                <div className="badge-row">{renderBadges()}</div>
              </div>
              <div className="core-grid">
                {CORE_FIELDS.map((field) => {
                  const baselineKey = `baseline_${field.key}` as keyof typeof subject;
                  const baselineValue = (subject as any)?.[baselineKey];
                  return (
                    <label key={field.key} className="core-field">
                      <div className="core-field-label">
                        <span>{field.label}</span>
                        <small className="norm-hint">Норма: {formatNumber(baselineValue)}</small>
                      </div>
                      <input
                        type="number"
                        value={coreDraft[field.key]}
                        onChange={(e) => handleCoreValueChange(field.key, Number(e.target.value))}
                      />
                    </label>
                  );
                })}
              </div>
              <div className="panel-footer">
                <button onClick={saveCoreState} disabled={savingCore}>
                  {savingCore ? 'Сохранение...' : 'Сохранить параметры'}
                </button>
                <div className="point-selector">
                  <label>Точка воздействия</label>
                  <select value={pointId} onChange={(e) => setPointId(e.target.value)}>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="point-stats">
                  <div>
                    <span>Local Sensitivity: {formatNumber(subject.point?.local_sensitivity)}</span>
                    <small className="norm-hint inline">Норма: {formatNumber(subject.point?.baseline_local_sensitivity)}</small>
                  </div>
                  <div>
                    <span>Local Attitude: {formatNumber(subject.point?.local_attitude)}</span>
                    <small className="norm-hint inline">Норма: {formatNumber(subject.point?.baseline_local_attitude)}</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel relations-panel">
              <div className="panel-header">
                <div>
                  <h3>Персонажи и отношения</h3>
                  {perspectiveCharacter ? (
                    <span className="subtitle">Перспектива: {perspectiveCharacter.name}</span>
                  ) : (
                    <span className="subtitle">Перспектива: {subject?.name || subjectId}</span>
                  )}
                </div>
              </div>
              <div className="perspective-controls">
                <span className="perspective-label">Перспективы</span>
                <div className="perspective-list">
                  {perspectiveOptions.map((ch) => (
                    <button
                      key={ch.id}
                      className={`perspective-pill ${ch.id === (perspectiveId || subject?.id) ? 'active' : ''}`}
                      onClick={() => handlePerspectiveChange(ch.id)}
                    >
                      <span>{ch.name}</span>
                      <small>{ch.kind === 'player' ? 'Калибратор' : ch.kind === 'npc' ? 'NPC' : 'Субъект'}</small>
                    </button>
                  ))}
                </div>
              </div>
              {relations.length ? (
                <div className="relations-body">
                  <div className="relations-list">
                    {relations.map((rel) => {
                      const active = rel.toId === selectedRelationId;
                      return (
                        <button
                          key={rel.toId}
                          className={`relation-pill ${active ? 'active' : ''}`}
                          onClick={() => setSelectedRelationId(rel.toId)}
                        >
                          <div className="relation-name">
                            {rel.target?.name || rel.toId}
                            <span className="relation-kind">
                              {rel.target?.kind === 'player'
                                ? 'Калибратор'
                                : rel.target?.kind === 'npc'
                                ? 'NPC'
                                : 'Субъект'}
                            </span>
                          </div>
                          <div className="relation-pill-status">
                            <span className={`relation-flag ${rel.knows ? 'on' : 'off'}`}>знает</span>
                            <span className={`relation-flag ${isNear(rel.toId) ? 'on' : 'off'}`}>рядом</span>
                            <span className={`relation-flag ${rel.canInteract ? 'on' : 'off'}`}>может</span>
                          </div>
                          <div className="relation-pill-attitude">{rel.attitude.toFixed(0)}</div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedRelation ? (
                    <div className="relation-detail">
                      <div className="relation-detail-header">
                        <h4>{selectedRelation.target?.name || selectedRelation.toId}</h4>
                        <span className="relation-kind">
                          {selectedRelation.target?.kind === 'player'
                            ? 'Калибратор'
                            : selectedRelation.target?.kind === 'npc'
                            ? 'NPC'
                            : 'Субъект'}
                        </span>
                      </div>
                      <div className="relation-flags">
                        <label>
                          <input
                            type="checkbox"
                            checked={!!selectedRelation.knows}
                            onChange={(e) => updateRelationDraft('knows', e.target.checked)}
                          />
                          Знает
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!selectedRelation.canInteract}
                            onChange={(e) => updateRelationDraft('canInteract', e.target.checked)}
                          />
                          Может взаимодействовать
                        </label>
                        <div className={`relation-near-flag ${isNear(selectedRelation.toId) ? 'on' : 'off'}`}>
                          Рядом
                        </div>
                      </div>
                      <div className="relation-attitude-editor">
                        <span>Отношение</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={selectedRelation.attitude}
                          onChange={(e) => updateRelationDraft('attitude', Number(e.target.value))}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={selectedRelation.attitude}
                          onChange={(e) => updateRelationDraft('attitude', Number(e.target.value) || 0)}
                        />
                      </div>
                      <button onClick={saveSelectedRelation} disabled={savingRelation}>
                        {savingRelation ? 'Сохранение...' : 'Сохранить связь'}
                      </button>
                    </div>
                  ) : (
                    <div className="relation-detail empty">Выберите персонажа из списка</div>
                  )}
                </div>
              ) : (
                <span className="subtitle">Нет других персонажей</span>
              )}
            </div>

            <div className="panel locations-panel">
              <div className="panel-header">
                <div>
                  <h3>Локации</h3>
                  <span className="subtitle">Распределение персонажей</span>
                </div>
                <button onClick={fetchScenesList}>Обновить</button>
              </div>
              <div className="move-controls">
                <div>
                  <label>Персонаж</label>
                  <select value={moveCharacterId} onChange={(e) => setMoveCharacterId(e.target.value)}>
                    {characters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Локация</label>
                  <select value={moveSceneId} onChange={(e) => setMoveSceneId(e.target.value)}>
                    {scenesList.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.id}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={moveCharacter} disabled={movingCharacter || !moveCharacterId || !moveSceneId}>
                  {movingCharacter ? 'Перемещение...' : 'Переместить'}
                </button>
              </div>
              <div className="scenes-grid">
                {scenesList.map((sc) => (
                  <div key={sc.id} className={`scene-card ${scene?.id === sc.id ? 'active' : ''}`}>
                    <div className="scene-title">{sc.id}</div>
                    <div className="scene-characters">
                      {sc.characters && sc.characters.length ? (
                        sc.characters.map((entry: any) => (
                          <div key={entry.character.id} className="scene-character-row">
                            <div>
                              {entry.character.name}
                              <span className="scene-character-role">
                                {entry.role || entry.character.kind}
                              </span>
                            </div>
                            <span className={`scene-character-flag ${entry.presenceState}`}>
                              {entry.presenceState}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="subtitle">Нет персонажей</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3>Ресурсы игрока</h3>
                  <span className="subtitle">{player?.id || 'PL-1'}</span>
                </div>
                <button onClick={savePlayerResources} disabled={savingPlayer}>
                  {savingPlayer ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
              <div className="resource-grid">
                {Object.entries(player?.resources || {}).map(([key, value]) => (
                  <div key={key} className="resource-card">
                    <strong>{key}</strong>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
              <div className="resource-editors">
                {Object.entries(playerDraft).map(([key, value]) => (
                  <label key={key}>
                    <span>{key}</span>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => handlePlayerDraftChange(key, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
              <div className="resource-add">
                <input
                  type="text"
                  placeholder="Новый ресурс"
                  value={newResourceKey}
                  onChange={(e) => setNewResourceKey(e.target.value)}
                />
                <input
                  type="number"
                  value={newResourceValue}
                  onChange={(e) => setNewResourceValue(e.target.value)}
                />
                <button onClick={addNewResourceField}>Добавить</button>
              </div>
            </div>

            <div className="panel contexts-panel">
              <div className="panel-header">
                <h3>Активные контексты</h3>
                <div className="wait-controls">
                  <button onClick={() => handleWait(1, false)}>+1 тик</button>
                  <button onClick={() => handleWait(5, false)}>+5 тиков</button>
                  <button onClick={() => handleWait(5, true)}>+5 и ответ</button>
                </div>
              </div>
              <div className="contexts-scroll">
                {groupedContexts.map(([slot, items]) => (
                  <div key={slot} className="context-group">
                    <div className="context-slot">{slot}</div>
                    <div className="context-grid">
                      {items.map((ctx: any) => {
                        const isActive = activeContexts.includes(ctx.id);
                        return (
                          <label key={ctx.id} className={`context-switch ${isActive ? 'active' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={(e) => toggleContext(ctx.id, e.target.checked, ctx.label)}
                            />
                            <span className="switch-thumb" />
                            <span className="context-label">{ctx.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>Сценарий / переходы</h3>
              {scene?.transitions?.length ? (
                <div className="transitions">
                  {scene.transitions.map((transition: any, idx: number) => (
                    <div key={`${transition.targetSceneId}-${idx}`} className="transition-card">
                      <strong>{transition.targetSceneId}</strong>
                      {transition.conditions ? (
                        <span className="subtitle">
                          {transition.conditions.requiresActionId && `действие: ${transition.conditions.requiresActionId} `}
                          {transition.conditions.minAttitude !== undefined &&
                            `att >= ${transition.conditions.minAttitude} `}
                          {transition.conditions.maxAttitude !== undefined &&
                            `att <= ${transition.conditions.maxAttitude}`}
                        </span>
                      ) : (
                        <span className="subtitle">без условий</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="subtitle">Переходы не заданы</span>
              )}
            </div>
          </div>

          <div className="column">
            <div className="panel">
              <div className="panel-header">
                <h3>Консоль действий</h3>
                <div className="intensity">
                  <label>Сила {intensity.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={intensity}
                    onChange={(e) => setIntensity(parseFloat(e.target.value))}
                  />
                </div>
              </div>
              <div className="action-controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <span style={{ color: '#aaa', alignSelf: 'center' }}>Цель:</span>
                  <select value={actionTargetId} onChange={(e) => setActionTargetId(e.target.value)} style={{ flex: 1 }}>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} style={{ flex: 1 }}>
                    {actions.map((action) => {
                      const costsLabel = formatCosts(action.costs);
                      return (
                        <option key={action.id} value={action.id}>
                          {action.label}
                          {costsLabel ? ` · ${costsLabel}` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <button onClick={() => addToQueue()} disabled={!selectedAction}>
                    + В очередь
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ color: '#aaa' }}>Длительность (0 = мгновенно):</span>
                  <input type="number" min="0" value={actionDuration} onChange={(e) => setActionDuration(parseInt(e.target.value) || 0)} style={{ width: '60px' }} />
                </div>
                {actionQueue.length > 0 && (
                <div className="action-queue" style={{ marginTop: '12px', background: '#1c1c1c', padding: '8px', borderRadius: '4px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#888' }}>В очереди ({actionQueue.length}):</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {actionQueue.map(q => (
                      <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#2c2c2c', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        <span>
                            {q.textMessage ? `🗣 ${q.textMessage}` : `⚡ [${q.targetName}] ${q.label} (Сила: ${q.intensity.toFixed(1)})`}
                            {q.duration ? ` • ${q.duration} т.` : ''}
                        </span>
                        <button style={{ padding: '0 4px', fontSize: '12px' }} onClick={() => removeFromQueue(q.id)}>X</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={executeQueue} disabled={loading} style={{ marginTop: '8px', width: '100%', background: '#2e7d32', color: 'white', padding: '8px', borderRadius: '4px', fontWeight: 'bold' }}>
                    ▶ Выполнить всё
                  </button>
                </div>
                )}
              </div>
              <div className="action-costs">
                <span>Стоимость:</span>
                {selectedActionCosts ? (
                  Object.entries(selectedActionCosts).map(([resKey, value]) => (
                    <span key={resKey} className="chip">
                      {resKey}: -{String(value)}
                    </span>
                  ))
                ) : (
                  <span className="chip muted">Бесплатно</span>
                )}
              </div>
            </div>

            <div className="panel chat-panel">
              <div className="panel-header">
                <h3>Диалог с субъектом</h3>
              </div>
              <div className="chat-log">
                {chat.map((entry, idx) => (
                  <div key={idx} className={`chat-message ${entry.role}`}>
                    <strong>{entry.role === 'player' ? 'Вы' : (entry.role === 'subject' ? (entry.label || subject?.name || 'NPC') : 'Система')}:</strong>{' '}
                    <span>{entry.text || '(молчание)'}</span>
                  </div>
                ))}
                {loading && <div className="chat-message system">S-01 обрабатывает...</div>}
              </div>
              <div className="chat-input">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Введите реплику (добавит в очередь)..."
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                />
                <button onClick={sendChatMessage} disabled={!chatInput.trim()}>
                  + В очередь
                </button>
              </div>
            </div>
          </div>

          <div className="column">
            <div className="panel diagnostics-panel">
              <div className="panel-header">
                <h3>Диагностика</h3>
              </div>
              {diagnostics ? (
                <div className="diagnostic-body">
                  <div>
                    <strong>Суть:</strong> {diagnostics.actionSummary}
                  </div>
                  <div>
                    <strong>Реакция:</strong> {diagnostics.reactionSummary}
                  </div>
                  <div>
                    ΔAtt: {(diagnostics.rawDelta?.attitudeDelta || 0).toFixed(2)} · ΔOpen:{' '}
                    {(diagnostics.rawDelta?.opennessDelta || 0).toFixed(2)}
                  </div>
                </div>
              ) : (
                <span className="subtitle">Данных пока нет</span>
              )}

              {engineResult && (
                <div className="engine-grid">
                  <div>
                    <span>Валентность</span>
                    <strong>{engineResult.finalValence?.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Интенсивность</span>
                    <strong>{engineResult.experiencedIntensity?.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Удовольствие</span>
                    <strong>{engineResult.pleasure?.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Дискомфорт</span>
                    <strong>{engineResult.discomfort?.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Перегрузка</span>
                    <strong>{engineResult.overload?.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Вовлеченность</span>
                    <strong>{engineResult.engagement?.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {physicalReaction && (
                <div className="physical-reaction">
                  <strong>Физическая реакция:</strong>
                  <p>{physicalReaction}</p>
                </div>
              )}

              {classifierLog && (
                <details className="classifier-log">
                  <summary>LLM Классификатор</summary>
                  <pre>{JSON.stringify(classifierLog, null, 2)}</pre>
                </details>
              )}
            </div>

            <div className="panel prompt-panel">
              <div className="prompt-header">
                <h3>Лог промпта</h3>
                <div className="prompt-tabs">
                  <button
                    className={tabState === 'prompt' ? 'active' : ''}
                    onClick={() => setTabState('prompt')}
                  >
                    Промпт ({promptLog.length})
                  </button>
                  <button
                    className={tabState === 'trace' ? 'active' : ''}
                    onClick={() => setTabState('trace')}
                  >
                    Изменения ({actionTrace?.length || 0})
                  </button>
                </div>
              </div>
              {tabState === 'prompt' ? (
                <div className="prompt-log">
                  {promptLog.map((entry, idx) => (
                    <div key={idx} className={`prompt-entry ${entry.role}`}>
                      <div className="prompt-role">{entry.role}</div>
                      <pre>{entry.content}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="action-trace-log">
                  {actionTrace?.length ? (
                    actionTrace.map((entry, idx) => (
                      <details key={idx} className="trace-entry" open={idx === actionTrace.length - 1}>
                        <summary>{entry.label}</summary>
                        <pre>{JSON.stringify(entry.values, null, 2)}</pre>
                      </details>
                    ))
                  ) : (
                    <span className="subtitle">Нет данных по изменению</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
