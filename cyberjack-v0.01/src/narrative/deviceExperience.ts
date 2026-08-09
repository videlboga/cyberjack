export type DeviceExperienceSession = {
  intensity?: number;
  rhythm?: string;
  targetMode?: string;
};

function intensityBand(intensity: number) {
  if (intensity <= 30) return 'едва заметной настойчивостью';
  if (intensity <= 50) return 'мягкой, но ощутимой настойчивостью';
  if (intensity <= 70) return 'уверенным глубоким нажимом';
  if (intensity <= 85) return 'сильным, требовательным нажимом';
  return 'предельной интенсивностью, почти не оставляющей передышки';
}

export function describeDeviceMotion(session: DeviceExperienceSession): string {
  const rhythm = session.rhythm || 'steady';
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
  return `Механизм продолжает ${describeDeviceMotion(session)}. Давление, движение и трение идут по одной траектории, а след предыдущего движения остаётся до следующего.`;
}

export function describeDeviceAction(session: DeviceExperienceSession): string {
  return `Секс-машина: внутреннее воздействие — ${describeDeviceMotion(session)}`;
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
