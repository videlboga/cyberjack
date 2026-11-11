import fs from 'node:fs';

const manifestPath = 'public/audio/reaction-audio-manifest.json';
const reviewPath = 'docs/audio-assets/vocalization-review-selection.json';
const runtimeStates = new Set([
  'afterglow', 'angry', 'aroused', 'blush', 'bored', 'climax', 'crying',
  'curious', 'defiant', 'disgust', 'distressed', 'excited', 'exhausted',
  'fear', 'guarded', 'high_negative', 'high_positive', 'mixed',
  'mixed_overload', 'neutral', 'pain', 'pleasure', 'receptive', 'sad',
  'shy', 'sleepy', 'smile', 'smug', 'submissive', 'subspace', 'surprise',
  'unconscious',
]);

let input = '';
for await (const chunk of process.stdin) input += chunk;
const reviews = JSON.parse(input.trim());
const source = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const pools = new Map();

for (const [key, entry] of Object.entries(source.reactions)) {
  for (const file of [entry.oneShot, ...(entry.variants || [])]) {
    if (reviews[`${key}::${file}`] !== 'keep') continue;
    const files = pools.get(entry.state) || [];
    if (!files.includes(file)) files.push(file);
    pools.set(entry.state, files);
  }
}

const reactions = {};
for (const state of runtimeStates) {
  const files = pools.get(state) || [];
  if (!files.length) continue;
  reactions[`generic_${state}`] = {
    character: 'generic',
    state,
    label: `Общий голос · ${state}`,
    oneShot: files[0],
    ...(files.length > 1 ? { variants: files.slice(1) } : {}),
  };
}

const selected = Object.entries(reviews).filter(([, status]) => status === 'keep');
const rejected = Object.entries(reviews).filter(([, status]) => status === 'remove');
const unusedSelected = [...pools.entries()]
  .filter(([state]) => !runtimeStates.has(state))
  .flatMap(([state, files]) => files.map(file => ({ state, file })));
const missingStates = [...runtimeStates].filter(state => !pools.get(state)?.length);

fs.writeFileSync(manifestPath, `${JSON.stringify({
  version: Number(source.version || 0) + 1,
  basePath: source.basePath,
  reactions,
}, null, 2)}\n`);
fs.writeFileSync(reviewPath, `${JSON.stringify({
  reviewedAt: new Date().toISOString(),
  sourceManifestVersion: source.version,
  summary: {
    reviewed: selected.length + rejected.length,
    selected: selected.length,
    rejected: rejected.length,
    integrated: Object.values(reactions).reduce((sum, entry) => sum + 1 + (entry.variants?.length || 0), 0),
    missingStates,
    unusedSelected,
  },
  reviews,
}, null, 2)}\n`);

console.log(JSON.stringify({ groups: Object.keys(reactions).length, missingStates, unusedSelected }, null, 2));
