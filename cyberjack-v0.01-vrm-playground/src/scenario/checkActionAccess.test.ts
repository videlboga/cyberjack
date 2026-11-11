import { describe, expect, it } from 'vitest';
import { areSlotsWithinPhysicalReach } from './checkActionAccess';

describe('physical slot reachability', () => {
    it('allows an actor standing near a free character in that character’s room slot', () => {
        expect(areSlotsWithinPhysicalReach(
            'near:NPC-CAND-01',
            'room:room_calibration',
            'PL-1',
            'NPC-CAND-01',
        )).toBe(true);
    });

    it('allows an actor standing beside the device occupied by the target', () => {
        expect(areSlotsWithinPhysicalReach(
            'near:lab_diagnostic_table',
            'device:lab_diagnostic_table',
            'PL-1',
            'NPC-CAND-GEN-02',
        )).toBe(true);
    });

    it('does not make different nearby positions mutually reachable', () => {
        expect(areSlotsWithinPhysicalReach(
            'near:NPC-CAND-01',
            'device:lab_diagnostic_table',
            'PL-1',
            'NPC-CAND-GEN-02',
        )).toBe(false);
    });
});
