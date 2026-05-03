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
    let synch = 50.0;
    let status = 'UNKNOWN';
    let label = id.toUpperCase();
    
    if (subjectState && subjectState.points) {
      const ptState = subjectState.points[id];
      if (ptState) {
        synch = ptState.attitude !== undefined ? ptState.attitude : ((ptState.local_attitude ?? 50) + (ptState.local_sensitivity ?? 50)) / 2;
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
                <div style={{ width: \`\${Math.max(0, Math.min(100, stat.val || 0))}%\`, height: '100%', background: '#00f0ff' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* НИЖНЯЯ ПАНЕЛЬ: ЛОГИ */}
      <div style={{
        position: 'absolute', bottom: '30px', left: '30px', width: '450px',
        pointerEvents: 'none', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px'
      }}>
        {messages.slice(-6).map((m, i) => (
          <div key={i} style={{ 
            background: 'rgba(0, 20, 25, 0.85)', 
            borderLeft: m.role === 'narrator' ? '2px solid #00f0ff' : '2px solid #ff0055',
            padding: '8px 12px', color: m.role === 'narrator' ? '#ccffff' : '#ffaaaa',
            textShadow: '0 0 2px rgba(0,0,0,0.8)'
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
            background: 'linear-gradient(135deg, rgba(0, 40, 40, 0.9) 0%, rgba(0, 20, 25, 0.95) 100%)',
            border: '1px solid #00f0ff', borderRadius: '2px', padding: '12px', minWidth: '180px',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)', pointerEvents: 'none'
          }}>
            <div style={{ position: 'absolute', top: -1, left: -1, width: 10, height: 10, borderLeft: '3px solid #00f0ff', borderTop: '3px solid #00f0ff' }} />
            <div style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '2px' }}>NODE_ID: {hover.partId.toUpperCase()}</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>{stats.label}</div>
            
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                <span>SYNC_RATE</span><span>{stats.synch}%</span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(0, 240, 255, 0.1)' }}>
                <div style={{ width: \`\${Math.max(0, Math.min(100, stats.synch))}%\`, height: '100%', background: '#00f0ff', boxShadow: '0 0 5px #00f0ff' }} />
              </div>
            </div>

            <div style={{ fontSize: '11px', marginTop: '12px', color: stats.status === 'OPTIMAL' ? '#00ffaa' : (stats.status === 'STABLE' ? '#00f0ff' : '#ff0055') }}>
              STATUS: {stats.status}
            </div>
            
            {subjectState?.points && subjectState.points[hover.partId] && (
              <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.5, borderTop: '1px solid rgba(0,240,255,0.2)', paddingTop: '4px' }}>
                L_ATT: {subjectState.points[hover.partId]?.local_attitude?.toFixed(1) || '0'} | L_SENS: {subjectState.points[hover.partId]?.local_sensitivity?.toFixed(1) || '0'}
              </div>
            )}
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
              position: 'absolute', left: radial.x, top: radial.y, transform: 'translate(-50%, -50%)',
              width: '340px', height: '340px', pointerEvents: 'auto'
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
                    width: activeCategory ? '120px' : '100px', 
                    height: '34px',
                    background: isLocked ? 'rgba(50, 0, 0, 0.9)' : 'rgba(0, 20, 20, 0.9)',
                    border: isLocked ? '1px solid #ff0055' : '1px solid #00f0ff',
                    color: isLocked ? '#ff0055' : '#00f0ff', 
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    fontSize: '10px', fontWeight: 'bold', padding: '0 10px',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                    clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)'
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
        position: 'absolute', bottom: '30px', right: '30px', color: '#00f0ff', textAlign: 'right',
        pointerEvents: 'none', borderRight: '2px solid #00f0ff', paddingRight: '15px'
      }}>
        <div style={{ fontSize: '10px', opacity: 0.5 }}>STATUS: ACTIVE</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>SYSTEM_CALIBRATOR_v.0.2</div>
        <div style={{ fontSize: '10px', opacity: 0.8 }}>TARGET UID: {targetSubjectId || 'AWAITING_LOCK'}</div>
        <div style={{ marginTop: '15px', color: '#ffaa00', fontSize: '12px' }}>
          RSRC_ENERGY: {playerResources?.['energy'] || 0}
        </div>
        <div style={{ color: '#ffaa00', fontSize: '12px' }}>
          RSRC_AP: {playerResources?.['action_points'] || 0}
        </div>
      </div>
    </div>
  );
};

export default DiegeticUI;
`;
fs.writeFileSync('./src/ui/DiegeticUI.tsx', txt);
