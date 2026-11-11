import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { WinchRope } from './winch-rope.js';

const loader = new GLTFLoader();
const stage = document.getElementById('detail-visual');
let active = null;
let shadowTexture = null;

function shadowMap() {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(36,38,40,.32)');
  g.addColorStop(0.55, 'rgba(36,38,40,.14)');
  g.addColorStop(1, 'rgba(36,38,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowTexture = new THREE.CanvasTexture(c);
  shadowTexture.colorSpace = THREE.SRGBColorSpace;
  return shadowTexture;
}

function axisVec(axis) {
  return axis === 'y' ? new THREE.Vector3(0, 1, 0)
    : axis === 'z' ? new THREE.Vector3(0, 0, 1)
    : new THREE.Vector3(1, 0, 0);
}

// Cache-bust для GLB: статический сервер (python http.server) отдаёт файлы без
// Cache-Control, поэтому браузер применяет эвристическую свежесть и может
// показать старую геометрию по неизменному URL. Версия берётся из метаданных
// модели (bytes/nodes), т.е. меняется вместе с пересобранным GLB; если каталог
// не фиксирует bytes, в версию подмешивается токен сборки из ?v= самого
// components-viewer.js. Существующие query-параметры сохраняются.
const BUILD_V = new URL(import.meta.url).searchParams.get('v') || '';

// Вариант модели: гибкий (базовый GLB) или жёсткий (<id>_hard.glb).
// Каталог держит оба файла в model.variants; выбор приходит из components.html
// через comp.__activeVariant (переключатель в модалке).
function pickVariant(comp) {
  const list = Array.isArray(comp.model && comp.model.variants)
    ? comp.model.variants.filter((v) => v && v.file)
    : [];
  if (!list.length) return { id: 'flexible', model: comp.model };
  const want = comp.__activeVariant;
  const v = list.find((x) => x.id === want) || list.find((x) => x.default) || list[0];
  return {
    id: v.id,
    model: Object.assign({}, comp.model, {
      file: v.file,
      prefix: v.prefix || comp.model.prefix,
      nodes: v.nodes,
      bytes: v.bytes,
      motion: comp.model.motion || { type: 'none' }
    })
  };
}

function modelUrl(model) {
  const u = new URL(model.file, location.href);
  const has = (x) => x !== undefined && x !== null && x !== '';
  const v = [];
  if (has(model.bytes)) v.push(model.bytes);
  else if (BUILD_V) v.push(BUILD_V);
  if (has(model.nodes)) v.push(model.nodes);
  if (v.length) u.searchParams.set('v', v.join('-'));
  return u.href;
}

function dispose() {
  if (!active) return;
  const a = active;
  active = null;
  cancelAnimationFrame(a.raf);
  a.ro?.disconnect();
  a.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => m?.dispose?.());
  });
  a.renderer.dispose();
  a.canvas.remove();
  stage?.classList.remove('has-3d');
  if (window.__COMPONENT_VIEWER === a) window.__COMPONENT_VIEWER = null;
}

