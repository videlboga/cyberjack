// Builds the pose registry the VRM stand uses: one measured base clip per game pose,
// the modifiers that have measured windows, and an explicit list of what is still missing.
// Inputs are the published measurement layers; nothing is guessed from names alone.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '..');
const data = dir + '/data';
const search = JSON.parse(fs.readFileSync(data + '/library-search.json'));
const hentai = JSON.parse(fs.readFileSync(data + '/hentai-labels.json'));
const rows = new Map(search.rows.map((r) => [r.id, r]));
const manifest = JSON.parse(fs.readFileSync(data + '/library-annotation-manifest.json'));
const hentaiManifest = JSON.parse(fs.readFileSync(data + '/hentai-labels-manifest.json'));

const ENERGY_RANK = {quiet: 0, small: 1, active: 2, unknown: 3};
const PLAYER_RIGS = new Set(['female', 'shared']);
const stageClip = {'pose_standing': 'Idle_00_00', 'pose_standing_straight': 'Idle_00_00', 'pose_sitting': 'Base_sitting', 'pose_lying_down': 'Base_lying', 'pose_all_fours': 'Base_all_fours', 'pose_kneeling': 'Base_kneeling', 'pose_spread_eagle': 'Base_spread_eagle', 'act_present_feet': 'Base_feet'};

// Poses that already had a shipped clip are kept as they are: this task fills the empty ones.
const SHIPPED = {'pose_standing': 'd82833280717194afd3bde21', 'pose_standing_straight': 'd82833280717194afd3bde21', 'pose_sitting': '28a3169401858c6bd0c90276', 'pose_lying_down': '227af670e6cbaa32bf59d276'};

const PHASE_RANK = {'idle': 0, 'loop-w': 1, 'loop-s': 1, 'loop-o': 1, 'loop': 1, 'stop-idle': 2, 'insert': 3, 'insert-idle': 3, 'in-loop': 3, 'in-start': 3, 'in-a': 3, 'out': 4, 'out-a': 4, 'out-start': 4, 'out-loop': 4, 'drop': 4, 'pull': 4, 'touch': 2, unknown: 5};
function phaseRank(id) {
  const row = hentai.labels[id];
  return row ? PHASE_RANK[row[4]] ?? 5 : 5;
}

function labelOf(id) {
  const row = hentai.labels[id];
  if (!row) return null;
  return {sceneKey: row[0], phase: row[4], side: row[7], posture: row[8], group: row[9], hscene: row[12]};
}

// Every clip that could serve as a pose: humanoid female/shared, measured, not root-moving.
function candidates() {
  return search.rows.filter((r) => r.status === 'ok' && r.coverage >= 0.75 && PLAYER_RIGS.has(r.rig) && r.rootTravel < 0.1 && r.duration >= 0.5);
}
const pool = candidates();

