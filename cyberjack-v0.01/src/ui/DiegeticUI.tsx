import React, { useEffect, useState, useRef } from 'react';

interface HoverData {
  subjectId?: string;
  partId: string;
  x: number;
  y: number;
}

interface SpeechBubbleData {
  id: string;
  actorId: string;
  text: string;
  x: number;
  y: number;
  expiresAt: number;
}

export interface DiegeticUIProps {
  messages: any[];
  groupedActions: Record<string, any[]>;
  radialCategories: any[];
  sendAction: (presetId?: string, text?: string, targetPoint?: string, targetCharIdOverride?: string, customIntensity?: number) => void;
  isProcessing: boolean;
  focusedCharacter: any;
  targetSubjectId: string | null;
  playerResources: Record<string, number>;
  playerInventory: any[];
  
  subjectState?: any;
  setSelectedPoint: (point: string) => void;
  onFocusSubject?: (subjectId: string) => void;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  handleChatSubmit: (e: React.FormEvent) => void;
  relationsList: any[];
}

const DiegeticUI: React.FC<DiegeticUIProps> = ({
  messages,
  groupedActions,
  radialCategories,
  sendAction,
  isProcessing,
  focusedCharacter,
  targetSubjectId,
  playerResources,
  playerInventory,
  subjectState,
  setSelectedPoint,
  onFocusSubject,
  chatInput,
  setChatInput,
  handleChatSubmit,
  relationsList
}) => {
  const [hover, setHover] = useState<HoverData | null>(null);
  const [radial, setRadial] = useState<{subjectId?: string, partId: string, x: number, y: number} | null>(null);
  const [speechBubbles, setSpeechBubbles] = useState<Record<string, SpeechBubbleData>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const radialStateRef = useRef<boolean>(false);
  const radialDataRef = useRef<{subjectId?: string, partId: string} | null>(null);
  const ignoreNextRadialRef = useRef<number>(0);

  const getPartStats = (id: string) => {
    let synch = 50.0;
    let status = 'UNKNOWN';
    let label = id.toUpperCase();
    
    const lookupId = id.toLowerCase();
    
    if (subjectState && subjectState.points) {
      const ptState = subjectState.points[id] || subjectState.points[lookupId];
      if (ptState) {
        synch = ptState.localAttitude !== undefined ? ptState.localAttitude : (ptState.local_attitude !== undefined ? ptState.local_attitude : 50);
        label = ptState.preset?.label || id.toUpperCase();
        if (synch >= 80) status = 'OPTIMAL';
        else if (synch >= 40) status = 'STABLE';
        else status = 'CRITICAL';
      }
    }
    
    return {
      synch: Math.round(synch),
      status,
      label
    };
  };

  useEffect(() => {
    // Sync messages to speech bubbles
    const lastMessage = messages[messages.length - 1];
    
    // RADICAL FIX: We NEVER want bubbles for player roles.
    // Explicitly check role and actorId.
    const isPlayer = lastMessage?.role === 'player' || 
                     lastMessage?.actorId === 'PLAYER' || 
                     lastMessage?.actorId === 'PL-1';

    if (lastMessage && lastMessage.role === 'subject' && !isPlayer) {
        const actorId = lastMessage.actorId || 'UNKNOWN';
        
        setSpeechBubbles(prev => {
            const current = prev[actorId];
            return {
                ...prev,
                [actorId]: {
                    id: current?.id || `${Date.now()}`,
                    actorId,
                    text: lastMessage.text,
                    x: current?.x || 0.5,
                    y: current?.y || 0.3,
                    expiresAt: Date.now() + 5000
                }
            };
        });
    }

    // Immediate cleanup for any player bubbles that might have leaked
    setSpeechBubbles(prev => {
        const now = Date.now();
        let hasChanges = false;
        const next = { ...prev };

        for (const id in next) {
            const isInvalid = id === 'PLAYER' || id === 'PL-1' || next[id].expiresAt < now;
            if (isInvalid) {
                delete next[id];
                hasChanges = true;
            }
        }

        return hasChanges ? next : prev;
    });
  }, [messages]);

  useEffect(() => {
    const isPointerOverMenu = (normX: number, normY: number) => {
        if (typeof document === 'undefined') return false;
        // normX and normY are 0..1 scale relative to the browser window viewport.
        const px = normX * window.innerWidth;
        const py = normY * window.innerHeight;
        const el = document.elementFromPoint(px, py);
        return el && el.closest('.radial-menu-container') !== null;
    };

    (window as any).CyberjackUI = {
      showHoverInfo: (subjectId: string, partId: string, normX: number, normY: number) => {
        if (radialStateRef.current) return;
        if (subjectId && targetSubjectId !== subjectId) {
          onFocusSubject?.(subjectId);
        }
        setHover({ subjectId, partId, x: normX, y: normY });
      },
      hideHoverInfo: () => {
        if (radialStateRef.current) return;
        setHover(null);
      },
      updateSpeechBubblePosition: (actorId: string, normX: number, normY: number) => {
        // Log to verify coordinates are coming through
        // console.log(`UI: Update bubble pos for ${actorId}: ${normX}, ${normY}`);
        setSpeechBubbles(prev => {
          if (!prev[actorId]) return prev;
          if (prev[actorId].x === normX && prev[actorId].y === normY) return prev;
          return {
            ...prev,
            [actorId]: { 
              ...prev[actorId], 
              x: normX, 
              y: normY 
            }
          };
        });
      },
      showRadialMenu: (subjectId: string, partId: string, normX: number, normY: number) => {
        if (isPointerOverMenu(normX, normY)) return;

        if (subjectId && targetSubjectId !== subjectId) {
          onFocusSubject?.(subjectId);
        }
        radialStateRef.current = true;
        setRadial({ subjectId, partId, x: normX, y: normY });
        setActiveCategory(null);
        setSelectedPoint(partId);
      },
      hideRadialMenu: (normX: number, normY: number) => {
        if (isPointerOverMenu(normX, normY)) return;

        radialStateRef.current = false;
        setRadial(null);
        setActiveCategory(null);
      }
    };

    return () => { 
      if ((window as any).CyberjackUI) {
        delete (window as any).CyberjackUI;
      }
    };
  }, [setSelectedPoint, targetSubjectId, onFocusSubject]);

  useEffect(() => {
    // Sync messages to speech bubbles
    const lastMessage = messages[messages.length - 1];
    
    // RADICAL FIX: We NEVER want bubbles for player roles.
    const isPlayer = lastMessage?.role === 'player' || 
                     lastMessage?.actorId === 'PLAYER' || 
                     lastMessage?.actorId === 'PL-1' ||
                     lastMessage?.actorName === 'Калибратор';

    if (lastMessage && lastMessage.role === 'subject' && !isPlayer) {
      const actorId = lastMessage.actorId || 'UNKNOWN';
      
      setSpeechBubbles(prev => {
        const current = prev[actorId];
        return {
          ...prev,
          [actorId]: {
            id: current?.id || `${Date.now()}`,
            actorId,
            text: lastMessage.text,
            x: current?.x ?? 0.5,
            y: current?.y ?? 0.3,
            expiresAt: Date.now() + 5000
          }
        };
      });
    }

    // Force remove player bubbles from state immediately
    setSpeechBubbles(prev => {
        if (prev['PLAYER'] || prev['PL-1']) {
            const next = { ...prev };
            delete next['PLAYER'];
            delete next['PL-1'];
            return next;
        }
        return prev;
    });
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setSpeechBubbles(prev => {
        let changed = false;
        const next = { ...prev };
        for (const key in next) {
          if (next[key].expiresAt < now) {
            delete next[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ 
      width: '100vw', height: '100vh', background: 'transparent', overflow: 'hidden',
      position: 'relative', pointerEvents: 'none', fontFamily: 'monospace', color: '#00f0ff'
    }}>
      
      {/* SPEECH BUBBLES */}
      {Object.values(speechBubbles).map(bubble => (
        <div 
          key={bubble.id}
          style={{
            position: 'absolute',
            left: `${bubble.x * 100}vw`,
            top: `${bubble.y * 100}vh`,
            transform: 'translate(-50%, -120%)',
            background: 'rgba(0, 5, 10, 0.85)',
            border: bubble.actorId === 'PLAYER' ? '1px solid #00ffaa' : '1px solid #ff0055',
            padding: '10px 15px',
            color: '#fff',
            fontSize: '14px',
            maxWidth: '280px',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 0 20px rgba(0,0,0,0.8)',
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 85%, 55% 85%, 50% 100%, 45% 85%, 0% 85%)',
            paddingBottom: '25px',
            textShadow: '0 1px 2px rgba(0,0,0,1)'
          }}
        >
          <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {bubble.actorId}
          </div>
          {bubble.text}
        </div>
      ))}

      {/* ЛЕВАЯ ПАНЕЛЬ: CORE STATE */}
      {subjectState && (
        <div style={{
          position: 'absolute', top: '15%', left: '30px', width: '220px',
          background: 'linear-gradient(90deg, rgba(0, 20, 25, 0.9) 0%, rgba(0, 40, 40, 0.6) 100%)',
          borderLeft: '2px solid #00f0ff', padding: '15px', color: '#00f0ff'
        }}>
          <div style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '1px' }}>TARGET_STATE</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>{subjectState.name?.toUpperCase() || (targetSubjectId && targetSubjectId.toUpperCase())}</div>
          
          {[
            { label: 'CAPACITY', val: subjectState.capacity },
            { label: 'OPENNESS', val: subjectState.openness },
            { label: 'PLASTICITY', val: subjectState.plasticity },
            { label: 'ATTITUDE', val: subjectState.attitude },
            { label: 'TENSION', val: subjectState.tension }
          ].map(stat => (
            <div key={stat.label} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>{stat.label}</span><span>{stat.val != null ? stat.val.toFixed(1) : 'N/A'}</span>
              </div>
              <div style={{ width: '100%', height: '2px', background: 'rgba(0, 240, 255, 0.1)', marginTop: '2px' }}>
                <div style={{ width: `${Math.max(0, Math.min(100, stat.val || 0))}%`, height: '100%', background: '#00f0ff' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* НИЖНЯЯ ПАНЕЛЬ: ЛОГИ И ЧАТ */}
      <div style={{
        position: 'absolute', bottom: '30px', left: '30px', width: '450px',
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <div style={{ 
          pointerEvents: 'none', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          {messages.filter(m => m.role === 'narrator' || m.role === 'subject' || m.role === 'player').slice(-6).map((m, i) => (
            <div key={i} style={{ 
              background: 'rgba(0, 5, 10, 0.7)',
              borderLeft: m.role === 'narrator' ? '3px solid #00f0ff' : (m.role === 'player' ? '3px solid #00ffaa' : '3px solid #ff0055'),
              padding: '10px 15px', 
              color: m.role === 'narrator' ? '#ccffff' : (m.role === 'player' ? '#aaffff' : '#ffcccc'),
              textShadow: '0 0 2px rgba(0,0,0,0.8)',
              fontStyle: m.role === 'narrator' ? 'italic' : 'normal'
            }}>
              {m.role === 'player' && <span style={{ opacity: 0.5, fontSize: '9px', display: 'block', marginBottom: '4px' }}>ВЫ:</span>}
              {m.role === 'subject' && <span style={{ opacity: 0.5, fontSize: '9px', display: 'block', marginBottom: '4px' }}>{m.actorId?.toUpperCase() || 'ЦЕЛЬ'}:</span>}
              {m.text}
            </div>
          ))}
        </div>
        
        {/* INPUT FORM */}
        <form onSubmit={handleChatSubmit} style={{ pointerEvents: 'auto', display: 'flex' }}>
          <input 
            type="text" 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)} 
            placeholder="Ввести команду/реплику..."
            style={{ 
              flex: 1, 
              background: 'rgba(0, 20, 25, 0.85)', 
              border: '1px solid #00f0ff', 
              color: '#00f0ff', 
              padding: '8px 12px', 
              fontFamily: 'monospace',
              outline: 'none'
            }} 
            disabled={isProcessing}
          />
          <button 
            type="submit" 
            disabled={isProcessing}
            style={{
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid #00f0ff',
              borderLeft: 'none',
              color: '#00f0ff',
              padding: '0 15px',
              cursor: isProcessing ? 'default' : 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold'
            }}
          >
            {isProcessing ? '...' : '>_'}
          </button>
        </form>
      </div>      {/* ХОВЕР ПО ЧАСТЯМ ТЕЛА */}
      {hover && (() => {
        const stats = getPartStats(hover.partId);
        return (
          <div style={{
            position: 'absolute', left: `${hover.x * 100}vw`, top: `${hover.y * 100}vh`, transform: 'translate(40px, -50%)',
            background: 'linear-gradient(135deg, rgba(0, 40, 40, 0.9) 0%, rgba(0, 20, 25, 0.95) 100%)',
            border: '1px solid #00f0ff', borderRadius: '2px', padding: '12px', minWidth: '180px',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)', pointerEvents: 'none'
          }}>
            <div style={{ position: 'absolute', top: -1, left: -1, width: 10, height: 10, borderLeft: '3px solid #00f0ff', borderTop: '3px solid #00f0ff' }} />
            <div style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '2px' }}>NODE_ID: {hover.partId.toUpperCase()}</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>{stats.label}</div>
            
            <div style={{ marginTop: '10px' }}>
              {(subjectState?.points?.[hover.partId] || subjectState?.points?.[hover.partId.toLowerCase()]) && (() => {
                  const pt = subjectState.points[hover.partId] || subjectState.points[hover.partId.toLowerCase()];
                  return (
                      <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '4px', opacity: 0.8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Sensitivity:</span><span>{Math.round(pt.localSensitivity || pt.local_sensitivity || 0)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Attitude:</span><span>{Math.round(pt.localAttitude || pt.local_attitude || 0)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Familiarity:</span><span>Lvl {Math.round(pt.familiarity || 0)}</span>
                        </div>
                      </div>
                  );
              })()}
            </div>

            <div style={{ fontSize: '12px', marginTop: '12px', color: '#ff0055' }}>
              STATUS: [{stats.status}]
            </div>
          </div>
        );
      })()}

      {/* РАДИАЛЬНОЕ МЕНЮ С КАТЕГОРИЯМИ */}
      {radial && (() => {
        // Если выбрана категория, показываем ее экшены, иначе - категории, у которых есть экшены.
        const activeActions = activeCategory ? (groupedActions[activeCategory] || []) : [];
        const renderItems = activeCategory ? activeActions : radialCategories;
        const itemCount = renderItems.length;
        let angleStep = itemCount ? 360 / itemCount : 0;
        if (itemCount === 1) angleStep = 0;

        return (
          <div style={{
              position: 'absolute', left: `${radial.x * 100}vw`, top: `${radial.y * 100}vh`, transform: 'translate(-50%, -50%)',
              width: '380px', height: '380px', pointerEvents: 'auto', zIndex: 50,
              background: 'radial-gradient(circle at center, rgba(0, 40, 50, 0.7) 0%, rgba(0, 20, 25, 0.4) 60%, transparent 100%)',
              borderRadius: '50%',
              backdropFilter: 'blur(2px)'
          }}
          className="radial-menu-container"
          onClick={(e) => {
              // Просто поглощаем клик, не закрывая меню
              e.stopPropagation();
          }}
          onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
          }}>
              <div 
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '60px', height: '60px', background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid #00f0ff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 'bold', color: '#00f0ff', cursor: activeCategory ? 'pointer' : 'default',
                boxShadow: activeCategory ? '0 0 15px rgba(0,240,255,0.5)' : 'none'
              }}
              onClick={(e) => { 
                e.stopPropagation(); 
                ignoreNextRadialRef.current = Date.now() + 1500;
                if (activeCategory) setActiveCategory(null);
              }}
            >
              {activeCategory ? 'BACK' : 'CMD'}
            </div>

            {itemCount === 0 && (
               <div style={{
                position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
                fontSize: '10px', color: '#ff0055', background: 'rgba(0,0,0,0.8)', padding: '2px 5px', border: '1px solid #ff0055'
               }}>
                 {activeCategory ? 'NO_ACTIONS_RSRC' : 'EMPTY_NODE'}
               </div>
            )}

            {renderItems.map((item: any, idx: number) => {
               const baseAngle = itemCount === 1 ? 0 : (idx * angleStep) - 90;
               const isLocked = isProcessing && activeCategory;
               const radius = activeCategory ? 120 : 90;
               return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    if (!activeCategory) {
                      ignoreNextRadialRef.current = Date.now() + 1500;
                      setActiveCategory(item.id);
                    } else {
                      sendAction(item.id, undefined, radial.partId, radial.subjectId || targetSubjectId || undefined);
                      ignoreNextRadialRef.current = Date.now() + 1500;
                      radialStateRef.current = false;
                      radialDataRef.current = null;
                      setRadial(null);
                      setActiveCategory(null);
                    }
                  }}
                  style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: `translate(-50%, -50%) rotate(${baseAngle}deg) translate(${radius}px) rotate(${-baseAngle}deg)`,
                    width: activeCategory ? '120px' : '100px', 
                    height: '34px',
                    background: isLocked ? 'rgba(50, 0, 0, 0.9)' : 'rgba(0, 20, 20, 0.9)',
                    border: isLocked ? '1px solid #ff0055' : '1px solid #00f0ff',
                    color: isLocked ? '#ff0055' : '#00f0ff', 
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    fontSize: '10px', fontWeight: 'bold', padding: '0 10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                    clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)',
                    pointerEvents: 'auto',
                    zIndex: 10
                  }}
                  title={item.label}
                >
                  {item.label}
                </div>
               );
            })}
          </div>
        );
      })()}

      {/* ПРАВАЯ ПАНЕЛЬ: РЕСУРСЫ и ОТНОШЕНИЯ */}
      <div style={{
        position: 'absolute', bottom: '30px', right: '30px', color: '#00f0ff', textAlign: 'right',
        pointerEvents: 'auto', borderRight: '2px solid #00f0ff', paddingRight: '15px'
      }}>
        <div style={{ fontSize: '10px', opacity: 0.5 }}>STATUS: ACTIVE</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>SYSTEM_CALIBRATOR_v.0.2</div>
        <div style={{ fontSize: '10px', opacity: 0.8 }}>TARGET UID: {targetSubjectId || 'AWAITING_LOCK'}</div>
        
        {/* RELATIONS SECTION */}
        {relationsList && relationsList.length > 0 && (
          <div style={{ marginTop: '15px', borderBottom: '1px solid rgba(0, 240, 255, 0.2)', paddingBottom: '10px', marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '5px' }}>TARGET_RELATIONS</div>
            {relationsList.map((rel: any, i: number) => {
              const metrics = [
                { axisId: 'Attitude', value: (rel.attitude != null ? rel.attitude : 50) - 50 },
                { axisId: 'Openness', value: rel.openness || 0 },
                { axisId: 'Plasticity', value: rel.plasticity || 0 }
              ];
              return (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '9px', opacity: 0.5, textAlign: 'right', marginBottom: '2px' }}>TO: {rel.to_id}</div>
                  {metrics.map((m, j) => (
                    <div key={`${i}-${j}`} style={{ 
                      display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px',
                      fontSize: '11px', marginBottom: '4px', opacity: 0.9
                    }}>
                      <div style={{ width: '80px', height: '2px', background: 'rgba(0, 240, 255, 0.1)', flexShrink: 0 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, Math.abs(m.value * 2)))}%`, height: '100%', background: m.value >= 0 ? '#00f0ff' : '#ff0055', float: 'right' }} />
                      </div>
                      <div>[{m.value > 0 ? '+' : ''}{m.value.toFixed(1)}]</div>
                      <div style={{ color: '#fff', textTransform: 'uppercase' }}>{m.axisId.substring(0, 12)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '10px', color: '#ffaa00', fontSize: '12px' }}>
          RSRC_ENERGY: {playerResources?.['energy'] || playerResources?.['energy'] || 0}
        </div>
        <div style={{ color: '#ffaa00', fontSize: '12px' }}>
          RSRC_CREDITS: {playerResources?.['credits'] || playerResources?.['credit'] || 0}
        </div>
        <div style={{ color: '#ffaa00', fontSize: '12px' }}>
          RSRC_AUTH: {playerResources?.['authority'] || 0}
        </div>
      </div>
    </div>
  );
};

export default DiegeticUI;
