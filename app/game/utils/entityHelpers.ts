// Функция для генерации уникальных ID
let idCounter = 0
export const generateUniqueId = (prefix: string = ''): string => {
  idCounter++
  return `${prefix}${Date.now()}-${idCounter}`
}

// Получение цвета для ранга
export const getRankColor = (rank: string): string => {
  const colors: Record<string, string> = {
    S: "bg-purple-500 text-white",
    A: "bg-red-500 text-white",
    B: "bg-orange-500 text-white",
    C: "bg-yellow-500 text-white",
    D: "bg-green-500 text-white",
    E: "bg-blue-500 text-white",
    F: "bg-gray-500 text-white",
  }
  return colors[rank] || "bg-gray-500 text-white"
}

// Получение цвета для типа события
export const getEventTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    anomaly: "bg-red-500 text-white",
    crisis: "bg-orange-500 text-white",
    opportunity: "bg-green-500 text-white",
    market: "bg-blue-500 text-white",
    story: "bg-purple-500 text-white",
  }
  return colors[type] || "bg-gray-500 text-white"
}

// Получение цвета для типа контракта
export const getContractTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    rescue: "bg-red-500 text-white",
    escort: "bg-blue-500 text-white",
    delivery: "bg-green-500 text-white",
    investigation: "bg-purple-500 text-white",
    elimination: "bg-orange-500 text-white",
  }
  return colors[type] || "bg-gray-500 text-white"
}

// Форматирование цены
export const formatPrice = (price: number | undefined | null): string => {
  if (!price || isNaN(Number(price))) {
    return '0'
  }
  const numPrice = Number(price)
  if (numPrice >= 1000000) {
    return `${(numPrice / 1000000).toFixed(1)}M`
  } else if (numPrice >= 1000) {
    return `${(numPrice / 1000).toFixed(1)}K`
  }
  return numPrice.toString()
}

// Форматирование времени
export const formatTime = (minutes: number | undefined | null): string => {
  if (!minutes || isNaN(Number(minutes))) {
    return '0м'
  }
  const numMinutes = Number(minutes)
  const hours = Math.floor(numMinutes / 60)
  const mins = numMinutes % 60
  
  if (hours > 0) {
    return `${hours}ч ${mins}м`
  }
  return `${mins}м`
}

// Получение названия сущности по ID
export const getEntityName = (id: string, entities: any[]): string => {
  const entity = entities.find(e => e.id === id)
  return entity?.name || entity?.title || id
}

// Создание нового таланта
export const createNewTalent = () => ({
  id: generateUniqueId('talent-'),
  name: "Новый талант",
  description: "Описание таланта",
  rank: "C",
  attributes: {
    intelligence: 1,
    strength: 1,
    agility: 1,
    charisma: 1,
    perception: 1
  },
  skills: [],
  traits: [],
  background: "Неизвестно",
  price: 1000
})

// Создание нового атрибута
export const createNewAttribute = () => ({
  id: generateUniqueId('attr-'),
  name: "Новый атрибут",
  description: "Описание атрибута",
  maxValue: 10,
  cost: 100
})

// Создание нового навыка
export const createNewSkill = () => ({
  id: generateUniqueId('skill-'),
  name: "Новый навык",
  description: "Описание навыка",
  category: "combat",
  maxLevel: 5,
  cost: 50
})

// Создание нового контракта
export const createNewContract = () => ({
  id: generateUniqueId('contract-'),
  title: "Новый контракт",
  description: "Описание контракта",
  type: "delivery",
  difficulty: "medium",
  reward: 1000,
  timeLimit: 60,
  requirements: {
    level: 1,
    reputation: 0
  }
})

// Создание нового события
export const createNewEvent = () => ({
  id: generateUniqueId('event-'),
  title: "Новое событие",
  description: "Описание события",
  type: "market",
  probability: 0.1,
  effects: [],
  requirements: {
    level: 1,
    reputation: 0
  }
})

// Создание нового оборудования
export const createNewEquipment = () => ({
  id: generateUniqueId('equipment-'),
  name: "Новое оборудование",
  description: "Описание оборудования",
  type: "weapon",
  rarity: "common",
  stats: {},
  price: 500
})

// Создание новой сюжетной точки
export const createNewStoryPoint = () => ({
  id: generateUniqueId('story-point-'),
  title: "Новая сюжетная точка",
  description: "Описание сюжетной точки",
  type: "intro",
  triggers: [],
  consequences: [],
  requirements: {
    level: 1,
    reputation: 0
  }
})

// Создание новой сцены
export const createNewScene = () => ({
  id: generateUniqueId('scene-'),
  title: "Новая сцена",
  description: "Описание сцены",
  type: "dialogue",
  characters: [],
  choices: [],
  requirements: {
    level: 1,
    reputation: 0
  }
})

// Функция для глубокого клонирования объекта
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T
  }
  
  const cloned = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  
  return cloned
}

// Функция для сравнения объектов
export const isEqual = (obj1: any, obj2: any): boolean => {
  return JSON.stringify(obj1) === JSON.stringify(obj2)
}

// Функция для получения вложенного свойства объекта
export const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}

// Функция для установки вложенного свойства объекта
export const setNestedValue = (obj: any, path: string, value: any): any => {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }
    return current[key]
  }, obj)
  
  target[lastKey] = value
  return obj
}
