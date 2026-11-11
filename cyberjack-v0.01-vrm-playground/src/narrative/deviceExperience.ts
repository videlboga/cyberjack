export type DeviceExperienceSession = {
  intensity?: number;
  rhythm?: string;
  targetMode?: string;
  stimulationMode?: string;
};

function intensityBand(intensity: number) {
  if (intensity <= 30) return 'едва заметной настойчивостью';
  if (intensity <= 50) return 'мягкой, но ощутимой настойчивостью';
  if (intensity <= 70) return 'уверенным глубоким нажимом';
  if (intensity <= 85) return 'сильным, требовательным нажимом';
  return 'предельной интенсивностью, почти не оставляющей передышки';
}

const directPressure = (intensity: number) => intensity <= 30 ? 'лёгким, но настойчивым давлением'
  : intensity <= 50 ? 'ощутимым давлением, которое не даёт мышцам расслабиться'
  : intensity <= 70 ? 'глубоким и требовательным давлением'
  : intensity <= 85 ? 'сильным давлением, от которого тело невольно напрягается'
  : 'предельным давлением почти без передышки';

export function describeDeviceMotion(session: DeviceExperienceSession): string {
  const rhythm = session.rhythm || 'steady';
  if (session.stimulationMode === 'tickling') {
    const pattern = rhythm === 'pulse'
      ? 'серии быстрых щекочущих касаний с различимыми паузами'
      : rhythm === 'wave'
        ? 'щекочущие касания, которые плавно учащаются и редеют'
        : rhythm === 'random'
          ? 'сбивчивые щекочущие касания с непредсказуемой сменой точек'
          : 'ровные повторяющиеся щекочущие касания';
    const intensity = Number(session.intensity || 0);
    const pressure = intensity <= 30 ? 'едва касаясь кожи'
      : intensity <= 50 ? 'настойчиво проходя по чувствительным местам'
      : intensity <= 70 ? 'жёстко врезаясь щетинками в подошвы'
      : intensity <= 85 ? 'безжалостно прочёсывая подошвы и пальцы'
      : 'на пределе, не оставляя ногам ни секунды покоя';
    return `${pattern}, ${pressure}`;
  }
  const pattern = rhythm === 'pulse'
    ? 'серии коротких толчков с различимыми паузами'
    : rhythm === 'wave'
      ? 'длинные волны, которые плавно ускоряются и замедляются'
      : rhythm === 'random'
        ? 'сбивчивые, непредсказуемо меняющиеся толчки'
        : 'ровное повторяющееся внутреннее движение';
  return `${pattern} с ${intensityBand(Number(session.intensity || 0))}`;
}

export function describeDeviceSensation(session: DeviceExperienceSession): string {
  if (session.stimulationMode === 'tickling') return `Ступни зажаты в держателях. Щётки работают по подошвам, под пальцами и вдоль сводов: ${describeDeviceMotion(session)}. Ноги дёргаются и пытаются уйти от щекотки, но фиксаторы не дают их отдёрнуть.`;
  if (session.stimulationMode === 'anal') return `Поршень в анусе продолжает ${describeDeviceMotion(session)}. Он растягивает мышцы изнутри ${directPressure(Number(session.intensity || 0))}; после каждого движения остаются давление и трение до следующего хода.`;
  return `Поршень во влагалище продолжает ${describeDeviceMotion(session)}. Он давит на стенки изнутри ${directPressure(Number(session.intensity || 0))}; после каждого движения остаются давление и трение до следующего хода.`;
}

export function describeDeviceAction(session: DeviceExperienceSession): string {
  if (session.stimulationMode === 'tickling') return `Секс-машина: щекочущий протокол — ${describeDeviceMotion(session)}`;
  return `Секс-машина: ${session.stimulationMode === 'anal' ? 'анальное' : 'вагинальное'} воздействие — ${describeDeviceMotion(session)}`;
}

export function describeDeviceProtocolEvent(
  command: 'configure' | 'settings' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop',
  next: DeviceExperienceSession,
  previous?: DeviceExperienceSession,
): string {
  if (command === 'start') return `Механизм приходит в движение: ${describeDeviceSensation(next)}`;
  if (command === 'resume') return `Механизм вновь приходит в движение: ${describeDeviceSensation(next)}`;
  if (command === 'pause') return 'Движение внутри останавливается; остаются тепло, остаточное давление и ожидание продолжения.';
  if (command === 'stop') return 'Механизм останавливается окончательно; внутреннее давление постепенно отпускает, оставляя тело без привычного ритма.';

  const beforeMotion = previous ? describeDeviceMotion(previous) : '';
  const afterMotion = describeDeviceMotion(next);
  if (previous?.rhythm && previous.rhythm !== next.rhythm) {
    return `Ход механизма меняется: ${beforeMotion}; теперь — ${afterMotion}.`;
  }
  if (previous && Number(next.intensity || 0) > Number(previous.intensity || 0)) {
    return `Механизм усиливает ход: ${afterMotion}.`;
  }
  if (previous && Number(next.intensity || 0) < Number(previous.intensity || 0)) {
    return `Механизм ослабляет ход: ${afterMotion}.`;
  }
  return `Механизм перенастраивает воздействие: ${describeDeviceSensation(next)}`;
}

/** Brief operator-facing log line.  The sensory variant above is for the
 * affected character's context, never for the public chat feed. */
export function describeDeviceProtocolSummary(
  command: 'configure' | 'settings' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop',
): string {
  const summary = {
    configure: 'Конфигурация секс-машины изменена.',
    settings: 'Параметры протокола обновлены.',
    start: 'Секс-машина запущена.',
    adjust: 'Интенсивность воздействия изменена.',
    pause: 'Секс-машина поставлена на паузу.',
    resume: 'Секс-машина возобновлена.',
    stop: 'Секс-машина остановлена.',
  };
  return summary[command];
}
