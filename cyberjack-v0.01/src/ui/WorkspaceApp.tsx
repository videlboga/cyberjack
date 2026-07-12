import React, { useState } from 'react';
import { CoreVisualizer } from './CoreVisualizer';
import { CalibrationPrototype } from './CalibrationPrototype';

export function WorkspaceApp() {
  const [view, setView] = useState<'core' | 'game'>('game');
  return <>
    <nav style={{position:'sticky',top:0,zIndex:20,display:'flex',gap:6,padding:'8px 16px',background:'#070c0f',borderBottom:'1px solid #26383f'}}>
      <button onClick={() => setView('core')} style={buttonStyle(view === 'core')}>Визуализация ядра</button>
      <button onClick={() => setView('game')} style={buttonStyle(view === 'game')}>Игровой прототип</button>
    </nav>
    {view === 'core' ? <CoreVisualizer/> : <CalibrationPrototype/>}
  </>;
}

const buttonStyle = (active: boolean): React.CSSProperties => ({padding:'9px 13px',border:`1px solid ${active ? '#6ed8bc' : '#314047'}`,background:active ? '#17332c' : '#11191d',color:active ? '#a4efdc' : '#9aa9ae',cursor:'pointer',fontWeight:700});
