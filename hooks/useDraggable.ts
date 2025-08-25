import { useState, useCallback, useEffect, useRef } from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface DragConstraints {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

function applyConstraints(position: Position, constraints?: DragConstraints): Position {
  if (!constraints) return position;
  
  return {
    x: Math.max(constraints.minX ?? -Infinity, Math.min(constraints.maxX ?? Infinity, position.x)),
    y: Math.max(constraints.minY ?? -Infinity, Math.min(constraints.maxY ?? Infinity, position.y))
  };
}

export function useDraggable(
  initialPosition: Position,
  onPositionChange?: (position: Position) => void,
  constraints?: DragConstraints,
  dragHandleSelector: string = '[data-draggable="true"]'
) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const dragHandle = target.closest(dragHandleSelector);
    
    if (dragHandle) {
      setIsDragging(true);
      const rect = elementRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }, [dragHandleSelector]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      const constrainedPosition = applyConstraints(
        { x: newX, y: newY },
        constraints
      );
      
      setPosition(constrainedPosition);
      onPositionChange?.(constrainedPosition);
    }
  }, [isDragging, dragOffset, onPositionChange, constraints]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const dragHandle = target.closest(dragHandleSelector);
    
    if (dragHandle && e.touches.length === 1) {
      setIsDragging(true);
      const rect = elementRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top
        });
      }
      e.preventDefault();
    }
  }, [dragHandleSelector]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const newX = e.touches[0].clientX - dragOffset.x;
      const newY = e.touches[0].clientY - dragOffset.y;
      
      const constrainedPosition = applyConstraints(
        { x: newX, y: newY },
        constraints
      );
      
      setPosition(constrainedPosition);
      onPositionChange?.(constrainedPosition);
      e.preventDefault();
    }
  }, [isDragging, dragOffset, onPositionChange, constraints]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      // Предотвращаем выделение текста во время перетаскивания
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Обновляем позицию при изменении initialPosition
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  return {
    position,
    isDragging,
    elementRef,
    handleMouseDown,
    handleTouchStart
  };
}

