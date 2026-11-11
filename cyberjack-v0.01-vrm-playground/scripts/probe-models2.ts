import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
const big = "Сцена и диалог:\n" + ("- Мира реагирует на слова Калибратора, чувствует возбуждение, смущение, страх. "*300);
const models = ['deepseek/deepseek-v3.2', 'deepseek/deepseek-v4-flash', 'deepseek/deepseek-chat-v3-0324'];
for (const model of models) {
    const runs = [];
    for (let i = 0; i < 10; i++) {
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
            runs.push(Math.round(performance.now() - t0));
        } catch (e) {
            runs.push(-1);
        }
    }
    const ok = runs.filter(x => x > 0).length;
    const avg = runs.filter(x => x > 0).reduce((a, b) => a + b, 0) / Math.max(ok, 1);
    console.log(`${model}: ${ok}/10 ok | avg=${Math.round(avg)}ms | fastest=${Math.min(...runs.filter(x=>x>0))}ms | slowest=${Math.max(...runs)}ms`);
}
