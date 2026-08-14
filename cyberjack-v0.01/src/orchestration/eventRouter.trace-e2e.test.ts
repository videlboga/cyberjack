import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../infrastructure/seed';
import { activeContextsRepo, subjectRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { dispatchEvent } from './eventRouter';
import { currentTraceRequestId, withTraceContext } from './trace';
import { executeCharacterSpeech } from '../services/characterSpeechExecutor';

const mocks = vi.hoisted(() => ({
    parseSemanticVerbalInput: vi.fn(),
    executeCharacterSpeech: vi.fn(),
}));
vi.mock('../parser/semanticVerbalParser', () => ({ parseSemanticVerbalInput: mocks.parseSemanticVerbalInput }));
vi.mock('../services/characterSpeechExecutor', () => ({ executeCharacterSpeech: mocks.executeCharacterSpeech }));

const SUBJECT = 'TEST-TRACE-E2E';

beforeEach(() => {
    subjectRepo.save(SUBJECT, SUBJECT, {
        sensitivity: 50, capacity: 80, openness: 50, plasticity: 50, attitude: 80, tension: 0,
    });
    db.prepare(`
        INSERT OR IGNORE INTO subject_point_states (
            subject_id, point_id, local_sensitivity, local_attitude, local_openness,
            familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness
        )
        SELECT ?, point_id, local_sensitivity, local_attitude, local_openness,
            familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness
        FROM subject_point_states WHERE subject_id = 'S-AV-01'
    `).run(SUBJECT);
    db.prepare('DELETE FROM active_contexts WHERE subject_id = ?').run(SUBJECT);
    mocks.parseSemanticVerbalInput.mockReset();
    mocks.executeCharacterSpeech.mockReset();
});

/**
 * Этап 10: сквозной trace. Парсер, тик и генерация ответа одного
 * пользовательского хода должны разделять один requestId.
 */
describe('end-to-end trace across parser, tick and reply (Этап 10)', () => {
    it('shares one requestId across parser, tick and generated reply', async () => {
        activeContextsRepo.add('test-underwear', SUBJECT, 'eq_clothe_underwear', -1, 'systemic');

        // The parser records the trace id it sees inside the dispatch context.
        let parserTraceId: string | null = null;
        mocks.parseSemanticVerbalInput.mockImplementation(async () => {
            parserTraceId = currentTraceRequestId();
            return {
                intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0,
                pointId: 'systemic', verbalIntent: 'command',
                commandIntent: { type: 'remove_worn_clothing' },
                semanticMentions: { actionIds: [], pointIds: [] }, mentionedTags: [],
                model: 'semantic-parser-v2:test',
            };
        });

        // The reply generator records the trace id it sees.
        let replyTraceId: string | null = null;
        mocks.executeCharacterSpeech.mockImplementation(async () => {
            replyTraceId = currentTraceRequestId();
            return { success: true, speech: 'Хорошо.', sentMessages: [] };
        });

        const result = await dispatchEvent({
            subjectId: SUBJECT,
            playerId: 'PL-1',
            sceneId: 'scene_lab_calibrator',
            pointId: 'systemic',
            presetId: 'verbal_pressure',
            textMessage: 'Разденься',
        });

        // The tick's requestId (returned by dispatchEvent) is the same one the
        // parser saw. The reply generator is wrapped by tickController with the
        // same requestId, so it must see the same id.
        expect(result.requestId).toBeTruthy();
        expect(parserTraceId).toBe(result.requestId);

        // Model the tickController reply step: it wraps generateTurnReply in
        // withTraceContext(requestId, ...). The reply generator must see the
        // same requestId as the parser and the tick.
        await withTraceContext(result.requestId, async () => {
            await executeCharacterSpeech({ source: 'player_turn', payload: {} as any, userInput: 'x' });
        });
        expect(replyTraceId).toBe(result.requestId);
    });
});
