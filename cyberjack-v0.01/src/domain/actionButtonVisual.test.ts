import { describe, expect, it } from 'vitest';
import { resolveActionButtonImage } from './actionButtonVisual';
import { peakActionImagePath } from '../ui/CalibrationPrototype';

describe('resolveActionButtonImage', () => {
  it('uses the action and body point that actually caused a peak event', () => {
    expect(peakActionImagePath({ action: { id: 'deep_massage', pointId: 'back' } }))
      .toBe('/character-images/actions-by-point/back/deep_massage.png');
    expect(peakActionImagePath({ action: { id: 'hot_wax', pointId: 'belly' } }))
      .toBe('/character-images/actions-by-point/belly/hot_wax.png');
  });
  it('uses a point-specific canonical asset when available', () => {
    expect(resolveActionButtonImage('gentle_stroke', 'contact', 'hair'))
      .toBe('/character-images/actions-by-point/hair/gentle_stroke.png');
  });

  it('resolves generated suffixed variants', () => {
    expect(resolveActionButtonImage('deep_kiss', 'intimate', 'lips'))
      .toMatch(/^\/character-images\/actions-by-point\/lips\/deep_kiss_(?:s\d+|alt\d+)\.png$/);
  });

  it('uses the old image for an uncovered point-action pair', () => {
    expect(resolveActionButtonImage('belt_strike', 'contact', 'back'))
      .toBe('/character-images/actions/contact/belt_strike.png');
  });

  it('keeps system action groups on their existing artwork', () => {
    expect(resolveActionButtonImage('pose_standing', 'pose', 'systemic'))
      .toBe('/character-images/actions/poses/pose_standing.png');
  });

  it('uses feather point artwork for breath where available', () => {
    expect(resolveActionButtonImage('breath_blow', 'contact', 'face'))
      .toContain('/character-images/actions-by-point/face/feather_stroke');
  });
});
