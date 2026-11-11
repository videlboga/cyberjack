import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
// ДОЛГИЙ процесс: 40 запросов с короткой паузой, половина с Connection:close
// чтобы проверить деградацию keep-alive пула через прокси
const big = "Факты:\n" + ("- эпизод: детальный текст о калибровке, реакции, ощущениях, персонаже. "*150);
async function call(useClose: boolean) {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`,
                ...(useClose ? { 'Connection': 'close' } : {})
            },
            signal: ctrl.signal,
            body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'system', content: 'Ты память. JSON. ' + big }, { role: 'user', content: 'верни json' }], max_tokens: 2000, response_format: { type: 'json_object' } })
        });
        await r.json();
        clearTimeout(t);
        return Math.round(performance.now() - t0);
    } catch (e) { return -1; }
}
for (let i = 0; i < 40; i++) {
    const useClose = i >= 20;
    const ms = await call(useClose);
    const tag = useClose ? 'CLOSE' : 'KEEP ';
    console.log(`${tag} #${i}: ${ms < 0 ? 'FAIL' : ms + 'ms'}`);
    await new Promise(r => setTimeout(r, 3000));
}
