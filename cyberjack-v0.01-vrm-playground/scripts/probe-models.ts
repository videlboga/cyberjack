import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
const big = "Сцена и диалог:\n" + ("- Мира реагирует на слова Калибратора, чувствует возбуждение, смущение, страх. "*300);
const models = [
    'deepseek/deepseek-v4-flash',
    'deepseek/deepseek-v4-flash-0731',
    'deepseek/deepseek-v3.2',
    'deepseek/deepseek-v3.2-exp',
    'deepseek/deepseek-chat-v3-0324',
    'deepseek/deepseek-chat-v3.1',
];
for (const model of models) {
    const runs = [];
    for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 12000);
            const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                signal: ctrl.signal,
                body: JSON.stringify({ model, messages: [{ role: 'system', content: 'Ты играешь персонажа. ' + big }, { role: 'user', content: 'ответь' }], max_tokens: 180, stream: true, temperature: 0.85 })
            });
            const headersMs = Math.round(performance.now() - t0);
            const reader = r.body!.getReader();
            const dec = new TextDecoder();
            let got = 0, first = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!first) first = Math.round(performance.now() - t0);
                got += dec.decode(value).length;
            }
            clearTimeout(t);
            runs.push(`ok ${Math.round(performance.now()-t0)}ms`);
        } catch (e) {
            runs.push(`FAIL ${Math.round(performance.now()-t0)}ms`);
        }
    }
    const ok = runs.filter(x => x.startsWith('ok')).length;
    console.log(`${model}: ${ok}/5 ok | ${runs.join(' | ')}`);
}
