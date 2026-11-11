import 'dotenv/config';
import { Agent, setGlobalDispatcher } from 'undici';
import fs from 'fs';

setGlobalDispatcher(new Agent({ keepAliveTimeout: 1000, connections: 4 }));

const prompt = fs.readFileSync('/tmp/real_prompt.txt', 'utf-8');
const key = process.env.OPENROUTER_API_KEY || '';

const models = [
    'google/gemini-2.5-flash-lite',
    'deepseek/deepseek-v4-flash',
    'deepseek/deepseek-chat-v3-0324',
    'deepseek/deepseek-v3.2',
];

async function call(model: string, trial: number) {
    const t0 = performance.now();
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 45000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            signal: ctrl.signal,
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: prompt }],
                max_tokens: 2000,
                response_format: { type: 'json_object' },
                temperature: 0.7,
            })
        });
        const headersMs = Math.round(performance.now() - t0);
        const data = await r.json();
        clearTimeout(t);
        const content = data?.choices?.[0]?.message?.content ?? '';
        let valid = false, title = '';
        try { const j = JSON.parse(content); valid = !!j.title; title = j.title; } catch {}
        return `trial ${trial}: ${headersMs}ms status=${r.status} ${valid ? 'VALID' : 'RAW:' + content.slice(0,40).replace(/\n/g,' ')}`;
    } catch (e) {
        return `trial ${trial}: ERROR ${Math.round(performance.now()-t0)}ms ${String((e as any).message).slice(0,50)}`;
    }
}

for (const model of models) {
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await call(model, i));
    console.log(`\n=== ${model} ===`);
    results.forEach(r => console.log('  ' + r));
}
