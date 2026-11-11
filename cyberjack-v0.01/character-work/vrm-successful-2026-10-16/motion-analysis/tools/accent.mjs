// Accent: what the pose emphasises, from two independent sources — measured geometry and clip metadata.
// Geometry says where the body is opened; metadata says what the scene is about. Neither is trusted alone.
// Heights are body heights above the clip floor (anatomy-v6), so "low" means near the floor of this clip.

export const PARTS = ['butt', 'feet', 'chest', 'mouth', 'genitals', 'back', 'hands'];

const KEYWORDS = {
  butt: ['поп', 'попк', 'ягодиц', 'задниц', '尻', 'お尻', 'バック', '背面'],
  feet: ['стоп', 'ступн', 'подошв', 'ножк', 'фут-джоб', 'футджоб', 'footjob', '足', '足コキ', '足舐'],
  chest: ['груд', 'сосок', 'соск', '胸', '乳', 'パイズリ'],
  mouth: ['минет', 'рот', 'ртом', 'сосёт', 'сосет', 'лиж', '口', 'フェラ', '咥', '舐'],
  genitals: ['промежн', 'вагин', 'клитор', 'лобок', 'マン', 'クリ', '結合', '手マン'],
  back: ['спин', '背中'],
  hands: ['рук', 'руками', 'пальц', '手コキ', '指'],
};

const clamp = (x) => Math.min(1, Math.max(0, x));
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

// The act names the part being used, but only for the role that uses it. A cunnilingus clip of the active
// partner is a mouth pose, not a genitals pose; the receiving side gets the genitals accent instead.
// Koikatsu writes paired scenes as separate female and male clip sets, so `side` is the role key.
const ACT_ROLE = {
  footjob: { female: 'feet', male: 'genitals' },
  titjob: { female: 'chest', male: 'genitals' },
  'nipple-handjob': { female: 'chest', male: 'genitals' },
  'breast-licking': { male: 'mouth', female: 'chest' },
  handjob: { female: 'hands', male: 'genitals' },
  'ball-massage': { female: 'hands', male: 'genitals' },
  oral: { female: 'mouth', male: 'genitals' },
  deepthroat: { female: 'mouth', male: 'genitals' },
  cunnilingus: { male: 'mouth', female: 'genitals' },
  anilingus: { male: 'mouth', female: 'genitals' },
  fingering: { male: 'hands', female: 'genitals' },
  'anal-fingering': { male: 'hands', female: 'genitals' },
  masturbation: { shared: 'genitals' },
  humping: { shared: 'genitals' },
};

export function actAccent(actIds = [], side = null) {
  const scores = {};
  for (const id of actIds) {
    const map = ACT_ROLE[id];
    if (!map) continue;
    const part = (side && map[side]) || map.shared || null;
    if (!part) continue;
    // The performing side drives the pose, so it outweighs the receiving side.
    const weight = side && map[side] === part ? 1 : 0.85;
    scores[part] = Math.max(scores[part] || 0, weight);
  }
  return scores;
}

// Clip names are romanised Japanese and encode the position even when the scene table does not resolve it:
// Sita_kokan_D_namemawasu2_B = "from below, crotch, licking around, variant D2". 43 602 clips have no
// translated scene, and for most of them the name is the only positional evidence available.
// Priority order matters: a clip named Te_muneL_C_momu is about the chest used by the hand, not the hand.
const NAME_PARTS = [
  ['kokan', 'genitals', 6], ['anal', 'genitals', 6], ['siri', 'butt', 5], ['mune', 'chest', 4],
  ['kuti', 'mouth', 3], ['kuchi', 'mouth', 3], ['kao', 'mouth', 3], ['asi', 'feet', 2], ['ashi', 'feet', 2],
  ['te', 'hands', 1], ['yubi', 'hands', 1],
];
// Only acts that name the working organ. "ireru"/"ositukeru" say what happens, not which part is emphasised.
const NAME_ACTS = { nameru: 'mouth', namemawasu: 'mouth', nademawasu: 'hands', momu: 'hands', ijiru: 'hands' };

