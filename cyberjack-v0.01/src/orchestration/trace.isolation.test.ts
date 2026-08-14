import { describe, expect, it } from 'vitest';
import { withTraceContext, currentTraceRequestId } from './trace';

/**
 * Этап 10: изоляция trace-контекста. withTraceContext (AsyncLocalStorage.run)
 * должен восстанавливать родительский контекст после завершения, не смешивать
 * параллельные тики и не протекать в автономные вызовы.
 */
describe('trace context isolation (Этап 10)', () => {
    it('restores the parent trace after a nested tick completes', async () => {
        const parentId = 'parent-tick';
        const childId = 'child-tick';

        const childSeen = await withTraceContext(parentId, async () => {
            // Inside the parent, run a nested tick with its own context.
            const inner = await withTraceContext(childId, async () => {
                return currentTraceRequestId();
            });
            // After the nested tick, the parent context must be restored.
            const afterNested = currentTraceRequestId();
            return { inner, afterNested };
        });

        expect(childSeen.inner).toBe(childId);
        expect(childSeen.afterNested).toBe(parentId);
    });

    it('does not mix request IDs across parallel ticks', async () => {
        const a = 'tick-a';
        const b = 'tick-b';

        const [seenA, seenB] = await Promise.all([
            withTraceContext(a, async () => {
                await new Promise(resolve => setTimeout(resolve, 5));
                return currentTraceRequestId();
            }),
            withTraceContext(b, async () => {
                await new Promise(resolve => setTimeout(resolve, 1));
                return currentTraceRequestId();
            }),
        ]);

        expect(seenA).toBe(a);
        expect(seenB).toBe(b);
    });

    it('does not leak the tick id into an autonomous call after the tick ends', async () => {
        const tickId = 'tick-1';

        await withTraceContext(tickId, async () => {
            expect(currentTraceRequestId()).toBe(tickId);
        });

        // After the tick's context is gone, an autonomous call sees no id.
        expect(currentTraceRequestId()).toBeNull();
    });
});
