import { describe, expect, it } from 'vitest';
import actions from '../infrastructure/data/presets/actions.json';
import { memoryTagLabels } from './memoryTagLabels';

describe('memory tag vocabulary', () => {
    it('has a Russian label for every action tag that can be stored in an episode', () => {
        const presets = Array.isArray(actions) ? actions : (actions as any).actions || [];
        const actionTags = new Set<string>(presets.flatMap((preset: any) => preset.tags || []));
        const missing = [...actionTags].filter(tag => !memoryTagLabels[tag]);
        expect(missing).toEqual([]);
    });

    it('labels process metadata in human terms', () => {
        expect(memoryTagLabels.continuous).toBe('продолжительный контакт');
        expect(memoryTagLabels.intense).toBe('усиленный контакт');
    });
});
