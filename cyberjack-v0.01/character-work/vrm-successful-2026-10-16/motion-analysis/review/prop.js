// A vibrator scene as the game plays it: the character layer clip plus the paired object clip that moves
// the prop root. The prop is bound to the hand bone, and its own track shifts it a couple of centimetres.
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { createMixer } from './mix-core.mjs';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const requested = params.get('char');
// Bases with real, measurable poses (hips height and knee angle were checked): the layer alone is a delta.
// H layer clips are deltas and look broken as a base; these are complete poses from the action animators
// (measured: hips height, elbow and knee angles).
const BASE_NAMES = ['f_suwari_00_08_01_L', 'f_suwari_00_02_L', 'f_sleep_00_00', 'Idle_08_01', 'Stand_00_00'];
let baseId = params.get('baseId') || '';

const scene = new T.Scene();
scene.background = new T.Color('#eef2f5');
const camera = new T.PerspectiveCamera(40, 1, 0.01, 100);
// A missing WebGL context must not stop the data panels from working.
let renderer = null;
try { renderer = new T.WebGLRenderer({ antialias: true }); } catch (e) { renderer = null; }
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  $('#viewport').append(renderer.domElement);
}
const controls = new OrbitControls(camera, renderer ? renderer.domElement : document.body);
controls.enableDamping = true;
scene.add(new T.GridHelper(4, 20, 0xaebac4, 0xcad2d9));
scene.add(new T.HemisphereLight(0xffffff, 0x8a95a5, 1.15));
const key = new T.DirectionalLight(0xffffff, 1.4);
key.position.set(2, 4, 3);
scene.add(key);

const bodyGroup = new T.Group();
const geometry = new T.BufferGeometry();
const LINE_COLOR = 0xc2601a;
bodyGroup.add(new T.LineSegments(geometry, new T.LineBasicMaterial({ color: LINE_COLOR })));
const joints = [];
for (let i = 0; i < 24; i++) {
  const mesh = new T.Mesh(new T.SphereGeometry(0.011, 8, 6), new T.MeshBasicMaterial({ color: LINE_COLOR }));
  bodyGroup.add(mesh);
  joints.push(mesh);
}
scene.add(bodyGroup);

let clipList = [];
let state = null;
let playing = true;
let time = 0;

const toVec = (p) => new T.Vector3(p[0], p[1], p[2]);

function fit() {
  const box = new T.Box3();
  for (const pose of state.preview.frames) for (const joint of pose) box.expandByPoint(toVec(joint));
  const center = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3()).length() || 1;
  controls.target.copy(center);
  camera.position.copy(center).add(new T.Vector3(0.5, 0.4, 1).normalize().multiplyScalar(Math.max(size * 1.5, 1.5)));
  controls.update();
}

function trackAt(track, t) {
  if (!track || !track.points?.length) return [0, 0, 0];
  const frames = track.points;
  const index = Math.min(frames.length - 1, Math.max(0, Math.round(t * (track.fps || 30))));
  return frames[index];
}

// The clip's own mean is its resting placement for that scene; only the deviation from it is motion. Taking
// the mean from the area defaults instead keeps the item in place when the clip belongs to another scene.
function trackDeltaAt(track, t) {
  if (!track?.points?.length) return new T.Vector3();
  if (!track.__mean) {
    const sum = [0, 0, 0];
    for (const point of track.points) { sum[0] += point[0]; sum[1] += point[1]; sum[2] += point[2]; }
    track.__mean = sum.map((value) => value / track.points.length);
  }
  const point = trackAt(track, t);
  return new T.Vector3(point[0] - track.__mean[0], point[1] - track.__mean[1], point[2] - track.__mean[2]);
}

function trackQuatAt(track, t) {
  if (!track?.quaternions?.length) return null;
  const index = Math.min(track.quaternions.length - 1, Math.max(0, Math.round(t * (track.fps || 30))));
  return track.quaternions[index];
}

