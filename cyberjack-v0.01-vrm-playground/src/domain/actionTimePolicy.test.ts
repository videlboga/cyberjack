import { describe, expect, it } from 'vitest';
import { actionTimePolicy } from './actionTimePolicy';

describe('action time policy', () => {
  it('starts a sustained process now with a reduced onset impulse', () => {
    expect(actionTimePolicy('act_start_vibrator')).toEqual({
      stateDeltaScale:.35,
      kind:'process_start',
    });
  });

  it('changes an active process without time skipping or stackable state gain', () => {
    expect(actionTimePolicy('act_adjust_electrostimulation')).toEqual({
      stateDeltaScale:0,
      kind:'process_control',
    });
  });

  it('applies a full immediate state delta for a discrete action', () => {
    expect(actionTimePolicy('light_touch')).toEqual({
      stateDeltaScale:1,
      kind:'discrete',
    });
  });
});
