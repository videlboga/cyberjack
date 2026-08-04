import { describe, expect, it } from 'vitest';
import { runTick } from '../src/engine/runTick';
import { computeNovelty } from '../src/compiler/noveltyService';
import type { CompiledAction, SubjectCoreState, SubjectPointState } from '../src/domain/types';

const core = (): SubjectCoreState => ({ sensitivity: 55, capacity: 60, openness: 50, plasticity: 60, attitude: 50, tension: 0, baselineSensitivity: 55, baselineCapacity: 60, baselineOpenness: 50, baselinePlasticity: 60, baselineAttitude: 50 });
const point = (): SubjectPointState => ({ pointId: 'zone', localSensitivity: 55, localAttitude: 50, localOpenness: 50, familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 55, baselineLocalAttitude: 50, baselineLocalOpenness: 50 });
const action = (actionKey: string, intensity: number, valence: number, contact: number, novelty: number): CompiledAction => ({ actionKey, label: actionKey, type: actionKey === 'wait' ? 'system' : 'physical', tags: [], intensity, valence, contact, sharpness: 0, novelty });
const focused = action('focused', .5, 1, .2, 1);
const broad = action('broad', .2, 1, 1, 1);
const medium = action('medium', .35, .8, .5, .8);
const intense = action('intense', .6, 1, 1, .3);
const wait = action('wait', 0, 0, 0, 0);

function simulate(pattern: CompiledAction[], ticks: number) {
  let currentCore = core(); let currentPoint = point(); let history: Array<{ actionKey: string }> = [];
  for (let tick = 0; tick < ticks; tick++) {
    const raw = pattern[tick % pattern.length];
    const effective = { ...raw, novelty: computeNovelty(raw, history, currentPoint.familiarity) };
    const output = runTick({ subjectId: 's', pointId: 'zone', action: effective, core: currentCore, point: currentPoint });
    currentCore = output.nextCore; currentPoint = output.nextPoint;
    history = [{ actionKey: raw.actionKey }, ...history].slice(0, 20);
  }
  return { core: currentCore, point: currentPoint };
}

describe('short calibration strategies', () => {
  it('sensitizes with varied manageable stimulation and rest', () => {
    const result = simulate([focused, broad, wait], 10);
    expect(result.point.localSensitivity).toBeGreaterThanOrEqual(59);
    expect(result.core.capacity).toBeGreaterThan(55);
    expect(result.core.tension).toBeLessThan(40);
  });

  it('trades sensitivity for fast acceptance under intense pleasant stimulation', () => {
    const result = simulate([intense, wait, wait], 10);
    expect(result.core.attitude).toBeGreaterThanOrEqual(59);
    expect(result.point.localAttitude).toBeGreaterThanOrEqual(59);
    expect(result.point.localSensitivity).toBeLessThan(52);
  });

  it('reaches a balanced preparation state through variation and planned rest', () => {
    // As sensitivity rises the same actions become more demanding, so a
    // balanced protocol must increase its recovery cadence as well.
    const result = simulate([focused, broad, medium, wait, wait], 30);
    expect(result.core.sensitivity).toBeGreaterThanOrEqual(62);
    expect(result.point.localSensitivity).toBeGreaterThanOrEqual(61.5);
    expect(result.core.attitude).toBeGreaterThanOrEqual(59);
    expect(result.point.localAttitude).toBeGreaterThanOrEqual(59.5);
    expect(result.point.baselineLocalSensitivity).toBeGreaterThanOrEqual(58);
    expect(result.core.capacity).toBeGreaterThanOrEqual(45);
    expect(result.core.tension).toBeLessThan(85);
  });

  it('reaches breakdown pressure when intense stimulation is repeated without rest', () => {
    const result = simulate([intense], 10);
    expect(result.core.tension).toBeGreaterThanOrEqual(100);
    expect(result.core.capacity).toBeLessThan(50);
    expect(result.point.localSensitivity).toBeLessThan(52);
  });

  it('strengthens edge conditioning but asymptotically limits familiar repetition', () => {
    const ten = simulate([intense], 10);
    const thirty = simulate([intense], 30);
    const hundred = simulate([intense], 100);
    expect(ten.core.attitude).toBeGreaterThan(70);
    expect(thirty.core.attitude - ten.core.attitude).toBeLessThan(10);
    expect(hundred.core.attitude - thirty.core.attitude).toBeLessThan(10);
    expect(hundred.core.attitude).toBeLessThan(100);
  });
});