function draw() {
  if (!state) return;
  const duration = state.duration || 1;
  const t = time % duration;
  const preview = state.preview;
  const frameIndex = Math.min(preview.frames.length - 1, Math.round((t / Math.max(0.001, preview.duration)) * (preview.frames.length - 1)));
  const pose = preview.frames[frameIndex];
  for (let i = 0; i < joints.length; i++) if (pose[i]) joints[i].position.copy(toVec(pose[i]));
  const vertices = [];
  for (let i = 0; i < pose.length; i++) if (preview.parents[i] >= 0) vertices.push(...pose[i], ...pose[preview.parents[i]]);
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingSphere();

  for (const side of state.sides) {
    if (!side.mesh) continue;
    const anchorChoice = window.__aibuBone || $('#anchor')?.value || 'waist';
    const anchorBone = { waist: 'cf_j_waist02', hips: 'cf_j_hips', handL: 'cf_j_hand_L', handR: 'cf_j_hand_R' }[anchorChoice] || anchorChoice || 'cf_j_waist02';
    const boneName = anchorBone;
    const boneIndex = preview.names.indexOf(boneName);
    const anchor = boneIndex >= 0 ? toVec(pose[boneIndex]) : toVec(pose[0]);
    // The clip stores the prop's offset in the parent bone's own space, so the offset is rotated by the
    // bone's orientation and added to the bone position (not to world axes — that put the prop inside the body).
    const point = trackAt(side.track, t);
    const parentIndex = preview.parents[boneIndex];
    const childIndex = preview.parents.findIndex((p, i) => p === boneIndex && i !== boneIndex);
    // As in the game: the attachment frame (k_f_kosi02_02 and friends) is an identity child of the body bone,
    // so the item sits exactly at that bone with the bone's own orientation and the prefab's identity transform.
    const bonePos = new T.Vector3(anchor.x, anchor.y, anchor.z);
    const quat = preview.quats?.[frameIndex]?.[boneIndex];
    const boneQuat = quat ? new T.Quaternion().fromArray(quat) : new T.Quaternion();
    // The item clip stores its local transform in the parent bone's space, exactly like Unity does when the
    // prefab is parented with SetParent(worldPositionStays: false): rotate the offset by the bone.
    const useTrack = $('#useTrack') ? $('#useTrack').checked : true;
    // With no paired clip the game leaves the item at the bone, which is inside the body. Use the typical
    // offset of this item in this area instead (median over its clips, data not guesswork).
    const area = window.__aibuArea;
    const base = new T.Vector3(...(window.__itemDefaults?.[window.__aibuAsset]?.[area] || [0, 0, 0]));
    const localOffset = useTrack && side.track ? base.clone().add(trackDeltaAt(side.track, t)) : base;
    side.mesh.position.copy(bonePos).add(localOffset.clone().applyQuaternion(boneQuat));
    // The clip's own rotation (unit quaternion in curves 6..9) multiplies the bone orientation, as Unity does
    // for a child transform.
    const clipQuat = useTrack ? trackQuatAt(side.track, t) : null;
    side.mesh.quaternion.copy(boneQuat);
    if (clipQuat) side.mesh.quaternion.multiply(new T.Quaternion().fromArray(clipQuat));
    side.mesh.scale.setScalar(1);
    window.__debug = { anchor: bonePos.toArray(), prop: side.mesh.position.toArray(), bone: boneName, quat: quat || null };
  }
  $('#time').textContent = `${t.toFixed(2)} / ${duration.toFixed(2)} с`;
  $('#timeline').value = String(t);
  $('#timeline').max = String(duration);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) time += dt;
  draw();
  controls.update();
  if (renderer) renderer.render(scene, camera);
}

// The body pose comes from a base clip plus this layer: the layer alone is a delta and stands in rest.
async function composePose(clipId, duration) {
  // Clip durations are not round numbers (0.6666 s): an end exactly on the boundary is rejected, so stop a frame short.
  const donorEnd = Math.max(1 / 30, Math.min(1.3, duration) - 1 / 30).toFixed(3);
  const url = `/api/mix/selection-bank?baseId=${baseId}&baseStart=0&baseEnd=1.3&donorId=${clipId}&donorStart=0&donorEnd=${donorEnd}`;
  const bank = await (await fetch(url, { cache: 'no-store' })).json();
  if (!bank.rig) return null;
  const mixer = createMixer(bank);
  const names = bank.rig.map((b) => b.name);
  const config = { recipe: 'custom', base: 'libraryBase', basePlayback: 'hold', mask: 'legs', weight: 1, torso: 0, shoulder: true, fingers: 'base', blendIn: 0, blendOut: 0, holdLoops: 1, entryMode: 'original', transferMode: 'layer', animatedOnly: true, donorPlayback: 'clip', donorTime: 0, donorRate: 1, floorCorrection: false };
  const total = Math.min(Math.max(bank.clips.custom.duration, 1 / 30), 20);
  const frames = [];
  const quats = [];
  for (let t = 0; t < total; t += 1 / 30) {
    const out = mixer.evaluate(t, config);
    frames.push(names.map((_n, i) => new T.Vector3().setFromMatrixPosition(out.mixed[i].world).toArray()));
    quats.push(names.map((_n, i) => [out.mixed[i].worldQ.x, out.mixed[i].worldQ.y, out.mixed[i].worldQ.z, out.mixed[i].worldQ.w]));
  }
  return { frames, quats, names, parents: names.map((n) => { const b = bank.rig.find((x) => x.name === n); return b ? names.indexOf(b.parent) : -1; }), duration: total };
}

