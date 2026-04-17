import React, { useState, useMemo } from 'react';
import './AnatomyView.css';

interface AnatomyViewProps {
  subjectState: any;
  character: any;
  avatarUrl?: string | null;
  activeContexts: any[];
  onActionSelect: (pointId: string, actionId: string, intensity: number) => void;
  availablePoints: {id: string, label: string}[];
  availableActions: any[];
  playerInventory?: any[];
  sceneObjects?: any[];
  playerSector?: string | null;
  targetSector?: string | null;
}

const ACTION_GROUPS = [
  { id: 'medical', label: 'Медицинские', tags: ['medical', 'clinical', 'chemical', 'piercing', 'inspection'] },
  { id: 'intimate', label: 'Интимные', tags: ['intimate', 'sensual', 'stimulation', 'affection'] },
  { id: 'pain', label: 'Силовые', tags: ['impact', 'pain', 'punishment', 'dominance', 'struggle'] },
  { id: 'control', label: 'Контроль', tags: ['restraint', 'control', 'metal', 'electronic', 'pose', 'bdsm'] },
  { id: 'support', label: 'Поддержка', tags: ['mental', 'comfort', 'talk', 'trade', 'praise'] }
];

const ACTION_GROUP_OVERRIDES: Record<string, string> = {
  act_suspend_wrists: 'control', act_release_wrists: 'control',
  act_apply_handcuffs: 'control', act_remove_handcuffs: 'control',
  act_struggle_cuffs: 'control', gentle_stroke: 'support',
  tickle: 'support', feather_stroke: 'support', breath_blow: 'support',
  verbal_pressure: 'support', stare: 'support', close_inspection: 'support',
  light_kiss: 'intimate', deep_kiss: 'intimate', deep_massage: 'intimate',
  licking: 'intimate', vibrator_pulse: 'intimate', gentle_touch: 'intimate',
  firm_grip: 'pain', light_bite: 'pain', hard_bite: 'pain',
  pinch: 'pain', scratching: 'pain', slap: 'pain', hard_slap: 'pain',
  belt_strike: 'pain', whip_strike: 'pain', taser_shock: 'pain',
  feint_strike: 'pain', hair_pull: 'pain', spit: 'control',
  needle_prick: 'medical', ice_cube: 'medical', hot_wax: 'medical',
  pose_kneeling: 'control', restraint_cuffs: 'control'
};

const POINT_GROUPS = [
  { id: 'head', label: 'Голова и Шея', points: ['head', 'face', 'lips', 'neck'] },
  { id: 'torso', label: 'Торс', points: ['shoulders', 'chest', 'nipples', 'belly', 'back', 'waist'] },
  { id: 'limbs', label: 'Конечности', points: ['left_arm', 'right_arm', 'left_hand', 'right_hand', 'left_leg', 'right_leg', 'knees', 'feet', 'hips'] },
  { id: 'intimate', label: 'Чувствительные зоны', points: ['inner_thighs', 'buttocks', 'anus', 'groin', 'penis', 'testicles', 'prostate', 'vulva', 'vagina', 'clitoris'] },
  { id: 'system', label: 'Системы и Контекст', points: ['general', 'mind_state', 'global_pose', 'slot_pose', 'slot_room', 'slot_social'] }
];

const classifyPoint = (pointId: string) => {
  for (const group of POINT_GROUPS) {
    if (group.points.includes(pointId)) return group.id;
  }
  return 'system';
};

const classifyAction = (action: any): string | null => {
  if (ACTION_GROUP_OVERRIDES[action.id]) return ACTION_GROUP_OVERRIDES[action.id];
  const categories = action.categories || [];
  const baseTags = [...(action.tags || []), ...categories].map(t => t.toLowerCase());
  for (const group of ACTION_GROUPS) {
    if (baseTags.some(tag => group.tags.includes(tag))) return group.id;
  }
  if (action.requiresItem) return 'control';
  if (baseTags.length === 0) return 'pain';
  return null;
};

