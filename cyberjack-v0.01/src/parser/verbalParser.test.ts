import { describe, expect, it } from 'vitest';
import { commandClassificationAllowsExecution } from './verbalParser';

describe('verbal command safety gate', () => {
    it('does not execute an action when the classifier also calls the utterance a question', () => {
        expect(commandClassificationAllowsExecution('question', 'Тело?')).toBe(false);
        expect(commandClassificationAllowsExecution('question', 'Покажешь тело?')).toBe(false);
    });

    it('keeps explicit commands executable', () => {
        expect(commandClassificationAllowsExecution('command', 'Покажи тело')).toBe(true);
        expect(commandClassificationAllowsExecution('command', 'Встань, пожалуйста?')).toBe(true);
    });
});
