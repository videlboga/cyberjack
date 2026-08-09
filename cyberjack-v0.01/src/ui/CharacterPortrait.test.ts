import { describe, expect, it } from 'vitest';
import { canonicalCharacterPortrait } from './CharacterPortrait';

describe('canonicalCharacterPortrait', () => {
  it('uses contexts embedded in the current state', () => {
    const portrait = canonicalCharacterPortrait('NPC-CAND-01', 'Ника', [], {
      contexts: [{ actionId: 'eq_clothe_dress' }],
    });

    expect(portrait).toContain('dress');
  });

  it('merges state contexts with the legacy context list', () => {
    const portrait = canonicalCharacterPortrait(
      'NPC-CAND-01',
      'Ника',
      [{ id: 'eq_clothe_stockings' }],
      { contexts: [{ actionId: 'eq_clothe_dress' }] },
    );

    expect(portrait).toContain('dress_stockings');
  });
});
