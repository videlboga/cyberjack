// Типы валидации
export type ValidationRule = {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom'
  value?: any
  message: string
  validator?: (value: any) => boolean
}

export type ValidationSchema = {
  [fieldName: string]: ValidationRule[]
}

// Базовые правила валидации
export const validationRules = {
  required: (message: string = 'Это поле обязательно'): ValidationRule => ({
    type: 'required',
    message
  }),
  
  min: (min: number, message?: string): ValidationRule => ({
    type: 'min',
    value: min,
    message: message || `Минимальное значение: ${min}`
  }),
  
  max: (max: number, message?: string): ValidationRule => ({
    type: 'max',
    value: max,
    message: message || `Максимальное значение: ${max}`
  }),
  
  pattern: (pattern: RegExp, message: string): ValidationRule => ({
    type: 'pattern',
    value: pattern,
    message
  }),
  
  custom: (validator: (value: any) => boolean, message: string): ValidationRule => ({
    type: 'custom',
    validator,
    message
  })
}

// Функция валидации поля
export const validateField = (value: any, rules: ValidationRule[]): string | null => {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return rule.message
        }
        break
        
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return rule.message
        }
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message
        }
        if (Array.isArray(value) && value.length < rule.value) {
          return rule.message
        }
        break
        
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return rule.message
        }
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message
        }
        if (Array.isArray(value) && value.length > rule.value) {
          return rule.message
        }
        break
        
      case 'pattern':
        if (typeof value === 'string' && !rule.value.test(value)) {
          return rule.message
        }
        break
        
      case 'custom':
        if (rule.validator && !rule.validator(value)) {
          return rule.message
        }
        break
    }
  }
  
  return null
}

// Функция валидации объекта
export const validateObject = (data: any, schema: ValidationSchema): Record<string, string> => {
  const errors: Record<string, string> = {}
  
  for (const [fieldName, rules] of Object.entries(schema)) {
    const error = validateField(data[fieldName], rules)
    if (error) {
      errors[fieldName] = error
    }
  }
  
  return errors
}

