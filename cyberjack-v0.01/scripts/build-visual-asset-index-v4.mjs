import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicRoot = path.join(root, 'public');
const outputPath = path.join(root, 'src/infrastructure/data/visual/visual-asset-index-v4.generated.json');

const roots = [
  'character-images/cutout/calibration-core',
  'character-images/cutout/rendered',
  'character-images/cutout/interactions-expanded',
  'character-images/cutout/interactions',
  'character-images/cutout/intimacy',
  'character-images/cutout/calibration-v4',
  'character-images/cutout/calibration-interactions-v4',
  'character-images/cutout/devices-v4',
  'character-images/calibration-core',
  'character-images/rendered',
  'character-images/interactions-expanded',
  'character-images/interactions',
  'character-images/intimacy',
  'character-images/calibration-v4',
  'character-images/calibration-interactions-v4',
  'character-images/devices-v4',
  'character-images/vr-chair'
];

const excludedSegments = new Set(['rmbg_v1']);
const assets = [];

function walk(relativeDir) {
  const absoluteDir = path.join(publicRoot, relativeDir);
  if (!fs.existsSync(absoluteDir)) return;
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (excludedSegments.has(entry.name)) continue;
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) walk(relativePath);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) assets.push(`/${relativePath}`);
  }
}

for (const relativeRoot of roots) walk(relativeRoot);
assets.sort();

const duplicateAssets = assets.filter((asset, index) => asset === assets[index - 1]);
if (duplicateAssets.length) {
  console.error(`Duplicate indexed paths:\n${duplicateAssets.join('\n')}`);
  process.exit(1);
}

const countBelow = prefix => assets.filter(asset => asset.startsWith(prefix)).length;
const generated = {
  version: 4,
  generatedAt: new Date().toISOString(),
  excluded: ['/character-images/rendered/mira/rmbg_v1'],
  counts: {
    total: assets.length,
    calibrationCore: countBelow('/character-images/calibration-core/'),
    rendered: countBelow('/character-images/rendered/'),
    interactionsExpanded: countBelow('/character-images/interactions-expanded/'),
    interactionsSparse: countBelow('/character-images/interactions/'),
    intimacy: countBelow('/character-images/intimacy/'),
    calibrationV4: countBelow('/character-images/calibration-v4/'),
    calibrationInteractionsV4: countBelow('/character-images/calibration-interactions-v4/'),
    devicesV4: countBelow('/character-images/devices-v4/'),
    vrChair: countBelow('/character-images/vr-chair/')
  },
  assets
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
console.log(generated.counts);
