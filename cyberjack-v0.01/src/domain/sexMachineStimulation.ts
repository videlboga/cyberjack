export type SexMachineStimulationMode = 'vaginal' | 'anal' | 'tickling';

export const SEX_MACHINE_STIMULATION = {
  vaginal: { label:'Вагинальная стимуляция', description:'Базовая внутренняя траектория секс-машины.', pointId:'vagina', visualSet:'restrained', tags:['sexual','vaginal','penetration','continuous','machine'] },
  anal: { label:'Анальная стимуляция', description:'Глубокий механический контакт по анальной траектории.', pointId:'anus', visualSet:'sex_machine', tags:['sexual','anal','penetration','continuous','machine','exposure','humiliation'] },
  tickling: { label:'Щекотка ступней', description:'Фиксированные ступни проходят через серии управляемой щекотки с меняющимся ритмом.', pointId:'feet', visualSet:'tickling', tags:['tickling','feet','continuous','machine'] },
} as const;

/**
 * Каждый независимый модуль секс-машины фиксирует один режим стимуляции.
 * Ключ — id лабораторного модуля (lab_sex_machine_<mode>).
 */
export const SEX_MACHINE_ASSETS: Record<string, SexMachineStimulationMode> = {
  lab_sex_machine_vaginal: 'vaginal',
  lab_sex_machine_anal: 'anal',
  lab_sex_machine_tickling: 'tickling',
};

export const isSexMachineAsset = (assetId: string): boolean =>
  assetId in SEX_MACHINE_ASSETS;

/** Режим модуля секс-машины по id устройства (независимые модули). */
export const sexMachineModeForAsset = (assetId: string): SexMachineStimulationMode | null =>
  SEX_MACHINE_ASSETS[assetId] ?? null;

export const sexMachineStimulation = (mode: unknown) =>
  mode === 'tickling' ? SEX_MACHINE_STIMULATION.tickling
    : mode === 'anal' ? SEX_MACHINE_STIMULATION.anal
      : SEX_MACHINE_STIMULATION.vaginal;

export const sexMachineAvatarPath = (characterSlug: string, mode: unknown, affect: string, running: boolean) => {
  const stim = sexMachineStimulation(mode);
  const modeDir = mode === 'tickling' ? 'tickling' : mode === 'anal' ? 'anal' : 'vaginal';
  if (running) {
    return `/character-images/sex-machine/${modeDir}/${characterSlug}__${stim.visualSet}__${affect}.png`;
  }
  // Stopped state has its own dedicated frames per mode.
  if (mode === 'tickling') {
    return `/character-images/sex-machine/tickling/stopped/${characterSlug}__${affect}.png`;
  }
  return `/character-images/sex-machine/${modeDir}/stop/${modeDir}__${characterSlug}__stop__${affect}.png`;
};
