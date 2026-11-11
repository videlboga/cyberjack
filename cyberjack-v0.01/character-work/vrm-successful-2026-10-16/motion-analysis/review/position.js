// Position view: draw the base pose of an H position and the same pose with one of its layers applied.
// The base comes from the game's base-controller clip list, the layer from the position's own controller.
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { createMixer } from './mix-core.mjs';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const [mode, id] = (params.get('position') || '5/1').split('/');

const scene = new T.Scene();
scene.background = new T.Color('#eef2f5');
const camera = new T.PerspectiveCamera(40, 1, 0.01, 100);
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
$('#viewport').append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new T.GridHelper(4, 20, 0xaebac4, 0xcad2d9));
scene.add(new T.HemisphereLight(0xffffff, 0x8a95a5, 1.15));
const key = new T.DirectionalLight(0xffffff, 1.5);
key.position.set(2, 4, 3);
scene.add(key);
const fill = new T.DirectionalLight(0xffffff, 0.6);
fill.position.set(-3, 2, -2);
scene.add(fill);

const PALETTE = [0x2f6fb0, 0xc2601a, 0x1f8a4c];
const groups = PALETTE.map((color) => {
  const group = new T.Group();
  const geometry = new T.BufferGeometry();
  const line = new T.LineSegments(geometry, new T.LineBasicMaterial({ color }));
  const joints = [];
  for (let i = 0; i < 24; i++) {
    const mesh = new T.Mesh(new T.SphereGeometry(0.011, 8, 6), new T.MeshBasicMaterial({ color }));
    group.add(mesh);
    joints.push(mesh);
  }
  group.add(line);
  scene.add(group);
  return { group, geometry, joints };
});

let state = null;
let showPartner = false;
let partner = null;
let itemMesh = null;
let itemInfo = null;
let playing = true;
let time = 0;

function fit() {
  const box = new T.Box3();
  const firstPoses = state.kind === 'clip' ? [state.preview.frames[0]] : state.frames[0];
  for (const pose of firstPoses) for (const joint of pose) box.expandByPoint(new T.Vector3(...joint).sub(new T.Vector3(...pose[0])));
  const center = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3()).length() || 1;
  controls.target.copy(center);
  camera.position.copy(center).add(new T.Vector3(0.6, 0.35, 1).normalize().multiplyScalar(Math.max(size * 1.4, 1.4)));
  controls.update();
}

