// Конфигурации полей для универсальной системы редактирования
export interface FieldConfig {
  name: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'slider' | 'switch' | 'object' | 'array' | 'boolean' | 'dynamic-object' | 'dynamic-array'
  label: string
  required?: boolean
  options?: string[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  description?: string
  defaultValue?: any
  dynamicConfig?: {
    type: 'attributes' | 'skills' | 'effects' | 'states' | 'preferences' | 'condition' | 'history'
    subType?: string
    options?: string[]
    min?: number
    max?: number
  }
}

// Базовые поля для всех сущностей
export const baseFields: FieldConfig[] = [
  { name: 'id', type: 'text', label: 'ID', required: true, placeholder: 'Введите уникальный ID' }
]

// Конфигурации для разных типов сущностей
export const entityFieldConfigs: Record<string, FieldConfig[]> = {
  assets: [
    ...baseFields,
    { name: 'name', type: 'text', label: 'Имя', required: true, placeholder: 'Введите имя актива' },
    { name: 'description', type: 'textarea', label: 'Описание', required: true, placeholder: 'Опишите актив' },
    { name: 'rank', type: 'select', label: 'Ранг', options: ['Junior', 'Middle', 'Senior', 'Elite'], required: true },
    { name: 'price', type: 'number', label: 'Цена', required: true, min: 0, max: 10000 },
    { name: 'specialization', type: 'text', label: 'Специализация', required: false, placeholder: 'Специализация' },
    { name: 'avatar', type: 'text', label: 'Аватар (эмодзи)', required: false, placeholder: '👩‍💻' },
    { name: 'status', type: 'select', label: 'Статус', options: ['available', 'owned', 'training', 'assigned', 'inactive'], required: true },
    { name: 'location', type: 'text', label: 'Местоположение', required: false, placeholder: 'talent_exchange' },
    { name: 'owner', type: 'text', label: 'Владелец', required: false, placeholder: 'ID владельца' },
    { 
      name: 'attributes', 
      type: 'dynamic-object', 
      label: 'Атрибуты', 
      required: false, 
      description: 'Базовые характеристики актива',
      dynamicConfig: {
        type: 'attributes',
        options: ['strength', 'empathy', 'intelligence', 'temperament', 'grit', 'ego', 'loyalty', 'obedience', 'resistance'],
        min: 1,
        max: 10
      }
    },
    { 
      name: 'skills', 
      type: 'dynamic-object', 
      label: 'Навыки', 
      required: false, 
      description: 'Профессиональные навыки',
      dynamicConfig: {
        type: 'skills',
        options: ['maid', 'cooking', 'neural_hacking', 'orgasm_control', 'field', 'etiquette', 'logistics', 'medical', 'maintenance', 'data', 'dance', 'seduction', 'interrogation', 'surveillance'],
        min: 0,
        max: 10
      }
    },
    { 
      name: 'traits', 
      type: 'dynamic-array', 
      label: 'Черты характера', 
      required: false, 
      description: 'Особенности личности',
      dynamicConfig: {
        type: 'preferences',
        options: ['loyal', 'quick_learner', 'tech_savvy', 'creative', 'analytical', 'social', 'introverted', 'extroverted', 'resilient', 'sensitive']
      }
    },
    { 
      name: 'preferences', 
      type: 'dynamic-object', 
      label: 'Предпочтения', 
      required: false, 
      description: 'Предпочтения в работе',
      dynamicConfig: {
        type: 'preferences',
        subType: 'work_type',
        options: ['service', 'technical', 'creative', 'analytical', 'social', 'physical']
      }
    },
    { 
      name: 'condition', 
      type: 'dynamic-object', 
      label: 'Состояние', 
      required: false, 
      description: 'Текущее состояние',
      dynamicConfig: {
        type: 'condition',
        options: ['health', 'mental_state', 'stress', 'fatigue'],
        min: 0,
        max: 100
      }
    },
    { 
      name: 'history', 
      type: 'dynamic-object', 
      label: 'История', 
      required: false, 
      description: 'История работы',
      dynamicConfig: {
        type: 'history',
        options: ['created', 'last_training', 'assignments', 'success_rate']
      }
    }
  ],

  actions: [
    { name: 'title', type: 'text', label: 'Название', required: true, placeholder: 'Введите название действия' },
    { name: 'description', type: 'textarea', label: 'Описание', required: true, placeholder: 'Опишите действие' },
    { name: 'cost', type: 'number', label: 'Стоимость', required: true, min: 0, max: 1000 },
    { name: 'risk', type: 'number', label: 'Риск (%)', required: false, min: 0, max: 100 },
    { 
      name: 'effects', 
      type: 'dynamic-object', 
      label: 'Эффекты', 
      required: false, 
      description: 'Влияние на навыки и состояния',
      dynamicConfig: {
        type: 'effects',
        options: ['skills', 'states'],
        subType: 'skills'
      }
    },
    { 
      name: 'riskEffects', 
      type: 'dynamic-object', 
      label: 'Эффекты риска', 
      required: false, 
      description: 'Негативные эффекты при неудаче',
      dynamicConfig: {
        type: 'effects',
        options: ['states'],
        subType: 'states'
      }
    }
  ],

  equipment: [
    ...baseFields,
    { name: 'name', type: 'text', label: 'Название', required: true, placeholder: 'Введите название импланта' },
    { name: 'description', type: 'textarea', label: 'Описание', required: true, placeholder: 'Опишите имплант' },
    { name: 'type', type: 'select', label: 'Тип', options: ['implant', 'clothing', 'device'], required: true },
    { name: 'slot', type: 'select', label: 'Слот', options: ['ocular', 'body', 'head', 'neural'], required: true },
    { name: 'removable', type: 'switch', label: 'Съемное', required: false },
    { 
      name: 'effects', 
      type: 'dynamic-object', 
      label: 'Эффекты', 
      required: false, 
      description: 'Влияние на характеристики',
      dynamicConfig: {
        type: 'effects',
        options: ['Intelligence', 'Fear', 'Strength', 'Empathy', 'Creativity'],
        min: -50,
        max: 50
      }
    },
    { 
      name: 'powerSettings', 
      type: 'dynamic-object', 
      label: 'Настройки мощности', 
      required: false, 
      description: 'Параметры энергопотребления',
      dynamicConfig: {
        type: 'preferences',
        options: ['min', 'max', 'default'],
        min: 0,
        max: 200
      }
    },
    { 
      name: 'modes', 
      type: 'dynamic-array', 
      label: 'Режимы работы', 
      required: false, 
      description: 'Доступные режимы',
      dynamicConfig: {
        type: 'preferences',
        options: ['Стандартный', 'Усиленный', 'Экономный', 'Турбо', 'Креативный', 'Базовый', 'AR', 'VR', 'Eco', 'Performance']
      }
    },
    { 
      name: 'progressiveEffects', 
      type: 'dynamic-array', 
      label: 'Прогрессивные эффекты', 
      required: false, 
      description: 'Эффекты, усиливающиеся со временем',
      dynamicConfig: {
        type: 'effects',
        options: ['Intelligence', 'Creativity', 'Strength', 'Empathy']
      }
    }
  ],

  users: [
    ...baseFields,
    { name: 'username', type: 'text', label: 'Имя пользователя', required: true, placeholder: 'Введите имя пользователя' },
    { name: 'email', type: 'text', label: 'Email', required: true, placeholder: 'user@example.com' },
    { name: 'role', type: 'select', label: 'Роль', options: ['admin', 'user', 'trader'], required: true },
    { name: 'status', type: 'select', label: 'Статус', options: ['active', 'inactive', 'banned'], required: true }
  ],

  events: [
    ...baseFields,
    { name: 'title', type: 'text', label: 'Название', required: true, placeholder: 'Введите название события' },
    { name: 'description', type: 'textarea', label: 'Описание', required: true, placeholder: 'Опишите событие' },
    { name: 'probability', type: 'slider', label: 'Вероятность', min: 0, max: 1, step: 0.01, required: true },
    { name: 'duration', type: 'number', label: 'Длительность (дни)', required: true, min: 1, max: 30 },
    { 
      name: 'effects', 
      type: 'dynamic-object', 
      label: 'Эффекты', 
      required: false, 
      description: 'Влияние события',
      dynamicConfig: {
        type: 'effects',
        options: ['states', 'attributes'],
        subType: 'states'
      }
    }
  ],

  contracts: [
    ...baseFields,
    { name: 'title', type: 'text', label: 'Название', required: true, placeholder: 'Введите название контракта' },
    { name: 'description', type: 'textarea', label: 'Описание', required: true, placeholder: 'Опишите контракт' },
    { name: 'client', type: 'text', label: 'Клиент', required: true, placeholder: 'Название клиента' },
    { name: 'reward', type: 'number', label: 'Награда', required: true, min: 0, max: 10000 },
    { name: 'deadline', type: 'number', label: 'Срок (дни)', required: true, min: 1, max: 365 },
    { name: 'difficulty', type: 'select', label: 'Сложность', options: ['easy', 'medium', 'hard'], required: true }
  ],

  scenes: [
    ...baseFields,
    { name: 'title', type: 'text', label: 'Название', required: true, placeholder: 'Введите название сцены' },
    { name: 'description', type: 'textarea', label: 'Описание', required: true, placeholder: 'Опишите сцену' },
    { name: 'type', type: 'select', label: 'Тип', options: ['dialogue', 'action', 'choice', 'narrative'], required: true },
    { 
      name: 'characters', 
      type: 'dynamic-array', 
      label: 'Персонажи', 
      required: false, 
      description: 'Участники сцены',
      dynamicConfig: {
        type: 'preferences',
        options: ['player', 'asset', 'npc', 'system']
      }
    },
    { 
      name: 'choices', 
      type: 'dynamic-array', 
      label: 'Выборы', 
      required: false, 
      description: 'Варианты выбора',
      dynamicConfig: {
        type: 'preferences',
        options: ['continue', 'accept', 'decline', 'investigate', 'escape']
      }
    }
  ]
}

// Функция для получения конфигурации полей по типу сущности
export const getFieldConfig = (entityType: string): FieldConfig[] => {
  // Убираем множественное число для поиска
  const normalizedType = entityType.replace(/s$/, '')
  
  // Ищем точное совпадение
  if (entityFieldConfigs[entityType]) {
    return entityFieldConfigs[entityType]
  }
  
  // Ищем без множественного числа
  if (entityFieldConfigs[normalizedType]) {
    return entityFieldConfigs[normalizedType]
  }
  
  // Возвращаем базовую конфигурацию для неизвестных типов
  return [
    ...baseFields,
    { name: 'name', type: 'text', label: 'Название', required: true, placeholder: 'Введите название' },
    { name: 'description', type: 'textarea', label: 'Описание', required: false, placeholder: 'Опишите сущность' },
    { name: 'type', type: 'text', label: 'Тип', required: false, placeholder: 'Тип сущности' }
  ]
}

// Функция для получения отображаемого имени типа сущности
export const getEntityDisplayName = (entityType: string): string => {
  const displayNames: Record<string, string> = {
    actions: 'действие',
    action: 'действие',
    assets: 'актив',
    asset: 'актив',
    users: 'пользователя',
    user: 'пользователя',
    market: 'товар',
    talentExchange: 'актив биржи',
    voidRescue: 'спасение из пустоты',
    voidRescues: 'спасение из пустоты',
    system: 'систему',
    systems: 'систему',
    equipment: 'оборудование',
    contracts: 'контракт',
    contract: 'контракт',
    events: 'событие',
    event: 'событие',
    scenes: 'сцену',
    scene: 'сцену',
    categories: 'категорию',
    category: 'категорию',
    entity: 'сущность'
  }
  return displayNames[entityType] || entityType
}
