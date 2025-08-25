import { generateUniqueId } from './entityHelpers'

// Типы конфигураций
export interface ConfigType {
  actions: 'actions'
  market: 'market'
  contracts: 'contracts'
  events: 'events'
  equipment: 'equipment'
  system: 'system'
  scenes: 'scenes'
  storyPoints: 'storyPoints'
  storyPoint: 'storyPoint'
  screen: 'screen'
  assets: 'assets'
  users: 'users'
}

// Схемы для валидации конфигураций
export const configSchemas = {
  actions: {
    type: 'actions',
    fields: [
      { name: 'name', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'category', type: 'select', label: 'Категория', required: true, options: ['training', 'coaching', 'therapy'] },
      { name: 'cost', type: 'number', label: 'Стоимость', required: true },
      { name: 'duration', type: 'number', label: 'Длительность (мин)', required: true },
      { name: 'effects', type: 'object', label: 'Эффекты', required: false }
    ],
    defaultValues: {
      id: '',
      name: '',
      description: '',
      category: 'training',
      cost: 100,
      duration: 60,
      effects: {}
    }
  },
  market: {
    type: 'market',
    fields: [
      { name: 'name', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'type', type: 'select', label: 'Тип', required: true, options: ['talentExchange', 'voidRescues', 'corporateContracts'] },
      { name: 'price', type: 'number', label: 'Цена', required: true },
      { name: 'risk', type: 'number', label: 'Риск', required: true },
      { name: 'requirements', type: 'object', label: 'Требования', required: false }
    ],
    defaultValues: {
      id: '',
      name: '',
      description: '',
      type: 'talentExchange',
      price: 1000,
      risk: 0.1,
      requirements: {}
    }
  },
  contracts: {
    type: 'contracts',
    fields: [
      { name: 'title', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'type', type: 'select', label: 'Тип', required: true, options: ['rescue', 'escort', 'delivery', 'investigation', 'elimination'] },
      { name: 'difficulty', type: 'select', label: 'Сложность', required: true, options: ['easy', 'medium', 'hard', 'extreme'] },
      { name: 'reward', type: 'number', label: 'Награда', required: true },
      { name: 'timeLimit', type: 'number', label: 'Временной лимит (мин)', required: true },
      { name: 'requirements', type: 'object', label: 'Требования', required: false }
    ],
    defaultValues: {
      id: '',
      title: '',
      description: '',
      type: 'delivery',
      difficulty: 'medium',
      reward: 1000,
      timeLimit: 60,
      requirements: {}
    }
  },
  events: {
    type: 'events',
    fields: [
      { name: 'title', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'type', type: 'select', label: 'Тип', required: true, options: ['anomaly', 'crisis', 'opportunity', 'market', 'story'] },
      { name: 'probability', type: 'number', label: 'Вероятность', required: true },
      { name: 'effects', type: 'array', label: 'Эффекты', required: false },
      { name: 'requirements', type: 'object', label: 'Требования', required: false }
    ],
    defaultValues: {
      id: '',
      title: '',
      description: '',
      type: 'market',
      probability: 0.1,
      effects: [],
      requirements: {}
    }
  },
  equipment: {
    type: 'equipment',
    fields: [
      { name: 'name', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'type', type: 'select', label: 'Тип', required: true, options: ['weapon', 'armor', 'gadget', 'consumable'] },
      { name: 'rarity', type: 'select', label: 'Редкость', required: true, options: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
      { name: 'stats', type: 'object', label: 'Характеристики', required: false },
      { name: 'price', type: 'number', label: 'Цена', required: true }
    ],
    defaultValues: {
      id: '',
      name: '',
      description: '',
      type: 'weapon',
      rarity: 'common',
      stats: {},
      price: 500
    }
  },
  storyPoints: {
    type: 'storyPoints',
    fields: [
      { name: 'title', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'type', type: 'select', label: 'Тип', required: true, options: ['intro', 'main', 'side', 'ending'] },
      { name: 'triggers', type: 'array', label: 'Триггеры', required: false },
      { name: 'consequences', type: 'array', label: 'Последствия', required: false },
      { name: 'requirements', type: 'object', label: 'Требования', required: false }
    ],
    defaultValues: {
      id: '',
      title: '',
      description: '',
      type: 'intro',
      triggers: [],
      consequences: [],
      requirements: {}
    }
  },
  scenes: {
    type: 'scenes',
    fields: [
      { name: 'id', type: 'text', label: 'ID', required: true },
      { name: 'title', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'triggerConditions', type: 'array', label: 'Условия триггера', required: false },
      { name: 'probability', type: 'number', label: 'Вероятность', required: false },
      { name: 'screens', type: 'array', label: 'Экраны', required: false }
    ],
    defaultValues: {
      id: '',
      title: '',
      description: '',
      triggerConditions: [],
      probability: 100,
      screens: []
    }
  },
  storyPoint: {
    type: 'storyPoint',
    fields: [
      { name: 'id', type: 'text', label: 'ID', required: true },
      { name: 'name', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'defaultValue', type: 'number', label: 'Значение по умолчанию', required: true },
      { name: 'minValue', type: 'number', label: 'Минимальное значение', required: true },
      { name: 'maxValue', type: 'number', label: 'Максимальное значение', required: true }
    ],
    defaultValues: {
      id: '',
      name: '',
      description: '',
      defaultValue: 0,
      minValue: 0,
      maxValue: 100
    }
  },
  screen: {
    type: 'screen',
    fields: [
      { name: 'id', type: 'text', label: 'ID', required: true },
      { name: 'title', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'background', type: 'text', label: 'Фон', required: false },
      { name: 'choices', type: 'array', label: 'Выборы', required: false },
      { name: 'accessConditions', type: 'array', label: 'Условия доступа', required: false },
      { name: 'parentScene', type: 'text', label: 'Родительская сцена', required: false }
    ],
    defaultValues: {
      id: '',
      title: '',
      description: '',
      background: '',
      choices: [],
      accessConditions: [],
      parentScene: ''
    }
  },
  system: {
    type: 'system',
    fields: [
      { name: 'name', type: 'text', label: 'Название', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'type', type: 'select', label: 'Тип', required: true, options: ['attribute', 'skill', 'state', 'resource'] },
      { name: 'minValue', type: 'number', label: 'Минимальное значение', required: false },
      { name: 'maxValue', type: 'number', label: 'Максимальное значение', required: false },
      { name: 'defaultValue', type: 'number', label: 'Значение по умолчанию', required: false }
    ],
    defaultValues: {
      id: '',
      name: '',
      description: '',
      type: 'attribute',
      minValue: 0,
      maxValue: 100,
      defaultValue: 50
    }
  },
  assets: {
    type: 'assets',
    fields: [
      { name: 'name', type: 'text', label: 'Имя', required: true },
      { name: 'description', type: 'textarea', label: 'Описание', required: true },
      { name: 'rank', type: 'select', label: 'Ранг', required: true, options: ['Junior', 'Middle', 'Senior', 'Elite'] },
      { name: 'price', type: 'number', label: 'Цена', required: true },
      { name: 'specialization', type: 'text', label: 'Специализация', required: false },
      { name: 'avatar', type: 'text', label: 'Аватар (эмодзи)', required: false },
      { name: 'status', type: 'select', label: 'Статус', required: true, options: ['available', 'owned', 'training', 'assigned', 'inactive'] },
      { name: 'location', type: 'text', label: 'Местоположение', required: false }
    ],
    defaultValues: {
      id: '',
      name: '',
      description: '',
      rank: 'Junior',
      price: 150,
      specialization: '',
      avatar: '👤',
      status: 'available',
      owner: null,
      location: 'talent_exchange',
      attributes: {
        strength: 1, empathy: 1, intelligence: 1, temperament: 1, 
        grit: 1, ego: 1, loyalty: 1, obedience: 1, resistance: 1
      },
      skills: {},
      traits: [],
      preferences: { work_type: [], environment: [], avoid: [] },
      condition: { health: 100, mental_state: 80, stress: 20, fatigue: 10 },
      history: { 
        created: new Date().toISOString().split('T')[0], 
        last_training: '', 
        assignments: 0, 
        success_rate: 0 
      }
    }
  },
  users: {
    type: 'users',
    fields: [
      { name: 'username', type: 'text', label: 'Имя пользователя', required: true },
      { name: 'email', type: 'text', label: 'Email', required: true },
      { name: 'role', type: 'select', label: 'Роль', required: true, options: ['admin', 'user', 'trader'] },
      { name: 'status', type: 'select', label: 'Статус', required: true, options: ['active', 'inactive', 'banned'] }
    ],
    defaultValues: {
      id: '',
      username: '',
      email: '',
      role: 'user',
      status: 'active',
      created: new Date().toISOString().split('T')[0],
      lastLogin: '',
      account: { balance: 1000, currency: 'credits', transactions: [] },
      assets: [],
      equipment: [],
      settings: { theme: 'dark', notifications: true, autoAssign: false, riskTolerance: 'medium' }
    }
  }
}

// Функция для получения схемы конфигурации
export const getConfigSchema = (configType: keyof typeof configSchemas) => {
  return configSchemas[configType]
}

// Функция для создания нового элемента конфигурации
export const createNewConfigItem = (configType: keyof typeof configSchemas) => {
  const schema = getConfigSchema(configType)
  const newItem = { ...schema.defaultValues }
  newItem.id = generateUniqueId(`${configType}-`)
  return newItem
}

// Типы для конфигурации
export interface ConfigValidationResult {
  isValid: boolean
  errors: string[]
}

export interface ConfigDiff {
  added: string[]
  changed: string[]
  removed: string[]
}

export interface RequiredFieldsResult {
  isValid: boolean
  missingFields: string[]
}

// Функция валидации конфигурации
export const validateConfig = (config: any): ConfigValidationResult => {
  const errors: string[] = []
  
  // Проверяем базовую структуру
  if (!config || typeof config !== 'object') {
    errors.push('Конфигурация должна быть объектом')
    return { isValid: false, errors }
  }
  
  // Проверяем наличие основных секций
  const requiredSections = ['actions', 'assets', 'equipment', 'events', 'contracts', 'market']
  requiredSections.forEach(section => {
    if (!config[section]) {
      errors.push(`Отсутствует секция: ${section}`)
    }
  })
  
  // Проверяем структуру действий
  if (config.actions) {
    if (!config.actions.categories) {
      errors.push('Отсутствует categories в actions')
    } else {
      Object.entries(config.actions.categories).forEach(([categoryName, category]: [string, any]) => {
        if (!category.title) {
          errors.push(`Отсутствует title в категории ${categoryName}`)
        }
        if (!category.actions) {
          errors.push(`Отсутствует actions в категории ${categoryName}`)
        } else {
          Object.entries(category.actions).forEach(([actionName, action]: [string, any]) => {
            if (!action.title) {
              errors.push(`Отсутствует title в действии ${actionName}`)
            }
            if (typeof action.cost !== 'number') {
              errors.push(`Некорректный cost в действии ${actionName}`)
            }
          })
        }
      })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция объединения конфигураций
export const mergeConfigs = (baseConfig: any, overrideConfig: any): any => {
  const result = { ...baseConfig }
  
  const mergeDeep = (target: any, source: any): any => {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) {
          target[key] = {}
        }
        mergeDeep(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
    return target
  }
  
  return mergeDeep(result, overrideConfig)
}

// Функция валидации сущности
export const validateEntity = (entity: any, entityType: string): ConfigValidationResult => {
  const errors: string[] = []
  
  // Базовые проверки
  if (!entity) {
    errors.push('Сущность не может быть пустой')
    return { isValid: false, errors }
  }
  
  // Проверяем обязательные поля в зависимости от типа
  switch (entityType) {
    case 'assets':
      if (!entity.id) errors.push('ID обязателен для актива')
      if (!entity.name) errors.push('Имя обязательно для актива')
      if (!entity.rank) errors.push('Ранг обязателен для актива')
      if (entity.price === undefined) errors.push('Цена обязательна для актива')
      else if (typeof entity.price !== 'number') errors.push('Цена должна быть числом')
      else if (entity.price < 0) errors.push('Цена не может быть отрицательной')
      else if (entity.price > 100000) errors.push('Цена не может превышать 100,000')
      break
      
    case 'actions':
      if (!entity.title) errors.push('Название обязательно для действия')
      if (!entity.description) errors.push('Описание обязательно для действия')
      if (typeof entity.cost !== 'number') errors.push('Стоимость должна быть числом')
      if (entity.cost < 0) errors.push('Стоимость не может быть отрицательной')
      break
      
    case 'equipment':
      if (!entity.id) errors.push('ID обязателен для оборудования')
      if (!entity.name) errors.push('Название обязательно для оборудования')
      if (!entity.type) errors.push('Тип обязателен для оборудования')
      if (!entity.slot) errors.push('Слот обязателен для оборудования')
      break
      
    default:
      if (!entity.id) errors.push('ID обязателен')
      if (!entity.name && !entity.title) errors.push('Название обязательно')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция очистки конфигурации
export const sanitizeConfig = (config: any): any => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Удаляем потенциально опасные теги
      const sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      
      // Нормализуем числовые строки
      if (/^\d+(\.\d+)?$/.test(sanitized)) {
        return parseFloat(sanitized)
      }
      
      return sanitized
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue).filter(v => v !== null && v !== undefined && v !== '')
    }
    
    if (value && typeof value === 'object') {
      const result: any = {}
      for (const [key, val] of Object.entries(value)) {
        const sanitized = sanitizeValue(val)
        if (sanitized !== null && sanitized !== undefined && sanitized !== '') {
          result[key] = sanitized
        }
      }
      return Object.keys(result).length > 0 ? result : undefined
    }
    
    // Нормализуем числа с плавающей точкой
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value
    }
    
    return value
  }
  
  return sanitizeValue(config)
}

// Функция получения различий между конфигурациями
export const getConfigDiff = (oldConfig: any, newConfig: any): ConfigDiff => {
  const added: string[] = []
  const changed: string[] = []
  const removed: string[] = []
  
  const getPaths = (obj: any, prefix: string = ''): string[] => {
    const paths: string[] = []
    
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...getPaths(value, path))
      } else {
        paths.push(path)
      }
    }
    
    return paths
  }
  
  const getObjectPaths = (obj: any, prefix: string = ''): string[] => {
    const paths: string[] = []
    
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(path)
        paths.push(...getObjectPaths(value, path))
      }
    }
    
    return paths
  }
  
  const getValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
  
  const oldPaths = getPaths(oldConfig)
  const newPaths = getPaths(newConfig)
  const oldObjectPaths = getObjectPaths(oldConfig)
  const newObjectPaths = getObjectPaths(newConfig)
  
  // Находим добавленные пути
  newPaths.forEach(path => {
    if (!oldPaths.includes(path)) {
      added.push(path)
    }
  })
  
  // Находим удаленные пути
  oldPaths.forEach(path => {
    if (!newPaths.includes(path)) {
      removed.push(path)
    }
  })
  
  // Находим измененные пути
  oldPaths.forEach(path => {
    if (newPaths.includes(path)) {
      const oldValue = getValue(oldConfig, path)
      const newValue = getValue(newConfig, path)
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changed.push(path)
      }
    }
  })
  
  // Добавляем объекты в соответствующие списки
  newObjectPaths.forEach(path => {
    if (!oldObjectPaths.includes(path) && !added.includes(path)) {
      added.push(path)
    }
  })
  
  oldObjectPaths.forEach(path => {
    if (!newObjectPaths.includes(path) && !removed.includes(path)) {
      removed.push(path)
    }
  })
  
  return { added, changed, removed }
}

