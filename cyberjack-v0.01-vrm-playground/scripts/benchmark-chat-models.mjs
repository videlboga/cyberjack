import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceFile = path.join(root, 'logs', 'prompt_payloads.jsonl');
const outputFile = path.join(root, 'logs', 'chat-model-benchmark.jsonl');
const models = (process.env.BENCHMARK_MODELS || [
  'deepseek/deepseek-v4-flash',
  'qwen/qwen3.7-flash',
  'mistralai/mistral-small-3.2-24b-instruct'
].join(',')).split(',').map(value => value.trim()).filter(Boolean);
const sampleCount = Math.max(1, Number(process.env.BENCHMARK_SAMPLES || 6));
const providers = (process.env.BENCHMARK_PROVIDERS || '').split(',').map(value => value.trim()).filter(Boolean);
const apiKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY;

if (!apiKey) throw new Error('OPENROUTER_API_KEY/LLM_API_KEY is missing');

const rows = fs.readFileSync(sourceFile, 'utf8').trim().split('\n')
  .map(line => { try { return JSON.parse(line); } catch { return null; } })
  .filter(row => Array.isArray(row?.sentMessages) && row.sentMessages.length >= 2 && row.response);

const unique = [];
const seen = new Set();
for (const row of rows.reverse()) {
  const user = [...row.sentMessages].reverse().find(message => message.role === 'user')?.content || '';
  const key = `${row.actorId || ''}:${user.slice(0, 240)}`;
  if (!seen.has(key)) {
    seen.add(key);
    unique.push({ ...row, benchmarkUserText: user });
  }
}

const samples = unique.slice(0, sampleCount).reverse();
if (!samples.length) throw new Error(`No completed prompts in ${sourceFile}`);

async function generate(model, messages, provider) {
  const started = performance.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Cyberjack latency benchmark'
    },
    body: JSON.stringify({
      model, messages, stream: true, max_tokens: 180, temperature: 0.85, top_p: 0.9,
      reasoning: { enabled: false },
      ...(provider ? { provider: { only: [provider], allow_fallbacks: false } } : {})
    })
  });
  if (!response.ok || !response.body) throw new Error(`${response.status}: ${await response.text()}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let text = '';
  let ttftMs = null;
  let usage = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      const event = JSON.parse(line.slice(6));
      const chunk = event.choices?.[0]?.delta?.content || '';
      if (chunk && ttftMs === null) ttftMs = Math.round(performance.now() - started);
      text += chunk;
      if (event.usage) usage = event.usage;
    }
  }
  return { ttftMs, totalMs: Math.round(performance.now() - started), text: text.trim(), usage };
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
  const sample = samples[sampleIndex];
  for (const model of models) {
    for (const provider of providers.length ? providers : ['']) {
      try {
        const result = await generate(model, sample.sentMessages, provider);
        const row = {
          ts: new Date().toISOString(), sampleIndex, actorId: sample.actorId, kind: sample.kind,
          userText: sample.benchmarkUserText, reference: sample.response, model, provider: provider || null, ...result
        };
        fs.appendFileSync(outputFile, `${JSON.stringify(row)}\n`);
        console.log(`${model}\tprovider=${provider || 'auto'}\tsample=${sampleIndex + 1}/${samples.length}\tttft=${result.ttftMs}ms\ttotal=${result.totalMs}ms\tchars=${result.text.length}`);
      } catch (error) {
        const row = { ts: new Date().toISOString(), sampleIndex, actorId: sample.actorId, model, provider: provider || null, error: error.message };
        fs.appendFileSync(outputFile, `${JSON.stringify(row)}\n`);
        console.log(`${model}\tprovider=${provider || 'auto'}\tsample=${sampleIndex + 1}/${samples.length}\tERROR=${error.message}`);
      }
    }
  }
}

console.log(`Results: ${outputFile}`);
