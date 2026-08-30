import 'dotenv/config';
import { parseVerbalInputWithLLM } from '../src/adapters/llmAdapter';
const r = await parseVerbalInputWithLLM([
  { role: 'system', content: 'Ты извлекаешь воспоминания. Ответь строго JSON.' },
  { role: 'user', content: '{"action":"поцелуй","target":"Мира"} верни {"label":"поцелуй"}' }
], undefined, 'memory');
console.log('TYPE:', typeof r);
console.log('VALUE:', JSON.stringify(r).slice(0, 400));
