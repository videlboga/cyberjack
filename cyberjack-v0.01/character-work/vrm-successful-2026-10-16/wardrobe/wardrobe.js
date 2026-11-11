// Гардероб: вещи отдельно от тела.
// База — VRM без одежды (тело), вещи — GLB из wardrobe/items, пришиваются подменой скелета.
//
//   const w = new Wardrobe(baseVrm, {itemsBase: './items'});
//   await w.init('./wardrobe.json');           // манифест
//   await w.setOutfit({top: 'mira-00-kk-pufferlong-8400', bottom: 'mira-01-kk-cf-m-shorts-03-8591'});
//   w.equip(id) / w.unequip('top') / w.state
//
// Слоты: hair, top, bottom, underwear_top, underwear_bottom, socks, shoes, accessory.
// В слоте одновременно одна вещь; accessories допускают несколько.

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const SLOT_ORDER = ['underwear_top', 'underwear_bottom', 'socks', 'bottom', 'top', 'shoes', 'accessory'];
const MULTI_SLOT = new Set(['accessory']);

export class Wardrobe {
  constructor(vrm, {itemsBase = './', loader = null} = {}) {
    this.vrm = vrm;
    this.scene = vrm.scene;
    this.itemsBase = itemsBase;
    this.loader = loader || new GLTFLoader();
    this.manifest = null;
    this.equipped = new Map();          // id → {item, mesh}
    this.cache = new Map();             // id → gltf
    this.bodyMesh = null;
    this.boneset = null;
    this._pickBody();
  }

  _pickBody() {
    let best = null, bestVerts = -1;
    this.scene.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const n = o.geometry.attributes.position.count;
      const isBody = /cf_m_body/i.test(o.material?.name || '');
      if (isBody || n > bestVerts) { if (isBody || !best) { best = o; bestVerts = n; } }
    });
    if (!best) throw new Error('гардероб: в базовой модели нет скиннинга');
    this.bodyMesh = best;
    this.boneset = best.skeleton.bones.map(b => b.name);
  }

  async init(manifestUrl) {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error('гардероб: манифест недоступен');
    const doc = await res.json();
    this.manifest = doc;
    this.byId = new Map(doc.items.map(i => [i.id, i]));
    return this;
  }

  items(slot = null) {
    return this.manifest ? this.manifest.items.filter(i => !slot || i.slot === slot) : [];
  }

  // вещь может состоять из нескольких частей (платье = низ + верх): надеваем всю группу
  siblings(item) {
    return this.manifest.items.filter(i => i.character === item.character &&
      i.outfit === item.outfit && (i.group || i.id) === (item.group || item.id));
  }

  async _load(item) {
    if (this.cache.has(item.id)) return this.cache.get(item.id);
    const gltf = await this.loader.loadAsync(`${this.itemsBase}${item.file}`);
    this.cache.set(item.id, gltf);
    return gltf;
  }

  async equip(id) {
    const item = this.byId?.get(id);
    if (!item) throw new Error('гардероб: нет вещи ' + id);
    if (MULTI_SLOT.has(item.slot)) {
      for (const part of this.siblings(item)) await this._mount(part);
      return this.equipped.get(id)?.mesh || null;
    }
    if (!this.equipped.has(id)) this.unequip(item.slot);
    for (const part of this.siblings(item)) await this._mount(part);
    return this.equipped.get(id)?.mesh || null;
  }

  async _mount(item) {
    if (this.equipped.has(item.id)) return this.equipped.get(item.id).mesh;
    if (!this.byId?.has(item.id)) throw new Error('гардероб: нет вещи ' + item.id);
    if (this.manifest.boneset?.hash && item.boneset !== this.manifest.boneset.hash) {
      throw new Error(`гардероб: вещь ${id} сделана под другой скелет (${item.boneset} ≠ ${this.manifest.boneset.hash})`);
    }
    const id = item.id;
    const gltf = await this._load(item);
    let mesh = null;
    gltf.scene.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh) throw new Error('гардероб: в вещи нет меша ' + id);

    // вся суть: скелеты идентичны, поэтому вещь просто переезжает на скелет тела
    mesh.skeleton = this.bodyMesh.skeleton;
    mesh.bindMatrix.copy(this.bodyMesh.bindMatrix);
    mesh.bindMatrixInverse.copy(this.bodyMesh.bindMatrixInverse);
    mesh.frustumCulled = false;
    mesh.name = 'w:' + id;
    const layer = SLOT_ORDER.indexOf(item.slot);
    mesh.renderOrder = (layer < 0 ? SLOT_ORDER.length : layer) + 1;
    this.scene.add(mesh);
    this.equipped.set(id, {item, mesh});
    return mesh;
  }

  unequip(slot) {
    for (const [id, rec] of [...this.equipped]) {
      if (rec.item.slot !== slot) continue;
      rec.mesh.removeFromParent();
      this.equipped.delete(id);
    }
  }

  async setOutfit(map) {
    const wanted = Object.entries(map).filter(([, id]) => id);
    for (const slot of new Set([...this.equipped.values()].map(r => r.item.slot))) {
      if (!(slot in map)) this.unequip(slot);
    }
    for (const [slot, id] of wanted) {
      if (MULTI_SLOT.has(slot)) {
        this.unequip(slot);
        for (const one of Array.isArray(id) ? id : [id]) await this.equip(one);
      } else {
        const current = this.equipped.get(id);
        if (!current) await this.equip(id);
      }
    }
    return this.state;
  }

  get state() {
    const out = {};
    for (const {item} of this.equipped.values()) {
      if (MULTI_SLOT.has(item.slot)) (out[item.slot] ||= []).push(item.id);
      else out[item.slot] = item.id;
    }
    return out;
  }

  get detail() {
    const out = {};
    for (const {item} of this.equipped.values()) {
      const slot = out[item.slot] ||= {parts: 0, ids: []};
      slot.parts += 1;
      slot.ids.push(item.id);
    }
    return out;
  }
}
