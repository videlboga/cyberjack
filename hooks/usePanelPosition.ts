import { useState, useCallback, useEffect } from 'react';
import { Position } from './useDraggable';

export interface PanelPosition extends Position {
  width?: number;
  height?: number;
}

export interface PanelLayout {
  position: PanelPosition;
  isMinimized?: boolean;
  isMaximized?: boolean;
}

export function usePanelPosition(
  panelId: string, 
  defaultPosition: PanelPosition,
  defaultLayout?: Partial<PanelLayout>
) {
  const [layout, setLayout] = useState<PanelLayout>(() => {
    if (typeof window === 'undefined') {
      return {
        position: defaultPosition,
        isMinimized: false,
        isMaximized: false,
        ...defaultLayout
      };
    }
    
    const saved = localStorage.getItem(`panel-layout-${panelId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          position: defaultPosition,
          isMinimized: false,
          isMaximized: false,
          ...defaultLayout,
          ...parsed
        };
      } catch {
        return {
          position: defaultPosition,
          isMinimized: false,
          isMaximized: false,
          ...defaultLayout
        };
      }
    }
    
    return {
      position: defaultPosition,
      isMinimized: false,
      isMaximized: false,
      ...defaultLayout
    };
  });

  const updatePosition = useCallback((newPosition: PanelPosition) => {
    setLayout(prev => {
      const updated = {
        ...prev,
        position: newPosition
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`panel-layout-${panelId}`, JSON.stringify(updated));
      }
      
      return updated;
    });
  }, [panelId]);

  const updateLayout = useCallback((newLayout: Partial<PanelLayout>) => {
    setLayout(prev => {
      const updated = {
        ...prev,
        ...newLayout
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`panel-layout-${panelId}`, JSON.stringify(updated));
      }
      
      return updated;
    });
  }, [panelId]);

  const toggleMinimize = useCallback(() => {
    updateLayout({ 
      isMinimized: !layout.isMinimized,
      isMaximized: false 
    });
  }, [layout.isMinimized, updateLayout]);

  const toggleMaximize = useCallback(() => {
    updateLayout({ 
      isMaximized: !layout.isMaximized,
      isMinimized: false 
    });
  }, [layout.isMaximized, updateLayout]);

  const resetPosition = useCallback(() => {
    const resetLayout = {
      position: defaultPosition,
      isMinimized: false,
      isMaximized: false,
      ...defaultLayout
    };
    
    setLayout(resetLayout);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`panel-layout-${panelId}`, JSON.stringify(resetLayout));
    }
  }, [panelId, defaultPosition, defaultLayout]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      // Можно добавить логику очистки при необходимости
    };
  }, [panelId]);

  return {
    layout,
    position: layout.position,
    isMinimized: layout.isMinimized,
    isMaximized: layout.isMaximized,
    updatePosition,
    updateLayout,
    toggleMinimize,
    toggleMaximize,
    resetPosition
  };
}

