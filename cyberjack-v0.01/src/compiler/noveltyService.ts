// src/compiler/noveltyService.ts
import { CompiledAction } from '../domain/types';

/**
 * Calculates current novelty based on action history.
 * A stub for Phase 3. In the final version, this will read actual event logs.
 */
export function computeNovelty(actionData: Partial<CompiledAction>, history: any[]): number {
    // Stub: always return 0.5 or the preset value. E.g. we will calculate how often 
    // the user did the EXACT same action string of numbers
    return actionData.novelty ?? 0.5;
}
