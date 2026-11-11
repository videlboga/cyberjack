// Runtime-проверка GLB библиотеки через тот же Three.js GLTFLoader, что в проекте.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type) { this.type = type; }
  };
}

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(project, 'public/models/machine-modules');
const review = path.join(project, 'docs/plans/blockout/machine-modules');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));
const entries = [...catalog.modules, ...catalog.assemblies];
const report = [];
const loader = new GLTFLoader();

for (const entry of entries) {
  const file = path.join(root, entry.file);
  const bytes = await fs.readFile(file);
  const errors = [];
  if (bytes.toString('utf8', 0, 4) !== 'glTF') errors.push('bad GLB magic');
  let gltf;
  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    gltf = await loader.parseAsync(buffer, path.dirname(file) + '/');
  } catch (error) {
    report.push({ id: entry.id, file: entry.file, errors: [`parse: ${error.message}`], pass: false });
    continue;
  }
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  let meshes = 0;
  let triangles = 0;
  let missingMaterial = 0;
  let missingModule = 0;
  const actualModules = new Set();
  scene.traverse((node) => {
    if (!node.isMesh) return;
    meshes += 1;
    triangles += node.geometry.index
      ? node.geometry.index.count / 3
      : node.geometry.attributes.position.count / 3;
    if (!node.material) missingMaterial += 1;
    const moduleId = node.userData.machine_module;
    if (!moduleId) missingModule += 1;
    else actualModules.add(moduleId);
  });
  if (!meshes) errors.push('no meshes');
  if (missingMaterial) errors.push(`missing material: ${missingMaterial}`);
  if (missingModule) errors.push(`missing machine_module: ${missingModule}`);
  if (![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) errors.push('non-finite bounds');
  if (catalog.assemblies.includes(entry)) {
    if (Math.abs(box.min.y) > 1e-4) errors.push(`ground contact Y=${box.min.y}`);
    if (size.x > 2.4 || size.z > 2.0 || size.y > 2.1) errors.push('outside concept envelope');
    for (const required of entry.modules) {
      if (!actualModules.has(required)) errors.push(`missing required module: ${required}`);
    }
    for (const actual of actualModules) {
      if (!entry.modules.includes(actual)) errors.push(`unexpected module: ${actual}`);
    }
  }
  report.push({
    id: entry.id, file: entry.file, meshes, triangles,
    materials: [...new Set((() => {
      const names = [];
      scene.traverse((n) => { if (n.isMesh && n.material?.name) names.push(n.material.name); });
      return names;
    })())],
    modules: [...actualModules].sort(),
    bounds: { min: box.min.toArray(), max: box.max.toArray(), size: size.toArray() },
    errors, pass: errors.length === 0,
  });
}

const summary = {
  total: report.length,
  passed: report.filter((r) => r.pass).length,
  failed: report.filter((r) => !r.pass).map((r) => ({ id: r.id, errors: r.errors })),
};
await fs.mkdir(review, { recursive: true });
await fs.writeFile(path.join(review, 'runtime-validation.json'), JSON.stringify({ summary, report }, null, 2));
console.log(JSON.stringify(summary, null, 2));
for (const item of report) {
  console.log(item.pass ? 'PASS' : 'FAIL', item.id, `meshes=${item.meshes ?? 0}`, `triangles=${item.triangles ?? 0}`);
}
if (summary.failed.length) process.exitCode = 1;
