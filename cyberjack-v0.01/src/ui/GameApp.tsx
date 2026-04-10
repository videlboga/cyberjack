import React, { useState, useEffect, useRef } from 'react';
import './GameApp.css';

const API_BASE = 'http://localhost:3000';

type ActionPreset = { id: string; label: string; occupiesPoints?: string[] };
type Character = { id: string; name: string; kind?: string };

export function GameApp() {
  const [messages, setMessages] = useState<any[]>([]);
  const [playerResources, setPlayerResources] = useState<Record<string, number>>({});
  const [activeSubject, setActiveSubject] = useState<Character | null>(null);
  const [subjectState, setSubjectState] = useState<any>(null);
  const [availableActions, setAvailableActions] = useState<ActionPreset[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  const sceneId = 'lab';

  useEffect(() => {
    fetchInitialState();
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  async function fetchInitialState() {
    try {
      const res = await fetch(`${API_BASE}/api/state?subjectId=S-01&pointId=head`);
      const body = await res.json();
      if (body.success && body.subject) {
        setSubjectState(body.subject);
        setActiveSubject({ id: body.subject.id, name: body.subject.name });
        setAvailableActions(body.availableActions || []);
      }
      
      const pRes = await fetch(`${API_BASE}/api/relations?fromId=C-Gamma`);
      const pBody = await pRes.json();
      if (pBody.success) {
        // Mock player resources for now, until player API gives it
        setPlayerResources({ TimeBudget: 100, Energy: 50 });
      }

      setMessages([{
        id: Date.now(),
        role: 'system',
        text: 'Simulation started. Connected to ' + sceneId
      }]);
    } catch (e) {
      console.error(e);
    }
  }

  async function sendAction(presetId?: string, text?: string, targetPoint: string = 'head') {
    if (!activeSubject) return;
    setIsProcessing(true);

    try {
      const reqBody: any = {
        subjectId: activeSubject.id,
        pointId: targetPoint,
        sceneId,
        playerId: 'C-Gamma',
        skipLLM: false
      };

      if (presetId) reqBody.presetId = presetId;
      if (text) reqBody.textMessage = text;

      // Optimistic UI log for user action
      if (presetId) {
        const actionLabel = availableActions.find(a => a.id === presetId)?.label || presetId;
        addMessage({
          role: 'player',
          text: `[Action] ${actionLabel} -> ${targetPoint}`,
        });
      } else if (text) {
        addMessage({
          role: 'player',
          text: `"${text}"`,
        });
      }

      setChatInput('');

      const res = await fetch(`${API_BASE}/api/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      const data = await res.json();
      
      if (data.success) {
        // Refresh state
        fetchInitialState();

        // Narrator or LLM response
        const newMsgText = data.llmResponse?.content || data.diagnostics?.semanticNarrative || "Action completed.";
        addMessage({
          role: 'narrator',
          text: newMsgText
        });
      }
    } catch (e) {
      console.error(e);
      addMessage({ role: 'system', text: 'Error executing action.' });
    } finally {
      setIsProcessing(false);
    }
  }

  const addMessage = (msg: any) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random() }]);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendAction(undefined, chatInput.trim());
  };

  return (
    <div className="game-app-container">
      <header className="game-header">
        <div className="player-stats">
          {Object.entries(playerResources).map(([k, v]) => (
            <span key={k} style={{ marginRight: 16 }}>{k}: {v}</span>
          ))}
        </div>
        <div className="top-actions">
          <button className="icon-btn">Inventory</button>
          <button className="icon-btn">Journal</button>
          <button className="time-btn" onClick={() => sendAction('wait')} disabled={isProcessing}>
            {isProcessing ? 'Waiting...' : 'Wait Tick'}
          </button>
        </div>
      </header>
      
      <main className="game-main">
        {/* Map Layer */}
        <section className="map-view">
          <div className="map-node">
            <h4>Control Terminal</h4>
            <div className="avatar-group">
              <div className="avatar player" title="Calibrator">OP</div>
            </div>
          </div>
          <div className="map-path"></div>
          <div className="map-node active">
            <h4>Lab Chair</h4>
            <div className="avatar-group">
              {activeSubject && (
                <div className="avatar subject" title={activeSubject.name}>
                  {activeSubject.id}
                  {isProcessing && <div className="bubble">...</div>}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Chat Timeline Layer */}
        <section className="chat-timeline">
          <div className="log-entries" ref={logRef}>
            {messages.map(m => (
              <div key={m.id} className={`log-entry ${m.role}`}>
                {m.role === 'player' && <strong style={{color: '#93c5fd'}}>You: </strong>}
                {m.role === 'narrator' && <strong style={{color: '#cbd5e1'}}>Simulation: </strong>}
                {m.role === 'subject' && <strong style={{color: '#fca5a5'}}>{activeSubject?.name}: </strong>}
                {m.text}
              </div>
            ))}
          </div>
          <form className="chat-input-bar" onSubmit={handleChatSubmit}>
            <input 
              type="text" 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)}
              placeholder={activeSubject ? `Speak or describe action to ${activeSubject.name}...` : `Select a subject...`}
              disabled={isProcessing || !activeSubject}
            />
            <button type="submit" disabled={isProcessing || !activeSubject}>Send</button>
          </form>
        </section>

        {/* Info & Radial Layer */}
        <aside className={`status-panel ${subjectState ? 'open' : ''}`}>
          {subjectState ? (
            <div className="subject-details">
              <h3>{subjectState.name}</h3>
              
              <div className="stat-bars">
                <div className="stat">
                  <label><span>Sensitivity</span> <span>{Math.round(subjectState.sensitivity)} / 100</span></label>
                  <progress value={subjectState.sensitivity} max="100"/>
                </div>
                <div className="stat">
                  <label><span>Capacity</span> <span>{Math.round(subjectState.capacity)} / 100</span></label>
                  <progress value={subjectState.capacity} max="100"/>
                </div>
                <div className="stat">
                  <label><span>Attitude</span> <span>{Math.round(subjectState.attitude)} / 100</span></label>
                  <progress value={subjectState.attitude} max="100"/>
                </div>
                <div className="stat">
                  <label><span>Plasticity</span> <span>{Math.round(subjectState.plasticity)} / 100</span></label>
                  <progress value={subjectState.plasticity} max="100"/>
                </div>
              </div>
              
              <div className="active-contexts">
                <h4>Active Contexts</h4>
                <p style={{fontSize: 12, color: '#64748b'}}>None</p>
                {/* We'd map through subjectState.activeContexts if we had them fetched here */}
              </div>
              
              <div className="quick-actions-list">
                <h4>Quick Interactions (Head)</h4>
                {availableActions.slice(0, 8).map(action => (
                  <button 
                    key={action.id} 
                    onClick={() => sendAction(action.id)}
                    disabled={isProcessing}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">Loading subject data...</div>
          )}
        </aside>
      </main>
    </div>
  );
}
