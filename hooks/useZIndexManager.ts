import { useCallback, useEffect } from 'react';

class ZIndexManager {
  private static instance: ZIndexManager;
  private baseZIndex = 1000;
  private activePanels = new Map<string, number>();

  static getInstance(): ZIndexManager {
    if (!ZIndexManager.instance) {
      ZIndexManager.instance = new ZIndexManager();
    }
    return ZIndexManager.instance;
  }

  getZIndex(panelId: string): number {
    if (!this.activePanels.has(panelId)) {
      const maxZIndex = Math.max(...this.activePanels.values(), this.baseZIndex);
      this.activePanels.set(panelId, maxZIndex + 1);
    }
    return this.activePanels.get(panelId)!;
  }

  bringToFront(panelId: string): number {
    const maxZIndex = Math.max(...this.activePanels.values(), this.baseZIndex);
    const newZIndex = maxZIndex + 1;
    this.activePanels.set(panelId, newZIndex);
    return newZIndex;
  }

  removePanel(panelId: string): void {
    this.activePanels.delete(panelId);
  }

  getActivePanels(): string[] {
    return Array.from(this.activePanels.keys());
  }

  reset(): void {
    this.activePanels.clear();
  }
}

export function useZIndexManager(panelId: string) {
  const manager = ZIndexManager.getInstance();
  
  const bringToFront = useCallback(() => {
    return manager.bringToFront(panelId);
  }, [panelId]);

  const getZIndex = useCallback(() => {
    return manager.getZIndex(panelId);
  }, [panelId]);

  const removePanel = useCallback(() => {
    manager.removePanel(panelId);
  }, [panelId]);

  useEffect(() => {
    // Автоматически выводим панель на передний план при фокусе
    const handleFocus = () => {
      bringToFront();
    };

    const element = document.querySelector(`[data-panel-id="${panelId}"]`);
    if (element) {
      element.addEventListener('focus', handleFocus);
      element.addEventListener('click', handleFocus);
      
      return () => {
        element.removeEventListener('focus', handleFocus);
        element.removeEventListener('click', handleFocus);
      };
    }
  }, [panelId, bringToFront]);

  useEffect(() => {
    return () => {
      manager.removePanel(panelId);
    };
  }, [panelId]);

  return { 
    getZIndex, 
    bringToFront, 
    removePanel,
    getActivePanels: manager.getActivePanels.bind(manager)
  };
}

