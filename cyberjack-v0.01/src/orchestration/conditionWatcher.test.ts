import { describe, expect, it } from 'vitest';
import { STATE_RULES } from './conditionWatcher';

describe('condition watcher lifecycle', () => {
    it('makes panic a bounded high-activation episode with recovery hysteresis', () => {
        const panic = STATE_RULES.find(rule => rule.code === 'panic_attack')!;
        expect(panic.durationOnTrigger).toBe(30);
        expect(panic.check({ capacity: 20, attitude: 30, tension: 40 } as any, {} as any)).toBe(true);
        expect(panic.check({ capacity: 20, attitude: 30, tension: 10 } as any, {} as any)).toBe(false);
        expect(panic.releaseCheck?.({ capacity: 40, attitude: 20, tension: 50 } as any, {} as any)).toBe(true);
    });
});
