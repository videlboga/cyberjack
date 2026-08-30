import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
const big = "Факты:\n" + ("- эпизод: детальный текст о калибровке, реакции, ощущениях, персонаже. "*200); // ~36KB
const N = 6;
const results = await Promise.allSettled(Array.from({ length: N }, async (_, i) => {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 40000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            signal: ctrl.signal,
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: [{ role: 'system', content: 'Ты создаёшь память. JSON. ' + big }, { role: 'user', content: 'верни json' }],
                max_tokens: 2000, response_format: { type: 'json_object' }
            })
        });
        const headersMs = Math.round(performance.now() - t0);
        await r.json();
        clearTimeout(t);
        return { i, ok: true, headersMs, totalMs: Math.round(performance.now() - t0) };
    } catch (e) {
        return { i, ok: false, ms: Math.round(performance.now() - t0), err: String((e as any).message).slice(0, 40) };
    }
}));
let ok = 0;
for (const r of results) {
    const v = (r as any).value;
    if (v.ok) { ok++; console.log(`#${v.i}: ok headers=${v.headersMs}ms total=${v.totalMs}ms`); }
    else console.log(`#${v.i}: FAIL ${v.ms}ms ${v.err}`);
}
console.log(`итог: ok=${ok} из ${N} (большие payload через прокси)`);
