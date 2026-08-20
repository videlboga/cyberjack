import { describe, expect, it } from 'vitest';
import { deriveSocialMotivation, motivationContext, motivationPreferredAct, type SocialMotivation } from './socialMotivation';

const base = {
    familiarity: 0.5,
    strokeBalance: 0,
    need: 'clarity' as const,
    lifePosition: 'ok_ok' as const,
    egoState: 'adult' as const,
    activeGameId: null,
    firstEncounter: false,
};

describe('deriveSocialMotivation', () => {
    it('prioritizes an active game', () => {
        const m = deriveSocialMotivation({ ...base, activeGameId: 'kick_me' });
        expect(m).toBe('game');
    });

    it('returns stroke_need when hungry for approval', () => {
        const m = deriveSocialMotivation({ ...base, strokeBalance: -20, need: 'approval' });
        expect(m).toBe('stroke_need');
    });

    it('does not return stroke_need for safety need even when hungry', () => {
        const m = deriveSocialMotivation({ ...base, strokeBalance: -30, need: 'safety' });
        expect(m).not.toBe('stroke_need');
    });

    it('returns encounter on first meeting', () => {
        const m = deriveSocialMotivation({ ...base, familiarity: 0.05, firstEncounter: true });
        expect(m).toBe('encounter');
    });

    it('returns deepen for an established relationship', () => {
        const m = deriveSocialMotivation({ ...base, familiarity: 0.5 });
        expect(m).toBe('deepen');
    });
});

describe('motivationPreferredAct', () => {
    it('maps encounter to introduce', () => {
        expect(motivationPreferredAct('encounter', 'adult')).toBe('introduce');
    });

    it('maps deepen to check_in for adult', () => {
        expect(motivationPreferredAct('deepen', 'adult')).toBe('check_in');
    });

    it('maps deepen to ask_boundary for critical_parent', () => {
        expect(motivationPreferredAct('deepen', 'critical_parent')).toBe('ask_boundary');
    });

    it('maps game to offer_support for nurturing_parent', () => {
        expect(motivationPreferredAct('game', 'nurturing_parent')).toBe('offer_support');
    });

    it('maps stroke_need to check_in', () => {
        expect(motivationPreferredAct('stroke_need', 'adult')).toBe('check_in');
    });
});

describe('motivationContext', () => {
    const input = {
        speakerName: 'Суми',
        recipientName: 'Май',
        need: 'connection' as const,
        egoState: 'free_child' as const,
        lifePosition: 'not_ok_ok' as const,
        hook: 'ступни',
    };

    it('renders encounter context with hook', () => {
        const ctx = motivationContext('encounter', input);
        expect(ctx).toContain('знакомишься с Май');
        expect(ctx).toContain('Тебе легче говорить о: ступни');
    });

    it('renders deepen context with need', () => {
        const ctx = motivationContext('deepen', input);
        expect(ctx).toContain('углубить связь');
        expect(ctx).toContain('близость');
    });

    it('renders stroke_need context', () => {
        const ctx = motivationContext('stroke_need', input);
        expect(ctx).toContain('заметили');
    });

    it('renders game context without naming the game', () => {
        const ctx = motivationContext('game', input);
        expect(ctx).toContain('тянет');
        expect(ctx).not.toContain('kick_me');
        expect(ctx).not.toContain('Игра');
    });
});
