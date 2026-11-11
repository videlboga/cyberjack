import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { VISUALLY_SUPPORTED_PORTABLE_ITEMS } from '../src/scenario/worldService';

describe('portable equipment visual coverage', () => {
    it('keeps every supported item connected to an authored action image', () => {
        const actions = JSON.parse(fs.readFileSync(
            path.resolve('src/infrastructure/data/presets/actions.json'), 'utf8'
        )) as Array<{ id:string; requiresItem?:string }>;
        const imageIds = new Set(
            ['equipment','clothing'].flatMap(group =>
                fs.readdirSync(path.resolve(`public/character-images/actions/${group}`))
                    .filter(file => file.endsWith('.png'))
                    .map(file => file.replace(/\.png$/, ''))
            )
        );

        for (const itemId of VISUALLY_SUPPORTED_PORTABLE_ITEMS) {
            const itemActions = actions.filter(action => action.requiresItem === itemId);
            expect(itemActions.length, `${itemId}: no required action`).toBeGreaterThan(0);
            expect(
                itemActions.some(action => imageIds.has(action.id)),
                `${itemId}: no authored action image`
            ).toBe(true);
        }
    });
});
