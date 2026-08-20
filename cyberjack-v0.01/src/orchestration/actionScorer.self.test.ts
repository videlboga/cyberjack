import { describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { subjectRepo } from '../infrastructure/repositories';
import { ActionScorer } from './actionScorer';

function setupSelfSubject(id: string, tension: number, genitalPref: number) {
    subjectRepo.save(id, 'Тест', {
        sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50,
        tension, baselineCapacity: 50,
        preferences: JSON.stringify({ points: { clitoris: genitalPref, vagina: genitalPref } }),
    });
}

describe('ActionScorer.scoreSelfActions', () => {
    it('возвращает мастурбацию, когда есть генитальный трейт и высокий tension', () => {
        setupSelfSubject('SELF-1', 70, 3);
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-1', 70);
        expect(results.some(r => r.actionId === 'act_self_stimulate')).toBe(true);
    });

    it('не триггерит при низком tension', () => {
        setupSelfSubject('SELF-2', 30, 3);
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-2', 30);
        expect(results.some(r => r.actionId === 'act_self_stimulate')).toBe(false);
    });

    it('не триггерит без генитального трейта', () => {
        setupSelfSubject('SELF-3', 80, 0);
        const results = ActionScorer.scoreSelfActions('scene_lab_calibrator', 'SELF-3', 80);
        expect(results.some(r => r.actionId === 'act_self_stimulate')).toBe(false);
    });
});
