// types/database.ts

import { User, Character, Characteristic, CharacteristicDefinition, CharacterAnatomy, AnatomyDefinition, CharacterPose, PoseDefinition, PoseAngle, ActiveZone, Action, CharacterCopy, CharacterKnowledge, Session, StoryPoint, Scene, Screen, Choice, StationEntity, UserRole, StoryPointType } from '@prisma/client'

// Enum для уровней знаний (соответствует Prisma схеме)
export enum KnowledgeLevel {
  UNKNOWN = 'UNKNOWN',
  APPROXIMATE = 'APPROXIMATE',
  DETAILED = 'DETAILED',
  PRECISE = 'PRECISE'
}

// Базовые типы из Prisma
export type {
  User,
  Character,
  Characteristic,
  CharacteristicDefinition,
  CharacterAnatomy,
  AnatomyDefinition,
  CharacterPose,
  PoseDefinition,
  PoseAngle,
  ActiveZone,
  Action,
  CharacterCopy,
  CharacterKnowledge,
  Session,
  StoryPoint,
  Scene,
  Screen,
  Choice,
  StationEntity,
  UserRole,
  StoryPointType
}

// Расширенные типы с включениями
export type CharacterWithDetails = Character & {
  characteristics: (Characteristic & {
    definition: CharacteristicDefinition
  })[]
  anatomy: (CharacterAnatomy & {
    definition: AnatomyDefinition
  })[]
  poses: (CharacterPose & {
    definition: PoseDefinition
  })[]
}

export type CharacterWithCharacteristics = Character & {
  characteristics: (Characteristic & {
    definition: CharacteristicDefinition
  })[]
}

export type CharacterWithAnatomy = Character & {
  anatomy: (CharacterAnatomy & {
    definition: AnatomyDefinition
  })[]
}

export type CharacterWithPoses = Character & {
  poses: (CharacterPose & {
    definition: PoseDefinition & {
      angles: (PoseAngle & {
        zones: (ActiveZone & {
          anatomy: AnatomyDefinition | null
        })[]
      })[]
    }
  })[]
}

export type UserWithDetails = User & {
  characterCopies: (CharacterCopy & {
    character: Character
  })[]
  characterKnowledge: (CharacterKnowledge & {
    character: Character
    characteristic: CharacteristicDefinition | null
  })[]
}

export type PoseWithAngles = PoseDefinition & {
  angles: (PoseAngle & {
    zones: (ActiveZone & {
      anatomy: AnatomyDefinition | null
    })[]
  })[]
}

export type SceneWithScreens = Scene & {
  screens: (Screen & {
    choices: Choice[]
  })[]
}

// Типы для API
export interface ActionResult {
  success: boolean
  effects: ActionEffect[]
  message: string
}

export interface ActionEffect {
  characteristicId: string
  change: number
  permanent: boolean
}

export interface CharacteristicChange {
  characteristicId: string
  change: number
  permanent?: boolean
}

export interface CharacteristicReveal {
  characteristicId: string
  level: KnowledgeLevel
  value: number
  accuracy: number
}

// Типы для системы времени
export interface TimeUpdate {
  gameTime: number
  formattedTime: string
  isRunning: boolean
}

// Типы для Character AI
export interface AIResponse {
  response: string
  characterId: string
  timestamp: Date
}

export interface CharacterContext {
  lastAction?: string
  currentPose?: string
  userModifiers?: Record<string, number>
}

// Типы для админ-панели
export interface AdminConfig {
  characteristics: CharacteristicDefinition[]
  actions: Action[]
  poses: PoseDefinition[]
  anatomy: AnatomyDefinition[]
  storyPoints: StoryPoint[]
}

// Типы для валидации
export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  success: boolean
  errors: ValidationError[]
}

// Типы для экспорта/импорта
export interface ExportData {
  characters: CharacterWithDetails[]
  characteristics: CharacteristicDefinition[]
  actions: Action[]
  poses: PoseDefinition[]
  anatomy: AnatomyDefinition[]
  storyPoints: StoryPoint[]
  scenes: SceneWithScreens[]
}

export interface ImportResult {
  success: boolean
  imported: {
    characters: number
    characteristics: number
    actions: number
    poses: number
    anatomy: number
    storyPoints: number
    scenes: number
  }
  errors: string[]
}
