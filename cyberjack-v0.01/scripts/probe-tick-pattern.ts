import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
// Точный паттерн тика: 4 больших memory (json_object) + 1 character-speech (stream) ПАРАЛЛЕЛЬНО
const big = "Факты:\n" + ("- эпизод: детальный текст о калибровке, реакции, ощущениях, персонаже Мира. "*200); // ~36KB
const scene = "Сцена и диалог:\n" + ("- Мира реагирует на слова Калибратора, чувствует возбуждение, смущение, страх. "*300); // ~30KB

const memory = () => ({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    opt: {
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'system', content: 'Ты создаёшь память. JSON. ' + big }, { role: 'user', content: 'верни json' }],
        max_tokens: 2000, response_format: { type: 'json_object' }
    }
});
const speech = () => ({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    opt: {
        model: 'deepseek/deepseek-chat-v3-0324',
        messages: [{ role: 'system', content: 'Ты играешь персонажа. ' + scene }, { role: 'user', content: 'ответь' }],
        max_tokens: 180, stream: true, temperature: 0.85
    }
});

async function run(ms, label) {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(ms.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, signal: ctrl.signal, body: JSON.stringify(ms.opt) });
        const headersMs = Math.round(performance.now() - t0);
        if (ms.opt.stream) {
            const reader = r.body!.getReader();
            const dec = new TextDecoder();
            while (true) { const { done, value } = await reader.read(); if (done) break; dec.decode(value); }
        } else {
            await r.json();
        }
        clearTimeout(t);
        return `${label} ok ${Math.round(performance.now()-t0)}ms`;
    } catch (e) {
        return `${label} FAIL ${Math.round(performance.now()-t0)}ms ${(e as any).name}`;
    }
}

for (let trial = 0; trial < 5; trial++) {
    const t0 = performance.now();
    const results = await Promise.all([
        run(memory(), 'm1'), run(memory(), 'm2'), run(memory(), 'm3'), run(memory(), 'm4'),
        run(speech(), 'sp')
    ]);
    console.log(`trial ${trial} [${Math.round(performance.now()-t0)}ms]: ${results.join(' | ')}`);
}