export function nameAccent(name = '') {
  const tokens = String(name).toLowerCase().split('_').map((t) => t.replace(/[0-9]+$/, ''));
  const scores = {};
  let bestPriority = 0;
  for (const tok of tokens) {
    const hit = NAME_PARTS.find(([prefix]) => tok === prefix || tok.startsWith(prefix));
    if (hit && hit[2] > bestPriority) { for (const k of Object.keys(scores)) delete scores[k]; scores[hit[1]] = 0.9; bestPriority = hit[2]; }
  }
  // A name with only an action word still says something about the modality.
  if (!Object.keys(scores).length) for (const tok of tokens) if (NAME_ACTS[tok]) scores[NAME_ACTS[tok]] = 0.5;
  return scores;
}

export function metaAccent(fields) {
  // Only per-clip metadata: the scene of this clip, its acts and its title. Bundle summaries ("Набор H-сцены
  // 00_01_00: позиции набора …") list every position of the bundle and would tag the whole bundle.
  const text = [fields.sceneLabel, fields.sceneName, fields.actLabels, fields.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const scores = {};
  for (const [part, words] of Object.entries(KEYWORDS)) {
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits) scores[part] = clamp(hits / 2);
  }
  return scores;
}

// Geometry is deliberately conservative: one strong condition per part beats several weak ones, otherwise
// an upright torso with a normal spine curve outscores everything as "chest".
// A rest-pose container: both arms horizontal and straight, legs straight, torso upright. On stage such a clip
// looks like a T-pose because most bones carry the source rest pose. It is a layer, not a standalone pose.
export function isRestPose(m) {
  if (!m) return false;
  const ae = [num(m['L.arm.elevation']?.mean, 0), num(m['R.arm.elevation']?.mean, 0)];
  const af = [num(m['L.arm.flexion']?.mean, 90), num(m['R.arm.flexion']?.mean, 90)];
  const lf = [num(m['L.leg.flexion']?.mean, 90), num(m['R.leg.flexion']?.mean, 90)];
  const incl = num(m['body.inclination']?.mean, 45);
  return ae.every((v) => Math.abs(v) < 12) && af.every((v) => v < 15) && lf.every((v) => v < 20) && Math.abs(incl) < 10;
}

export function geomAccent(m) {
  if (!m) return {};
  const incl = num(m['body.inclination']?.mean, 45);
  const pelvis = num(m['pelvis.aboveFloor']?.mean, 0.5);
  const knees = Math.min(num(m['L.knee.aboveFloor']?.mean, 0.4), num(m['R.knee.aboveFloor']?.mean, 0.4));
  const feetH = Math.min(num(m['L.foot.aboveFloor']?.mean, 0.4), num(m['R.foot.aboveFloor']?.mean, 0.4));
  const hands = Math.min(num(m['L.hand.aboveFloor']?.mean, 0.4), num(m['R.hand.aboveFloor']?.mean, 0.4));
  const flexion = Math.max(num(m['L.leg.flexion']?.mean, 90), num(m['R.leg.flexion']?.mean, 90));
  const outward = (Math.abs(num(m['L.leg.outward']?.mean, 0)) + Math.abs(num(m['R.leg.outward']?.mean, 0))) / 2;
  const curvature = num(m['spine.curvature']?.mean, 0);
  const headPitch = num(m['head.pitch']?.mean, 0);
  const armFlexion = Math.max(num(m['L.arm.flexion']?.mean, 90), num(m['R.arm.flexion']?.mean, 90));
  const low = pelvis <= 0.17;
  const scores = {};
  // Butt: the pelvis is on the floor, or the body is folded over knees that carry the weight (arms free).
  scores.butt = low && incl < 55 ? 0.9
    : knees < 0.08 && incl > 45 && hands > 0.15 ? 0.7
    : incl > 45 && knees < 0.08 && pelvis > 0.2 ? 0.6
    : 0;
  // Feet: the leg is extended and the foot is carried up, i.e. offered rather than tucked under the body.
  // A foot is only offered when it is actually carried up; an extended leg lying on the floor is not a foot pose.
  scores.feet = feetH < 0.08 ? 0 : clamp(0.7 * (feetH / 0.45) + 0.3 * ((60 - flexion) / 60));
  // Chest: leaning back with an arched spine, pelvis still raised.
  scores.chest = pelvis > 0.2 && incl > 8 && incl < 40 && curvature > 18 ? 0.7 : 0;
  // Mouth: head held level and forward while the body is up, so the face is what is offered.
  scores.mouth = pelvis > 0.25 && Math.abs(headPitch) < 20 && hands < 0.2 ? 0.45 : 0;
  // Genitals: pelvis low with the legs clearly apart.
  scores.genitals = low && outward > 0.45 ? 0.8 : 0;
  // Back: a horizontal body lying with the pelvis down — the back is what faces up.
  scores.back = incl > 60 && low ? 0.7 : 0;
  // Hands: arms carried away from the body, not folded.
  scores.hands = hands > 0.25 && armFlexion < 70 ? 0.6 : 0;
  return scores;
}

