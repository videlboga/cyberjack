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

// Функция для валидации конфигурации
export const validateConfig = (config: any, configType: keyof typeof configSchemas): string[] => {
  const schema = getConfigSchema(configType)
  const errors: string[] = []

  schema.fields.forEach(field => {
    if (field.required && (!config[field.name] || config[field.name] === '')) {
      errors.push(`${field.label} обязательно для заполнения`)
    }

    if (config[field.name] !== undefined && config[field.name] !== null) {
      switch (field.type) {
        case 'number':
          if (isNaN(Number(config[field.name]))) {
            errors.push(`${field.label} должно быть числом`)
          }
          break
        case 'array':
          if (!Array.isArray(config[field.name])) {
            errors.push(`${field.label} должно быть массивом`)
          }
          break
        case 'object':
          if (typeof config[field.name] !== 'object' || Array.isArray(config[field.name])) {
            errors.push(`${field.label} должно быть объектом`)
          }
          break
        case 'select':
          if (field.options && !field.options.includes(config[field.name])) {
            errors.push(`${field.label} должно быть одним из: ${field.options.join(', ')}`)
          }
          break
      }
    }
  })

  return errors
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

