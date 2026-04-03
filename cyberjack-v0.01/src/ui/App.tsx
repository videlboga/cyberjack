import React, { useEffect, useMemo, useState } from 'react';
import { ConfigEditor } from './ConfigEditor';

type ChatEntry = {
  role: 'player' | 'subject' | 'system';
  text: string;
};

const API_BASE = 'http://localhost:3001';

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
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [engineResult, setEngineResult] = useState<any>(null);
  const [physicalReaction, setPhysicalReaction] = useState('');
  const [promptLog, setPromptLog] = useState<any[]>([]);
  const [contexts, setContexts] = useState<any[]>([]);
  const [activeContexts, setActiveContexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [scene, setScene] = useState<any>(null);
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

  const subjectId = subject?.id || 'S-01';
  const sceneId = scene?.id || 'lab';

  useEffect(() => {
    fetchState(pointId);
  }, [pointId]);

  useEffect(() => {
    fetchContexts();
  }, []);

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

  async function handleAction(options?: {
    presetId?: string;
    textMessage?: string;
    labelOverride?: string;
    intensityOverride?: number;
  }) {
    const actionId = options?.presetId || selectedAction;
    if (!actionId) return;

    const label = options?.labelOverride || actions.find((a) => a.id === actionId)?.label || actionId;
    const textMessage = options?.textMessage;

    if (textMessage) {
      setChat((prev) => [...prev, { role: 'player', text: textMessage }]);
    } else {
      setChat((prev) => [...prev, { role: 'player', text: `[Действие] ${label}` }]);
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          pointId,
          sceneId,
          presetId: actionId,
          intensity: options?.intensityOverride ?? intensity,
          textMessage
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Tick failed');

      setSubject(data.state);
      setPlayer(data.player);
      setDiagnostics(data.diagnostics);
      setEngineResult(data.tickResult);
      setClassifierLog(data.classifierLog);

      if (data.reply) {
        setPhysicalReaction(data.reply.reaction || '');
        if (data.reply.speech !== undefined) {
          const speechText = data.reply.speech || '';
          setChat((prev) => [
            ...prev,
            {
              role: 'subject',
              text: speechText || '(молчит)'
            }
          ]);
        }
      }
      if (data.promptMessages) {
        setPromptLog(data.promptMessages);
      }
      await fetchState(pointId);
      await fetchContexts();
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
        }
      }
      if (data.promptMessages) setPromptLog(data.promptMessages);
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
      await handleAction({
        presetId: 'verbal_pressure',
        textMessage: enable
          ? `Контекст активирован: ${label}. Примени это состояние.`
          : `Контекст снят: ${label}. Возвращайся к нейтральному состоянию.`,
        labelOverride: `[Контекст] ${label}`,
        intensityOverride: 0.4
      });
    } catch (err) {
      console.error(err);
    }
  }

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    handleAction({
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
                {CORE_FIELDS.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      value={coreDraft[field.key]}
                      onChange={(e) => handleCoreValueChange(field.key, Number(e.target.value))}
                    />
                  </label>
                ))}
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
                  <span>Local Sensitivity: {subject.point?.local_sensitivity?.toFixed(1) ?? '-'}</span>
                  <span>Local Attitude: {subject.point?.local_attitude?.toFixed(1) ?? '-'}</span>
                </div>
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
                    <span>{value}</span>
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
              <div className="action-controls">
                <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
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
                <button onClick={() => handleAction()} disabled={!selectedAction}>
                  Применить
                </button>
              </div>
              <div className="action-costs">
                <span>Стоимость:</span>
                {selectedActionCosts ? (
                  Object.entries(selectedActionCosts).map(([resKey, value]) => (
                    <span key={resKey} className="chip">
                      {resKey}: -{value}
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
                    <strong>{entry.role === 'player' ? 'Вы' : entry.role === 'subject' ? subject.name : 'Система'}:</strong>{' '}
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
                  placeholder="Введите реплику..."
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                />
                <button onClick={sendChatMessage} disabled={!chatInput.trim()}>
                  Отправить
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
              <div className="panel-header">
                <h3>Лог промпта ({promptLog.length})</h3>
              </div>
              <div className="prompt-log">
                {promptLog.map((entry, idx) => (
                  <div key={idx} className={`prompt-entry ${entry.role}`}>
                    <div className="prompt-role">{entry.role}</div>
                    <pre>{entry.content}</pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