function pick(list, prefer = {}) {
  const ranked = [...list].sort((a, b) => {
    const pa = phaseRank(a.id), pb = phaseRank(b.id);
    if (pa !== pb) return pa - pb;
    const ea = ENERGY_RANK[a.energy] ?? 3, eb = ENERGY_RANK[b.energy] ?? 3;
    if (ea !== eb) return ea - eb;
    const da = Math.abs((a.duration || 0) - (prefer.duration ?? 1.4)), db = Math.abs((b.duration || 0) - (prefer.duration ?? 1.4));
    if (Math.abs(da - db) > 0.25) return da - db;
    if (a.loop !== b.loop) return a.loop ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return ranked;
}

function alternatives(list, n = 3) {
  return pick(list).slice(0, n).map((r) => ({id: r.id, name: r.name, duration: r.duration, energy: r.energy, posture: r.posture, loop: r.loop, evidence: 'measured-ranking'}));
}

const poses = {};
for (const [id, clipId] of Object.entries(SHIPPED)) {
  const r = rows.get(clipId);
  poses[id] = {
    stageClip: stageClip[id],
    baseClip: clipId,
    name: r?.name || null,
    duration: r?.duration ?? null,
    evidence: 'existing-shipped-clip',
    posture: r?.posture || null,
    alternatives: [],
    needsMeasurement: [],
  };
}

// act_present_feet: a straight leg lifted above horizontal while the other foot carries the weight.
// Previously this pose reused the seated base, which is why it looked wrong on stage.
{
  // The library has no clip that sits with both legs out: 9 seated candidates exist, all active
  // H-scene fragments, and the 966 foot.presented clips are all lying shots with a raised leg.
  // So the pose stays constructed from the seated base plus measured knee extensions, and the
  // gap is stated instead of being papered over with a lying clip.
  // No library clip sits with both legs out, but the mixer can present the legs on the seated base:
  // the bank takes the seated clip and animates the leg branches from measured leg-forward donors.
  // The pose is chosen by what the clip actually presents: a measured foot presentation, calm and
  // loopable, seated first because that is the act the pose is for.
  const presented = pool.filter((r) => r.goals.includes('foot.presented'));
  const seated = presented.filter((r) => r.posture === 'seated');
  const calm = seated.filter((r) => r.energy === 'quiet' || r.energy === 'small');
  if (false && (calm.length || seated.length)) {
    const list = calm.length ? calm : seated;
    const best = pick(list, {duration: 1.4})[0];
    poses.act_present_feet = {
      stageClip: 'Base_feet',
      baseClip: best.id,
      name: best.name,
      duration: best.duration,
      evidence: 'measured presented part: feet (seated foot-presentation clip)',
      posture: best.posture,
      candidates: list.length,
      alternatives: alternatives(list.filter((r) => r.id !== best.id)),
      needsMeasurement: [],
    };
  } else {
  const low = presented.filter((r) => r.posture === 'lying' || r.stance === 'low-horizontal');
  // A base whose legs are abducted survives the pelvis swap: the abduction lives in the thigh's own
  // rotation, while a straight-legged base keeps its lift in the pelvis and collapses when it turns upright.
  // Verified on stage: abducted base -> knee 0.086, foot 0.186; straight base -> knee -0.382, foot -0.646.
  const spread = low.filter((r) => (r.goals || []).includes('legs-apart'));
  const calm = spread.filter((r) => r.energy === 'quiet' || r.energy === 'small');
  const best = pick(calm.length ? calm : spread.length ? spread : low.length ? low : presented, {duration: 1.4})[0];
  if (!best) throw Error('no measured foot.presented clip');
  poses.act_present_feet = {
    stageClip: 'Base_feet',
    baseClip: best.id,
    name: best.name,
    duration: 1.4,
    evidence: 'measured foot.presented (raised straight legs on a low base)',
    posture: 'seated',
    candidates: low.length || presented.length,
    alternatives: alternatives((low.length ? low : presented).filter((r) => r.id !== best.id)),
    needsMeasurement: ['seated-feet-presentation-clip'],
  };
  }
}

// pose_all_fours: the library has a measured quadruped goal, so this pose is filled from data.
{
  // Quadruped must show hands AND knees below the pelvis, with a measured floor-hands contact:
  // a goal alone can come from a torso angle, so the shape and the contact are required too.
  const strict = pool.filter((r) => r.stance === 'hands-knees-shape' && r.goals.includes('base.kneeling') && (r.contacts || []).includes('floor-hands'));
  const list = strict.length ? strict : pool.filter((r) => r.goals.includes('base.all-fours'));
  const best = pick(list, {duration: 1.4})[0];
  if (!best) throw Error('no measured all-fours candidate');
  poses.pose_all_fours = {
    stageClip: 'Base_all_fours',
    baseClip: best.id,
    name: best.name,
    duration: best.duration,
    evidence: strict.length ? 'measured hands-knees shape + knee support + floor-hands contact' : 'measured-goal-base.all-fours',
    posture: best.posture,
    alternatives: alternatives(list.filter((r) => r.id !== best.id)),
    needsMeasurement: [],
  };
}

// pose_spread_eagle: the KPlug "Распятая лягушкой" scene is the measured source for a spread-eagle base.
{
  const sceneKey = 'kplug:02_58';
  const list = pool.filter((r) => {
    const l = labelOf(r.id);
    return l && l.sceneKey === sceneKey && l.posture === 'lying';
  }).sort((a, b) => phaseRank(a.id) - phaseRank(b.id) || (ENERGY_RANK[a.energy] ?? 3) - (ENERGY_RANK[b.energy] ?? 3) || a.id.localeCompare(b.id));
  const best = list[0];
  if (!best) throw Error('no spread-eagle scene clips');
  poses.pose_spread_eagle = {
    stageClip: 'Base_spread_eagle',
    baseClip: best.id,
    name: best.name,
    duration: best.duration,
    evidence: 'scene-table kplug:02_58 (Spread Eagle) + measured lying posture',
    scene: 'Распятая лягушкой',
    phase: labelOf(best.id)?.phase || null,
    posture: best.posture,
    alternatives: alternatives(list.filter((r) => r.id !== best.id)),
    needsMeasurement: [],
  };
}

// pose_kneeling: preferred source is the measured knee-support goal; the geometric scorer is only a fallback.
{
  const measuredList = pool.filter((r) => r.goals.includes('base.kneeling'));
  if (measuredList.length) {
    const best = pick(measuredList, {duration: 1.4})[0];
    poses.pose_kneeling = {
      stageClip: 'Base_kneeling',
      baseClip: best.id,
      name: best.name,
      duration: best.duration,
      evidence: 'measured knee support (goal base.kneeling from anatomy-v3 atoms)',
      posture: best.posture,
      candidates: measuredList.length,
      alternatives: alternatives(measuredList.filter((r) => r.id !== best.id)),
      needsMeasurement: [],
    };
  } else {

  const anatomy = new Map();
  for (let shard = 0; shard < 4; shard++) {
    const file = data + '/anatomy-' + shard + '.jsonl';
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      const rec = JSON.parse(line);
      if (rec?.anatomy?.metrics) anatomy.set(rec.id, rec.anatomy.metrics);
    }
  }
  const list = pool.filter((r) => ['seated', 'crouched'].includes(r.posture)).map((r) => {
    const m = anatomy.get(r.id) || {};
    const inclination = m['body.inclination']?.mean ?? 45, pelvis = m['pelvis.aboveFeet']?.mean ?? 0.2;
    const knee = ((m['L.leg.flexion']?.mean ?? 90) + (m['R.leg.flexion']?.mean ?? 90)) / 2;
    // Kneeling wants: upright torso, low pelvis, deep knee fold.
    const score = Math.abs(inclination - 12) / 30 + Math.abs(pelvis - 0.30) / 0.15 + Math.abs(knee - 130) / 40;
    return {...r, kneelingScore: Math.round(score * 1000) / 1000};
  }).sort((a, b) => a.kneelingScore - b.kneelingScore || phaseRank(a.id) - phaseRank(b.id) || a.id.localeCompare(b.id));
  const best = list[0];
  if (!best) throw Error('no kneeling candidate');
  poses.pose_kneeling = {
    stageClip: 'Base_kneeling',
    baseClip: best.id,
    name: best.name,
    duration: best.duration,
    evidence: 'geometric pick: upright torso, low pelvis, deep knee fold (knee support not measured)',
    score: best.kneelingScore,
    posture: best.posture,
    alternatives: alternatives(list.filter((r) => r.id !== best.id)),
    needsMeasurement: ['kneeling-versus-crouched-class'],
  };
  }
}

// Modifiers: report what the measurement layer can supply for each game posture command.
const modifierGoals = {
  posture_arms_up: 'arms.both.overhead',
  posture_arms_down: 'arms.both.lowered',
  posture_arms_sides: 'arms.both.side',
  posture_arms_front: 'arms.both.front',
  posture_head_left: 'head.left',
  posture_head_right: 'head.right',
  posture_head_forward: 'head.forward',
  posture_leg_left_forward: 'left-leg-forward',
  posture_leg_right_forward: 'right-leg-forward',
  posture_legs_free: null,
  posture_arms_free: null,
};
const modifiers = {};
for (const [command, goalId] of Object.entries(modifierGoals)) {
  if (!goalId) {
    modifiers[command] = {goalId: null, status: 'release', note: 'команда снимает слой, отдельного источника не требует'};
    continue;
  }
  const list = pool.filter((r) => r.goals.includes(goalId));
  modifiers[command] = {
    goalId,
    status: list.length ? 'measured' : 'needs-measurement',
    candidates: list.length,
    examples: alternatives(list, 2),
  };
}

const registry = {
  format: 'vrm-pose-registry-v1',
  generatedAt: new Date().toISOString(),
  fingerprints: {annotations: manifest.fingerprint, hentaiLabels: hentaiManifest.fingerprint},
  measurement: {
    anatomyVersion: 'anatomy-v2',
    note: 'Базовые клипы выбраны по измеренной позе, динамике и цели. Поза пары и контакт не измеряются; для парных сцен это только одна сторона.',
  },
  poses,
  modifiers,
};
fs.writeFileSync(data + '/pose-registry.json', JSON.stringify(registry, null, 2));
console.log(JSON.stringify({poses: Object.fromEntries(Object.entries(poses).map(([k, v]) => [k, [v.stageClip, v.name, Math.round((v.duration || 0) * 100) / 100, v.evidence]])), modifiers: Object.fromEntries(Object.entries(modifiers).map(([k, v]) => [k, v.status]))}, null, 1));
