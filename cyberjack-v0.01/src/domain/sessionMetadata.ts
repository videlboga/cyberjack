/**
 * Этап 9. Типизация device/mental session metadata.
 *
 * Раньше `deviceSession`/`mentalSession` в metadata лабораторного актива
 * были `Record<string, any>`. Введён типизированный контракт.
 */

export type DeviceStimulationMode = 'penetration' | 'tickling' | 'vibration' | 'pulse' | 'wave' | 'random';
export type DeviceRhythm = 'steady' | 'pulse' | 'wave' | 'random';
export type DeviceOrgasmPolicy = 'allow' | 'deny' | 'force';
export type DeviceStatus = 'idle' | 'running' | 'paused' | 'stopped';

/** Сессия секс-машины / устройства в metadata лабораторного актива. */
export interface DeviceSessionMetadata {
  subjectId?: string;
  status?: DeviceStatus;
  intensity?: number;
  stimulationMode?: DeviceStimulationMode;
  rhythm?: DeviceRhythm;
  orgasmPolicy?: DeviceOrgasmPolicy;
  startedAtTick?: number;
}

export type MentalSessionPhase = 'recall' | 'immersion' | 'consolidation';

/** Сессия ментальной коррекции (кресло) в metadata лабораторного актива. */
export interface MentalSessionMetadata {
  status?: DeviceStatus;
  phase?: MentalSessionPhase;
  memoryText?: string;
  focusTag?: string;
}