/**
 * Combine both sources: geometry 0.6, metadata 0.4. Geometry is measured on this clip, while a scene name
 * describes the whole scene and may cover many fragments.
 */
export function accentFor(metrics, fields, weights = { geom: 0.6, meta: 0.4 }) {
  const geom = geomAccent(metrics);
  const meta = metaAccent(fields);
  const act = actAccent(fields.acts || [], fields.side || null);
  const fromName = nameAccent(fields.clipName || '');
  // An explicit act beats the pose: if the scene is a footjob, the accent is the feet even when the
  // geometry reads as sitting on the butt. Weaker acts only add to the combined score.
  // Several explicit acts can share a clip (footjob + oral). Break the tie with the scene text, so the part
  // the scene actually names wins, and only then fall back to the order of the parts table.
  const explicit = Object.entries(act).sort((a, b) => b[1] - a[1] || (meta[b[0]] || 0) - (meta[a[0]] || 0))[0];
  // A body-part token in the clip name describes this very clip, while an act describes the whole scene:
  // the name wins unless the act names the performing side outright (weight 1).
  const namePartEarly = Object.entries(fromName).sort((a, b) => b[1] - a[1])[0];
  if (namePartEarly && namePartEarly[1] >= 0.85 && !(explicit && explicit[1] >= 1)) {
    const detail = {};
    for (const part of PARTS) detail[part] = { geom: Math.round((geom[part] || 0) * 100) / 100, meta: Math.round((meta[part] || 0) * 100) / 100, name: Math.round((fromName[part] || 0) * 100) / 100, score: part === namePartEarly[0] ? namePartEarly[1] : 0 };
    return { part: namePartEarly[0], score: namePartEarly[1], detail, source: 'name' };
  }
  if (explicit && explicit[1] >= 0.8) {
    const detail = {};
    for (const part of PARTS) detail[part] = { geom: Math.round((geom[part] || 0) * 100) / 100, meta: Math.round((meta[part] || 0) * 100) / 100, act: Math.round((act[part] || 0) * 100) / 100, score: part === explicit[0] ? explicit[1] : 0 };
    return { part: explicit[0], score: explicit[1], detail, source: 'act' };
  }
  // A body-part token in the clip name is positional evidence of the same strength as an act.
  const namePart = Object.entries(fromName).sort((a, b) => b[1] - a[1])[0];
  if (namePart && namePart[1] >= 0.85) {
    const detail = {};
    for (const part of PARTS) detail[part] = { geom: Math.round((geom[part] || 0) * 100) / 100, meta: Math.round((meta[part] || 0) * 100) / 100, name: Math.round((fromName[part] || 0) * 100) / 100, score: part === namePart[0] ? namePart[1] : 0 };
    return { part: namePart[0], score: namePart[1], detail, source: 'name' };
  }
  let best = 'none';
  let bestScore = 0;
  const detail = {};
  for (const part of PARTS) {
    const g = geom[part] || 0;
    const m = meta[part] || 0;
    const score = weights.geom * g + weights.meta * m + 0.3 * (act[part] || 0) + 0.45 * (fromName[part] || 0);
    detail[part] = { geom: Math.round(g * 100) / 100, meta: Math.round(m * 100) / 100, score: Math.round(score * 100) / 100 };
    if (score > bestScore) { bestScore = score; best = part; }
  }
  return { part: bestScore >= 0.3 ? best : 'none', score: Math.round(bestScore * 100) / 100, detail };
}
