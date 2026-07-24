import { describe, expect, it } from 'vitest';
import { deriveTelemetry, formatTelemetryForPrompt } from '../src/narrative/telemetry';

describe('derived telemetry', () => {
    it('turns rising tension into observable trends without exposing hidden traits', () => {
        const snapshot = deriveTelemetry({
            core: { sensitivity: 70, capacity: 65, openness: 80, plasticity: 90, attitude: 55, tension: 72 },
            point: { localSensitivity: 88, localAttitude: 50 },
            observation: {
                action: { id: 'gentle_stroke', label: 'Мягко погладить', pointId: 'neck' }, contact: 'full', behavioralState: 'responsive',
                reaction: { pleasure: 6, discomfort: 1, overload: 0, engagement: 5, mixed: false },
                learning: { effect: 1, familiarityDelta: .1, sensitivityDelta: .2, baselineSensitivityDelta: 0 },
                changes: { tension: 4, capacity: -1, attitude: .3, openness: .2, localAttitude: .2 }, contexts: [],
                currentState: { title: 'В контакте', description: '' }, transitions: [], uiText: '', subjectiveText: '', technicalText: ''
            }
        });
        expect(snapshot.signals.find(item => item.id === 'pulse')?.trend).toBe('up');
        expect(snapshot.signals.find(item => item.id === 'localResponse')?.value).toBe('гиперреактивный');
        expect(formatTelemetryForPrompt(snapshot)).not.toMatch(/пластичност|открытост|attitude/i);
    });

    it('shows post-peak decline and reduced tone after discharge', () => {
        const snapshot = deriveTelemetry({
            core: { sensitivity: 60, capacity: 30, openness: 60, plasticity: 60, attitude: 60, tension: 15 },
            observation: {
                action: { id: 'gentle_stroke', label: 'Мягко погладить', pointId: 'neck' }, contact: 'full', behavioralState: 'responsive',
                reaction: { pleasure: 10, discomfort: 0, overload: 0, engagement: 3, mixed: false },
                learning: { effect: 0, familiarityDelta: 0, sensitivityDelta: 0, baselineSensitivityDelta: 0 },
                changes: { tension: -80, capacity: -20, attitude: 0, openness: 0, localAttitude: 0 }, contexts: [],
                currentState: { title: 'После разрядки', description: '' },
                transitions: [{ kind: 'discharge', title: 'Разрядка', text: '', severity: 'major' }], uiText: '', subjectiveText: '', technicalText: ''
            }
        });
        expect(snapshot.summary).toContain('идут на спад');
        expect(snapshot.signals.find(item => item.id === 'pulse')?.trend).toBe('down');
        expect(snapshot.signals.find(item => item.id === 'muscleTone')?.trend).toBe('down');
    });
});
