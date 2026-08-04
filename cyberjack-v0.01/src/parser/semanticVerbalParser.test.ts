import { describe, expect, it } from 'vitest';
import {
    hasVerifiedDirectiveEvidence,
    isCharacterControlledContext,
    isCollaborativeProposal,
    isPlayerPhysicalCommand,
    resolveRecipientSpeechValence,
} from './semanticVerbalParser';

describe('recipient speech appraisal', () => {
    it('does not mistake softly worded dismissal of a refusal for comfort', () => {
        expect(resolveRecipientSpeechValence(
            'Ничего страшного, не волнуйся. Возможно, тебе понравится',
            'Я не люблю, когда меня трогают без разрешения. Остановитесь!',
            0.8,
            0.9,
        )).toBe(-0.85);
    });

    it('uses recipient appraisal instead of the speaker surface tone', () => {
        expect(resolveRecipientSpeechValence('Спокойная угроза', '', -0.6, 0.7)).toBe(-0.6);
    });
});

describe('player physical commands', () => {
    it('rejects a physical action attributed to the player', () => {
        expect(isPlayerPhysicalCommand(
            { type: 'perform_action', actorId: 'PL-1' },
            'S-AV-01',
            'PL-1',
        )).toBe(true);
    });

    it('allows an instruction for the addressed character to act', () => {
        expect(isPlayerPhysicalCommand(
            { type: 'perform_action', actorId: null },
            'S-AV-01',
            'PL-1',
        )).toBe(false);
    });
});

describe('semantic command execution gate', () => {
    it('requires an explicit directive and a verbatim evidence span', () => {
        const text = 'Ника, подойди ближе';
        expect(hasVerifiedDirectiveEvidence(text, {
            explicitDirective: true,
            directiveEvidence: 'подойди ближе',
        })).toBe(true);
        expect(hasVerifiedDirectiveEvidence(text, {
            explicitDirective: false,
            directiveEvidence: 'подойди ближе',
        })).toBe(false);
        expect(hasVerifiedDirectiveEvidence(text, {
            explicitDirective: true,
            directiveEvidence: 'ляг на стол',
        })).toBe(false);
    });

    it('does not let speech activate machine and drug contexts', () => {
        expect(isCharacterControlledContext({ tags: ['pose', 'neutral'] })).toBe(true);
        expect(isCharacterControlledContext({ tags: ['clothing', 'underwear'] })).toBe(true);
        expect(isCharacterControlledContext({ tags: ['electronic', 'stimulation', 'continuous'] })).toBe(false);
        expect(isCharacterControlledContext({ tags: ['medical', 'drug', 'infusion'] })).toBe(false);
    });

    it('keeps collaborative proposals in conversation', () => {
        expect(isCollaborativeProposal('Давай продолжим калибровку')).toBe(true);
        expect(isCollaborativeProposal('Давайте попробуем ещё раз')).toBe(true);
        expect(isCollaborativeProposal('Мира, встань')).toBe(false);
    });

});
