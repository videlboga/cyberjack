# 🎯 Лучшие практики реализации плавающих панелей

## 📋 Анализ текущей реализации

### ✅ Что уже хорошо:
- Использование `position: fixed` для плавающих элементов
- Обработка drag & drop через mouse events
- Разделение логики перетаскивания и контента
- Использование `useCallback` для оптимизации

### ❌ Что можно улучшить:
- Дублирование кода drag & drop логики
- Отсутствие границ экрана
- Нет сохранения позиций
- Отсутствие z-index управления
- Нет анимаций и переходов

## 🏆 Лучшие практики

### 1. **Создание переиспользуемого хука для drag & drop**

```typescript
// hooks/useDraggable.ts
export function useDraggable(
  initialPosition: Position,
  onPositionChange?: (position: Position) => void,
  constraints?: DragConstraints
) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-draggable="true"]')) {
      setIsDragging(true);
      const rect = elementRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Применяем ограничения
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

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    position,
    isDragging,
    elementRef,
    handleMouseDown
  };
}
```

### 2. **Компонент-обертка для плавающих панелей**

```typescript
// components/ui/FloatingPanel.tsx
interface FloatingPanelProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  position?: Position;
  onPositionChange?: (position: Position) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  zIndex?: number;
}

export function FloatingPanel({
  children,
  title,
  onClose,
  position = { x: 100, y: 100 },
  onPositionChange,
  minWidth = 300,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 600,
  className = "",
  zIndex = 1000
}: FloatingPanelProps) {
  const constraints = {
    minX: 0,
    maxX: window.innerWidth - minWidth,
    minY: 0,
    maxY: window.innerHeight - minHeight
  };

  const { position: currentPosition, isDragging, elementRef, handleMouseDown } = useDraggable(
    position,
    onPositionChange,
    constraints
  );

  return (
    <div
      ref={elementRef}
      className={cn(
        "fixed bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg",
        "transition-all duration-200 ease-out",
        isDragging && "scale-[1.02] shadow-xl",
        className
      )}
      style={{
        left: currentPosition.x,
        top: currentPosition.y,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        zIndex
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="flex items-center justify-between p-3 border-b border-border/50 cursor-move select-none"
        data-draggable="true"
      >
        <h3 className="font-semibold text-foreground">{title}</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 overflow-auto">
        {children}
      </div>
    </div>
  );
}
```

### 3. **Менеджер z-index для управления слоями**

```typescript
// hooks/useZIndexManager.ts
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
}

export function useZIndexManager(panelId: string) {
  const manager = ZIndexManager.getInstance();
  
  const bringToFront = useCallback(() => {
    return manager.bringToFront(panelId);
  }, [panelId]);

  const getZIndex = useCallback(() => {
    return manager.getZIndex(panelId);
  }, [panelId]);

  useEffect(() => {
    return () => {
      manager.removePanel(panelId);
    };
  }, [panelId]);

  return { getZIndex, bringToFront };
}
```

### 4. **Сохранение позиций в localStorage**

```typescript
// hooks/usePanelPosition.ts
interface PanelPosition {
  x: number;
  y: number;
}

export function usePanelPosition(panelId: string, defaultPosition: PanelPosition) {
  const [position, setPosition] = useState<PanelPosition>(() => {
    if (typeof window === 'undefined') return defaultPosition;
    
    const saved = localStorage.getItem(`panel-position-${panelId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultPosition;
      }
    }
    return defaultPosition;
  });

  const updatePosition = useCallback((newPosition: PanelPosition) => {
    setPosition(newPosition);
    localStorage.setItem(`panel-position-${panelId}`, JSON.stringify(newPosition));
  }, [panelId]);

  return [position, updatePosition] as const;
}
```

### 5. **Анимации и переходы**

```css
/* styles/floating-panels.css */
.floating-panel {
  animation: panelEnter 0.3s ease-out;
}

.floating-panel.closing {
  animation: panelExit 0.2s ease-in;
}

@keyframes panelEnter {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes panelExit {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

.panel-drag-handle {
  cursor: grab;
}

.panel-drag-handle:active {
  cursor: grabbing;
}
```

### 6. **Адаптивность и мобильная поддержка**

```typescript
// hooks/useResponsivePanel.ts
export function useResponsivePanel() {
  const [isMobile, setIsMobile] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setScreenSize({ width, height });
      setIsMobile(width < 768);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const getPanelConstraints = useCallback(() => {
    if (isMobile) {
      return {
        minX: 0,
        maxX: screenSize.width - 320,
        minY: 0,
        maxY: screenSize.height - 400
      };
    }
    return {
      minX: 0,
      maxX: screenSize.width - 400,
      minY: 0,
      maxY: screenSize.height - 500
    };
  }, [isMobile, screenSize]);

  return { isMobile, screenSize, getPanelConstraints };
}
```

### 7. **Горячие клавиши и доступность**

```typescript
// hooks/usePanelHotkeys.ts
export function usePanelHotkeys(
  panelId: string,
  onClose: () => void,
  onToggle?: () => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC для закрытия
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Ctrl/Cmd + ` для переключения
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        onToggle?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onToggle]);
}
```

## 🎨 Рекомендуемая архитектура

### Структура компонентов:
```
components/
├── ui/
│   ├── FloatingPanel.tsx          # Базовая плавающая панель
│   ├── PanelManager.tsx           # Менеджер всех панелей
│   └── PanelContainer.tsx         # Контейнер для панелей
├── panels/
│   ├── ActionToolPanel.tsx        # Панель действий
│   ├── CharacterChat.tsx          # Чат персонажа
│   └── SettingsPanel.tsx          # Панель настроек
└── hooks/
    ├── useDraggable.ts            # Хук для перетаскивания
    ├── useZIndexManager.ts        # Управление слоями
    ├── usePanelPosition.ts        # Сохранение позиций
    └── useResponsivePanel.ts      # Адаптивность
```

### Преимущества такой архитектуры:
- ✅ Переиспользуемость компонентов
- ✅ Централизованное управление
- ✅ Легкое тестирование
- ✅ Хорошая производительность
- ✅ Доступность и UX
- ✅ Адаптивность

## 🚀 Следующие шаги

1. **Создать базовые хуки** (useDraggable, useZIndexManager)
2. **Реализовать FloatingPanel** компонент
3. **Рефакторить существующие панели** для использования новой архитектуры
4. **Добавить анимации и переходы**
5. **Реализовать сохранение позиций**
6. **Добавить горячие клавиши**
7. **Протестировать на мобильных устройствах**

