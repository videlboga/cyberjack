// Единые типы для всех unified компонентов

// ============================================================================
// БАЗОВЫЕ ТИПЫ
// ============================================================================

export interface BaseComponentProps {
  className?: string
  disabled?: boolean
  loading?: boolean
  error?: string | null
}

export interface BaseSelectableProps {
  value: string | number | boolean
  onChange: (value: string | number | boolean) => void
  placeholder?: string
  required?: boolean
}

export interface BaseValidatableProps {
  isValid?: boolean
  validationError?: string
  onValidationChange?: (isValid: boolean, error?: string) => void
}

// ============================================================================
// СЕЛЕКТОРЫ
// ============================================================================

export interface SelectorOption {
  value: string | number
  label: string
  description?: string
  category?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SelectorProps extends BaseComponentProps, BaseSelectableProps {
  options: SelectorOption[]
  multiple?: boolean
  searchable?: boolean
  clearable?: boolean
  loading?: boolean
  emptyMessage?: string
  onSearch?: (query: string) => void
}

export interface AttributeSelectorProps extends SelectorProps {
  entityType: 'asset' | 'player' | 'scene'
  entityId?: string
  attributeType?: 'numeric' | 'string' | 'boolean' | 'array'
  category?: string
}

export interface EntitySelectorProps extends SelectorProps {
  entityType: 'asset' | 'user' | 'equipment' | 'station' | 'story_point'
  filter?: (entity: any) => boolean
  displayField?: string
  valueField?: string
}

export interface OperatorSelectorProps extends SelectorProps {
  valueType: 'numeric' | 'string' | 'boolean' | 'array'
  supportedOperators?: string[]
}

// ============================================================================
// ПОСТРОИТЕЛИ
// ============================================================================

export interface BuilderField {
  id: string
  name: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'array'
  label: string
  description?: string
  required?: boolean
  validation?: {
    min?: number
    max?: number
    pattern?: string
    custom?: (value: any) => boolean
  }
  options?: SelectorOption[]
}

export interface BuilderProps extends BaseComponentProps {
  fields: BuilderField[]
  data: Record<string, any>
  onDataChange: (data: Record<string, any>) => void
  onValidationChange?: (isValid: boolean, errors: string[]) => void
  mode?: 'create' | 'edit' | 'view'
}

export interface ConditionBuilderProps extends BuilderProps {
  condition: any
  onConditionChange: (condition: any) => void
  assets?: any[]
  users?: any[]
}

// ============================================================================
// ПАНЕЛИ
// ============================================================================

export interface PanelProps extends BaseComponentProps {
  title?: string
  subtitle?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  actions?: React.ReactNode
  onToggle?: (collapsed: boolean) => void
}

export interface FloatingPanelProps extends PanelProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  draggable?: boolean
  resizable?: boolean
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  onPositionChange?: (position: { x: number; y: number }) => void
  onSizeChange?: (size: { width: number; height: number }) => void
}

export interface StatsPanelProps extends PanelProps {
  stats: Array<{
    label: string
    value: string | number
    change?: number
    trend?: 'up' | 'down' | 'neutral'
    color?: string
  }>
  layout?: 'grid' | 'list' | 'cards'
  showTrends?: boolean
  showChanges?: boolean
}

// ============================================================================
// ВВОДЫ
// ============================================================================

export interface InputProps extends BaseComponentProps, BaseSelectableProps, BaseValidatableProps {
  type: 'text' | 'number' | 'email' | 'password' | 'url' | 'tel' | 'date' | 'time' | 'datetime-local'
  min?: number
  max?: number
  step?: number
  pattern?: string
  autoComplete?: string
  autoFocus?: boolean
  readOnly?: boolean
  onFocus?: (event: React.FocusEvent) => void
  onBlur?: (event: React.FocusEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
}

export interface ValueInputProps extends InputProps {
  attributeType: 'numeric' | 'string' | 'boolean' | 'array'
  operator: string
  options?: SelectorOption[]
  allowCustom?: boolean
  onOptionsChange?: (options: SelectorOption[]) => void
}

// ============================================================================
// УВЕДОМЛЕНИЯ
// ============================================================================

export interface NotificationProps extends BaseComponentProps {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  dismissible?: boolean
  onDismiss?: () => void
  actions?: React.ReactNode
}

export interface StatNotificationProps extends NotificationProps {
  stat: {
    label: string
    value: string | number
    previousValue?: string | number
    change?: number
    trend?: 'up' | 'down' | 'neutral'
  }
  threshold?: number
  showPercentage?: boolean
  showTrend?: boolean
}

// ============================================================================
// УТИЛИТЫ
// ============================================================================

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export interface ComponentState {
  loading: boolean
  error: string | null
  data: any
  validation: ValidationResult
}

export interface ComponentActions {
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setData: (data: any) => void
  setValidation: (validation: ValidationResult) => void
  reset: () => void
}

// ============================================================================
// ТЕМЫ И СТИЛИ
// ============================================================================

export interface ThemeConfig {
  primary: string
  secondary: string
  success: string
  warning: string
  error: string
  info: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  shadow: string
}

export interface StyleProps {
  theme?: Partial<ThemeConfig>
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  rounded?: boolean
  shadow?: boolean
  border?: boolean
}

// ============================================================================
// СОБЫТИЯ
// ============================================================================

export interface ComponentEvents {
  onChange?: (value: any) => void
  onFocus?: (event: React.FocusEvent) => void
  onBlur?: (event: React.FocusEvent) => void
  onClick?: (event: React.MouseEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  onSubmit?: (event: React.FormEvent) => void
  onCancel?: () => void
  onConfirm?: () => void
  onDismiss?: () => void
}

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================

export type {
  BaseComponentProps,
  BaseSelectableProps,
  BaseValidatableProps,
  SelectorOption,
  SelectorProps,
  AttributeSelectorProps,
  EntitySelectorProps,
  OperatorSelectorProps,
  BuilderField,
  BuilderProps,
  ConditionBuilderProps,
  PanelProps,
  FloatingPanelProps,
  StatsPanelProps,
  InputProps,
  ValueInputProps,
  NotificationProps,
  StatNotificationProps,
  ValidationResult,
  ComponentState,
  ComponentActions,
  ThemeConfig,
  StyleProps,
  ComponentEvents
}

