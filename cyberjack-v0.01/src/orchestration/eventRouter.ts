// src/orchestration/eventRouter.ts
import { runGameTick, GameEventPayload } from './runGameTick';

/**
 * Basic router to handle incoming game events.
 * Currently only routes 'INTERACT', but will expand as Phase 8 (Verbal) comes online.
 */
export function eventRouter(eventType: string, payload: any) {
    console.log(`[EventRouter] Received ${eventType}`);
    
    switch (eventType) {
        case 'INTERACT':
            return runGameTick(payload as GameEventPayload);
            
        case 'VERBAL':
            // Phase 8: Pass through verbal parser first, then route to INTERACT
            throw new Error('Verbal routing not implemented yet.');
            
        default:
            throw new Error(`Unknown event type: ${eventType}`);
    }
}
