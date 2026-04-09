const fs = require('fs');

let stContent = fs.readFileSync('src/adapters/sillyTavernAdapter.ts', 'utf8');

stContent = stContent.replace(/sendToSillyTavern/g, 'generateCharacterReply');
stContent = stContent.replace(/ST_MODEL/g, 'MODEL');
stContent = stContent.replace(/export async function sendNarratorDescription/g, 'export async function generateNarratorReply');
stContent = stContent.replace(/sillyTavernSystemPrefix/g, 'narrativeSystemPrefix'); // just config keys, probably don't rename this yet

// Just simple rename string:
fs.writeFileSync('src/adapters/llmAdapterExt.ts', stContent);