export function AnatomyView({ subjectState, character, avatarUrl, activeContexts, onActionSelect, availablePoints, availableActions, playerInventory = [], sceneObjects = [], playerSector, targetSector }: AnatomyViewProps) {
  const [selectedPoint, setSelectedPoint] = useState<string>('general');
  const [intensity, setIntensity] = useState<number>(1.0);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activePointGroup, setActivePointGroup] = useState<string | null>('system');
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);
  

  const getPointContexts = (point: string) => {
    return activeContexts.filter(c => c.targetPoint === point || (point === 'general' && !c.targetPoint));
  };

  const filteredAndGroupedActions = useMemo(() => {
    const sameSector = playerSector === targetSector;

    const valid = availableActions.filter(a => {
      if (a.type === 'system' || a.id.startsWith('sys_') || a.id === 'wait') return false;
      
      // Check limits from GameApp logic
      if (a.requiresItem && !playerInventory.some((item: any) => item.id === a.requiresItem)) return false;
      if (a.type === 'verbal') return false; // Maybe we want to hide verbal here too, since it is a physical scanner
      if (a.type === 'physical' && !sameSector) return false;

      if (a.requiresSceneObject) {
         const req = a.requiresSceneObject;
         const obj = sceneObjects.find((o: any) => o.itemId === req);
         if (!obj) return false;
         if (obj.nodeId && playerSector && obj.nodeId !== playerSector) return false;
      }

      if (a.requireContexts && a.requireContexts.length > 0) {
         const needed: string[] = a.requireContexts;
         const subjCtxs: string[] = (subjectState?.contexts || []).map((c: any) => c.actionId);
         const missing = needed.filter(n => !subjCtxs.includes(n));
         if (missing.length > 0) return false;
      }

      if (a.removeContexts && a.removeContexts.length > 0) {
         const needed: string[] = a.removeContexts;
         const subjCtxs: string[] = (subjectState?.contexts || []).map((c: any) => c.actionId);
         // Often removeContexts implies the context *must* be present to be removed (like act_remove_handcuffs needing cuffs present)
         // But in engine it actually checks contexts dynamically. Let's do basic intersection.
         const hasAnyToRemove = needed.some(n => subjCtxs.includes(n));
         if (!hasAnyToRemove) return false;
      }

      // Point check
      if (!selectedPoint) return !a.occupiesPoints || a.occupiesPoints.length === 0;
      return !a.occupiesPoints || a.occupiesPoints.length === 0 || a.occupiesPoints.includes(selectedPoint);
    });

    const groups: Record<string, any[]> = {};
    ACTION_GROUPS.forEach(g => { groups[g.id] = []; });
    
    valid.forEach(a => {
      const gid = classifyAction(a) || 'pain';
      if (!groups[gid]) groups[gid] = [];
      groups[gid].push(a);
    });
    
    return groups;
  }, [availableActions, selectedPoint, playerSector, targetSector, playerInventory, sceneObjects, subjectState]);

  const groupedPoints = useMemo(() => {
    const groups: Record<string, typeof availablePoints> = {};
    POINT_GROUPS.forEach(g => { groups[g.id] = []; });
    availablePoints.forEach(pt => {
        const gid = classifyPoint(pt.id);
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(pt);
    });
    return groups;
  }, [availablePoints]);

  return (
    <div className="anatomy-overlay">
      <div className="anatomy-panel left-panel">
        <h3 className="panel-title">Сканер Анатомии</h3>
        <div className="points-accordion actions-accordion">
          {POINT_GROUPS.map(group => {
            const points = groupedPoints[group.id];
            if (!points || points.length === 0) return null;
            const isOpen = activePointGroup === group.id;
            return (
              <div key={group.id} className="action-group">
                <button className="group-header" onClick={() => setActivePointGroup(isOpen ? null : group.id)}>
                   {group.label} ({points.length})
                </button>
                {isOpen && (
                  <div className="points-list actions-list" style={{ padding: '4px 0', border: 'none', background: 'transparent' }}>
                    {points.map(pt => (
                      <button 
                        key={pt.id} 
                        className={`point-btn ${selectedPoint === pt.id ? 'active' : ''}`}
                        onClick={() => setSelectedPoint(pt.id)}
                      >
                        <span>{pt.label}</span>
                        {getPointContexts(pt.id).length > 0 && <span className="point-badge">{getPointContexts(pt.id).length}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="anatomy-panel center-panel">
        <h3 className="panel-title">Доступные воздействия</h3>
        <div className="point-details">
          <h4>Точка: {availablePoints.find(p=>p.id===selectedPoint)?.label || selectedPoint}</h4>
          <div className="point-contexts">
             {getPointContexts(selectedPoint).map(ctx => (
                <div key={ctx.id} className="ctx-chip">{ctx.label || ctx.type}</div>
             ))}
             {getPointContexts(selectedPoint).length === 0 && <div className="ctx-empty">Нет эффектов или контекстов</div>}
          </div>
        </div>
        <div className="intensity-slider" style={{ marginBottom: 12 }}>
          <label>Интенсивность: {intensity.toFixed(1)}</label>
          <input type="range" min="0.1" max="2.0" step="0.1" value={intensity} onChange={e => setIntensity(parseFloat(e.target.value))} />
        </div>
        <div className="actions-accordion">
          {ACTION_GROUPS.map(group => {
             const acts = filteredAndGroupedActions[group.id];
             if (!acts || acts.length === 0) return null;
             const isOpen = activeGroup === group.id;
             return (
               <div key={group.id} className="action-group">
                 <button className="group-header" onClick={() => setActiveGroup(isOpen ? null : group.id)}>
                   {group.label} ({acts.length})
                 </button>
                 {isOpen && (
                   <div className="actions-list">
                     {acts.map(act => (
                        <button key={act.id} className="action-btn" onClick={() => onActionSelect(selectedPoint, act.id, intensity)}>
                          {act.label}
                        </button>
                     ))}
                   </div>
                 )}
               </div>
             );
          })}
        </div>
      </div>
      
      <div className="anatomy-panel right-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #334155', paddingBottom: 8 }}>
          <h3 className="panel-title" style={{ margin: 0, border: 'none', padding: 0 }}>Core Telemetry</h3>
          <button 
            className="action-btn" 
            style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', borderColor: '#4f46e5' }}
            onClick={() => setShowTelemetry(!showTelemetry)}
          >
            {showTelemetry ? 'Скрыть графики' : 'Показать графики'}
          </button>
        </div>
        
        <div className="avatar-container" style={avatarUrl ? {
          flexGrow: 1, 
          position: 'relative', 
          background: `url("${avatarUrl}") center/cover`, 
          borderRadius: 8, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', overflow: 'hidden', minHeight: '380px', width: '100%' } : { 
          flexGrow: 1, 
          position: 'relative', 
          background: '#0f172a', 
          borderRadius: 8, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', overflow: 'hidden', minHeight: '380px', width: '100%' }}>
           {!avatarUrl && <div style={{ fontSize: 40, opacity: 0.5 }}>👤</div>}
           
           <div className={`telemetry-overlay ${showTelemetry ? 'visible' : ''}`} style={{ zIndex: 1 }}>
              <div className="character-card-header" style={{ marginBottom: '16px' }}>
                <div>
                  <span className="card-label" style={{ color: '#94a3b8', fontSize: '12px' }}>Фокус</span>
                  <h3 style={{ margin: 0 }}>{character?.name}</h3>
                </div>
              </div>
             <div className="telemetry-bar">
               <label>Tension (Напряжение)</label>
               <div className="bar"><div className="bar-fill" style={{width: `${Math.min(100, Math.max(0, subjectState?.tension || 0))}%`, background: '#ef4444'}}></div></div>
             </div>
             <div className="telemetry-bar">
               <label>Sensitivity (Чувствительность)</label>
               <div className="bar"><div className="bar-fill" style={{width: `${Math.min(100, Math.max(0, subjectState?.sensitivity || 0))}%`, background: '#f87171'}}></div></div>
             </div>
             <div className="telemetry-bar">
               <label>Capacity (Выносливость)</label>
               <div className="bar"><div className="bar-fill" style={{width: `${Math.min(100, Math.max(0, subjectState?.capacity || 0))}%`, background: '#60a5fa'}}></div></div>
             </div>
             <div className="telemetry-bar">
               <label>Attitude (Отношение)</label>
               <div className="bar"><div className="bar-fill" style={{width: `${Math.min(100, Math.max(0, subjectState?.attitude || 0))}%`, background: '#34d399'}}></div></div>
             </div>
             <div className="telemetry-bar">
               <label>Openness (Открытость)</label>
               <div className="bar"><div className="bar-fill" style={{width: `${Math.min(100, Math.max(0, subjectState?.openness || 0))}%`, background: '#fbbf24'}}></div></div>
             </div>
             <div className="telemetry-bar">
               <label>Plasticity (Пластичность)</label>
               <div className="bar"><div className="bar-fill" style={{width: `${Math.min(100, Math.max(0, subjectState?.plasticity || 0))}%`, background: '#a78bfa'}}></div></div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
