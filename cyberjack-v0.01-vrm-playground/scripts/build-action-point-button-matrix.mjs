import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputPath = new URL('../src/infrastructure/data/visual/action-point-button-matrix.generated.json', import.meta.url);
const assetIndexPath = new URL('../src/infrastructure/data/visual/action-point-assets.generated.json', import.meta.url);
const assetRoot = fileURLToPath(new URL('../public/character-images/actions-by-point/', import.meta.url));

const actions = {
  feather_stroke: ['Провести пером', 'feather tracing lightly across the selected body point'],
  gentle_stroke: ['Мягко погладить', 'a gentle open hand stroking the selected body point'],
  tickle: ['Пощекотать', 'fingertips lightly tickling the selected body point'],
  light_kiss: ['Коротко поцеловать', 'a brief soft kiss on the selected body point'],
  deep_kiss: ['Поцеловать глубоко', 'an intense lingering kiss focused on the selected body point'],
  licking: ['Провести языком', 'a tongue tracing the selected body point'],
  deep_massage: ['Надавить и размять', 'two hands applying deep massage to the selected body point'],
  ice_cube: ['Коснуться льдом', 'an ice cube touching the selected body point'],
  hot_wax: ['Капнуть воском', 'a small drop of warm wax falling onto the selected body point'],
  light_bite: ['Прикусить', 'a light playful bite on the selected body point'],
  hard_bite: ['Укусить до боли', 'a firm painful bite on the selected body point'],
  pinch: ['Ущипнуть', 'fingers pinching the selected body point'],
  scratching: ['Провести ногтями', 'fingernails scratching across the selected body point'],
  slap: ['Шлёпнуть', 'an open palm slapping the selected body point'],
  hard_slap: ['Ударить ладонью', 'a forceful open-palm strike to the selected body point'],
  firm_grip: ['Сильно сжать', 'a hand gripping and squeezing the selected body point'],
  needle_prick: ['Сделать укол иглой', 'a clinical needle touching the selected body point'],
  belt_strike: ['Ударить ремнём', 'a leather belt striking the selected body point'],
  whip_strike: ['Ударить хлыстом', 'a thin whip striking the selected body point'],
  taser_shock: ['Дать разряд электрошокером', 'a compact electroshock device contacting the selected body point'],
  hair_pull: ['Потянуть за волосы', 'a hand pulling the character by the hair'],
  finger_insertion: ['Начать пальцами', 'manual intimate stimulation focused on the selected body point'],
  act_start_penetration: ['Начать проникновение', 'the beginning of penetrative contact at the selected body point'],
};

const groups = {
  softExternal: ['feather_stroke', 'gentle_stroke', 'ice_cube'],
  sensitiveExternal: ['light_kiss', 'licking', 'light_bite', 'pinch'],
  impactExternal: ['slap', 'hard_slap', 'firm_grip', 'needle_prick', 'taser_shock'],
  broadPain: ['hard_bite', 'scratching'],
  heavyImpact: ['belt_strike', 'whip_strike'],
};

const unique = (...lists) => [...new Set(lists.flat())];

const points = {
  hair: ['gentle_stroke', 'hair_pull'],
  face: unique(groups.softExternal, groups.sensitiveExternal, ['slap', 'hard_slap', 'needle_prick']),
  lips: ['feather_stroke', 'gentle_stroke', 'light_kiss', 'deep_kiss', 'licking', 'light_bite', 'hard_bite', 'ice_cube'],
  neck: unique(groups.softExternal, groups.sensitiveExternal, groups.broadPain, ['firm_grip', 'taser_shock']),
  shoulders: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, ['deep_massage']),
  chest: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, groups.heavyImpact, ['deep_massage', 'hot_wax']),
  nipples: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, ['hot_wax']),
  belly: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, ['deep_massage', 'hot_wax', 'belt_strike']),
  back: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, groups.heavyImpact, ['deep_massage', 'hot_wax']),
  waist: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, ['deep_massage', 'belt_strike']),
  arms: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, ['deep_massage']),
  hands: unique(groups.softExternal, ['light_kiss', 'licking', 'pinch', 'firm_grip', 'needle_prick', 'taser_shock']),
  inner_thighs: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, groups.heavyImpact, ['hot_wax']),
  legs: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, groups.heavyImpact, ['deep_massage', 'hot_wax']),
  knees: unique(groups.softExternal, ['light_kiss', 'licking', 'pinch', 'scratching', 'slap', 'hard_slap', 'needle_prick']),
  feet: unique(groups.softExternal, groups.sensitiveExternal, ['tickle', 'deep_massage', 'pinch', 'scratching', 'slap', 'needle_prick', 'taser_shock']),
  buttocks: unique(groups.softExternal, groups.sensitiveExternal, groups.impactExternal, groups.broadPain, groups.heavyImpact, ['deep_massage', 'hot_wax']),
  vulva: unique(groups.softExternal, groups.sensitiveExternal, ['tickle', 'hot_wax', 'firm_grip']),
  clitoris: unique(groups.softExternal, groups.sensitiveExternal, ['tickle', 'ice_cube']),
  vagina: ['finger_insertion', 'act_start_penetration'],
  anus: ['feather_stroke', 'gentle_stroke', 'light_kiss', 'licking', 'ice_cube', 'finger_insertion', 'act_start_penetration'],
};

const combinations = Object.entries(points).flatMap(([pointId, actionIds]) =>
  actionIds.map((actionId) => {
    const [actionLabel, actionPrompt] = actions[actionId];
    return {
      pointId,
      actionId,
      actionLabel,
      assetPath: `/character-images/actions-by-point/${pointId}/${actionId}.png`,
      prompt: `${actionPrompt}; close-up interaction illustration clearly centered on ${pointId}; no text, no UI, no frame, full-bleed square composition`,
    };
  }),
);

const matrix = {
  version: 1,
  purpose: 'Mechanical point-action compatibility and generation checklist for calibration action-card illustrations.',
  assetConvention: '/character-images/actions-by-point/$pointId/$actionId.png',
  imageRequirements: {
    format: 'png',
    aspectRatio: '1:1',
    framing: 'full-bleed, no margins, no border',
    content: 'show the selected body point and make the action immediately readable',
    forbidden: ['text', 'labels', 'UI controls', 'decorative frame'],
  },
  actions: Object.fromEntries(Object.entries(actions).map(([id, [label]]) => [id, label])),
  points,
  combinations,
  totals: {
    points: Object.keys(points).length,
    actions: Object.keys(actions).length,
    images: combinations.length,
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(matrix, null, 2)}\n`);
const assetIndex = {};
for (const pointId of fs.readdirSync(assetRoot).sort()) {
  const pointPath = path.join(assetRoot, pointId);
  if (!fs.statSync(pointPath).isDirectory()) continue;
  for (const fileName of fs.readdirSync(pointPath).filter((file) => file.endsWith('.png')).sort()) {
    const actionId = fileName
      .replace(/\.png$/, '')
      .replace(/_(?:s\d+|alt\d+)$/, '');
    const key = `${pointId}/${actionId}`;
    const candidate = `/character-images/actions-by-point/${pointId}/${fileName}`;
    const current = assetIndex[key];
    // Prefer the canonical filename, then keep the first stable variant.
    if (!current || fileName === `${actionId}.png`) assetIndex[key] = candidate;
  }
}
fs.writeFileSync(assetIndexPath, `${JSON.stringify(assetIndex, null, 2)}\n`);
console.log(`Wrote ${matrix.totals.images} combinations to ${outputPath.pathname}`);
console.log(`Indexed ${Object.keys(assetIndex).length} available assets in ${assetIndexPath.pathname}`);
