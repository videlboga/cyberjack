import { afterEach, describe, expect, it } from 'vitest';
import { pendingCommandRepo } from './pendingCommandRepo';

const subjectId = '__test_pending_subject__';
const playerId = '__test_pending_player__';

afterEach(() => pendingCommandRepo.clear(subjectId, playerId));

describe('pending command focus', () => {
    it('stores only one replaceable conversational focus per pair', () => {
        pendingCommandRepo.save({
            subjectId, playerId, sceneId: 'scene-a', sourceText: 'Встань', description: 'встать',
            intent: { type: 'activate_context', targetContextId: 'pose_standing' },
        });
        pendingCommandRepo.save({
            subjectId, playerId, sceneId: 'scene-a', sourceText: 'Сядь', description: 'сесть',
            intent: { type: 'activate_context', targetContextId: 'pose_sitting' },
        });
        expect(pendingCommandRepo.get(subjectId, playerId)).toMatchObject({
            sourceText: 'Сядь', description: 'сесть',
            intent: { type: 'activate_context', targetContextId: 'pose_sitting' },
        });
    });

    it('can be forgotten without retaining command history', () => {
        pendingCommandRepo.save({
            subjectId, playerId, sceneId: 'scene-a', sourceText: 'Встань', description: 'встать',
            intent: { type: 'activate_context', targetContextId: 'pose_standing' },
        });
        pendingCommandRepo.clear(subjectId, playerId);
        expect(pendingCommandRepo.get(subjectId, playerId)).toBeNull();
    });
});
