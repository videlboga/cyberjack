import 'dotenv/config';
import { Agent, setGlobalDispatcher } from 'undici';
console.log('undici version:', require('undici/package.json').version);
console.log('API:', Object.keys(require('undici')).filter(k => /Agent|setGlobalDispatcher|globalDispatcher|fetch/i.test(k)).join(', '));
const agent = new Agent({ keepAliveTimeout: 1000, keepAliveMaxTimeout: 1000, connections: 10 });
setGlobalDispatcher(agent);
console.log('agent set OK');
