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
export const validateField = (field: any, value: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  // Проверка обязательности
  if (field.required && (value === null || value === undefined || value === '')) {
    errors.push(`${field.label} обязательно для заполнения`)
  }
  
  // Проверка минимальной длины для строк
  if (field.minLength && typeof value === 'string' && value.length < field.minLength) {
    errors.push(`${field.label} должно содержать минимум ${field.minLength} символов`)
  }
  
  // Проверка максимальной длины для строк
  if (field.maxLength && typeof value === 'string' && value.length > field.maxLength) {
    errors.push(`${field.label} не должно превышать ${field.maxLength} символов`)
  }
  
  // Проверка минимального значения для чисел
  if (field.min !== undefined && typeof value === 'number' && value < field.min) {
    errors.push(`${field.label} не может быть меньше ${field.min}`)
  }
  
  // Проверка максимального значения для чисел
  if (field.max !== undefined && typeof value === 'number' && value > field.max) {
    errors.push(`${field.label} не может быть больше ${field.max}`)
  }
  
  // Проверка опций для select
  if (field.type === 'select' && field.options && !field.options.includes(value)) {
    errors.push(`${field.label} должно быть одним из: ${field.options.join(', ')}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция валидации формы
export const validateForm = (fields: any[], formData: any): { isValid: boolean; errors: string[]; fieldErrors: Record<string, string[]> } => {
  const errors: string[] = []
  const fieldErrors: Record<string, string[]> = {}
  
  fields.forEach(field => {
    const value = formData[field.name]
    const validation = validateField(field, value)
    
    if (!validation.isValid) {
      errors.push(...validation.errors)
      fieldErrors[field.name] = validation.errors
    }
  })
  
  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors
  }
}

// Функция валидации email
export const validateEmail = (email: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!email || email.trim() === '') {
    errors.push('Email не может быть пустым')
  } else {
    // Дополнительные проверки для более строгой валидации
    if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
      errors.push('Некорректный формат email')
    } else if (!emailRegex.test(email)) {
      errors.push('Некорректный формат email')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция валидации числа
export const validateNumber = (value: number, options: { min?: number; max?: number; integer?: boolean }): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push('Значение должно быть числом')
    return { isValid: false, errors }
  }
  
  if (options.min !== undefined && value < options.min) {
    errors.push(`Значение не может быть меньше ${options.min}`)
  }
  
  if (options.max !== undefined && value > options.max) {
    errors.push(`Значение не может быть больше ${options.max}`)
  }
  
  if (options.integer && !Number.isInteger(value)) {
    errors.push('Значение должно быть целым числом')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция валидации строки
export const validateString = (value: string, options: { minLength?: number; maxLength?: number; required?: boolean; pattern?: RegExp }): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (options.required && (value === null || value === undefined || value === '')) {
    errors.push('Поле обязательно для заполнения')
  }
  
  if (options.minLength && value.length < options.minLength) {
    errors.push(`Минимальная длина: ${options.minLength} символов`)
  }
  
  if (options.maxLength && value.length > options.maxLength) {
    errors.push(`Максимальная длина: ${options.maxLength} символов`)
  }
  
  if (options.pattern && !options.pattern.test(value)) {
    errors.push('Значение не соответствует требуемому формату')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция валидации select
export const validateSelect = (value: any, options: { options: string[]; multiple?: boolean }): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (options.multiple) {
    if (!Array.isArray(value)) {
      errors.push('Значение должно быть массивом')
    } else {
      const invalidValues = value.filter(v => !options.options.includes(v))
      if (invalidValues.length > 0) {
        errors.push(`Недопустимые значения: ${invalidValues.join(', ')}`)
      }
    }
  } else {
    if (!options.options.includes(value)) {
      errors.push(`Значение должно быть одним из: ${options.options.join(', ')}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ===== Доменные проверки поз/анатомии =====
import systemConfig from '@/data/system-unified.json'

export type ValidationError = { field?: string; message: string }

export const validateAnatomyList = (anatomy: any): { isValid: boolean; errors: ValidationError[] } => {
  const errors: ValidationError[] = []
  if (!Array.isArray(anatomy)) {
    return { isValid: false, errors: [{ message: 'Анатомия должна быть массивом' }] }
  }
  for (const item of anatomy) {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push({ message: 'Элементы анатомии должны быть строками' })
    }
  }
  return { isValid: errors.length === 0, errors }
}

export const validateActiveZoneDomain = (zone: any): { isValid: boolean; errors: ValidationError[] } => {
  const errors: ValidationError[] = []

  // Координаты и размеры в диапазоне [0,100]
  const numInRange = (v: any, min: number, max: number) => typeof v === 'number' && !isNaN(v) && v >= min && v <= max
  if (!numInRange(zone.x, 0, 100)) errors.push({ field: 'x', message: 'X должен быть в диапазоне 0-100' })
  if (!numInRange(zone.y, 0, 100)) errors.push({ field: 'y', message: 'Y должен быть в диапазоне 0-100' })
  if (!numInRange(zone.width, 1, 100)) errors.push({ field: 'width', message: 'Ширина должна быть 1-100' })
  if (!numInRange(zone.height, 1, 100)) errors.push({ field: 'height', message: 'Высота должна быть 1-100' })

  // Чувствительность 1..10 (целое)
  if (!(typeof zone.sensitivity === 'number' && Number.isInteger(zone.sensitivity) && zone.sensitivity >= 1 && zone.sensitivity <= 10)) {
    errors.push({ field: 'sensitivity', message: 'Чувствительность должна быть целым числом 1-10' })
  }

  // anatomyId должен быть из справочника анатомии (для поз — выбирается из списка)
  const allowedAnatomy: string[] = (systemConfig as any)?.anatomy || []
  if (zone.anatomyId && !allowedAnatomy.includes(zone.anatomyId)) {
    errors.push({ field: 'anatomyId', message: `Анатомия недопустима: ${zone.anatomyId}` })
  }

  // Категория зоны
  const allowedCategories = ['touch', 'pressure', 'temperature', 'electrical', 'visual', 'auditory']
  if (!allowedCategories.includes(zone.category)) {
    errors.push({ field: 'category', message: 'Недопустимая категория зоны' })
  }

  return { isValid: errors.length === 0, errors }
}

export const validatePoseAngleDomain = (angle: any): { isValid: boolean; errors: ValidationError[] } => {
  const errors: ValidationError[] = []
  if (!Array.isArray(angle?.activeZones)) {
    return { isValid: false, errors: [{ message: 'activeZones должен быть массивом' }] }
  }
  angle.activeZones.forEach((z: any, idx: number) => {
    const res = validateActiveZoneDomain(z)
    if (!res.isValid) {
      res.errors.forEach(e => errors.push({ field: `activeZones[${idx}].${e.field || ''}`.replace(/\.$/, ''), message: e.message }))
    }
  })
  return { isValid: errors.length === 0, errors }
}

// Функция валидации динамического объекта
export const validateDynamicObject = (value: any, config: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (typeof value !== 'object' || value === null) {
    errors.push('Значение должно быть объектом')
    return { isValid: false, errors }
  }
  
  // Проверяем, что все ключи входят в допустимые опции
  const invalidKeys = Object.keys(value).filter(key => !config.options.includes(key))
  if (invalidKeys.length > 0) {
    errors.push(`Недопустимые ключи: ${invalidKeys.join(', ')}`)
  }
  
  // Проверяем значения
  Object.entries(value).forEach(([key, val]) => {
    if (config.min !== undefined && val < config.min) {
      errors.push(`${key}: значение не может быть меньше ${config.min}`)
    }
    if (config.max !== undefined && val > config.max) {
      errors.push(`${key}: значение не может быть больше ${config.max}`)
    }
  })
  
  // Проверяем минимальное количество ключей
  if (config.minKeys && Object.keys(value).length < config.minKeys) {
    errors.push(`Минимальное количество ключей: ${config.minKeys}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция валидации динамического массива
export const validateDynamicArray = (value: any[], config: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!Array.isArray(value)) {
    errors.push('Значение должно быть массивом')
    return { isValid: false, errors }
  }
  
  // Проверяем, что все элементы входят в допустимые опции
  const invalidItems = value.filter(item => !config.options.includes(item))
  if (invalidItems.length > 0) {
    errors.push(`Недопустимые элементы: ${invalidItems.join(', ')}`)
  }
  
  // Проверяем минимальное количество элементов
  if (config.minItems && value.length < config.minItems) {
    errors.push(`Минимальное количество элементов: ${config.minItems}`)
  }
  
  // Проверяем максимальное количество элементов
  if (config.maxItems && value.length > config.maxItems) {
    errors.push(`Максимальное количество элементов: ${config.maxItems}`)
  }
  
  // Проверяем уникальность
  if (config.unique) {
    const duplicates = value.filter((item, index) => value.indexOf(item) !== index)
    if (duplicates.length > 0) {
      errors.push(`Дублирующиеся элементы: ${[...new Set(duplicates)].join(', ')}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Функция получения ошибок валидации
export const getValidationErrors = (fields: any[], formData: any, options?: { groupByField?: boolean }): any => {
  const validation = validateForm(fields, formData)
  
  if (options?.groupByField) {
    return validation.fieldErrors
  }
  
  return validation.errors
}

// Функция валидации объекта
export const validateObject = (data: any, schema: ValidationSchema): Record<string, string> => {
  const errors: Record<string, string> = {}
  
  for (const [fieldName, rules] of Object.entries(schema)) {
    const error = validateFieldRules(data[fieldName], rules)
    if (error) {
      errors[fieldName] = error
    }
  }
  
  return errors
}

// Функция валидации поля по правилам
export const validateFieldRules = (value: any, rules: ValidationRule[]): string | null => {
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

