import type { CharacterRelation, SubjectCoreState } from '../domain/types';
import type { RelationshipDynamics } from '../infrastructure/relationshipDynamicsRepo';

export type CommandPresentation = {
  phase: 'executing' | 'refused';
  executorId: string;
  targetId?: string;
  executorNow: string;
  targetNow: string;
  observerNow: string;
};

/**
 * The engine commits a transition before speech is generated so the UI can
 * update immediately. A model must therefore not turn that current state into
 * an assertion that it existed before the command.
 */
type Input = {
  performed: boolean;
  executorId: string;
  executorName: string;
  targetId?: string;
  targetName?: string;
  actionLabel: string;
  requesterName: string;
  relationToRequester?: CharacterRelation | null;
  relationToTarget?: CharacterRelation | null;
  dynamics: RelationshipDynamics;
  core: SubjectCoreState;
  role?: string;
};

/**
 * Turns a mechanical command decision into present-tense, observable scene
 * facts. It intentionally contains no imperative or post-factum wording: the
 * simulation has committed the state transition, while dialogue occurs during
 * the action represented by that tick.
 */
export function presentCommand(input: Input): CommandPresentation {
  const target = input.targetName || 'собеседнику';
  const relationToTarget = input.relationToTarget?.attitude ?? 50;
  const relationToRequester = input.relationToRequester?.attitude ?? 50;

  if (!input.performed) {
    const reason = input.dynamics.fear >= 45
      ? 'напряжение заметно сковывает её, но она всё же удерживает границу'
      : relationToTarget >= 65
        ? `она не хочет делать с ${target} то, что считает неправильным`
        : input.core.capacity <= 25
          ? 'у неё слишком мало сил для нового действия'
          : 'она не готова переступить через собственное решение';
    return {
      phase: 'refused', executorId: input.executorId, targetId: input.targetId,
      executorNow: `${input.executorName} не начинает «${input.actionLabel}»: ${reason}.`,
      targetNow: `${input.executorName} не начинает «${input.actionLabel}». По её виду заметно, что она не готова на это пойти.`,
      observerNow: `${input.executorName} не приступает к действию; в её позе и тоне читается твёрдое нежелание.`,
    };
  }

  let motive: string;
  let manner: string;
  if (input.targetId && relationToTarget >= 65) {
    motive = `ей важно помочь ${target}`;
    manner = 'бережно и внимательно следя за реакцией';
  } else if (['staff', 'assistant'].includes(input.role || '')) {
    motive = 'она воспринимает это как понятную рабочую задачу';
    manner = 'собранно и деловито';
  } else if (relationToRequester >= 65) {
    motive = `она доверяет оценке ${input.requesterName}`;
    manner = 'спокойно, без лишних колебаний';
  } else if (input.dynamics.fear >= 45) {
    motive = 'ей трудно спорить в этой обстановке';
    manner = 'напряжённо, избегая лишних взглядов';
  } else if (input.dynamics.learnedCompliance >= 65 && input.core.capacity <= 35) {
    motive = 'привычка следовать знакомому ходу ситуации оказывается сильнее желания спорить';
    manner = 'скупо и заторможенно, будто экономя силы';
  } else if (input.core.capacity <= 25) {
    motive = 'она выбирает самый простой способ закончить этот момент';
    manner = 'медленно и без лишних движений';
  } else {
    motive = 'она решает не превращать просьбу в конфликт';
    manner = 'с короткой паузой, но без демонстративного протеста';
  }

  const action = input.targetId
    ? `${input.executorName} сейчас выполняет «${input.actionLabel}» в отношении ${target}`
    : `${input.executorName} сейчас выполняет «${input.actionLabel}»`;
  return {
    phase: 'executing', executorId: input.executorId, targetId: input.targetId,
    executorNow: `${action}. ${motive}; это проявляется ${manner}.`,
    targetNow: `${action}. Снаружи это выглядит ${manner}.`,
    observerNow: `${action}; со стороны это выглядит ${manner}.`,
  };
}
