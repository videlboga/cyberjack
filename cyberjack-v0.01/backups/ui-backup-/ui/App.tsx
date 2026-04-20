import React, { useState } from 'react';
import { DevApp } from './DevApp';
import { GameApp } from './GameApp';

export function App() {
  const [isDevMode, setIsDevMode] = useState(false);

  return (
    <>
      <button 
        style={{
          position: 'fixed', 
          bottom: 10, 
          left: 10, 
          zIndex: 9999, 
          padding: '4px 8px',
          background: '#000',
          color: '#0f0',
          border: '1px solid #0f0',
          cursor: 'pointer',
          borderRadius: 4
        }}
        onClick={() => setIsDevMode(!isDevMode)}
      >
        DEV: {isDevMode ? 'ON' : 'OFF'}
      </button>
      {isDevMode ? <DevApp /> : <GameApp />}
    </>
  );
}
