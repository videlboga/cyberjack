import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'src/infrastructure/data/visual/character-image-matrix.json');
const outputDir = path.join(root, 'docs/visual-assets');
const config = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const q = (value) => `"${String(value).replaceAll('"', '""')}"`;

fs.mkdirSync(outputDir, { recursive: true });

const combinations = [];
for (const character of config.characters) {
  for (const pose of config.poses) {
    for (const clothing of config.clothing) {
      for (const restraint of config.restraints.filter((entry) => entry.allowedPoses.includes(pose.id))) {
        for (const state of config.states) {
          const stem = `${pose.id}__${clothing.id}__${restraint.id}__${state.id}`;
          combinations.push({
            characterId: character.id,
            character: character.name,
            poseId: pose.id,
            pose: pose.name,
            clothingId: clothing.id,
            clothing: clothing.name,
            restraintId: restraint.id,
            restraint: restraint.name,
            stateId: state.id,
            state: state.name,
            relativePath: `public/character-images/rendered/${character.slug}/${stem}.${config.format}`
          });
        }
      }
    }
  }
}

const columns = ['characterId', 'character', 'poseId', 'pose', 'clothingId', 'clothing', 'restraintId', 'restraint', 'stateId', 'state', 'relativePath'];
const csv = [columns.join(','), ...combinations.map((row) => columns.map((key) => q(row[key])).join(','))].join('\n');
fs.writeFileSync(path.join(outputDir, 'character-image-combinations.csv'), `${csv}\n`);

const body = config.characters.flatMap((character) => config.poses.flatMap((pose) => config.states.map((state) =>
  `public/character-images/source/${character.slug}/body/${pose.id}__${state.id}.${config.format}`
)));
const clothing = config.characters.flatMap((character) => config.poses.flatMap((pose) => config.clothing.filter((entry) => entry.id !== 'nude').map((entry) =>
  `public/character-images/source/${character.slug}/clothing/${pose.id}__${entry.id}.${config.format}`
)));
const restraints = config.characters.flatMap((character) => config.poses.flatMap((pose) => config.restraints.filter((entry) => entry.id !== 'none' && entry.allowedPoses.includes(pose.id)).map((entry) =>
  `public/character-images/source/${character.slug}/restraint/${pose.id}__${entry.id}.${config.format}`
)));
const sourceAssets = { body, clothing, restraints };
fs.writeFileSync(path.join(outputDir, 'character-image-source-checklist.json'), `${JSON.stringify(sourceAssets, null, 2)}\n`);

const summary = {
  generatedAt: new Date().toISOString(),
  fullCombinations: combinations.length,
  sourceImages: body.length + clothing.length + restraints.length,
  sourceBreakdown: { body: body.length, clothing: clothing.length, restraints: restraints.length },
  note: 'Одежда и фиксаторы — прозрачные слои на едином холсте. Для ремней с перекрытиями допустимы суффиксы __back и __front.'
};
fs.writeFileSync(path.join(outputDir, 'character-image-matrix-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(summary);