// Функция проверки обязательных полей
export const validateRequiredFields = (entity: any, requiredFields: string[]): RequiredFieldsResult => {
  const missingFields: string[] = []
  
  requiredFields.forEach(field => {
    const value = entity[field]
    if (value === null || value === undefined || value === '') {
      missingFields.push(field)
    }
  })
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  }
}

// Функция для экспорта конфигурации
export const exportConfig = (config: any, filename: string) => {
  const dataStr = JSON.stringify(config, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Функция для импорта конфигурации
export const importConfig = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string)
        resolve(config)
      } catch (error) {
        reject(new Error('Неверный формат файла'))
      }
    }
    reader.onerror = () => reject(new Error('Ошибка чтения файла'))
    reader.readAsText(file)
  })
}

// Функция для получения статистики конфигурации
export const getConfigStats = (config: any, configType: keyof typeof configSchemas) => {
  const stats: Record<string, any> = {}

  switch (configType) {
    case 'actions':
      stats.totalActions = Object.keys(config.categories || {}).reduce((sum, category) => {
        return sum + (config.categories[category]?.length || 0)
      }, 0)
      stats.categories = Object.keys(config.categories || {})
      break
    case 'market':
      stats.totalItems = (config.talentExchange?.length || 0) + 
                        (config.voidRescues?.length || 0) + 
                        (config.corporateContracts?.length || 0)
      stats.types = ['talentExchange', 'voidRescues', 'corporateContracts'].filter(type => 
        config[type] && config[type].length > 0
      )
      break
    case 'contracts':
      stats.totalContracts = config.available?.length || 0
      stats.types = [...new Set(config.available?.map((c: any) => c.type) || [])]
      break
    case 'events':
      stats.totalEvents = config.events?.length || 0
      stats.types = [...new Set(config.events?.map((e: any) => e.type) || [])]
      break
    case 'equipment':
      stats.totalEquipment = config.equipment?.length || 0
      stats.types = [...new Set(config.equipment?.map((e: any) => e.type) || [])]
      stats.rarities = [...new Set(config.equipment?.map((e: any) => e.rarity) || [])]
      break
    case 'storyPoints':
      stats.totalStoryPoints = config.storyPoints?.length || 0
      stats.types = [...new Set(config.storyPoints?.map((sp: any) => sp.type) || [])]
      break
    case 'scenes':
      stats.totalScenes = config.scenes?.length || 0
      stats.types = [...new Set(config.scenes?.map((s: any) => s.type) || [])]
      break
    case 'assets':
      stats.totalAssets = config.assets?.length || 0
      stats.ranks = [...new Set(config.assets?.map((a: any) => a.rank) || [])]
      stats.statuses = [...new Set(config.assets?.map((a: any) => a.status) || [])]
      break
    case 'users':
      stats.totalUsers = config.users?.length || 0
      stats.roles = [...new Set(config.users?.map((u: any) => u.role) || [])]
      stats.statuses = [...new Set(config.users?.map((u: any) => u.status) || [])]
      break
  }

  return stats
}

