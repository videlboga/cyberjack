import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
// имитация тика: 20 параллельных стриминговых запросов через прокси
const N = 20;
const results = await Promise.allSettled(Array.from({ length: N }, async (_, i) => {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            signal: ctrl.signal,
            body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'user', content: 'ok' }], max_tokens: 10, response_format: { type: 'json_object' } })
        });
        await r.json();
        clearTimeout(t);
        return { i, ok: true, ms: Math.round(performance.now() - t0) };
    } catch (e) {
        return { i, ok: false, ms: Math.round(performance.now() - t0), err: String((e as any).message).slice(0, 40) };
    }
}));
let ok = 0, fail = 0;
for (const r of results) {
    const v = (r as any).value;
    if (v.ok) ok++; else { fail++; console.log(`FAIL #${v.i}: ${v.ms}ms ${v.err}`); }
}
console.log(`итог: ok=${ok} fail=${fail} из ${N}`);