// Специфичные схемы валидации для игровых сущностей
export const gameValidationSchemas = {
  talent: {
    name: [
      validationRules.required('Имя таланта обязательно'),
      validationRules.min(2, 'Имя должно содержать минимум 2 символа'),
      validationRules.max(50, 'Имя не должно превышать 50 символов')
    ],
    rank: [
      validationRules.required('Ранг обязателен'),
      validationRules.custom(
        (value) => ['S', 'A', 'B', 'C', 'D', 'E', 'F'].includes(value),
        'Ранг должен быть одним из: S, A, B, C, D, E, F'
      )
    ],
    price: [
      validationRules.required('Цена обязательна'),
      validationRules.min(0, 'Цена не может быть отрицательной'),
      validationRules.max(1000000, 'Цена не может превышать 1,000,000')
    ]
  },
  
  attribute: {
    name: [
      validationRules.required('Название атрибута обязательно'),
      validationRules.min(2, 'Название должно содержать минимум 2 символа')
    ],
    maxValue: [
      validationRules.required('Максимальное значение обязательно'),
      validationRules.min(1, 'Максимальное значение должно быть не менее 1'),
      validationRules.max(100, 'Максимальное значение не должно превышать 100')
    ],
    cost: [
      validationRules.required('Стоимость обязательна'),
      validationRules.min(0, 'Стоимость не может быть отрицательной')
    ]
  },
  
  skill: {
    name: [
      validationRules.required('Название навыка обязательно'),
      validationRules.min(2, 'Название должно содержать минимум 2 символа')
    ],
    category: [
      validationRules.required('Категория обязательна'),
      validationRules.custom(
        (value) => ['combat', 'social', 'technical', 'survival'].includes(value),
        'Категория должна быть одной из: combat, social, technical, survival'
      )
    ],
    maxLevel: [
      validationRules.required('Максимальный уровень обязателен'),
      validationRules.min(1, 'Максимальный уровень должен быть не менее 1'),
      validationRules.max(10, 'Максимальный уровень не должен превышать 10')
    ]
  },
  
  contract: {
    title: [
      validationRules.required('Название контракта обязательно'),
      validationRules.min(3, 'Название должно содержать минимум 3 символа')
    ],
    type: [
      validationRules.required('Тип контракта обязателен'),
      validationRules.custom(
        (value) => ['rescue', 'escort', 'delivery', 'investigation', 'elimination'].includes(value),
        'Тип должен быть одним из: rescue, escort, delivery, investigation, elimination'
      )
    ],
    reward: [
      validationRules.required('Награда обязательна'),
      validationRules.min(1, 'Награда должна быть положительной')
    ],
    timeLimit: [
      validationRules.required('Временной лимит обязателен'),
      validationRules.min(1, 'Временной лимит должен быть положительным')
    ]
  },
  
  event: {
    title: [
      validationRules.required('Название события обязательно'),
      validationRules.min(3, 'Название должно содержать минимум 3 символа')
    ],
    type: [
      validationRules.required('Тип события обязателен'),
      validationRules.custom(
        (value) => ['anomaly', 'crisis', 'opportunity', 'market', 'story'].includes(value),
        'Тип должен быть одним из: anomaly, crisis, opportunity, market, story'
      )
    ],
    probability: [
      validationRules.required('Вероятность обязательна'),
      validationRules.min(0, 'Вероятность не может быть отрицательной'),
      validationRules.max(1, 'Вероятность не может превышать 1')
    ]
  },
  
  equipment: {
    name: [
      validationRules.required('Название оборудования обязательно'),
      validationRules.min(2, 'Название должно содержать минимум 2 символа')
    ],
    type: [
      validationRules.required('Тип оборудования обязателен'),
      validationRules.custom(
        (value) => ['weapon', 'armor', 'gadget', 'consumable'].includes(value),
        'Тип должен быть одним из: weapon, armor, gadget, consumable'
      )
    ],
    rarity: [
      validationRules.required('Редкость обязательна'),
      validationRules.custom(
        (value) => ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(value),
        'Редкость должна быть одной из: common, uncommon, rare, epic, legendary'
      )
    ],
    price: [
      validationRules.required('Цена обязательна'),
      validationRules.min(0, 'Цена не может быть отрицательной')
    ]
  },
  
  storyPoint: {
    title: [
      validationRules.required('Название сюжетной точки обязательно'),
      validationRules.min(3, 'Название должно содержать минимум 3 символа')
    ],
    type: [
      validationRules.required('Тип сюжетной точки обязателен'),
      validationRules.custom(
        (value) => ['intro', 'main', 'side', 'ending'].includes(value),
        'Тип должен быть одним из: intro, main, side, ending'
      )
    ]
  }
}

// Функция для получения схемы валидации по типу сущности
export const getValidationSchema = (entityType: keyof typeof gameValidationSchemas) => {
  return gameValidationSchemas[entityType]
}

// Функция для валидации игровой сущности
export const validateGameEntity = (data: any, entityType: keyof typeof gameValidationSchemas) => {
  const schema = getValidationSchema(entityType)
  return validateObject(data, schema)
}

// Функция для проверки уникальности ID
export const validateUniqueId = (id: string, existingIds: string[]): string | null => {
  if (existingIds.includes(id)) {
    return 'ID должен быть уникальным'
  }
  return null
}

// Функция для валидации JSON
export const validateJSON = (jsonString: string): { valid: boolean; error?: string } => {
  try {
    JSON.parse(jsonString)
    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Неверный формат JSON' }
  }
}

// Функция для валидации email
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Функция для валидации URL
export const validateURL = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Функция для валидации цвета (hex)
export const validateHexColor = (color: string): boolean => {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  return hexRegex.test(color)
}

