import { applyLearning } from './src/engine/applyLearning.js';
import { DEFAULT_CONFIG } from './src/engine/config.js';

const baseCore = { tension: 80, sensitivity: 50, capacity: 80, openness: 50, plasticity: 50, attitude: 50 };
const basePoint = { pointId: 'systemic', localSensitivity: 50, localAttitude: 50, familiarity: 0, exposureCount: 0 };
const result = { experiencedIntensity: 0, pleasure: 0, discomfort: 0, overload: 0, engagement: 0, learningEffect: 0 };

console.log('--- TEST RUN ---');
console.log('TENSION DROP (1 tick):', applyLearning(baseCore, basePoint, {actionKey: 'wait', intensity: 0} as any, result, DEFAULT_CONFIG, 1.0).nextCore.tension);
console.log('TENSION DROP (20 ticks):', applyLearning(baseCore, basePoint, {actionKey: 'wait', intensity: 0} as any, result, DEFAULT_CONFIG, 20.0).nextCore.tension);

