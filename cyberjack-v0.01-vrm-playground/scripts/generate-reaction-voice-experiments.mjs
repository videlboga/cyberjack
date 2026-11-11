#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.elevenlabs', '.env'], quiet: true });

const args = new Set(process.argv.slice(2));
const generate = args.has('--generate');
const axisArg = process.argv.find(arg => arg.startsWith('--axis='))?.split('=')[1] || 'all';
const outDir = path.resolve('public/audio/sources/voice-experiments');

const ages = Array.from({ length: 10 }, (_, index) => 18 + index * 2);
const professions = [
  'clinical telemetry operator', 'station engineer', 'corporate records clerk',
  'security officer', 'laboratory researcher', 'freight pilot',
  'night-shift medic', 'cabaret performer',
];
const archetypes = [
  'tsundere', 'yandere', 'kuudere', 'dandere', 'genki girl',
  'onee-san', 'ojou-sama', 'deredere',
];
const emotions = {
  neutral: 'a quiet attentive hum and soft inhale',
  curious: 'a questioning hum with a small surprised inhale',
  guarded: 'a restrained breath catch and wary exhale',
  defiant: 'a controlled irritated grunt through clenched breath',
  angry: 'a sharp angry exhale and low frustrated vocal sound',
  disgust: 'a brief recoiling breath and disgusted nonverbal sound',
  surprise: 'a sudden short startled gasp',
  fear: 'a shaky frightened inhale and restrained whimper',
  distressed: 'uneven distressed breathing and a small broken gasp',
  pain: 'a brief strained cry followed by a controlled breath hiss',
  crying: 'a choked sob and trembling exhale, no words',
  sad: 'a low defeated sigh with unsteady breath',
  bored: 'a flat impatient nasal exhale',
  smile: 'a warm pleased breath with a tiny wordless laugh',
  shy: 'a hesitant soft gasp and embarrassed breath',
  blush: 'a flustered breath catch and quiet warm exhale',
  receptive: 'a relaxed pleased sigh and soft responsive hum',
  excited: 'a bright eager gasp with quickened breathing',
  aroused: 'a breathy restrained moan and trembling exhale',
  pleasure: 'a clear involuntary moan rising then settling',
  high_positive: 'an intense pleasure cry with rapid breath, controlled ending',
  mixed: 'a conflicted gasp blending pleasure and discomfort',
  mixed_overload: 'a broken overwhelmed moan with uneven breath',
  submissive: 'a yielding sigh and soft compliant nonverbal sound',
  subspace: 'a distant unfocused moan with slow drifting breathing',
  climax: 'a rising involuntary peak cry followed by broken after-breath',
  afterglow: 'a relieved settling sigh and slow warm breathing',
  exhausted: 'a long tired exhale and weak recovery breath',
  sleepy: 'slow drowsy breathing with a faint contented hum',
  smug: 'a confident amused breath and quiet satisfied hum',
  high_negative: 'a sharp overwhelmed cry and panicked uneven breathing',
  unconscious: 'quiet natural breathing only, no vocal reaction',
};

const base = 'Clean close-mic studio recording of one adult woman, nonverbal vocalization only, no intelligible words, no music, no ambience, no Foley, no echo, natural human voice, single take.';
const safeName = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const job = (axis, tag, prompt, duration = 2.2) => ({
  id: `${axis}__${safeName(tag)}`,
  axis, tag, duration,
  prompt: `${base} ${prompt}`,
});

const jobs = [
  ...ages.map(age => job('age', `${age}yo`, `Voice identity: ${age}-year-old adult woman. A neutral attentive hum, then a short soft surprised inhale.`, 2.0)),
  ...professions.map(profession => job('profession', profession, `Voice identity: 26-year-old adult woman, ${profession}. A neutral attentive hum, then a short guarded breath catch.`, 2.0)),
  ...archetypes.map(archetype => job('archetype', archetype, `Voice identity: 26-year-old adult woman with a ${archetype} anime archetype. A neutral attentive hum, then a brief pleased exhale. Keep it human and non-caricatured.`, 2.0)),
  ...Object.entries(emotions).flatMap(([emotion, description]) => [1, 2, 3].map(variant =>
    job('emotion', `${emotion}-${variant}`, `Voice identity: 26-year-old adult woman, cool expressive game-character voice. Emotion: ${emotion}. Performance: ${description}. Variation take ${variant}.`, emotion === 'climax' || emotion === 'subspace' ? 3.2 : 2.2)
  )),
].filter(entry => axisArg === 'all' || entry.axis === axisArg);

if (ages.some(age => age < 18)) throw new Error('Minor age tags are not permitted in this vocalization experiment.');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, `jobs-${axisArg}.json`), `${JSON.stringify({ version: 1, provider: 'elevenlabs-sound-effects-v2', jobs }, null, 2)}\n`);

if (!generate) {
  console.log(`Prepared ${jobs.length} jobs in ${path.relative(process.cwd(), outDir)} (dry run).`);
  console.log('Use --generate with ELEVENLABS_API_KEY set to render missing MP3 files.');
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required with --generate.');
let rendered = 0;
for (const entry of jobs) {
  const destination = path.join(outDir, `${entry.id}.mp3`);
  try { await fs.access(destination); continue; } catch { /* render missing file */ }
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: entry.prompt,
      duration_seconds: entry.duration,
      prompt_influence: 0.55,
      model_id: 'eleven_text_to_sound_v2',
      loop: false,
    }),
  });
  if (!response.ok) throw new Error(`${entry.id}: ${response.status} ${await response.text()}`);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  rendered += 1;
  console.log(`Rendered ${entry.id}`);
}
console.log(`Complete: ${rendered} new files, ${jobs.length - rendered} already present.`);
