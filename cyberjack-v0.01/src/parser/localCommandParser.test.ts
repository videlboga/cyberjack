import { describe, expect, it } from 'vitest';
import { parseLocalCommand } from './localCommandParser';

const characters = [
    { id: 'iona', name: 'Иона' },
    { id: 'nika', name: 'Ника' },
];

const parse = (text: string) => parseLocalCommand({
    text,
    characters,
    defaultActorId: 'player',
    defaultTargetId: 'nika',
});

describe('parseLocalCommand', () => {
    it('separates an addressed assistant from the action target', () => {
        expect(parse('Иона, осмотри Нику')).toMatchObject({
            actionId: 'act_examine', actorId: 'iona', targetId: 'nika', source: 'local-command-parser'
        });
    });

    it('uses the addressed character as target for a reflexive pose command', () => {
        expect(parse('Иона, садись')).toMatchObject({ actionId: 'pose_sitting', actorId: 'iona', targetId: 'iona' });
    });

    it('recognizes a kneeling command before the generic standing rule', () => {
        expect(parse('Ника, встань на колени')).toMatchObject({
            actionId: 'pose_kneeling', actorId: 'nika', targetId: 'nika'
        });
    });

    it('uses the current subject for a direct player action', () => {
        expect(parse('Осмотри Нику')).toMatchObject({ actionId: 'act_examine', actorId: 'player', targetId: 'nika' });
    });

    it.each([
        'Иона, ты можешь осмотреть Нику?',
        'Иона, не осматривай Нику',
        'Ника сказала «Иона, садись»',
        'Почему Ника сидит?'
    ])('does not execute ambiguous dialogue: %s', text => {
        expect(parse(text)).toBeNull();
    });
});
