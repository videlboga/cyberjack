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

  // Load initial state
  useEffect(() => {
    fetchState();
    fetchContexts();
  }, [pointId]);

  const fetchContexts = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/contexts`);
      const data = await res.json();
      if (data.success) {
        setAllContexts(data.allPresets || []);
        setActiveContexts(data.activeIds || []);
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
        body: JSON.stringify({ presetId, textMessage, pointId })
      });
      const data = await res.json();
      
      if (data.success) {
        setState(data.state);
        setDiagnostics(data.diagnostics);
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

  return (
    <div style={{ display: 'flex', gap: 20, padding: 20, fontFamily: 'sans-serif', maxWidth: 1200, margin: '0 auto', height: '95vh' }}>
      {/* ЛЕВАЯ КОЛОНКА - СИМУЛЯТОР */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: 10 }}>
        <h2>Милстоун: Интеграция с ST</h2>

        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div style={{ flex: 1, padding: 10, border: '1px solid #444', borderRadius: 8 }}>
            <h3>Субъект: {state.name} ({state.id})</h3>
            <div>Sensitivity: {state.sensitivity?.toFixed(1)}</div>
            <div>Attitude: {state.attitude?.toFixed(1)}</div>
            <div>Capacity: {state.capacity?.toFixed(1)}</div>
            
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
                <span className="label"><strong>Суть действия:</strong> {diagnostics.actionSummary}</span>
                <span className="label"><strong>Реакция:</strong> {diagnostics.reactionSummary}</span>
                <span className="label"><strong>Дельта Отношения:</strong> {(diagnostics.rawDelta?.attitudeDelta || 0).toFixed(2)}</span>
                <span className="label"><strong>Дельта Открытости:</strong> {(diagnostics.rawDelta?.opennessDelta || 0).toFixed(2)}</span>
              </div>
            ) : (
              <div style={{ color: '#999' }}>Пока нет данных...</div>
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
          <h3>Доступные действия</h3>
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
