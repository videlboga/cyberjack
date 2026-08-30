import 'dotenv/config';
import '../src/adapters/llmAdapter'; // подхватит setGlobalDispatcher
import { parseVerbalInputWithLLM } from '../src/adapters/llmAdapter';
// несколько подряд, чтобы проверить что соединения не залипают
for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    try {
        const r = await parseVerbalInputWithLLM([
            { role: 'system', content: 'Ответь одним словом.' },
            { role: 'user', content: 'hi' }
        ], undefined, 'memory');
        console.log(`${i}: ok ${Math.round(performance.now()-t0)}ms`, JSON.stringify(r).slice(0, 60));
    } catch (e) {
        console.log(`${i}: FAIL ${Math.round(performance.now()-t0)}ms`, String((e as any).message).slice(0, 60));
    }
}
