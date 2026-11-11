import { describe, expect, it } from 'vitest';
import { resolveCommandRoute } from './eventRouter';

describe('resolveCommandRoute', () => {
    it('routes a player action to its character target', () => {
        expect(resolveCommandRoute(
            { actorId: 'PL-1', targetId: 'S-AV-01' },
            'PL-1',
            'PL-1',
        )).toEqual({ subjectId: 'S-AV-01', actorId: 'PL-1' });
    });

    it('keeps an NPC executor as subject for an order involving another target', () => {
        expect(resolveCommandRoute(
            { actorId: 'iona', targetId: 'nika' },
            'PL-1',
            'nika',
        )).toEqual({ subjectId: 'iona', actorId: 'iona' });
    });

    it('resolves initiator aliases to the player', () => {
        expect(resolveCommandRoute(
            { actorId: 'S-AV-01', targetId: 'initiator' },
            'PL-1',
            'S-AV-01',
        )).toEqual({ subjectId: 'S-AV-01', actorId: 'S-AV-01' });
    });
});
