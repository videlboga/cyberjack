export type SexMachineStimulationMode = 'vaginal' | 'anal' | 'tickling' | 'circular_saw';

export const SEX_MACHINE_STIMULATION = {
  vaginal: { label:'Вагинальный контакт', description:'Базовая внутренняя траектория секс-машины.', pointId:'vagina', visual:'restrained', tags:['sexual','vaginal','penetration','continuous','machine'] },
  anal: { label:'Анальный контакт', description:'Глубокий механический контакт по анальной траектории.', pointId:'anus', visual:'sex_machine', tags:['sexual','anal','penetration','continuous','machine','exposure','humiliation'] },
  tickling: { label:'Щекотка ступней', description:'Фиксированные ступни проходят через серии управляемой щекотки с меняющимся ритмом.', pointId:'feet', visual:'tickling', tags:['tickling','feet','continuous','machine'] },
  circular_saw: { label:'Ротационный стимулятор', description:'Вращающийся силиконовый контур по передней точке с непрерывным ротационным контактом.', pointId:'clitoris', visual:'circularsaw', tags:['sexual','clitoral','machine','continuous','rotary','silicone'] },
} as const;

/**
 * Каждый независимый модуль секс-машины фиксирует один режим стимуляции.
 * Ключ — id лабораторного модуля (lab_sex_machine_<mode>).
 */
export const SEX_MACHINE_ASSETS: Record<string, SexMachineStimulationMode> = {
  lab_sex_machine_vaginal: 'vaginal',
  lab_sex_machine_anal: 'anal',
  lab_sex_machine_tickling: 'tickling',
  lab_sex_machine_circularsaw: 'circular_saw',
};

export const isSexMachineAsset = (assetId: string): boolean =>
  assetId in SEX_MACHINE_ASSETS;

/** Режим модуля секс-машины по id устройства (независимые модули). */
export const sexMachineModeForAsset = (assetId: string): SexMachineStimulationMode | null =>
  SEX_MACHINE_ASSETS[assetId] ?? null;

export const sexMachineStimulation = (mode: unknown) =>
  mode === 'tickling' ? SEX_MACHINE_STIMULATION.tickling
    : mode === 'anal' ? SEX_MACHINE_STIMULATION.anal
      : mode === 'circular_saw' ? SEX_MACHINE_STIMULATION.circular_saw
        : SEX_MACHINE_STIMULATION.vaginal;

/** Маппинг аффекта в имя файла для структурного режима (restrained/tickling/sex_machine). */
const STANDARD_AFFECT_FILE: Record<string, string> = {
  climax: 'climax', guarded: 'guarded', high_negative: 'high_negative',
  high_positive: 'high_positive', receptive: 'receptive', subspace: 'subspace', neutral: 'neutral',
};

/**
 * Путь к аватару персонажа на секс-машине.
 *
 * circularsaw использует отдельную структуру кадров:
 *  - pose/<slug>__<affect>_spinning.png  — машина работает (спиннинг)
 *  - pose/<slug>__<affect>_stopped.png   — машина выключена (в позе)
 *  - stopped_near/<slug>__<affect>.png   — машина выключена (антисипация/рядом)
 * Остальные режимы — единый набор <visual>__<affect>.png.
 */
export const sexMachineAvatarPath = (characterSlug: string, mode: unknown, affect: string, running: boolean) => {
  if (mode === 'circular_saw') {
    if (running) {
      // Вращение: только сильные аффекты; прочие маппим на базовый спиннинг.
      const spinAffect =
        affect === 'climax' ? 'climax'
          : affect === 'high_negative' ? 'high_negative'
            : affect === 'high_positive' ? 'high_positive'
              : 'high_positive';
      return `/character-images/sex-machine/circularsaw/pose/${characterSlug}__${spinAffect}_spinning.png`;
    }
    // Не запущена: active у машины (или рядом) — кадр stopped_near/pose.
    const nearAffect =
      affect === 'anticipation' || affect === 'dread' || affect === 'neutral' || affect === 'receptive' || affect === 'subspace'
        ? affect
        : affect === 'guarded' ? 'neutral'
          : affect === 'climax' || affect === 'high_positive' ? 'receptive'
            : affect === 'high_negative' ? 'dread'
              : 'neutral';
    return `/character-images/sex-machine/circularsaw/stopped_near/${characterSlug}__${nearAffect}.png`;
  }
  const stim = sexMachineStimulation(mode);
  const modeDir = mode === 'tickling' ? 'tickling' : mode === 'anal' ? 'anal' : 'vaginal';
  if (running) {
    return `/character-images/sex-machine/${modeDir}/${characterSlug}__${stim.visual}__${affect}.png`;
  }
  // Stopped state has its own dedicated frames per mode.
  if (mode === 'tickling') {
    return `/character-images/sex-machine/tickling/stopped/${characterSlug}__${affect}.png`;
  }
  return `/character-images/sex-machine/${modeDir}/stop/${modeDir}__${characterSlug}__stop__${affect}.png`;
};