async function loadChar(name) {
  $('#status').textContent = 'Читаем клип…';
  for (const side of state?.sides || []) if (side.mesh) scene.remove(side.mesh);
  const clipId = clipList.find((c) => c.name === name)?.id;
  if (!clipId) return;
  const detail = await (await fetch('/api/clip/' + clipId, { cache: 'no-store' })).json();
  const props = await (await fetch('/api/prop/' + encodeURIComponent(name), { cache: 'no-store' })).json();
  const sides = [];
  const wanted = $('#side')?.value || 'L';
  for (const [side, info] of Object.entries(props.sides || {})) {
    if (wanted !== 'LR' && side !== wanted) continue;
    let mesh = null;
    if (info.mesh) {
      const loader = new OBJLoader();
      try {
        const materials = await new MTLLoader().loadAsync(info.mtl);
        materials.preload();
        loader.setMaterials(materials);
      } catch (e) { /* без материалов */ }
      mesh = await loader.loadAsync(info.mesh);
      mesh.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.material || !o.material.map) o.material = new T.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7 });
        else o.material.side = T.DoubleSide;
      });
      mesh.scale.setScalar(0.6);
      scene.add(mesh);
    }
    const points = info.track?.points || [];
    const mean = points.length
      ? [0, 1, 2].map((axis) => points.reduce((sum, p) => sum + p[axis], 0) / points.length)
      : [0, 0, 0];
    sides.push({ side, mesh, track: info.track, clip: info.clip, mean });
  }
  let composed = null;
  try {
    composed = await composePose(clipId, detail.preview.duration);
  } catch (error) {
    $('#status').textContent = 'Этот клип нельзя собрать с базой: ' + error.message + '. Показан сырой клип — в нём руки в rest.';
  }
  const preview = composed || detail.preview;
  state = { preview, duration: preview.duration, sides, composed: Boolean(composed) };
  $('#title').textContent = `${name} · предмет ${sides.map((s) => s.side).join('/')}`;
  const rows = [
    ['Клип персонажа', name],
    ['База позы', composed ? `${$('#baseSelect')?.selectedOptions?.[0]?.textContent || 'база'} + слой (смешивание)` : 'rest: клип без базы'],
    ['Кадров', preview.frames.length],
    ['Длительность', preview.duration.toFixed(2) + ' с'],
    ...sides.map((s) => [`Предмет ${s.side}`, `${s.clip}${s.track ? ` · ${s.track.points.length} кадров ${s.track.fps.toFixed(0)} fps` : ''}`]),
  ];
  $('#meta').innerHTML = rows.map(([k, v]) => `<div class="prop"><span>${k}</span><span>${v}</span></div>`).join('');
  $('#props').innerHTML = sides.map((s) => {
    const p = s.track?.points || [];
    const xs = p.map((x) => x[0]), ys = p.map((x) => x[1]), zs = p.map((x) => x[2]);
    const amp = p.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs)) : 0;
    return `<div class="prop"><span>${s.clip} ${s.side}</span><span>ход ${(amp * 100).toFixed(1)} см</span></div>`;
  }).join('');
  fit();
  draw();
  $('#status').textContent = `Кость предмета: ${window.__aibuBone || '—'}. Оранжевый — тело (база + слой). Серый — ${$('#aibuInfo')?.textContent?.split('Кость')[1]?.split('Слои')[0]?.trim() || 'предмет'} по данным игры, смещение из парного клипа предмета.`;
}

