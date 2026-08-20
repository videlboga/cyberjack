import { describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { subjectRepo } from '../infrastructure/repositories';
import { ActionScorer } from './actionScorer';

// Трейт уровня 2 требует strength >= 3.25 (см. acquiredTraitLevel).
function setupSelfSubject(id: string, tension: number, prefs: any) {
    subjectRepo.save(id, 'Тест', {
        sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50,
        tension, baselineCapacity: 50,
        preferences: JSON.stringify(prefs),
    });
}

const genitalPrefs = { points: { clitoris: 3.5, vagina: 3.5 } };

describe('ActionScorer.scoreSelfActions', () => {
    it('мастурбация (finger_insertion) при сексуальной зависимости + высокий tension', () => {
        setupSelfSubject('SELF-1', 70, { tags: { sexual: 3.5 }, points: { vagina: 3.5 } });
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-1', 70);
        expect(results.some(r => r.actionId === 'finger_insertion')).toBe(true);
    });

    it('нежная самостимуляция (gentle_stroke на vulva) при вульварном трейте', () => {
        setupSelfSubject('SELF-2', 70, { points: { vulva: 3.5 } });
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-2', 70);
        expect(results.some(r => r.actionId === 'gentle_stroke' && r.pointId === 'vulva')).toBe(true);
    });

    it('стимуляция клитора (licking на clitoris) при клиторальном трейте', () => {
        setupSelfSubject('SELF-2b', 70, { points: { clitoris: 3.5 } });
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-2b', 70);
        expect(results.some(r => r.actionId === 'licking' && r.pointId === 'clitoris')).toBe(true);
    });

    it('фетиш ступней (gentle_stroke на feet) при point_feet', () => {
        setupSelfSubject('SELF-3', 70, { points: { feet: 3.5 } });
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-3', 70);
        expect(results.some(r => r.actionId === 'gentle_stroke' && r.pointId === 'feet')).toBe(true);
    });

    it('мазохизм (pinch/scratching на arms) при trait_masochist', () => {
        setupSelfSubject('SELF-4', 70, { tags: { pain: 3.5 } });
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-4', 70);
        expect(results.some(r => r.actionId === 'pinch' && r.pointId === 'arms')).toBe(true);
        expect(results.some(r => r.actionId === 'scratching' && r.pointId === 'arms')).toBe(true);
    });

    it('не триггерит при низком tension', () => {
        setupSelfSubject('SELF-5', 30, genitalPrefs);
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-5', 30);
        expect(results.length).toBe(0);
    });

    it('не триггерит без подходящего трейта (уровень < 2)', () => {
        setupSelfSubject('SELF-6', 80, { points: { clitoris: 1.0 } });
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-6', 80);
        expect(results.length).toBe(0);
    });
});
