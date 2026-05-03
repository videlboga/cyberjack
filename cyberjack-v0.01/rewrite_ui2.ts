import * as fs from 'fs';

const txt = `import React, { useEffect, useState } from 'react';

interface HoverData {
  partId: string;
  x: number;
  y: number;
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
  setSelectedPoint
}) => {
  const [hover, setHover] = useState<HoverData | null>(null);
  const [radial, setRadial] = useState<{partId: string, x: number, y: number} | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const getPartStats = (id: string) => {
    let att = 50.0;
    let sens = 50.0;
    let status = 'UNKNOWN';
    let label = id.toUpperCase();
    
    if (subjectState && subjectState.points) {
      const ptState = subjectState.points[id];
      if (ptState) {
        att = ptState.local_attitude ?? 50.0;
        sens = ptState.local_sensitivity ?? 50.0;
        label = ptState.preset?.label || id.toUpperCase();

        if (att >= 70) status = 'OPTIMAL';
        else if (att >= 30) status = 'STABLE';
        else status = 'CRITICAL';
      }
    }
    
    return {
      att: Math.round(att),
      sens: Math.round(sens),
      status,
      label
    };
  };

  useEffect(() => {
    (window as any).CyberjackUI = {
      showHoverInfo: (partId: string, x: number, y: number) => {
        setHover({ partId, x, y });
      },
      hideHoverInfo: () => {
        setHover(null);
      },
      showRadialMenu: (partId: string, x: number, y: number) => {
        setRadial({ partId, x, y });
        setActiveCategory(null);
        setSelectedPoint(partId);
      },
      hideRadialMenu: () => {
        setRadial(null);
        setActiveCategory(null);
      }
    };

    return () => { 
      if ((window as any).CyberjackUI) {
        delete (window as any).CyberjackUI;
      }
    };
  }, [setSelectedPoint]);

  return (
    <div style={{ 
      width: '100vw', height: '100vh', background: 'transparent', overflow: 'hidden',
      position: 'relative', pointerEvents: 'none', fontFamily: 'monospace', color: '#00f0ff'
    }}>
      
      {/* ЛЕВАЯ ПАНЕЛЬ: CORE STATE */}
      <div style={{
          position: 'absolute', top: '15%', left: '50px', width: '220px',
          background: 'linear-gradient(90deg, rgba(0, 20, 25, 0.95) 0%, rgba(0, 40, 40, 0.7) 100%)',
          borderLeft: '3px solid #00f0ff', padding: '15px', color: '#00f0ff',
          boxShadow: '0 0 20px rgba(0,240,255,0.1)'
      }}>
        {!subjectState ? (
           <div style={{ fontSize: '12px', color: '#ff0055', textAlign: 'center', padding: '20px 0' }}>
              [ SEARCHING TARGET PROFILE... ]
           </div>
        ) : (
           <>
              <div style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '1px' }}>TARGET_PROFILE</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#fff' }}>
                {subjectState.name?.toUpperCase() || (targetSubjectId && targetSubjectId.toUpperCase())}
              </div>
              
              {[
                { label: 'CAPACITY', val: subjectState.capacity },
                { label: 'OPENNESS', val: subjectState.openness },
                { label: 'PLASTICITY', val: subjectState.plasticity },
                { label: 'ATTITUDE', val: subjectState.attitude },
                { label: 'TENSION', val: subjectState.tension }
              ].map(stat => (
                <div key={stat.label} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                    <span>{stat.label}</span><span style={{color: '#fff'}}>{stat.val != null ? stat.val.toFixed(1) : 'N/A'}</span>
                  </div>
                  <div style={{ width: '100%', height: '3px', background: 'rgba(0, 240, 255, 0.1)', marginTop: '2px' }}>
                    <div style={{ width: \`\${Math.max(0, Math.min(100, stat.val || 0))}%\`, height: '100%', background: stat.label === 'TENSION' ? '#ff0055' : '#00f0ff', boxShadow: \`0 0 5px \${stat.label === 'TENSION' ? '#ff0055' : '#00f0ff'}\` }} />
                  </div>
                </div>
              ))}
           </>
        )}
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ: ЛОГИ */}
      <div style={{
        position: 'absolute', bottom: '50px', left: '50px', width: '450px',
        pointerEvents: 'none', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        {messages.slice(-6).map((m, i) => (
          <div key={i} style={{ 
            background: 'linear-gradient(90deg, rgba(0, 20, 25, 0.85) 0%, rgba(0,10,10,0.5) 100%)', 
            borderLeft: m.role === 'narrator' ? '3px solid #00f0ff' : '3px solid #ff0055',
            padding: '10px 14px', color: m.role === 'narrator' ? '#ccffff' : '#ffaaaa',
            textShadow: '0 0 2px rgba(0,0,0,0.9)',
            borderRadius: '0 4px 4px 0'
          }}>
            {m.text}
          </div>
        ))}
      </div>

      {/* ХОВЕР ПО ЧАСТЯМ ТЕЛА */}
      {hover && (() => {
        const stats = getPartStats(hover.partId);
        return (
          <div style={{
            position: 'absolute', left: hover.x, top: hover.y, transform: 'translate(40px, -50%)',
            background: 'linear-gradient(135deg, rgba(0, 30, 30, 0.95) 0%, rgba(0, 10, 15, 0.95) 100%)',
            border: '1px solid #00f0ff', borderRadius: '4px', padding: '16px', minWidth: '220px',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)', pointerEvents: 'none'
          }}>
            <div style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderLeft: '3px solid #00f0ff', borderTop: '3px solid #00f0ff' }} />
            <div style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '2px', color: '#fff' }}>NODE: {hover.partId.toUpperCase()}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', margin: '6px 0', textTransform: 'uppercase' }}>{stats.label}</div>
            
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                <span>LOC_ATTITUDE</span><span style={{color: '#fff'}}>{stats.att}</span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(0, 240, 255, 0.1)', marginBottom: '10px' }}>
                <div style={{ width: \`\${Math.max(0, Math.min(100, stats.att))}%\`, height: '100%', background: '#00f0ff', boxShadow: '0 0 5px #00f0ff' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                <span>LOC_SENSITIVITY</span><span style={{color: '#fff'}}>{stats.sens}</span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(0, 240, 255, 0.1)' }}>
                <div style={{ width: \`\${Math.max(0, Math.min(100, stats.sens))}%\`, height: '100%', background: '#ffaa00', boxShadow: '0 0 5px #ffaa00' }} />
              </div>
            </div>

            <div style={{ fontSize: '12px', marginTop: '16px', fontWeight: 'bold', color: stats.status === 'OPTIMAL' ? '#00ffaa' : (stats.status === 'STABLE' ? '#00f0ff' : '#ff0055') }}>
              STATE: {stats.status}
            </div>
            
            {!subjectState?.points?.[hover.partId] && (
              <div style={{ marginTop: '8px', fontSize: '10px', color: '#ff0055' }}>
                 [ NO_DATABASE_ENTRY ]
              </div>
            )}
          </div>
        );
      })()}

      {/* РАДИАЛЬНОЕ МЕНЮ С КАТЕГОРИЯМИ */}
      {radial && (() => {
        const activeActions = activeCategory ? (groupedActions[activeCategory] || []) : [];
        const renderItems = activeCategory ? activeActions : radialCategories;
        const itemCount = renderItems.length;
        let angleStep = itemCount ? 360 / itemCount : 0;
        if (itemCount === 1) angleStep = 0;

        return (
          <div style={{
              position: 'absolute', left: radial.x, top: radial.y, transform: 'translate(-50%, -50%)',
              width: '340px', height: '340px', pointerEvents: 'auto'
          }}>
            <div 
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '64px', height: '64px', background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid #00f0ff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 'bold', color: '#00f0ff', cursor: activeCategory ? 'pointer' : 'default',
                boxShadow: activeCategory ? '0 0 20px rgba(0,240,255,0.6)' : 'inset 0 0 10px rgba(0,240,255,0.3)'
              }}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (activeCategory) setActiveCategory(null); 
              }}
            >
              {activeCategory ? 'BACK' : 'CMD'}
            </div>

            {itemCount === 0 && (
               <div style={{
                position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
                fontSize: '11px', color: '#ff0055', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', border: '1px solid #ff0055'
               }}>
                 {activeCategory ? 'NO_ACTIONS_RSRC' : 'EMPTY_NODE'}
               </div>
            )}

            {renderItems.map((item: any, idx: number) => {
               const baseAngle = itemCount === 1 ? 0 : (idx * angleStep) - 90;
               const isLocked = isProcessing && activeCategory;
               const radius = activeCategory ? 120 : 96;
               return (
                <button
                  key={item.id} disabled={isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!activeCategory) {
                      setActiveCategory(item.id);
                    } else {
                      sendAction(item.id, undefined, radial.partId, targetSubjectId || undefined);
                      setRadial(null);
                      setActiveCategory(null);
                    }
                  }}
                  style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: \`translate(-50%, -50%) rotate(\${baseAngle}deg) translate(\${radius}px) rotate(\${-baseAngle}deg)\`,
                    width: activeCategory ? '130px' : '110px', 
                    height: '38px',
                    background: isLocked ? 'rgba(50, 0, 0, 0.9)' : 'rgba(0, 30, 30, 0.95)',
                    border: isLocked ? '1px solid #ff0055' : '1px solid #00f0ff',
                    color: isLocked ? '#ff0055' : '#00f0ff', 
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    fontSize: '11px', fontWeight: 'bold', padding: '0 12px',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                    clipPath: 'polygon(8% 0, 100% 0, 92% 100%, 0% 100%)',
                    boxShadow: '0 0 10px rgba(0,0,0,0.8)'
                  }}
                  title={item.label}
                >
                  {item.label}
                </button>
               );
            })}
            <div onClick={() => { setRadial(null); setActiveCategory(null); }} style={{ position: 'fixed', top: -2000, left: -2000, width: 4000, height: 4000, zIndex: -1 }} />
          </div>
        );
      })()}

      {/* ПРАВАЯ ПАНЕЛЬ: РЕСУРСЫ */}
      <div style={{
        position: 'absolute', bottom: '50px', right: '50px', color: '#00f0ff', textAlign: 'right',
        pointerEvents: 'none', borderRight: '3px solid #00f0ff', paddingRight: '20px',
        textShadow: '0 0 5px rgba(0,240,255,0.3)'
      }}>
        <div style={{ fontSize: '12px', opacity: 0.6, letterSpacing: '1px' }}>SYS_CALIBRATOR</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>v.0.2</div>
        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>TARGET_UID: {targetSubjectId || '[ NO LOCK ]'}</div>
        
        <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(0,20,20,0.8)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', textAlign: 'left', width: '180px', display: 'inline-block' }}>
           <div style={{ color: '#fff', fontSize: '10px', opacity: 0.6, marginBottom: '4px' }}>RESOURCES</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffaa00', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
             <span>ENERGY</span>
             <span style={{ color: '#fff' }}>{playerResources?.['energy'] || 0}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffaa00', fontSize: '14px', fontWeight: 'bold' }}>
             <span>ACTION_PTS</span>
             <span style={{ color: '#fff' }}>{playerResources?.['action_points'] || 0}</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DiegeticUI;
`;
fs.writeFileSync('./src/ui/DiegeticUI.tsx', txt);
