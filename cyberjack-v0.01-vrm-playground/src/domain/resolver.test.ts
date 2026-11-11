import { describe, expect, it } from 'vitest';
import { resolveInteractionActionCandidate, resolveStopActionCandidate } from './resolver';

const presets = [
  {
    id: 'act_end_feet_presentation',
    tags: ['comfort'],
    requireContexts: ['act_present_feet'],
    removeContexts: ['act_present_feet'],
    validTargets: ['feet'],
  },
  {
    id: 'act_end_exposure',
    tags: ['comfort'],
    requireContexts: ['act_hold_exposure'],
    removeContexts: ['act_hold_exposure'],
    validTargets: ['systemic'],
  },
];

describe('semantic interaction resolver', () => {
  it('chooses the applicable stop action instead of an impossible suggested sibling', () => {
    const result = resolveStopActionCandidate({
      presets,
      activeContextIds: ['act_hold_exposure'],
      suggestedActionId: 'act_end_feet_presentation',
      pointId: 'feet',
    });
    expect(result?.id).toBe('act_end_exposure');
  });

  it('keeps the suggested action when its required interaction is active', () => {
    const result = resolveStopActionCandidate({
      presets,
      activeContextIds: ['act_present_feet'],
      suggestedActionId: 'act_end_feet_presentation',
      pointId: 'feet',
    });
    expect(result?.id).toBe('act_end_feet_presentation');
  });

  it('resolves an adjustment only against an active parent interaction', () => {
    const result = resolveInteractionActionCandidate({
      presets: [...presets, {
        id: 'act_increase_friction',
        requireContexts: ['act_start_penetration'],
        contextConfig: { type: 'interaction_level' },
        validTargets: ['vagina'],
      }],
      activeContextIds: ['act_start_penetration'],
      goal: 'adjust',
      suggestedActionId: 'act_increase_friction',
      pointId: 'vagina',
    });
    expect(result?.id).toBe('act_increase_friction');
  });
});
