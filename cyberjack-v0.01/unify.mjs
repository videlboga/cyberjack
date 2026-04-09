import fs from 'fs';

let st = fs.readFileSync('src/adapters/sillyTavernAdapter.ts', 'utf8');
let llm = fs.readFileSync('src/adapters/llmAdapter.ts', 'utf8');

// Remove duplicate imports
st = st.replace(/import \{ activeConfig \} from '\.\.\/prompts\/config';/g, '');

st = st.replace(/export async function sendToSillyTavern/g, 'export async function generateCharacterReply');
st = st.replace(/export async function sendNarratorDescription/g, 'export async function generateNarratorReply');

fs.writeFileSync('src/adapters/llmEngine.ts', llm + '\n' + st);
