import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

interface HoverData {
  partId: string;
  x: number;
  y: number;
}

const DiegeticUI = () => {
  const [hover, setHover] = useState<HoverData | null>(null);
  const [radial, setRadial] = useState<{partId: string, x: number, y: number} | null>(null);

  useEffect(() => {
    // Шлюз для Unity
    (window as any).CyberjackUI = {
      showHoverInfo: (partId: string, x: number, y: number) => {
        setHover({ partId, x, y });
      },
      hideHoverInfo: () => {
        setHover(null);
      },
      showRadialMenu: (partId: string, x: number, y: number) => {
        setRadial({ partId, x, y });
      },
      hideRadialMenu: () => {
        setRadial(null);
      }
    };

    // Очистка при размонтировании
    return () => { delete (window as any).CyberjackUI; };
  }, []);

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: 'transparent', 
      overflow: 'hidden',
      position: 'relative',
      pointerEvents: 'none', // Пропускаем клики сквозь прозрачность к Unity
      fontFamily: 'monospace'
    }}>
      
      {/* ПЛАВАЮЩАЯ ПАНЕЛЬ ИНФОРМАЦИИ (HOVER) */}
      {hover && (
        <div style={{
          position: 'absolute',
          left: hover.x,
          top: hover.y,
          transform: 'translate(-50%, -120%)',
          background: 'rgba(0, 20, 20, 0.85)',
          border: '1px solid #00f0ff',
          borderRadius: '4px',
          padding: '8px 12px',
          color: '#00f0ff',
          boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)',
          pointerEvents: 'none',
          minWidth: '150px'
        }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>ANALYZING POINT...</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>[{hover.partId.toUpperCase()}]</div>
          <div style={{ height: '1px', background: '#00f0ff', margin: '6px 0', opacity: 0.5 }}></div>
          <div style={{ fontSize: '12px' }}>STATUS: <span style={{ color: '#fff' }}>STABLE</span></div>
          <div style={{ fontSize: '12px' }}>SYNC: <span style={{ color: '#fff' }}>94%</span></div>
        </div>
      )}

      {/* РАДИАЛЬНОЕ МЕНЮ (CLICK) */}
      {radial && (
        <div 
          onClick={() => setRadial(null)} // Закрыть по клику на фон (если pointer-events включены будут)
          style={{
            position: 'absolute',
            left: radial.x,
            top: radial.y,
            transform: 'translate(-50%, -50%)',
            width: '200px',
            height: '200px',
            pointerEvents: 'auto' // Здесь клики нужны
          }}
        >
           {/* Временная заглушка круга */}
           <div style={{
             width: '100%',
             height: '100%',
             borderRadius: '50%',
             border: '2px solid #ff00ff',
             background: 'rgba(255, 0, 255, 0.1)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             color: '#ff00ff',
             fontSize: '12px',
             textAlign: 'center'
           }}>
             RADIAL MENU<br/>[{radial.partId}]
           </div>
        </div>
      )}

      {/* ГЛОБАЛЬНЫЙ HUD (ДЛЯ ТЕСТА) */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: '#00f0ff',
        background: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderLeft: '3px solid #00f0ff',
        pointerEvents: 'none'
      }}>
        SYSTEM: CALIBRATOR_OS v0.1<br/>
        STATUS: LINK_ESTABLISHED
      </div>
    </div>
  );
};

export default DiegeticUI;
