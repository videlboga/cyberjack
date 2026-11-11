/**
 * winch-rope.js — процедурный трос лебёдки `motion_winch`.
 *
 * Заменяет дискретную схему «12 отдельных витков + видимость по порогам»
 * на одну непрерывную геометрию, которая пересчитывается из длины выпуска L.
 *
 * Геометрия (локальные координаты GLB, метры):
 *   ось барабана      — X;
 *   ось навивки       — (y = rope_payout.y, z = rope_payout.z - COIL_R);
 *   точка схода       — rope_payout = (0.048, 0.0328, 0.0592), угол +Z стороны;
 *   радиус навивки    — 0.0592 (центр трубы), радиус троса — 0.0046;
 *   шаг витка         — 0.0098 по X на оборот;
 *   витков            — N(L) = 12 → 4 линейно при L = 0 → 0.30 м;
 *   спираль уходит от точки схода в −X: x(u) = x_exit − pitch·u.
 *
 * В точке схода касательная спирали вертикальна (вверх, к сходу), поэтому
 * ветвь вниз продолжает трос без излома: одна и та же труба идёт
 * «вниз по ветви → вверх к точке схода → по спирали в глубину навивки».
 *
 * Топология BufferGeometry фиксирована, в кадре обновляются только позиции
 * и нормали (parallel transport), поэтому витки не появляются/исчезают,
 * а непрерывно «сматываются» в барабан.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;

export class WinchRope {
  constructor(options = {}) {
    const o = options;
    this.ropeRadius = o.ropeRadius ?? 0.0046;
    this.coilRadius = o.coilRadius ?? 0.0592;
    this.pitch = o.pitch ?? 0.0098;
    this.turnsFull = o.turnsFull ?? 12;
    this.turnsMin = o.turnsMin ?? 4;
    this.maxLength = o.maxLength ?? 0.30;
    this.tubularSegments = o.tubularSegments ?? 560;
    this.radialSegments = o.radialSegments ?? 10;

    const payout = o.payout instanceof THREE.Vector3
      ? o.payout.clone()
      : new THREE.Vector3(0.048, 0.0328, 0.0592);
    this.payout = payout;
    this.xExit = payout.x;
    this.axisY = payout.y;
    this.axisZ = payout.z - this.coilRadius;

    this.length = 0;
    this.turnCount = this.turnsFull;
    this.helixLength = this.turnsFull * Math.hypot(TAU * this.coilRadius, this.pitch);
    this.xStart = this.xExit - this.turnsFull * this.pitch;

    this._buildGeometry();

    this.mesh = new THREE.Mesh(this._geometry, o.material);
    this.mesh.name = 'motion_winch__rope_procedural';
    this.mesh.frustumCulled = false;

    // Торец навивки (глубина барабана) — чтобы труба не смотрела «дуплом».
    this.cap = new THREE.Mesh(
      new THREE.SphereGeometry(this.ropeRadius * 1.02, 12, 8),
      o.material
    );
    this.cap.name = 'motion_winch__rope_anchor_cap';
    this.cap.frustumCulled = false;

    this.update(0);
  }

  _buildGeometry() {
    const segs = this.tubularSegments;
    const rad = this.radialSegments;
    const ring = rad + 1;
    const vcount = (segs + 1) * ring;

    this._pos = new Float32Array(vcount * 3);
    this._nrm = new Float32Array(vcount * 3);
    const uv = new Float32Array(vcount * 2);
    // кольцо трубы неизменно — cos/sin считаем один раз
    this._ringCos = new Float32Array(ring);
    this._ringSin = new Float32Array(ring);
    for (let j = 0; j <= rad; j++) {
      const v = (j / rad) * TAU;
      this._ringCos[j] = -Math.cos(v);
      this._ringSin[j] = Math.sin(v);
    }
    const index = new Uint32Array(segs * rad * 6);

    for (let i = 0; i <= segs; i++) {
      for (let j = 0; j <= rad; j++) {
        const k = i * ring + j;
        uv[k * 2] = i / segs;
        uv[k * 2 + 1] = j / rad;
      }
    }
    let n = 0;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < rad; j++) {
        const a = i * ring + j;
        const b = a + ring;
        const d = a + 1;
        const c = b + 1;
        index[n++] = a; index[n++] = b; index[n++] = d;
        index[n++] = b; index[n++] = c; index[n++] = d;
      }
    }

    const g = new THREE.BufferGeometry();
    this._posAttr = new THREE.BufferAttribute(this._pos, 3).setUsage(THREE.DynamicDrawUsage);
    this._nrmAttr = new THREE.BufferAttribute(this._nrm, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this._posAttr);
    g.setAttribute('normal', this._nrmAttr);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    // Габарит считается постоянно меняющимся — отсечение по нему не нужно.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this._geometry = g;
    return g;
  }

  /**
   * Пересчитать трос под длину выпуска L (м).
   * Непрерывно: N(L) линейно, ветвь длиной L, ничего не скрывается.
   */
  update(length = 0) {
    const L = Math.min(this.maxLength, Math.max(0, Number(length) || 0));
    const R = this.coilRadius;
    const p = this.pitch;
    const turns = this.turnsFull + (this.turnsMin - this.turnsFull) * (L / this.maxLength);
    const revLen = Math.hypot(TAU * R, p);          // длина троса на один виток
    const helixLen = turns * revLen;
    const total = L + helixLen;
    const segs = this.tubularSegments;
    const rad = this.radialSegments;
    const ring = rad + 1;
    const r = this.ropeRadius;
    const xExit = this.xExit;
    const axisY = this.axisY;
    const axisZ = this.axisZ;
    const pos = this._pos;
    const nrm = this._nrm;
    const cosTab = this._ringCos;
    const sinTab = this._ringSin;

    let nx = 1, ny = 0, nz = 0;          // нормаль переноса
    let px = xExit, py = axisY - L, pz = axisZ + R;

    for (let i = 0; i <= segs; i++) {
      const s = (i / segs) * total;
      let tx, ty, tz;

      if (L > 0 && s <= L) {
        // Ветвь: строго вертикально вниз от точки схода.
        px = xExit;
        py = axisY - L + s;
        pz = axisZ + R;
        tx = 0; ty = 1; tz = 0;
      } else {
        // Спираль: u — число оборотов от точки схода в глубину навивки.
        const u = (s - L) / revLen;
        const th = Math.PI / 2 - TAU * u;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        px = xExit - p * u;
        py = axisY + R * c;
        pz = axisZ + R * sn;
        tx = -p;
        ty = TAU * R * sn;
        tz = -TAU * R * c;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
      }

      // parallel transport кадра вдоль троса
      if (i === 0) {
        if (Math.abs(ty) < 0.9) { nx = -tz; ny = 0; nz = tx; }
        else { nx = 1; ny = 0; nz = 0; }
      } else {
        const d = nx * tx + ny * ty + nz * tz;
        nx -= tx * d; ny -= ty * d; nz -= tz * d;
      }
      let nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-6) {
        if (Math.abs(ty) < 0.9) { nx = -tz; ny = 0; nz = tx; }
        else { nx = 1; ny = 0; nz = -tx; }
        nl = Math.hypot(nx, ny, nz) || 1;
      }
      nx /= nl; ny /= nl; nz /= nl;

      // binormal = tangent × normal
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;

      for (let j = 0; j <= rad; j++) {
        const sv = sinTab[j];
        const cv = cosTab[j];
        const ox = cv * nx + sv * bx;
        const oy = cv * ny + sv * by;
        const oz = cv * nz + sv * bz;
        const k = (i * ring + j) * 3;
        nrm[k] = ox; nrm[k + 1] = oy; nrm[k + 2] = oz;
        pos[k] = px + r * ox;
        pos[k + 1] = py + r * oy;
        pos[k + 2] = pz + r * oz;
      }
    }

    this._posAttr.needsUpdate = true;
    this._nrmAttr.needsUpdate = true;

    // торец навивки в глубине барабана
    const thEnd = Math.PI / 2 - TAU * turns;
    this.cap.position.set(
      xExit - p * turns,
      axisY + R * Math.cos(thEnd),
      axisZ + R * Math.sin(thEnd)
    );

    this.length = L;
    this.turnCount = turns;
    this.helixLength = helixLen;
    this.xStart = xExit - p * turns;
    this.ropeLength = total;
    return this;
  }

  /** Замеры для отчёта/QA. */
  stats() {
    const R = this.coilRadius;
    return {
      payout_m: +this.length.toFixed(4),
      turns: +this.turnCount.toFixed(3),
      turns_visible: Math.ceil(this.turnCount - 1e-6),
      coil_x_m: [+this.xStart.toFixed(4), +this.xExit.toFixed(4)],
      coil_span_m: +(this.turnCount * this.pitch).toFixed(4),
      helix_len_m: +this.helixLength.toFixed(4),
      rope_len_m: +(this.length + this.helixLength).toFixed(4),
      rope_end_y_m: +(this.axisY - this.length).toFixed(4),
      coil_radius_m: R,
      rope_diameter_m: +(this.ropeRadius * 2).toFixed(4)
    };
  }
}
