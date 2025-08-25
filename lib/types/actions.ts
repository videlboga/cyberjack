// Типы для системы действий и инструментов
import { EffectType, RoomType } from './character'

export interface Action {
  id: string
  name: string
  category: ActionCategory
  tool: ToolType
  targetArea: string
  intensity: number           // Интенсивность действия (0-10)
  duration: number            // Длительность в секундах
  effects: ActionEffect[]
  requirements: ActionRequirements
  cooldown: number            // Время перезарядки в секундах
}

export enum ActionCategory {
  PHYSICAL = 'physical',      // Физические воздействия
  STIMULATION = 'stimulation', // Стимуляция
  RESTRAINT = 'restraint',    // Ограничения
  PSYCHOLOGICAL = 'psychological' // Психологические
}

export enum ToolType {
  HAND = 'hand',              // Рука
  WHIP = 'whip',              // Плеть/Хлыст
  VIBRATOR = 'vibrator',      // Вибратор
  ELECTROSTIM = 'electrostim', // Электростимулятор
  THERMO = 'thermo',          // Термоустройство
  BRUSH = 'brush',            // Щетка
  ROPE = 'rope',              // Веревка
  CHAIN = 'chain',            // Цепь
  COLLAR = 'collar',          // Ошейник
  HANDCUFFS = 'handcuffs'     // Наручники
}

export interface ActionEffect {
  type: EffectType
  intensity: number
  duration: number
  targetStats: string[]       // На какие характеристики влияет
  targetAreas: string[]       // На какие области тела влияет
}

export interface ActionRequirements {
  toolAvailable: boolean      // Доступен ли инструмент
  targetAreaAccessible: boolean // Доступна ли область
  characterConsent?: boolean  // Согласие персонажа (для некоторых действий)
  equipmentRequired?: string[] // Требуемое оборудование
}

export interface QuickAction {
  id: string
  name: string
  category: QuickActionCategory
  description: string
  icon: string
  requirements: QuickActionRequirements
  effects: QuickActionEffect[]
  cooldown: number
}

export enum QuickActionCategory {
  POSE = 'pose',              // Смена позы
  SPEECH = 'speech',          // Заставить говорить
  MOVEMENT = 'movement',      // Перемещение
  CLOTHING = 'clothing',      // Изменение одежды
  EQUIPMENT = 'equipment'     // Активация оборудования
}

export interface QuickActionRequirements {
  characterObedience?: number // Требуемое послушание
  characterTrust?: number     // Требуемое доверие
  equipmentAvailable?: string[] // Доступное оборудование
  roomType?: RoomType         // Требуемый тип комнаты
}

export interface QuickActionEffect {
  type: string
  value: any
  duration?: number
}

