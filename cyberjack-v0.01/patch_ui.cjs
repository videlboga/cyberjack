const fs = require('fs');
const file = 'src/ui/App.tsx';
let txt = fs.readFileSync(file, 'utf-8');

const badgesFunc = `
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
`;

txt = txt.replace('  if (!state) return <div>Загрузка состояния... (Убедитесь, что npx tsx src/api/server.ts запущен)</div>;', 
'  if (!state) return <div>Загрузка состояния... (Убедитесь, что npx tsx src/api/server.ts запущен)</div>;\n' + badgesFunc);

const oldStats = `              <div>Sensitivity: {state.sensitivity?.toFixed(1)}</div>
              <div>Attitude: {state.attitude?.toFixed(1)}</div>
              <div>Capacity: {state.capacity?.toFixed(1)}</div>`;
              
const newStats = `              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sensitivity:</span> <strong>{state.sensitivity?.toFixed(1)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Attitude:</span> <strong>{state.attitude?.toFixed(1)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: state.capacity < 30 ? '#e74c3c' : 'inherit' }}><span>Capacity:</span> <strong>{state.capacity?.toFixed(1)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Openness:</span> <strong>{state.openness?.toFixed(1) ?? 'N/A'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Plasticity:</span> <strong>{state.plasticity?.toFixed(1) ?? 'N/A'}</strong></div>
              <div style={{ marginTop: 15, paddingTop: 10, borderTop: '1px solid #555' }}>
                <strong style={{ fontSize: '0.9em', color: '#999' }}>МЕНТАЛЬНЫЕ ЭФФЕКТЫ:</strong><br/>
                {renderBadges()}
              </div>`;

txt = txt.replace(oldStats, newStats);

fs.writeFileSync(file, txt);
console.log("Patched App.tsx successfully");
