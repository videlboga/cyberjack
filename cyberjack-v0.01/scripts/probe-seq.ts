import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            signal: ctrl.signal,
            body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'user', content: 'ok' }], max_tokens: 10, response_format: { type: 'json_object' } })
        });
        clearTimeout(t);
        const ms = Math.round(performance.now() - t0);
        console.log(`${i}: status=${r.status} ${ms}ms`);
    } catch (e) {
        const ms = Math.round(performance.now() - t0);
        console.log(`${i}: ERROR ${ms}ms`, (e as any).name, String((e as any).message).slice(0, 50));
    }
}
