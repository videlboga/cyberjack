import 'dotenv/config';
import { getModelAssignment } from '../src/adapters/modelAssignments';
import { parseVerbalInputWithLLM } from '../src/adapters/llmAdapter';
const a = getModelAssignment('memory');
console.log('MEMORY assignment:', JSON.stringify({ models: a.models, ttft: a.ttftTimeoutMs, req: a.requestTimeoutMs, maxTokens: a.maxTokens }));
const r = await parseVerbalInputWithLLM([
  { role: 'system', content: 'Ты извлекаешь воспоминания. Ответь строго JSON.' },
  { role: 'user', content: '{"action":"поцелуй","target":"Мира"} верни {"label":"поцелуй"}' }
], undefined, 'memory');
console.log('RESULT:', r.slice(0, 300));
