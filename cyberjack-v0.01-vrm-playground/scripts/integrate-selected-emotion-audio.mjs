import fs from 'node:fs/promises';

const manifestPath = 'public/audio/reaction-audio-manifest.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const emotions = [
  'neutral','curious','guarded','defiant','angry','disgust','surprise','fear',
  'distressed','pain','crying','sad','bored','smile','shy','blush','receptive',
  'excited','aroused','pleasure','high_positive','mixed','mixed_overload',
  'submissive','subspace','climax','afterglow','exhausted','sleepy','smug',
  'high_negative','unconscious',
];

for (const emotion of emotions) {
  const variants = [1, 2, 3]
    .filter(variant => !(emotion === 'high_negative' && variant === 3))
    .map(variant => `../sources/voice-experiments/emotion__${emotion.replaceAll('_', '-')}-${variant}.mp3`);
  manifest.reactions[`generic_${emotion}`] = {
    character: 'generic',
    state: emotion,
    label: `Общий эмоциональный слой · ${emotion}`,
    oneShot: variants[0],
    variants: variants.slice(1),
  };
}
manifest.version = Math.max(2, Number(manifest.version || 0));
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Integrated ${emotions.length} exact emotions; high_negative-3 excluded.`);