// Предопределенные действия
export const PREDEFINED_ACTIONS: Action[] = [
  // Физические воздействия
  {
    id: 'strike',
    name: 'Ударить',
    category: ActionCategory.PHYSICAL,
    tool: ToolType.HAND,
    targetArea: 'body',
    intensity: 5,
    duration: 1,
    effects: [
      {
        type: EffectType.PAIN,
        intensity: 5,
        duration: 30,
        targetStats: ['painTolerance', 'fear'],
        targetAreas: ['body']
      }
    ],
    requirements: {
      toolAvailable: true,
      targetAreaAccessible: true
    },
    cooldown: 5
  },
  {
    id: 'caress',
    name: 'Погладить',
    category: ActionCategory.PHYSICAL,
    tool: ToolType.HAND,
    targetArea: 'body',
    intensity: 3,
    duration: 2,
    effects: [
      {
        type: EffectType.PLEASURE,
        intensity: 3,
        duration: 60,
        targetStats: ['pleasureResponse', 'trust'],
        targetAreas: ['body']
      }
    ],
    requirements: {
      toolAvailable: true,
      targetAreaAccessible: true
    },
    cooldown: 2
  },
  {
    id: 'tickle',
    name: 'Щекотать',
    category: ActionCategory.STIMULATION,
    tool: ToolType.BRUSH,
    targetArea: 'sensitive_areas',
    intensity: 4,
    duration: 5,
    effects: [
      {
        type: EffectType.STIMULATION,
        intensity: 4,
        duration: 120,
        targetStats: ['sensitivity', 'arousal'],
        targetAreas: ['sensitive_areas']
      }
    ],
    requirements: {
      toolAvailable: true,
      targetAreaAccessible: true
    },
    cooldown: 10
  },
  {
    id: 'whip',
    name: 'Ударить плетью',
    category: ActionCategory.PHYSICAL,
    tool: ToolType.WHIP,
    targetArea: 'body',
    intensity: 8,
    duration: 1,
    effects: [
      {
        type: EffectType.PAIN,
        intensity: 8,
        duration: 180,
        targetStats: ['painTolerance', 'fear', 'obedience'],
        targetAreas: ['body']
      }
    ],
    requirements: {
      toolAvailable: true,
      targetAreaAccessible: true
    },
    cooldown: 15
  },
  {
    id: 'vibrate',
    name: 'Вибрация',
    category: ActionCategory.STIMULATION,
    tool: ToolType.VIBRATOR,
    targetArea: 'sensitive_areas',
    intensity: 6,
    duration: 10,
    effects: [
      {
        type: EffectType.STIMULATION,
        intensity: 6,
        duration: 300,
        targetStats: ['sensitivity', 'arousal', 'pleasureResponse'],
        targetAreas: ['sensitive_areas']
      }
    ],
    requirements: {
      toolAvailable: true,
      targetAreaAccessible: true
    },
    cooldown: 20
  },
  {
    id: 'electroshock',
    name: 'Электрошок',
    category: ActionCategory.STIMULATION,
    tool: ToolType.ELECTROSTIM,
    targetArea: 'body',
    intensity: 7,
    duration: 2,
    effects: [
      {
        type: EffectType.PAIN,
        intensity: 7,
        duration: 240,
        targetStats: ['painTolerance', 'fear', 'obedience'],
        targetAreas: ['body']
      }
    ],
    requirements: {
      toolAvailable: true,
      targetAreaAccessible: true
    },
    cooldown: 30
  }
]

// Предопределенные быстрые действия
export const PREDEFINED_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'change_pose',
    name: 'Сменить позу',
    category: QuickActionCategory.POSE,
    description: 'Заставить актив сменить позу',
    icon: '🔄',
    requirements: {
      characterObedience: 3
    },
    effects: [
      {
        type: 'pose_change',
        value: 'random'
      }
    ],
    cooldown: 10
  },
  {
    id: 'force_speak',
    name: 'Заставить говорить',
    category: QuickActionCategory.SPEECH,
    description: 'Принудить актив к разговору',
    icon: '💬',
    requirements: {
      characterObedience: 5
    },
    effects: [
      {
        type: 'speech_trigger',
        value: true
      }
    ],
    cooldown: 15
  },
  {
    id: 'move_room',
    name: 'Переместить',
    category: QuickActionCategory.MOVEMENT,
    description: 'Переместить актив в другую комнату',
    icon: '🚪',
    requirements: {
      characterObedience: 4
    },
    effects: [
      {
        type: 'room_change',
        value: 'random'
      }
    ],
    cooldown: 30
  },
  {
    id: 'change_clothing',
    name: 'Изменить одежду',
    category: QuickActionCategory.CLOTHING,
    description: 'Сменить одежду актива',
    icon: '👕',
    requirements: {
      characterObedience: 3
    },
    effects: [
      {
        type: 'clothing_change',
        value: 'random'
      }
    ],
    cooldown: 20
  }
]

// Области тела для взаимодействия
export const BODY_AREAS = {
  head: { name: 'Голова', x: 45, y: 15, width: 10, height: 15 },
  neck: { name: 'Шея', x: 45, y: 30, width: 10, height: 8 },
  chest: { name: 'Грудь', x: 40, y: 35, width: 20, height: 12 },
  waist: { name: 'Талия', x: 42, y: 47, width: 16, height: 8 },
  thighs: { name: 'Бедра', x: 35, y: 55, width: 30, height: 15 },
  hands: { name: 'Руки', x: 35, y: 45, width: 8, height: 12 },
  feet: { name: 'Ноги', x: 40, y: 70, width: 20, height: 15 },
  sensitive_areas: { name: 'Чувствительные зоны', x: 42, y: 50, width: 16, height: 10 }
}