function mount(comp) {
  if (!comp || !comp.model || !stage) return;
  const vr = pickVariant(comp);
  if (!vr.model.file) return;
  dispose();
  const canvas = document.createElement('canvas');
  canvas.className = 'detail-canvas';
  canvas.setAttribute('aria-label', '3D-модель компонента');
  stage.appendChild(canvas);
  stage.dataset.variant = vr.id;
  stage.dataset.model = vr.model.file;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bc, 1.5));
  const key = new THREE.DirectionalLight(0xfff6ea, 2.2);
  key.position.set(3.2, 5.0, 3.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe9ef, 0.9);
  fill.position.set(-4.0, 2.2, -2.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(0.4, 2.6, -5.0);
  scene.add(rim);

  const api = {
    canvas, renderer, scene, camera, raf: 0, ro: null,
    yaw: 0.72, pitch: 0.28, userYaw: 0, userPitch: 0,
    dist: 1, homeDist: 1, center: new THREE.Vector3(),
    model: null, anim: null, parts: [], motion: vr.model.motion || { type: 'none' },
    baseAnim: null, baseParts: [], pivot: null, materialPulse: [], t: 0,
    kin: null, matesGroup: null, variant: vr.id, modelMeta: vr.model,
    dragging: false, px: 0, py: 0, moved: 0
  };
  api.setMates = (on) => {
    if (api.matesGroup) api.matesGroup.visible = !!on;
    return !!on;
  };
  active = api;
  window.__COMPONENT_VIEWER = api;

  function resize() {
    const w = Math.max(1, canvas.clientWidth || stage.clientWidth);
    const h = Math.max(1, canvas.clientHeight || stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame() {
    const box = new THREE.Box3().setFromObject(api.model);
    const size = box.getSize(new THREE.Vector3());
    api.center.copy(box.getCenter(new THREE.Vector3()));
    const maxDim = Math.max(size.x, size.y, size.z, 0.08);
    const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hTan = vTan * Math.max(0.35, camera.aspect);
    const fitV = size.y / (2 * vTan);
    const fitH = Math.max(size.x, size.z) / (2 * hTan);
    api.homeDist = Math.max(fitV, fitH) * 1.38 + maxDim * 0.22;
    api.dist = api.homeDist;
    camera.near = Math.max(0.005, api.homeDist * 0.02);
    camera.far = api.homeDist * 30;
    camera.updateProjectionMatrix();

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: shadowMap(), transparent: true, depthWrite: false,
        opacity: 0.7, toneMapped: false
      })
    );
    const r = Math.max(size.x, size.z, 0.12) * 2.0;
    shadow.scale.set(r, r, 1);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(api.center.x, box.min.y - 0.002, api.center.z);
    scene.add(shadow);
  }

  function prepParts(prefix) {
    const spec = vr.model.parts || vr.model.motion?.parts || [];
    for (const key of spec) {
      if (key.endsWith('*')) {
        const stem = prefix + key.slice(0, -1);
        api.model.traverse((o) => {
          if (o.isMesh && o.name.startsWith(stem)) api.parts.push(o);
        });
      } else {
        const o = api.model.getObjectByName(prefix + key);
        if (o) api.parts.push(o);
      }
    }
    if (api.parts.length && api.motion.type === 'spin') {
      const box = new THREE.Box3();
      api.parts.forEach((o) => box.expandByObject(o));
      const c = box.getCenter(new THREE.Vector3());
      const g = new THREE.Group();
      g.position.copy(api.model.worldToLocal(c.clone()));
      api.model.add(g);
      api.model.updateMatrixWorld(true);
      api.parts.forEach((o) => g.attach(o));
      api.pivot = g;
    }
    if (api.parts.length && api.motion.type === 'slide') {
      api.baseParts = api.parts.map((o) => ({ o, p: o.position.clone() }));
    }
  }

  function prepAnim(prefix) {
    api.anim = api.model.getObjectByName(prefix + 'anim');
    if (api.anim) {
      api.baseAnim = {
        p: api.anim.position.clone(),
        r: api.anim.rotation.clone(),
        s: api.anim.scale.clone()
      };
    }
    const pulsePart = vr.model.motion?.part;
    if (pulsePart) {
      const o = api.model.getObjectByName(prefix + pulsePart);
      const mats = o ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => {
        if (!m || !m.emissive) return;
        const clone = m.clone();
        clone.emissive.setHex(0x2f7f86);
        clone.emissiveIntensity = 0.2;
        o.material = Array.isArray(o.material) ? o.material.map((x) => x === m ? clone : x) : clone;
        api.materialPulse.push(clone);
      });
    }
  }

  function prepWinch(prefix) {
    if (comp.id !== 'motion_winch') return;
    const spec = vr.model.payout || {};
    api.model.updateMatrixWorld(true);
    const payoutNode = api.model.getObjectByName(prefix + (spec.payout_node || 'rope_payout'));
    const end = api.model.getObjectByName(prefix + (spec.end_node || 'rope_end'));
    if (!end) return;

    // Старая дискретная навивка (12 отдельных витков + прямая ветвь) больше
    // не анимируется: скрываем её ОДИН раз при загрузке, вместо троса —
    // процедурная труба. Покадрового visible у витков нет.
    const legacy = [];
    api.model.traverse((o) => {
      const n = o.name || '';
      if (!n.startsWith(prefix + 'rope_')) return;
      if (n.startsWith(prefix + 'rope_turn_')
        || n === prefix + 'rope_branch'
        || n === prefix + 'rope_coil') legacy.push(o);
    });
    let material = null;
    for (const o of legacy) {
      if (!material && o.isMesh && o.material) material = o.material;
    }
    legacy.forEach((o) => { o.visible = false; });

    // Точка схода = rope_payout: верх вертикальной ветви и начало спирали.
    const payout = payoutNode
      ? api.model.worldToLocal(payoutNode.getWorldPosition(new THREE.Vector3()))
      : new THREE.Vector3(0.048, 0.0328, 0.0592);

    const rope = new WinchRope({
      material: material || new THREE.MeshStandardMaterial({
        color: 0xb2afa2, metalness: 0.85, roughness: 0.62
      }),
      payout,
      coilRadius: spec.coil_radius_m || 0.0592,
      pitch: spec.turn_pitch_m || 0.0098,
      turnsFull: spec.turn_count || 12,
      turnsMin: spec.min_turn_count || 4,
      maxLength: spec.length_m || 0.30
    });
    api.model.add(rope.mesh);
    api.model.add(rope.cap);

    api.winch = {
      rope, end, payout, start: null,
      baseEnd: end.position.clone(),
      maxLength: spec.length_m || 0.30,
      coilRadius: spec.coil_radius_m || 0.0592,
      forcedL: null,
      legacyHidden: legacy.map((o) => o.name),
      // Ручная установка длины (QA/скриншоты): замораживает выпуск.
      setLength(v) {
        this.forcedL = Math.min(this.maxLength, Math.max(0, Number(v) || 0));
        applyWinch(this.forcedL);
        return this.state();
      },
      release() { this.forcedL = null; return this.state(); },
      state() {
        return {
          ...rope.stats(),
          forced: this.forcedL,
          drum_angle_rad: api.anim ? +api.anim.rotation.x.toFixed(3) : null
        };
      }
    };
    applyWinch(0);
  }

  // Непрерывный выпуск/намотка троса лебёдки: одна труба строится из L.
  function applyWinch(length) {
    const w = api.winch;
    if (!w) return;
    const L = Math.min(w.maxLength, Math.max(0, Number(length) || 0));
    w.rope.update(L);

    // Крюковая подвеска (collar/socket/thimble/hook — дети rope_end) едет
    // вместе с концом; точка схода (rope_payout) неподвижна.
    w.end.position.set(w.baseEnd.x, w.baseEnd.y * (L / w.maxLength), w.baseEnd.z);

    // Барабан вращается тем же ходом, что и выпуск: θ(L) = (L − Lmax) / R.
    if (api.anim && api.baseAnim) {
      api.anim.rotation.copy(api.baseAnim.r);
      api.anim.rotation.x = api.baseAnim.r.x + (L - w.maxLength) / w.coilRadius;
    }
  }

  function buildMateMarkers() {
    const mates = Array.isArray(comp.mates) ? comp.mates : [];
    if (!mates.length) return;
    const colors = {
      input: 0x2f7f86, output: 0xb4696f, support: 0xb08b3e,
      mount: 0x4f6b55, fluid: 0x4a7fa5, signal: 0x7a5c9e, power: 0xa45d4f
    };
    const g = new THREE.Group();
    g.name = '__mate_points';
    for (const m of mates) {
      // Точки варианта (например latch_out жёсткого крепления) рисуются только
      // на своей геометрии: в гибком GLB узла языка нет.
      if (m.variant && api.variant && m.variant !== api.variant) continue;
      const p = m.position_m;
      if (!Array.isArray(p) || p.length < 3) continue;
      const color = colors[m.role] || 0x2f7f86;
      const point = new THREE.Vector3(p[0], p[1], p[2]);
      const n = new THREE.Vector3(...(m.normal || [0, 1, 0]));
      if (n.lengthSq() < 1e-9) n.set(0, 1, 0); else n.normalize();
      const size = Math.min(0.06, Math.max(0.018, Number(m.size_m) || 0.025));
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9, depthTest: false,
        depthWrite: false, toneMapped: false
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(size * 0.9, Math.max(0.0018, size * 0.07), 8, 32), mat);
      ring.position.copy(point);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      ring.renderOrder = 20;
      g.add(ring);
      const arrow = new THREE.ArrowHelper(n, point, Math.max(0.04, size * 2.2), color,
        Math.max(0.008, size * 0.4), Math.max(0.005, size * 0.25));
      arrow.traverse((o) => {
        if (o.isLine || o.isMesh) {
          o.material.depthTest = false;
          o.material.transparent = true;
          o.material.opacity = 0.85;
          o.renderOrder = 20;
        }
      });
      g.add(arrow);
    }
    if (!g.children.length) return;
    api.model.add(g);
    api.matesGroup = g;
  }

  function prepKinematics(prefix) {
    prepWinch(prefix);
    const kin = vr.model.kinematics;
    if (!kin || !Array.isArray(kin.drivers) || kin.drivers.length < 2) return;
    const directModels = new Set(['motion_oscillating', 'motion_piston_cam', 'work_tickle_pair']);
    const store = { drivers: [] };
    for (const d of kin.drivers) {
      // Трос лебёдки показывает отдельный payout-механизм.
      if (d.law === 'drum_rope') continue;
      if (d.law === 'link_two_point') {
        const o = api.model.getObjectByName(prefix + d.node);
        const t = api.model.getObjectByName(prefix + (d.target_node || 'rod_end'));
        if (o && t) store.drivers.push({ ...d, direct: o, target: t, baseRot: o.rotation.clone() });
        continue;
      }
      if (directModels.has(comp.id)) {
        const o = api.model.getObjectByName(prefix + (d.node || 'anim'));
        if (o) {
          store.drivers.push({
            ...d, direct: o, baseRot: o.rotation.clone(),
            basePos: o.position.clone(), axis: axisVec(d.axis || 'x'),
            axisName: d.axis || 'x'
          });
          continue;
        }
      }
      if (d.joint === 'revolute') {
        const objs = [];
        for (const key of (d.members || [d.node])) {
          if (!key) continue;
          if (key.endsWith('*')) {
            const stem = prefix + key.slice(0, -1);
            api.model.traverse((o) => {
              if (o.isMesh && o.name.startsWith(stem)) objs.push(o);
            });
          } else {
            const o = api.model.getObjectByName(prefix + key);
            if (o) objs.push(o);
          }
        }
        if (!objs.length) continue;
        const box = new THREE.Box3();
        objs.forEach((o) => box.expandByObject(o));
        const c = box.getCenter(new THREE.Vector3());
        const g = new THREE.Group();
        g.position.copy(api.model.worldToLocal(c.clone()));
        api.model.add(g);
        api.model.updateMatrixWorld(true);
        objs.forEach((o) => g.attach(o));
        store.drivers.push({ ...d, pivot: g });
      } else if (d.joint === 'prismatic') {
        const o = api.model.getObjectByName(prefix + (d.node || 'anim'));
        if (o) store.drivers.push({ ...d, obj: o, base: o.position.clone(), axis: axisVec(d.axis || 'x') });
      }
    }
    if (store.drivers.length) api.kin = store;
  }

  function kinLaw(d, phase) {
    const ratio = Number.isFinite(d.ratio) ? d.ratio : 1;
    if (d.law === 'phase') return phase * ratio - (d.offset_rad || 0);
    if (d.law === 'cam_cosine') {
      const p = d.profile || {};
      return (p.r_lift_m || 0.06) * 0.5 * (1 - Math.cos(phase));
    }
    if (d.law === 'cam_profile') {
      const p = d.profile || {};
      const tab = p.r_m || [];
      if (!tab.length) return 0;
      const step = (p.step_deg || 5) * Math.PI / 180;
      const x = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / step;
      const i = Math.floor(x) % tab.length;
      const j = (i + 1) % tab.length;
      const f = x - Math.floor(x);
      return (tab[i] * (1 - f) + tab[j] * f) - (p.r0_m || tab[0]);
    }
    if (d.law === 'screw_lead' || d.law === 'screw_lead_symmetric') {
      return (d.lead_m || 0.01) * ratio * phase / (2 * Math.PI);
    }
    if (d.law === 'crank_slider') return (d.crank_radius_m || 0.035) * Math.sin(phase);
    if (d.law === 'crank_slider_full') {
      const r = d.crank_radius_m || 0.02;
      const l = d.rod_length_m || 0.204;
      return r * Math.cos(phase)
        + Math.sqrt(Math.max(0, l * l - (r * Math.sin(phase)) ** 2))
        - Math.sqrt(Math.max(0, l * l - r * r));
    }
    if (d.law === 'drum_rope') return (d.drum_radius_m || 0.05) * ratio * phase;
    if (d.law === 'staged') return (d.fraction || 0) * 0.12;
    if (d.law === 'sine') return (d.amplitude_m || d.amplitude_rad || 1) * Math.sin(phase);
    return phase;
  }

  function applyMotion(t) {
    const m = api.motion;
    if (!m || m.type === 'none') return;
    if (api.kin) {
      const phase = Math.PI * (1 - Math.cos(t * (m.speed || 1)));
      for (const d of api.kin.drivers) {
        if (d.law === 'link_two_point' && d.direct && d.target) {
          api.model.updateMatrixWorld(true);
          const p = new THREE.Vector3();
          const t = new THREE.Vector3();
          d.direct.getWorldPosition(p);
          d.target.getWorldPosition(t);
          const parentYaw = d.direct.parent ? d.direct.parent.rotation.y : 0;
          d.direct.rotation[d.axis || 'y'] = Math.atan2(-(t.z - p.z), t.x - p.x) - parentYaw;
          continue;
        }
        const v = kinLaw(d, phase);
        if (d.direct) {
          if (d.joint === 'revolute') {
            d.direct.rotation[d.axisName || 'x'] =
              d.baseRot[d.axisName || 'x'] + v * (d.direction || 1);
          } else {
            d.direct.position.copy(d.basePos).addScaledVector(d.axis, v);
          }
        }
        if (d.pivot) d.pivot.rotation[d.axis || 'x'] = v * (d.direction || 1);
        if (d.obj) d.obj.position.copy(d.base).addScaledVector(d.axis, v);
      }
      return;
    }
    const axis = axisVec(m.axis || 'x');
    if (api.anim && api.baseAnim) {
      const a = api.anim;
      const b = api.baseAnim;
      if (m.type === 'slide') {
        a.position.copy(b.p).addScaledVector(axis, ((m.amount || 0.05) * 0.5) * Math.sin(t * (m.speed || 1)));
      } else if (m.type === 'spin') {
        a.rotation.copy(b.r);
        a.rotation[m.axis || 'x'] += t * (m.speed || 1);
      } else if (m.type === 'swing') {
        a.rotation.copy(b.r);
        a.rotation[m.axis || 'z'] += (m.amount || 0.35) * Math.sin(t * (m.speed || 1.2));
      } else if (m.type === 'vibrate') {
        a.position.copy(b.p).addScaledVector(axis, (m.amount || 0.004) * Math.sin(t * (m.speed || 26)));
      } else if (m.type === 'scale') {
        const k = 1 + (m.amount || 0.06) * Math.sin(t * (m.speed || 1.2));
        a.scale.copy(b.s);
        if (m.axis === 'yz') { a.scale.y = b.s.y * k; a.scale.z = b.s.z * k; }
        else a.scale[m.axis || 'x'] = b.s[m.axis || 'x'] * k;
      }
    }
    if (api.pivot && m.type === 'spin') {
      api.pivot.rotation.copy(new THREE.Euler());
      api.pivot.rotation[m.axis || 'x'] = t * (m.speed || 1);
    }
    if (api.baseParts.length && m.type === 'slide') {
      const amount = ((m.amount || 0.1) * 0.5) * Math.sin(t * (m.speed || 1));
      api.baseParts.forEach(({ o, p }) => o.position.copy(p).addScaledVector(axis, amount));
    }
    if (api.winch && m.type === 'spin') {
      // Непрерывный выпуск: L плавно 0 → Lmax → 0, трос перестраивается
      // целиком (витки сматываются, а не скрываются по порогам).
      if (api.winch.start === null) api.winch.start = t;
      // Один проход 0 → Lmax за 4 с, затем полная размотка остаётся.
      const L = api.winch.forcedL !== null
        ? api.winch.forcedL
        : api.winch.maxLength * Math.min(1, Math.max(0, (t - api.winch.start) / 4.0));
      applyWinch(L);
    }
    if (api.materialPulse.length) {
      api.materialPulse.forEach((mat) => {
        mat.emissiveIntensity = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * (m.speed || 1.5)));
      });
    }
  }

  function animate(now) {
    if (!active) return;
    const t = now * 0.001;
    const yaw = api.yaw + Math.sin(t * 0.34) * 0.34 + api.userYaw;
    const pitch = Math.min(1.22, Math.max(0.04, api.pitch + api.userPitch));
    const d = api.dist;
    camera.position.set(
      api.center.x + Math.sin(yaw) * Math.cos(pitch) * d,
      api.center.y + Math.sin(pitch) * d,
      api.center.z + Math.cos(yaw) * Math.cos(pitch) * d
    );
    camera.lookAt(api.center);
    applyMotion(t);
    renderer.render(scene, camera);
    api.raf = requestAnimationFrame(animate);
  }

  function bind() {
    canvas.addEventListener('pointerdown', (e) => {
      api.dragging = true;
      api.px = e.clientX; api.py = e.clientY; api.moved = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!api.dragging) return;
      const dx = e.clientX - api.px;
      const dy = e.clientY - api.py;
      api.px = e.clientX; api.py = e.clientY;
      api.moved += Math.abs(dx) + Math.abs(dy);
      api.userYaw -= dx * 0.008;
      api.userPitch = Math.min(0.9, Math.max(-0.2, api.userPitch + dy * 0.005));
    });
    const end = (e) => {
      api.dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      api.dist = Math.min(api.homeDist * 1.9, Math.max(api.homeDist * 0.45, api.dist * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
    api.ro = new ResizeObserver(resize);
    api.ro.observe(canvas);
  }

  bind();
  resize();

  const file = modelUrl(vr.model);
  loader.load(file, (gltf) => {
    if (!active) return;
    api.model = gltf.scene;
    scene.add(api.model);
    api.model.updateMatrixWorld(true);
    api.model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m && 'envMapIntensity' in m) m.envMapIntensity = 0.7; });
    });
    const prefix = (vr.model.prefix || comp.legacyId || comp.id) + '__';
    prepParts(prefix);
    prepAnim(prefix);
    prepKinematics(prefix);
    resize();
    frame();
    buildMateMarkers();
    resize();
    canvas.classList.add('ready');
    stage.classList.add('has-3d');
    api.raf = requestAnimationFrame(animate);
  }, undefined, (err) => {
    console.warn('component GLB failed', file, err);
    dispose();
  });
}

window.addEventListener('component:open', (e) => mount(e.detail));
window.addEventListener('component:close', () => dispose());
if (window.__CURRENT_COMPONENT) mount(window.__CURRENT_COMPONENT);
