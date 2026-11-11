import { describe, expect, it } from 'vitest';
import { runTick } from '../src/engine/runTick';
import { constrainCapacityWhileUnresponsive } from '../src/orchestration/runGameTick';
import type { CompiledAction, SubjectCoreState, SubjectPointState } from '../src/domain/types';

const core = (): SubjectCoreState => ({
  sensitivity: 55, capacity: 60, openness: 50, plasticity: 60, attitude: 50, tension: 0,
  baselineSensitivity: 55, baselineCapacity: 60, baselineOpenness: 50,
  baselinePlasticity: 60, baselineAttitude: 50,
});
const point = (): SubjectPointState => ({
  pointId: 'zone', localSensitivity: 55, localAttitude: 50, localOpenness: 50,
  familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 55,
  baselineLocalAttitude: 50, baselineLocalOpenness: 50,
});
const action: CompiledAction = { actionKey: 'pleasant', label: 'Pleasant', type: 'physical', tags: [], intensity: .4, valence: 1, contact: .5, sharpness: 0, novelty: .8 };
const wait: CompiledAction = { actionKey: 'wait', label: 'Wait', type: 'system', tags: [], intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 };

describe('state lifecycle invariants', () => {
  it('preserves and accumulates tension across active ticks', () => {
    const first = runTick({ subjectId: 's', pointId: 'zone', action, core: core(), point: point() });
    const second = runTick({ subjectId: 's', pointId: 'zone', action, core: first.nextCore, point: first.nextPoint });
    expect(first.nextCore.tension).toBeGreaterThan(0);
    expect(second.tickMeta.inputs.core.tension).toBeCloseTo(first.nextCore.tension);
    expect(second.nextCore.tension).toBeGreaterThan(first.nextCore.tension);
  });

  it('reduces accumulated tension while waiting', () => {
    const charged = { ...core(), tension: 40 };
    const output = runTick({ subjectId: 's', pointId: 'zone', action: wait, core: charged, point: point() });
    expect(output.nextCore.tension).toBeLessThan(40);
  });

  it('does not make a long pause look like an instant discharge', () => {
    const charged = { ...core(), tension: 66, openness: 70 };
    const output = runTick({ subjectId: 's', pointId: 'zone', action: wait, core: charged, point: point(), deltaTime: 8 });
    expect(output.nextCore.tension).toBeGreaterThan(35);
    expect(output.nextCore.tension).toBeLessThan(66);
  });

  it('updates, preserves and adapts local openness', () => {
    const output = runTick({ subjectId: 's', pointId: 'zone', action, core: core(), point: point() });
    expect(output.nextPoint.localOpenness).toBeGreaterThan(50);
    expect(output.delta.point.localOpenness).toBeGreaterThan(0);
    expect(output.nextPoint.baselineLocalOpenness).toBeGreaterThan(50);
  });

  it('does not let stimulation restore capacity while unresponsive', () => {
    expect(constrainCapacityWhileUnresponsive({
      previousCapacity: 0, proposedCapacity: 28, isRest: false, elapsedTime: 1,
    })).toBe(0);
  });

  it('requires several pauses to recover from complete collapse', () => {
    const recover = (previousCapacity: number) => constrainCapacityWhileUnresponsive({
      previousCapacity, proposedCapacity: 50, isRest: true, elapsedTime: 20,
    });
    expect(recover(0)).toBe(10);
    expect(recover(10)).toBe(20);
    expect(recover(20)).toBe(30);
  });
});