async function resolveBases() {
  const select = $('#baseSelect');
  const options = [];
  for (const name of BASE_NAMES) {
    try {
      const response = await fetch('/api/clips?q=' + encodeURIComponent(name) + '&rig=female', { cache: 'no-store' });
      const data = await response.json();
      const hit = (data.rows || []).find((r) => r.name === name);
      if (hit) options.push({ name, id: hit.id });
    } catch (e) { /* пропускаем */ }
  }
  select.replaceChildren(...options.map((o) => new Option(o.name, o.id)));
  if (!options.length) return null;
  const chosen = options.find((o) => o.id === baseId) || options[0];
  select.value = chosen.id;
  baseId = chosen.id;
  return chosen;
}

let aibuTable = null;

async function loadAibuTable() {
  if (aibuTable) return aibuTable;
  const data = await (await fetch('/api/items', { cache: 'no-store' })).json();
  const byItem = new Map();
  for (const layer of data.layers || []) {
    (layer.items || []).forEach((itemId, index) => {
      if (itemId < 0) return;
      const record = byItem.get(itemId) || { id: itemId, layers: [], bones: new Set() };
      record.layers.push({ area: layer.area, id: layer.id, bone: (layer.parents || [])[index] });
      const bone = (layer.bones || [])[index];
      if (bone) record.bones.add(bone);
      record.boneByArea = record.boneByArea || {};
      if (bone) record.boneByArea[layer.area] = bone;
      byItem.set(itemId, record);
    });
  }
  const kinds = data.kinds || {};
  window.__itemDefaults = data.defaults || {};
  aibuTable = (data.aibu || []).map((item) => ({
    ...item,
    kindName: kinds[item.kind] || ('kind ' + item.kind),
    layers: byItem.get(item.id)?.layers || [],
    bones: [...(byItem.get(item.id)?.bones || [])],
    boneByArea: byItem.get(item.id)?.boneByArea || {},
  }));
  return aibuTable;
}

async function loadTrack(clipId) {
  try {
    const data = await (await fetch('/api/track/' + encodeURIComponent(clipId), { cache: 'no-store' })).json();
    return data.track || null;
  } catch (error) { return null; }
}

async function pickAibuItem(id) {
  const table = await loadAibuTable();
  const item = table.find((x) => String(x.id) === String(id));
  if (item) {
    // Which layer this scene uses decides the bone: kokan/anal/siri sit on the waist, mune on the chest.
    const areaFor = (name) => /kokan/i.test(name) ? 2 : /mune/i.test(name) ? 0 : /siri/i.test(name) ? 4 : /anal/i.test(name) ? 3 : null;
    const wanted = areaFor($('#char').value || '');
    const layer = item.layers.find((l) => l.area === wanted) || item.layers[0];
    const data = aibuTable.find((x) => String(x.id) === String(id));
    window.__aibuBone = data?.boneByArea?.[layer?.area] || item.bones[0] || null;
    window.__aibuArea = layer?.area ?? null;
    window.__aibuAsset = item.asset;
    $('#aibuInfo').innerHTML = `<div class="prop"><span>${item.kindName}</span><span>${item.asset}</span></div>` +
      `<div class="prop"><span>Слой сцены</span><span>${layer ? layer.area + '/' + layer.id : '—'}</span></div>` +
      `<div class="prop"><span>Кость</span><span>${window.__aibuBone || '—'} (в игре ${layer ? (layer.bone || layer.area) : '—'})</span></div>` +
      `<div class="prop"><span>Слой выбран</span><span>${layer ? layer.area + '/' + layer.id : '—'}</span></div>` +
      `<div class="prop"><span>Слои</span><span>${item.layers.map((l) => l.area + '/' + l.id).join(', ') || '—'}</span></div>`;
    if (item.asset) {
      for (const side of state?.sides || []) if (side.mesh) scene.remove(side.mesh);
      const loader = new OBJLoader();
      try {
        const materials = await new MTLLoader().loadAsync('/items/' + item.asset + '.mtl');
        materials.preload();
        loader.setMaterials(materials);
      } catch (e) { /* без материалов */ }
      try {
        const mesh = await loader.loadAsync('/items/' + item.asset + '.obj');
        mesh.traverse((o) => {
          if (!o.isMesh) return;
          if (!o.material || !o.material.map) o.material = new T.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7 });
          else o.material.side = T.DoubleSide;
        });
        mesh.scale.setScalar(1);
        scene.add(mesh);
        // The item clip is paired to the body clip by name (Denma_x_B <-> Denma_x_B_L), so its track comes
        // from the same table the prop page uses.
        let track = null;
        try {
          const pair = await (await fetch('/api/prop/' + encodeURIComponent($('#char').value), { cache: 'no-store' })).json();
          const letter = item.set === 1 ? 'R' : 'L';
          const sideInfo = pair.sides?.[letter] || pair.sides?.C || pair.sides?.L || null;
          // Only an item of the same family as the paired clip may use its track: a rotor must not be driven
          // by the vibrator's motion.
          const pairPrefab = sideInfo?.mesh ? String(sideInfo.mesh).split('/').pop().replace(/\.obj$/, '') : null;
          track = pairPrefab && pairPrefab === item.asset ? sideInfo.track || null : null;
        } catch (error) { track = null; }
        // Any item animation can drive the item, not only the one paired with this body clip: the list below
        // offers every clip of the item family, base idle first.
        let itemClips = [];
        try {
          const list = await (await fetch('/api/itemclips/' + encodeURIComponent(item.asset), { cache: 'no-store' })).json();
          itemClips = list.clips || [];
        } catch (error) { itemClips = []; }
        const select = $('#itemClip');
        select.replaceChildren(...itemClips.map((c) => new Option(`${c.clip} · ${c.duration.toFixed(2)} с`, c.clipId)));
        const pairedId = track ? (itemClips.find((c) => c.clip === sideInfo?.clip)?.clipId || null) : null;
        if (pairedId) select.value = pairedId;
        const active = itemClips.find((c) => c.clipId === select.value) || null;
        const activeTrack = active ? await loadTrack(active.clipId) : track;
        if (state) state.sides = [{ side: 'aibu', mesh, track: activeTrack, clip: item.asset }];
        draw();
      } catch (e) { /* меша нет */ }
    }
  } else {
    window.__aibuBone = null;
    $('#aibuInfo').textContent = '';
  }
}

