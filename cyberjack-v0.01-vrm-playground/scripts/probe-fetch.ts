import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
const t0 = performance.now();
try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        signal: controller.signal,
        body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [{ role: 'user', content: 'ok' }],
            max_tokens: 20,
            response_format: { type: 'json_object' }
        })
    });
    clearTimeout(timer);
    const hms = Math.round(performance.now() - t0);
    const body = await r.text();
    console.log('headersMs:', hms, 'status:', r.status, 'body:', body.slice(0, 200));
} catch (e) {
    const ms = Math.round(performance.now() - t0);
    console.log('ERROR after', ms, 'ms:', (e as any).name, (e as any).message);
}
