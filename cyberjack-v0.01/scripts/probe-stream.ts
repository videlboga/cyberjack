import 'dotenv/config';
const key = process.env.OPENROUTER_API_KEY || '';
// стриминг через прокси
for (let trial = 0; trial < 3; trial++) {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            signal: ctrl.signal,
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: [{ role: 'user', content: 'напиши одно слово: ок' }],
                max_tokens: 20,
                stream: true
            })
        });
        const headersMs = Math.round(performance.now() - t0);
        // читаем чанки
        const reader = r.body!.getReader();
        const dec = new TextDecoder();
        let got = 0, firstChunkMs = 0, total = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!firstChunkMs) firstChunkMs = Math.round(performance.now() - t0);
            got += dec.decode(value).length;
            total = Math.round(performance.now() - t0);
        }
        clearTimeout(t);
        console.log(`stream ${trial}: status=${r.status} headers=${headersMs}ms firstChunk=${firstChunkMs}ms done=${total}ms bytes=${got}`);
    } catch (e) {
        const ms = Math.round(performance.now() - t0);
        console.log(`stream ${trial}: ERROR ${ms}ms`, (e as any).name, String((e as any).message).slice(0, 60));
    }
}