// Функция для поиска в конфигурации
export const searchInConfig = (config: any, query: string, configType: keyof typeof configSchemas): any[] => {
  const results: any[] = []
  const searchTerm = query.toLowerCase()

  const searchInArray = (array: any[], nameField: string = 'name') => {
    if (!Array.isArray(array)) return
    array.forEach(item => {
      if (item[nameField]?.toLowerCase().includes(searchTerm) || 
          item.title?.toLowerCase().includes(searchTerm) ||
          item.description?.toLowerCase().includes(searchTerm)) {
        results.push(item)
      }
    })
  }

  switch (configType) {
    case 'actions':
      Object.values(config.categories || {}).forEach((category: any) => {
        searchInArray(category)
      })
      break
    case 'market':
      searchInArray(config.talentExchange || [])
      searchInArray(config.voidRescues || [])
      searchInArray(config.corporateContracts || [])
      break
    case 'contracts':
      searchInArray(config.available || [], 'title')
      break
    case 'events':
      searchInArray(config.events || [], 'title')
      break
    case 'equipment':
      searchInArray(config.equipment || [])
      break
    case 'storyPoints':
      searchInArray(config.storyPoints || [], 'title')
      break
    case 'scenes':
      searchInArray(config.scenes || [], 'title')
      break
    case 'assets':
      searchInArray(config.assets || [])
      break
    case 'users':
      searchInArray(config.users || [], 'username')
      break
  }

  return results
}

