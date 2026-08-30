import 'dotenv/config';
import '../src/infrastructure/db';
import { materializeNextSubjectiveMemory } from '../src/workers/subjectiveMemoryWorker';

console.log('=== запускаю materializeNextSubjectiveMemory (реальный воркер) ===');
const t0 = performance.now();
try {
    await materializeNextSubjectiveMemory();
    console.log(`done in ${Math.round(performance.now() - t0)}ms`);
} catch (e) {
    console.log(`ERROR ${Math.round(performance.now() - t0)}ms:`, String((e as any).message).slice(0, 200));
}
