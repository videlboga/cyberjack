// Fixed-point "which part does the pose offer" measure, relative to the character's own body.
// No viewer or partner is assumed: a part is presented when it sits far outside the body's core line
// and stays there. Distances are in body heights.
//
//   limbs  : perpendicular distance of the hand/foot from the pelvis→neck axis
//   pelvis : distance of the pelvis from the neck→feet line (butt lifted out of the body line)
//
// Thresholds are deliberately explicit so they can be tuned per body part.
export const PART_THRESHOLDS = { feet: 0.2, hands: 0.25, hips: 0.08 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const perp = (p, origin, axis) => {
  const rel = sub(p, origin);
  const along = dot(rel, axis);
  return len([rel[0] - axis[0] * along, rel[1] - axis[1] * along, rel[2] - axis[2] * along]);
};
const pointOnLine = (a, b, p) => {
  const ab = sub(b, a);
  const abLen = len(ab) || 1;
  const t = dot(sub(p, a), ab) / (abLen * abLen);
  return len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
};

export function measurePoseParts({ frames, names, height = 1 }) {
  const scale = (f) => f.map((p) => [p[0] / height, p[1] / height, p[2] / height]);
  frames = frames.map(scale);
  const at = (f, name) => f[names.indexOf(name)];
  const feet = [];
  const hands = [];
  const hips = [];
  for (const f of frames) {
    const pelvis = at(f, 'cf_j_hips');
    const neck = at(f, 'cf_j_neck');
    const axis = norm(sub(neck, pelvis));
    // A foot is offered when the leg is actually extended: an unfolded knee carries the foot out of the
    // body line, while a folded leg (all fours, kneeling) keeps it tucked behind the pelvis.
    const kneeAngle = (s) => {
      const a = at(f, 'cf_j_thigh00_' + s), b = at(f, 'cf_j_leg01_' + s), c = at(f, 'cf_j_foot_' + s);
      const u = sub(a, b), v = sub(c, b);
      return (Math.acos(Math.min(1, Math.max(-1, dot(u, v) / ((len(u) || 1) * (len(v) || 1))))) * 180) / Math.PI;
    };
    const extended = (s) => kneeAngle(s) > 140;
    const footL = at(f, 'cf_j_foot_L'), footR = at(f, 'cf_j_foot_R');
    feet.push(Math.max(extended('L') ? perp(footL, pelvis, axis) : 0, extended('R') ? perp(footR, pelvis, axis) : 0));
    hands.push(Math.max(perp(at(f, 'cf_j_hand_L'), pelvis, axis), perp(at(f, 'cf_j_hand_R'), pelvis, axis)));
    // Butt offered: the pelvis sits above the chest line (face-down, hips up).
    hips.push(Math.max(0, pelvis[1] - neck[1]));
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const values = { feet: mean(feet), hands: mean(hands), hips: mean(hips) };
  const scores = Object.entries(values).map(([k, v]) => [k, v - (PART_THRESHOLDS[k] ?? 0)]);
  scores.sort((a, b) => b[1] - a[1]);
  const [top, second] = scores;
  const label = top[1] > 0 && top[1] - second[1] > 0.02 ? top[0] : 'none';
  return { ...values, label, margin: top[1] - second[1], series: { feet, hands, hips } };
}
