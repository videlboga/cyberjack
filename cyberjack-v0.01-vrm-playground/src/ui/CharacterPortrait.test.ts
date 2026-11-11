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

  it('maps the personal costume context to the costume image variant', () => {
    const portrait = canonicalCharacterPortrait('NPC-CAND-01', 'Ника', [], {
      contexts: [{ actionId: 'eq_clothe_costume' }],
    });

    expect(portrait).toContain('costume');
  });

  it('uses the mental-correction chair avatar when its environment context is active', () => {
    const portrait = canonicalCharacterPortrait('NPC-CAND-01', 'Ника', [], {
      contexts: [{ actionId: 'context_mental_correction_chair' }],
      attitude: 20,
    });

    expect(portrait).toBe('/character-images/vr-chair/nika__vr_chair_ni__guarded.png');
  });
});
