import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
// стриминг с БОЛЬШИМ контекстом через прокси (как character-speech)
const big = "Сцена и диалог:\n" + ("- Мира реагирует на слова Калибратора, чувствует возбуждение, смущение, страх. "*300);
for (let i = 0; i < 4; i++) {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            signal: ctrl.signal,
            body: JSON.stringify({
                model: 'deepseek/deepseek-v4-flash-0731',
                messages: [{ role: 'system', content: 'Ты играешь персонажа. ' + big }, { role: 'user', content: 'ответь' }],
                max_tokens: 180, stream: true, temperature: 0.85
            })
        });
        const headersMs = Math.round(performance.now() - t0);
        const reader = r.body!.getReader();
        const dec = new TextDecoder();
        let got = 0, firstChunkMs = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!firstChunkMs) firstChunkMs = Math.round(performance.now() - t0);
            got += dec.decode(value).length;
        }
        clearTimeout(t);
        console.log(`stream-big ${i}: status=${r.status} headers=${headersMs}ms first=${firstChunkMs}ms done=${Math.round(performance.now()-t0)}ms bytes=${got}`);
    } catch (e) {
        console.log(`stream-big ${i}: ERROR ${Math.round(performance.now()-t0)}ms`, (e as any).name, String((e as any).message).slice(0, 50));
    }
}
