import { describe, expect, it } from 'vitest';
import { presentCommand } from './commandPresentation';

const base = {
  executorId: 'NPC-CAND-01',
  executorName: 'Ника',
  targetId: 'NPC-CAND-SUMI',
  targetName: 'Суми',
  actionLabel: 'Массировать ступни',
  requesterName: 'Калибратор',
  relationToRequester: { fromId: 'a', toId: 'b', knows: true, present: true, canInteract: true, attitude: 50 },
  relationToTarget: { fromId: 'a', toId: 'b', knows: true, present: true, canInteract: true, attitude: 75 },
  dynamics: {
    subjectId: 'NPC-CAND-01', actorId: 'PL-1', resistance: 0,
    learnedCompliance: 0, dependency: 0, dissociation: 0, fear: 0,
  },
  core: { sensitivity: 50, capacity: 60, openness: 50, plasticity: 50, attitude: 50, tension: 20 },
};

describe('presentCommand', () => {
  it('frames a performed command as an action happening now', () => {
    const presentation = presentCommand({ ...base, performed: true });

    expect(presentation.phase).toBe('executing');
    expect(presentation.executorNow).toContain('сейчас выполняет');
    expect(presentation.targetNow).toContain('Снаружи');
    expect(presentation.executorNow).not.toMatch(/уже выполнил|подчинени|гипноз/i);
  });

  it('gives a refusal an observable present-tense form', () => {
    const presentation = presentCommand({ ...base, performed: false });

    expect(presentation.phase).toBe('refused');
    expect(presentation.executorNow).toContain('не начинает');
    expect(presentation.observerNow).toContain('не приступает');
  });
});