function draw() {
  if (!state) return;
  const duration = state.duration || 1;
  const t = time % duration;
  let poses;
  if (state.kind === 'clip') {
    const preview = state.preview;
    const index = Math.min(preview.frames.length - 1, Math.round((t / Math.max(0.001, preview.duration)) * (preview.frames.length - 1)));
    poses = [null, preview.frames[index]];
  } else {
    const frameIndex = Math.min(state.frames.length - 1, Math.max(0, Math.round((t / duration) * (state.frames.length - 1))));
    poses = state.frames[frameIndex];
  }
  poses.forEach((pose, index) => {
    const { group, geometry, joints } = groups[index];
    if (!pose || index === 0) {
      group.visible = false;
      return;
    }
    group.visible = true;
    for (let i = 0; i < joints.length; i++) if (pose[i]) joints[i].position.copy(new T.Vector3(...pose[i]).sub(new T.Vector3(...pose[0])));
    const vertices = [];
    for (let i = 0; i < pose.length; i++) if (state.parents[i] >= 0) vertices.push(...pose[i], ...pose[state.parents[i]]);
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.computeBoundingSphere();
  });
  if (partner && showPartner) {
    const preview = partner.preview;
    const index = Math.min(preview.frames.length - 1, Math.round((t / Math.max(0.001, preview.duration)) * (preview.frames.length - 1)));
    const pose = preview.frames[index];
    const { geometry, joints } = groups[2];
    for (let i = 0; i < joints.length; i++) if (pose[i]) joints[i].position.copy(new T.Vector3(...pose[i]).sub(new T.Vector3(...pose[0])));
    const vertices = [];
    for (let i = 0; i < pose.length; i++) if (preview.parents[i] >= 0) vertices.push(...pose[i], ...pose[preview.parents[i]]);
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.computeBoundingSphere();
  }
  if (itemMesh && state) {
    // anchor the prop to a bone of the visible pose
    const pose = poses[1] || poses[0];
    const boneName = itemInfo?.parents?.[0]?.bone || '';
    const map = { handR: 'cf_j_hand_R', handL: 'cf_j_hand_L', hips: 'cf_j_hips', head: 'cf_j_head' };
    const key = Object.keys(map).find((k) => boneName.includes(k));
    const index = key && state.names ? state.names.indexOf(map[key]) : 1;
    const anchor = pose[index >= 0 ? index : 1] || pose[0];
    itemMesh.position.set(anchor[0], anchor[1], anchor[2]);
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
  renderer.render(scene, camera);
}

async function poseFromClip(clipId, start, end) {
  const res = await fetch(`/api/clip/${clipId}`, { cache: 'no-store' });
  if (!res.ok) throw Error('клип не найден: ' + clipId);
  return res.json();
}

async function compose(base, layer) {
  const params = new URLSearchParams({ baseId: base.id, baseStart: '0', baseEnd: String(Math.min(base.duration, 1.3)), donorId: layer.id, donorStart: '0', donorEnd: String(Math.min(layer.duration, 1.3)) });
  const res = await fetch('/api/mix/selection-bank?' + params);
  if (!res.ok) throw Error('не удалось собрать банк смешивания');
  const bank = await res.json();
  const mixer = createMixer(bank);
  const names = bank.rig.map((b) => b.name);
  const config = { recipe: 'custom', base: 'libraryBase', basePlayback: 'hold', mask: 'legs', weight: 1, torso: 0, shoulder: true, fingers: 'base', blendIn: 0, blendOut: 0, holdLoops: 1, entryMode: 'original', transferMode: 'layer', animatedOnly: true, donorPlayback: 'clip', donorTime: 0, donorRate: 1, floorCorrection: false };
  const toPoints = (pose) => names.map((n, i) => new T.Vector3().setFromMatrixPosition(pose[i].world).toArray());
  const total = Math.min(Math.max(bank.clips.custom.duration, 1 / 30), 20);
  const fps = 30;
  const frames = [];
  for (let t = 0; t < total; t += 1 / fps) {
    const out = mixer.evaluate(t, config);
    frames.push([toPoints(out.base), toPoints(out.mixed)]);
  }
  return { frames, duration: total, names, parents: names.map((n) => { const b = bank.rig.find((x) => x.name === n); return b ? names.indexOf(b.parent) : -1; }) };
}

// Small 2D stick figures: enough to compare poses of many clips without N WebGL canvases.
function drawStick(canvas, preview, frameIndex) {
  const ctx = canvas.getContext('2d');
  const frame = preview.frames[frameIndex] || preview.frames[0];
  if (!frame) return;
  const points = frame.map((p) => ({ x: p[0], y: p[1] }));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((canvas.width - 16) / Math.max(0.15, maxX - minX), (canvas.height - 16) / Math.max(0.3, maxY - minY));
  const ox = canvas.width / 2 - ((minX + maxX) / 2) * scale;
  const oy = canvas.height - 8 + minY * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#c2601a';
  ctx.fillStyle = '#c2601a';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < frame.length; i++) {
    const parent = preview.parents[i];
    if (parent < 0) continue;
    ctx.beginPath();
    ctx.moveTo(ox + points[i].x * scale, oy - points[i].y * scale);
    ctx.lineTo(ox + points[parent].x * scale, oy - points[parent].y * scale);
    ctx.stroke();
  }
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(ox + p.x * scale, oy - p.y * scale, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function buildSheet() {
  const count = Number($('#sheetCount').value);
  const host = $('#sheet');
  host.replaceChildren();
  const layers = state?.record?.layers || [];
  const picked = layers.slice(0, count);
  $('#status').textContent = `Готовим сетку из ${picked.length} слоёв…`;
  for (const layer of picked) {
    const cell = document.createElement('button');
    cell.style.cssText = 'flex:0 0 96px;padding:3px;border:1px solid #dde3e9;border-radius:6px;background:#fff;cursor:pointer;text-align:left';
    const canvas = document.createElement('canvas');
    canvas.width = 88;
    canvas.height = 104;
    canvas.style.width = '88px';
    const label = document.createElement('div');
    label.textContent = layer.name;
    label.style.cssText = 'font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    cell.append(canvas, label);
    cell.onclick = () => { $('#layer').value = layer.id; showClip(layer, state?.record); };
    host.append(cell);
    try {
      const detail = await (await fetch(`/api/clip/${layer.id}`, { cache: 'no-store' })).json();
      if (detail.preview) drawStick(canvas, detail.preview, Math.floor(detail.preview.frames.length / 2));
    } catch (e) { /* пустая ячейка */ }
  }
  $('#status').textContent = `Сетка: ${picked.length} слоёв позиции. Клик по ячейке — показать позу крупно.`;
}

async function showClip(clip, record) {
  const res = await fetch(`/api/clip/${clip.id}`, { cache: 'no-store' });
  if (!res.ok) throw Error('клип не найден: ' + clip.name);
  const detail = await res.json();
  const preview = detail.preview;
  state = { kind: 'clip', clip, record, preview, parents: preview.parents, duration: preview.duration };
  fit();
  draw();
  const where = record ? ` · позиция ${record.mode}/${record.id} ${record.nameJa || ''}` : '';
  $('#status').textContent = `Поза клипа ${clip.name} (${clip.duration.toFixed(2)} с)${where}.` +
    (partner ? ` Зелёный — партнёр ${partner.name}.` : '') +
    ' Это клип из набора позиции, а не восстановленная поза позиции.';
}

async function load() {
  $('#status').textContent = 'Читаем позицию…';
  const res = await fetch(`/api/position/${mode}/${id}`, { cache: 'no-store' });
  const record = await res.json();
  if (!res.ok) { $('#status').textContent = record.error || 'Позиция не найдена'; return; }
  $('#title').textContent = `${record.nameJa || '—'} · режим ${record.mode} · id ${record.id}`;
  const meta = [['База', record.base ? record.base.name : 'нет'], ['Контроллер', record.controller], ['Базовый контроллер', record.baseController], ['Слоёв', record.layers.length]];
  $('#meta').innerHTML = meta.map(([k, v]) => `<div class="prop"><span>${k}</span><span>${v}</span></div>`).join('');
  const props = [['Предмет', record.props.item], ['Хит-коллайдер', record.props.hit], ['Хит-объект', record.props.hitObject], ['Шея', record.props.neck], ['Камера', record.props.camera], ['Партнёр', record.props.partner], ['Стол', record.props.useDesk ? 'да' : null], ['Стул', record.props.useChair ? 'да' : null]].filter(([, v]) => v);
  $('#props').innerHTML = props.length ? props.map(([k, v]) => `<div class="prop"><span>${k}</span><span>${v}</span></div>`).join('') : '<small>Предметов нет</small>';
  const select = $('#layer');
  select.replaceChildren(...record.layers.map((l) => new Option(`${l.name} · ${l.duration.toFixed(2)} с`, l.id)));
  const preferred = record.defaultLayer ? record.layers.find((l) => l.id === record.defaultLayer.id) : null;
  const chosen = record.layers.find((l) => l.id === select.value) || preferred || record.layers[0];
  if (chosen) select.value = chosen.id;
  partner = null;
  if (record.partner && record.partner.base) {
    const male = await fetch(`/api/clip/${record.partner.base.id}`, { cache: 'no-store' });
    if (male.ok) partner = { preview: (await male.json()).preview, name: record.partner.base.name };
  }
  if (record.props?.item) {
    try {
      const info = await (await fetch('/api/item/' + encodeURIComponent(record.props.item))).json();
      if (info.mesh) {
        const loader = new OBJLoader();
        const mtlUrl = info.mesh.replace(/\.obj$/, '.mtl');
        try {
          const materials = await new MTLLoader().loadAsync(mtlUrl);
          materials.preload();
          loader.setMaterials(materials);
        } catch (e) { /* материалы необязательны */ }
        const loaded = await loader.loadAsync(info.mesh);
        loaded.traverse((o) => {
          if (!o.isMesh) return;
          if (!o.material || !o.material.map) o.material = new T.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7, metalness: 0.05 });
          else o.material.side = T.DoubleSide;
        });
        loaded.scale.setScalar(0.6);
        scene.add(loaded);
        itemMesh = loaded;
        itemInfo = info;
        $('#props').insertAdjacentHTML('beforeend', `<div class="prop"><span>Меш предмета</span><span>${info.mesh}</span></div>`);
      }
    } catch (e) { /* предмет без меша */ }
  }
  await showClip(chosen, record);
}

showPartner = false;
$('#showPartner').onchange = (e) => { showPartner = e.target.checked; groups[2].group.visible = showPartner; draw(); };
groups[2].group.visible = false;
$('#showBase').onchange = (e) => { groups[0].group.visible = e.target.checked; draw(); };
groups[0].group.visible = false;
$('#layer').onchange = () => load();
$('#apply').onclick = () => load();
$('#sheetBuild').onclick = () => buildSheet();
$('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? 'Ⅱ' : '▶'; };
$('#timeline').oninput = (e) => { time = Number(e.target.value); playing = false; $('#play').textContent = '▶'; draw(); };
new ResizeObserver(() => {
  const w = $('#viewport').clientWidth, h = $('#viewport').clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe($('#viewport'));

requestAnimationFrame(frame);
load().catch((e) => { $('#status').textContent = 'Ошибка: ' + e.message; });
