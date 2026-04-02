import React, { useState, useEffect } from 'react';
import { ConfigEditor } from './ConfigEditor';

export function App() {
  const [pointId, setPointId] = useState('hands');
  const [state, setState] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [chat, setChat] = useState<{role: string, text: string}[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [promptLog, setPromptLog] = useState<any[]>([]);
  const [physicalReaction, setPhysicalReaction] = useState<string>("");

  const [allContexts, setAllContexts] = useState<any[]>([]);
  const [activeContexts, setActiveContexts] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<number>(1.0);
  const [engineResult, setEngineResult] = useState<any>(null);
  const [classifierLog, setClassifierLog] = useState<any>(null);
  const [coreEdit, setCoreEdit] = useState({
    sensitivity: 0,
    attitude: 0,
    capacity: 0,
    openness: 0,
    plasticity: 0
  });
  const [coreSaving, setCoreSaving] = useState(false);

  // Load initial state
  useEffect(() => {
    fetchState();
    fetchContexts();
  }, [pointId]);

  useEffect(() => {
    if (state) {
      setCoreEdit({
        sensitivity: Number(state.sensitivity || 0),
        attitude: Number(state.attitude || 0),
        capacity: Number(state.capacity || 0),
        openness: Number(state.openness || 0),
        plasticity: Number(state.plasticity || 0)
      });
    }
  }, [state]);

  const fetchContexts = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/contexts`);
      const data = await res.json();
      if (data.success) {
        setAllContexts(data.allPresets || []);
        setActiveContexts((data.activeIds || []).map((a: any) => a.id || a));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleContext = async (contextId: string, isActive: boolean) => {
    try {
      const res = await fetch(`http://localhost:3001/api/contexts/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId, isActive })
      });
      const data = await res.json();
      if (data.success) {
        fetchContexts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchState = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/state?pointId=${pointId}`);
      const data = await res.json();
      if (data.success) {
        setState(data.subject);
        setActions(data.availableActions);
        setPoints(data.availablePoints || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWait = async (ticks: number, callLLM: boolean) => {
    setLoading(true);
    setChat(p => [...p, { role: 'player', text: `[Время] Пропустить ${ticks} тик(ов). Отправка в LLM: ${callLLM ? 'Да' : 'Нет'}` }]);
    
    try {
      const res = await fetch('http://localhost:3001/api/wait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticks, callLLM })
      });
      const data = await res.json();
      
      if (data.success) {
        setState(data.state);
        const bundleDiagnostics = data.bundle?.diagnostics || data.diagnostics || null;
        const bundleResult = data.bundle?.output?.result || data.tickResult || null;
        setDiagnostics(bundleDiagnostics);
        setEngineResult(bundleResult);
        setClassifierLog(null);
        if (data.promptMessages) setPromptLog(data.promptMessages);
        
        if (data.reply) {
            setPhysicalReaction(data.reply.reaction || "");
            if (data.reply.speech) {
                setChat(p => [...p, { role: 'ST', text: data.reply.speech }]);
            } else {
                setChat(p => [...p, { role: 'ST', text: '(Молчит)' }]);
            }
        } else {
            setChat(p => [...p, { role: 'system', text: 'Время прошло (Silent Tick)' }]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAction = async (presetId: string, textMessage = "") => {
    setLoading(true);
    if (textMessage) {
        setChat(p => [...p, { role: 'player', text: textMessage }]);
    } else {
        const actionLabel = actions.find(a => a.id === presetId)?.label || presetId;
        setChat(p => [...p, { role: 'player', text: `[Действие: ${actionLabel}] на точку ${pointId}` }]);
    }
    
    try {
      const res = await fetch('http://localhost:3001/api/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId, textMessage, pointId, intensity })
      });
      const data = await res.json();
      
      if (data.success) {
        const bundle = data.bundle;
        setState(data.state);
        const bundleDiagnostics = bundle?.diagnostics || data.diagnostics || null;
        const bundleResult = bundle?.output?.result || data.tickResult || null;
        setDiagnostics(bundleDiagnostics);
        setEngineResult(bundleResult);
        setClassifierLog(data.classifierLog || null);
        if (data.promptMessages) setPromptLog(data.promptMessages);
        
        // Handle explicit JSON structure
        if (data.reply) {
            setPhysicalReaction(data.reply.reaction || "");
            if (data.reply.speech) {
                setChat(p => [...p, { role: 'ST', text: data.reply.speech }]);
            } else {
                setChat(p => [...p, { role: 'ST', text: '(Молчит)' }]);
            }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setInputMsg("");
  };

  if (!state) return <div>Загрузка состояния... (Убедитесь, что npx tsx src/api/server.ts запущен)</div>;

  const handleCoreChange = (field: keyof typeof coreEdit, value: number) => {
    setCoreEdit(prev => ({ ...prev, [field]: value }));
  };

  const handleCoreSave = async () => {
    if (!state) return;
    setCoreSaving(true);
    try {
      const res = await fetch('http://localhost:3001/api/subject/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: state.id,
          ...coreEdit
        })
      });
      const data = await res.json();
      if (data.success) {
        setState(data.state);
      }
    } catch (e) {
      console.error(e);
    }
    setCoreSaving(false);
  };

  const renderBadges = () => {
    if (!state) return null;
    const c = state.capacity || 0;
    const o = state.openness || 0;
    const s = state.sensitivity || 0;
    const a = state.attitude || 0;
    const p = state.plasticity || 0;
    const badges = [];

    if (c < 10) badges.push(<span key="apathy" style={{ background: '#8e44ad', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Апатия</span>);
    else if (c <= 25 && o > 80) badges.push(<span key="subspace" style={{ background: '#9b59b6', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Сабспейс</span>);
    else if (c <= 25 && o < 30 && a < 20) badges.push(<span key="panic" style={{ background: '#e74c3c', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Паническая атака</span>);
    else if (c <= 25 && s > 80) badges.push(<span key="overload" style={{ background: '#e67e22', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Сенсорная перегрузка</span>);
    
    if (c <= 40 && p > 80) badges.push(<span key="suggest" style={{ background: '#3498db', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Внушаемость</span>);
    if (c <= 30 && p < 30) badges.push(<span key="freeze" style={{ background: '#34495e', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Оцепенение</span>);
    if (c > 50 && s > 80) badges.push(<span key="hyper" style={{ background: '#f1c40f', color: '#000', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Гиперестезия</span>);
    if (c > 50 && a < 0) badges.push(<span key="defiance" style={{ background: '#c0392b', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Активное сопротивление</span>);

    if (state.point) {
      const ls = state.point.local_sensitivity || 0;
      const la = state.point.local_attitude || 0;
      if (ls > 80) badges.push(<span key="focal" style={{ background: '#d35400', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Гиперчувствительность ({state.point.point_id})</span>);
      if (ls > 70 && la < 30) badges.push(<span key="dissonance" style={{ background: '#c0392b', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.8em' }}>Диссонанс ({state.point.point_id})</span>);
    }

    if (badges.length === 0) return <span style={{ color: '#888', fontSize: '0.9em' }}>Стабильное состояние</span>;
    return <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>{badges}</div>;
  };


  return (
    <div style={{ display: 'flex', gap: 20, padding: 20, fontFamily: 'sans-serif', maxWidth: 1200, margin: '0 auto', height: '95vh' }}>
      {/* ЛЕВАЯ КОЛОНКА - СИМУЛЯТОР */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: 10 }}>
        <h2>Милстоун: Интеграция с ST</h2>

        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div style={{ flex: 1, padding: 10, border: '1px solid #444', borderRadius: 8 }}>
            <h3>Субъект: {state.name} ({state.id})</h3>
            <div>Sensitivity (Чувствительность): <strong>{state.sensitivity?.toFixed(1)}</strong></div>
            <div>Attitude (Отношение): <strong>{state.attitude?.toFixed(1)}</strong></div>
            <div>Capacity (Ресурс): <strong>{state.capacity?.toFixed(1)}</strong></div>
            <div>Openness (Открытость): <strong>{state.openness?.toFixed(1)}</strong></div>
            <div>Plasticity (Пластичность): <strong>{state.plasticity?.toFixed(1)}</strong></div>
            <div style={{ marginTop: 10 }}>
              <h4>Редактор параметров</h4>
              {[
                { key: 'sensitivity', label: 'Sensitivity (Чувствительность)' },
                { key: 'attitude', label: 'Attitude (Отношение)' },
                { key: 'capacity', label: 'Capacity (Ресурс)' },
                { key: 'openness', label: 'Openness (Открытость)' },
                { key: 'plasticity', label: 'Plasticity (Пластичность)' }
              ].map(field => (
                <div key={field.key} style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <label style={{ flex: 1 }}>{field.label}:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={(coreEdit as any)[field.key]}
                    onChange={e => handleCoreChange(field.key as keyof typeof coreEdit, Number(e.target.value))}
                    style={{ width: 80, padding: '3px 5px' }}
                  />
                </div>
              ))}
              <button onClick={handleCoreSave} disabled={coreSaving} style={{ marginTop: 8 }}>
                {coreSaving ? 'Сохранение...' : 'Сохранить параметры'}
              </button>
            </div>

            <div style={{ marginTop: '10px' }}>
              <strong>Биометрия / Модуль состояний:</strong><br/>
              {renderBadges()}
            </div>
            
            <h4 style={{ marginTop: 15 }}>Точка воздействия:</h4>
            <select value={pointId} onChange={(e) => setPointId(e.target.value)} style={{ padding: '5px', width: '100%' }}>
              {points.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.9em', color: '#666', marginTop: 5 }}>
              Local Sensitivity: {state.point?.local_sensitivity?.toFixed(1)}<br/>
              Local Attitude: {state.point?.local_attitude?.toFixed(1)}
            </div>
          </div>

          <div style={{ flex: 1, padding: 10, border: '1px solid #444', borderRadius: 8 }}>
            <h3>Диагностика</h3>
            {diagnostics ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span className="label"><strong>Суть:</strong> {diagnostics.actionSummary}</span>
                <span className="label"><strong>Реакция:</strong> {diagnostics.reactionSummary}</span>
                <span className="label"><strong>Дельта Att:</strong> {(diagnostics.rawDelta?.attitudeDelta || 0).toFixed(2)}</span>
                <span className="label"><strong>Дельта Open:</strong> {(diagnostics.rawDelta?.opennessDelta || 0).toFixed(2)}</span>
              </div>
            ) : (
              <div style={{ color: '#999' }}>Пока нет данных...</div>
            )}
            
            {engineResult && (
              <div style={{ marginTop: 10, padding: 8, background: '#2c3e50', borderRadius: 4, fontSize: '0.85em' }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#ecf0f1' }}>Движок: Подробности</summary>
                  <div style={{ marginTop: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, color: '#bdc3c7' }}>
                    <div>Валентность: {engineResult.finalValence?.toFixed(2)}</div>
                    <div>Ощущаемая Сила: {engineResult.experiencedIntensity?.toFixed(2)}</div>
                    <div>Удовольствие: {engineResult.pleasure?.toFixed(2)}</div>
                    <div>Дискомфорт: {engineResult.discomfort?.toFixed(2)}</div>
                    <div>Перегрузка: {engineResult.overload?.toFixed(2)}</div>
                    <div>Вовлеченность: {engineResult.engagement?.toFixed(2)}</div>
                    <div>Эффект обучения: {engineResult.learningEffect?.toFixed(2)}</div>
                  </div>
                </details>
              </div>
            )}

            {classifierLog && (
              <div style={{ marginTop: 10, padding: 8, background: '#27ae60', borderRadius: 4, fontSize: '0.85em', color: '#fff' }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>LLM Классификатор Намерения</summary>
                  <pre style={{ margin: '5px 0 0 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word', color: '#ecf0f1' }}>
                    {JSON.stringify(classifierLog, null, 2)}
                  </pre>
                </details>
              </div>
            )}
            
            {physicalReaction && (
              <div style={{ marginTop: 15, padding: 10, background: '#1e384c', color: '#e0f7fa', borderRadius: 6, fontStyle: 'italic' }}>
                <strong>Физическая реакция:</strong><br/>
                {physicalReaction}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20, padding: 10, border: '1px solid #444', borderRadius: 8 }}>
          <h3>Активные контексты (постоянные модификаторы)</h3>
          <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
            {allContexts.map(c => (
               <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                 <input 
                   type="checkbox" 
                   checked={activeContexts.includes(c.id)}
                   onChange={(e) => toggleContext(c.id, e.target.checked)}
                 />
                 {c.label}
               </label>
            ))}
          </div>
          
          <div style={{ marginTop: 15, paddingTop: 15, borderTop: '1px solid #444', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '0.9em', color: '#999' }}>Прокрутка времени (накопление эффектов от сред):</span>
            <button onClick={() => handleWait(1, false)} disabled={loading} style={{ padding: '6px 12px', background: '#444', border: '1px solid #666', borderRadius: 4, cursor: 'pointer', color: '#fff' }}>+1 тик (Скрыто)</button>
            <button onClick={() => handleWait(5, false)} disabled={loading} style={{ padding: '6px 12px', background: '#444', border: '1px solid #666', borderRadius: 4, cursor: 'pointer', color: '#fff' }}>+5 тиков (Скрыто)</button>
            <button onClick={() => handleWait(5, true)} disabled={loading} style={{ padding: '6px 12px', background: '#2c3e50', border: '1px solid #34495e', borderRadius: 4, cursor: 'pointer', color: '#fff' }}>+5 тиков и ответ (LLM)</button>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Доступные действия</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#222', padding: '5px 15px', borderRadius: 8, border: '1px solid #444' }}>
              <label style={{ fontSize: '0.9em', color: '#ccc' }}>Сила воздействия:</label>
              <input type="range" min="0.1" max="5.0" step="0.1" value={intensity} onChange={e => setIntensity(parseFloat(e.target.value))} />
              <strong style={{ width: '30px', textAlign: 'right', color: intensity > 2 ? '#e74c3c' : (intensity < 0.5 ? '#3498db' : '#2ecc71') }}>{intensity.toFixed(1)}x</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {actions.map(a => (
              <button 
                key={a.id} 
                onClick={() => handleAction(a.id)}
                disabled={loading}
                style={{ padding: '8px 16px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, cursor: 'pointer' }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid #444', borderRadius: 8, padding: 10, height: 300, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'player' ? 'flex-end' : 'flex-start', background: m.role === 'player' ? '#2c3e50' : '#333333', padding: '8px 12px', borderRadius: 8, maxWidth: '80%' }}>
                <strong>{m.role === 'player' ? 'Вы' : 'S-01'}:</strong> {m.text}
              </div>
            ))}
            {loading && <div style={{ color: '#888' }}>S-01 печатает...</div>}
          </div>
        <div style={{ display: 'flex', gap: 10 }}>
            <input 
              type="text" 
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              style={{ flex: 1, padding: 8 }}
              placeholder="Сказать что-нибудь..."
              onKeyDown={(e) => e.key === 'Enter' && inputMsg && handleAction('verbal_pressure', inputMsg)}
            />
            <button onClick={() => inputMsg && handleAction('verbal_pressure', inputMsg)} disabled={!inputMsg || loading} style={{ padding: '8px 16px' }}>Отправить</button>
          </div>
        </div>

        {promptLog.length > 0 && (
          <div style={{ marginTop: 20, border: '1px solid #444', borderRadius: 8, padding: 10, background: '#1e1e1e' }}>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#ccc' }}>
                Лог последнего отправленного промпта ({promptLog.length} сообщений)
              </summary>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {promptLog.map((m, i) => (
                  <div key={i} style={{ padding: 10, background: m.role === 'system' ? '#3e2723' : '#222', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.8em', textTransform: 'uppercase', color: '#999', marginBottom: 5 }}>Role: {m.role}</div>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontSize: '0.9em', fontFamily: 'monospace' }}>
                      {m.content}
                    </pre>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* ПРАВАЯ КОЛОНКА - КОНФИГУРАТОР ПРОМПТОВ */}
      <div style={{ flex: 1, minWidth: 350 }}>
        <ConfigEditor />
      </div>
    </div>
  );
}
