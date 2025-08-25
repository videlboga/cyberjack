'use client';

import React, { useState, useEffect } from 'react';
import { X, Minimize2, Maximize2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraggable, Position, DragConstraints } from '@/hooks/useDraggable';
import { useZIndexManager } from '@/hooks/useZIndexManager';
import { usePanelPosition, PanelLayout } from '@/hooks/usePanelPosition';

export interface FloatingPanelProps {
  children: React.ReactNode;
  title: string;
  panelId: string;
  onClose: () => void;
  defaultPosition?: Position;
  defaultLayout?: Partial<PanelLayout>;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  showControls?: boolean;
  resizable?: boolean;
  closable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
}

export function FloatingPanel({
  children,
  title,
  panelId,
  onClose,
  defaultPosition = { x: 100, y: 100 },
  defaultLayout,
  minWidth = 300,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 600,
  className = "",
  showControls = true,
  resizable = false,
  closable = true,
  minimizable = true,
  maximizable = true
}: FloatingPanelProps) {
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  
  // Получаем размеры экрана для ограничений
  useEffect(() => {
    const updateSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Управление позицией и состоянием панели
  const {
    position,
    isMinimized,
    isMaximized,
    updatePosition,
    toggleMinimize,
    toggleMaximize
  } = usePanelPosition(panelId, defaultPosition, defaultLayout);

  // Управление z-index
  const { getZIndex, bringToFront } = useZIndexManager(panelId);

  // Ограничения для перетаскивания
  const constraints: DragConstraints = {
    minX: 0,
    maxX: screenSize.width - minWidth,
    minY: 0,
    maxY: screenSize.height - minHeight
  };

  // Drag & drop функциональность
  const { isDragging, elementRef, handleMouseDown, handleTouchStart } = useDraggable(
    position,
    updatePosition,
    constraints
  );

  // Приводим панель на передний план при клике
  const handlePanelClick = () => {
    bringToFront();
  };

  // Обработка закрытия
  const handleClose = () => {
    if (closable) {
      onClose();
    }
  };

  // Определяем размеры панели
  const getPanelStyles = () => {
    if (isMaximized) {
      return {
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        zIndex: getZIndex()
      };
    }

    if (isMinimized) {
      return {
        left: position.x,
        top: position.y,
        width: minWidth,
        height: 'auto',
        zIndex: getZIndex()
      };
    }

    return {
      left: position.x,
      top: position.y,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      zIndex: getZIndex()
    };
  };

  return (
    <div
      ref={elementRef}
      data-panel-id={panelId}
      className={cn(
        "fixed bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg",
        "transition-all duration-200 ease-out",
        isDragging && "scale-[1.02] shadow-xl",
        isMinimized && "min-h-0",
        isMaximized && "rounded-none",
        className
      )}
      style={getPanelStyles()}
      onClick={handlePanelClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      tabIndex={0}
    >
      {/* Заголовок панели */}
      <div
        className={cn(
          "flex items-center justify-between p-3 border-b border-border/50 select-none",
          isMinimized ? "cursor-pointer" : "cursor-move"
        )}
        data-draggable="true"
      >
        <h3 className="font-semibold text-foreground truncate flex-1">
          {title}
        </h3>
        
        {showControls && (
          <div className="flex items-center gap-1 ml-2">
            {minimizable && (
              <button
                onClick={toggleMinimize}
                className="p-1 hover:bg-muted rounded transition-colors"
                aria-label={isMinimized ? "Развернуть" : "Свернуть"}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </button>
            )}
            
            {maximizable && !isMinimized && (
              <button
                onClick={toggleMaximize}
                className="p-1 hover:bg-muted rounded transition-colors"
                aria-label={isMaximized ? "Восстановить" : "Развернуть"}
              >
                {isMaximized ? <Square className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
            
            {closable && (
              <button
                onClick={handleClose}
                className="p-1 hover:bg-muted rounded transition-colors"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Содержимое панели */}
      {!isMinimized && (
        <div className="p-4 overflow-auto">
          {children}
        </div>
      )}
    </div>
  );
}

