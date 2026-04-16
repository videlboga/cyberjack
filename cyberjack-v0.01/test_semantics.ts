import { interpretAction } from './src/diagnostics/semanticActionInterpreter';

// Mock helpers
function createMockCore(attitude: number, openness: number) {
    return {
        id: 'mock',
        name: 'Mock',
        description: '',
        physicalState: { stamina: 1, arousal: 0, pain: 0, tension: 0, focus: 0 },
        psychologicalState: { stress: 0, submissiveness: 0, autonomy: 0, confidence: 0, trust: 0, affection: 0 },
        traits: [],
        attitude: attitude,
        openness: openness
    };
}

function createMockPoint(type: string, sensitivity: number, localAttitude: number) {
    return {
        id: 'p1',
        name: type,
        type: type,
        state: { sensitivity, arousal: 0, pain: 0, tension: 0, wetness: 0, warmth: 0 },
        localAttitude: localAttitude,
        tags: []
    };
}

const scenarios = [
    {
        name: "1. Вербальное / Неконтактное действие (contact=0.1, intensity=0.5, valence=0.5)",
        core: createMockCore(0, 0),
        point: createMockPoint('ear', 0.5, 0),
        action: { intensity: 0.5, valence: 0.5, contact: 0.1, sharpness: 0.1, sourceId: 'a', targetId: 'mock', type: 'verbal' }
    },
    {
        name: "2. Ненавистное прикосновение - мягкое действие от врага (contact=0.8, valence=0.8, attitude=-0.8, openness=-0.5)",
        core: createMockCore(-0.8, -0.5),
        point: createMockPoint('shoulder', 0.5, 0),
        action: { intensity: 0.5, valence: 0.8, contact: 0.8, sharpness: 0.1, sourceId: 'a', targetId: 'mock', type: 'touch' }
    },
    {
        name: "3. Желанное прикосновение - мягкое действие от любимого (contact=0.8, valence=0.8, attitude=0.9, openness=0.8)",
        core: createMockCore(0.9, 0.8),
        point: createMockPoint('cheek', 0.5, 0),
        action: { intensity: 0.5, valence: 0.8, contact: 0.8, sharpness: 0.1, sourceId: 'a', targetId: 'mock', type: 'touch' }
    },
    {
        name: "4. Доверенная боль - болезненное действие от того, кому доверяют (contact=0.9, valence=-0.8, sharpness=0.9, attitude=0.8, openness=0.9)",
        core: createMockCore(0.8, 0.9),
        point: createMockPoint('back', 0.5, 0),
        action: { intensity: 0.8, valence: -0.8, contact: 0.9, sharpness: 0.9, sourceId: 'a', targetId: 'mock', type: 'strike' }
    },
    {
        name: "5. Гиперчувствительная зона (contact=0.6, valence=0.5, point.sensitivity=0.95)",
        core: createMockCore(0.2, 0.2),
        point: createMockPoint('neck', 0.95, 0),
        action: { intensity: 0.4, valence: 0.5, contact: 0.6, sharpness: 0.2, sourceId: 'a', targetId: 'mock', type: 'touch' }
    }
];

console.log("=== ТЕСТ СЕМАНТИЧЕСКОГО ИНТЕРПРЕТАТОРА ===\n");
for (const sc of scenarios) {
    console.log(`\n--- ${sc.name} ---`);
    console.log(`Result: ${interpretAction(sc.action as any, sc.core as any, sc.point as any)}`);
}
