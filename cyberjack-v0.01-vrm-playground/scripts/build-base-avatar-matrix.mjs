import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'src/infrastructure/data/visual/base-avatar-matrix.json'), 'utf8'));
const characters = JSON.parse(fs.readFileSync(path.join(root, 'src/infrastructure/data/visual/character-image-matrix.json'), 'utf8')).characters
  .filter(character => matrix.characters.includes(character.id));
const outputDir = path.join(root, 'docs/visual-assets');
fs.mkdirSync(outputDir, { recursive: true });

const rows = [];
for (const character of characters) {
  for (const pose of matrix.poses) {
    for (const clothing of matrix.clothing) {
      for (const restraint of matrix.restraints) {
        for (const state of matrix.states) {
          rows.push({
            characterId: character.id,
            character: character.name,
            characterSlug: character.slug,
            appearanceTags: character.appearanceTags,
            pose: pose.id,
            poseTags: pose.tags,
            clothing: clothing.id,
            clothingTags: clothing.tags,
            restraint: restraint.id,
            state: state.id,
            stateTags: state.tags,
            stateNegativeTags: state.negativeTags,
            relativePath: `public/character-images/rendered/${character.slug}/${pose.id}__${clothing.id}__${restraint.id}__${state.id}.${matrix.format}`
          });
        }
      }
    }
  }
}

fs.writeFileSync(path.join(outputDir, 'base-avatar-checklist.json'), `${JSON.stringify(rows, null, 2)}\n`);
const columns = ['characterId', 'character', 'characterSlug', 'pose', 'clothing', 'restraint', 'state', 'relativePath'];
const quote = value => `"${String(value).replaceAll('"', '""')}"`;
const csv = [columns.join(','), ...rows.map(row => columns.map(key => quote(row[key])).join(','))].join('\n');
fs.writeFileSync(path.join(outputDir, 'base-avatar-checklist.csv'), `${csv}\n`);

const summary = {
  generatedAt: new Date().toISOString(),
  totalAssets: rows.length,
  perCharacter: rows.length / characters.length,
  breakdown: {
    characters: characters.length,
    poses: matrix.poses.length,
    clothing: matrix.clothing.length,
    restraints: matrix.restraints.length,
    states: matrix.states.length
  }
};
fs.writeFileSync(path.join(outputDir, 'base-avatar-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(summary);