async function boot() {
  await resolveBases();
  const table = await loadAibuTable();
  $('#aibuItem').append(...table.map((item) => new Option(`${item.id}: ${item.asset} · ${item.kindName}`, String(item.id))));
  $('#aibuItem').onchange = (e) => pickAibuItem(e.target.value);
  // Items live in several families, and their body clips are named after the item (Denma_, Dildo_, Vibe_, Rotor_).
  const families = ['Denma_', 'Dildo_', 'Vibe_', 'Rotor_'];
  const seen = new Map();
  for (const prefix of families) {
    const part = await (await fetch('/api/clips?q=' + encodeURIComponent(prefix) + '&rig=female')).json();
    for (const row of part.rows || []) {
      if (!seen.has(row.id) && row.rig === 'female' && row.playable !== false && !/_[LR]$/.test(row.name)) seen.set(row.id, row);
    }
  }
  clipList = [...seen.values()].slice(0, 300);
  const select = $('#char');
  select.replaceChildren(...clipList.map((c) => new Option(c.name, c.name)));
  const start = requested && clipList.some((c) => c.name === requested) ? requested : clipList[0]?.name;
  if (!start) { $('#status').textContent = 'Клипы Denma_* не найдены'; return; }
  select.value = start;
  await loadChar(start);
}

$('#char').onchange = (e) => loadChar(e.target.value);
$('#side').onchange = () => loadChar($('#char').value);
$('#itemClip').onchange = async (e) => {
  const track = await loadTrack(e.target.value);
  if (state?.sides?.[0]) { state.sides[0].track = track; draw(); }
};
$('#anchor').onchange = () => draw();
for (const id of ['useTrack', 'offX', 'offY', 'offZ', 'itemScale']) {
  const el = $('#' + id);
  if (el) el.oninput = () => draw();
}
$('#baseSelect').onchange = (e) => { baseId = e.target.value; loadChar($('#char').value); };
$('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? 'Ⅱ' : '▶'; };
$('#timeline').oninput = (e) => { time = Number(e.target.value); playing = false; $('#play').textContent = '▶'; draw(); };
new ResizeObserver(() => {
  const w = $('#viewport').clientWidth, h = $('#viewport').clientHeight;
  if (!w || !h) return;
  if (!renderer) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe($('#viewport'));

requestAnimationFrame(frame);
boot().catch((e) => { $('#status').textContent = 'Ошибка: ' + e.message; });
