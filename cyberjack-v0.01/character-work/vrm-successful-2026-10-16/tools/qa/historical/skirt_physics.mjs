import fs from 'node:fs';
import * as T from '/home/cyberkitty/Projects/control-room/dashboard-frontend/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/home/cyberkitty/Projects/control-room/dashboard-frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {VRMLoaderPlugin} from '/home/cyberkitty/Projects/control-room/dashboard-frontend/node_modules/@pixiv/three-vrm/lib/three-vrm.module.js';
globalThis.ProgressEvent??=class {constructor(type,p){Object.assign(this,p);this.type=type}};
const b=fs.readFileSync(process.argv[2]||'outputs/Rin_restored.vrm');const len=b.readUInt32LE(12);const d=JSON.parse(b.subarray(20,20+len));delete d.images;delete d.textures;delete d.materials;for(const m of d.meshes)for(const p of m.primitives)delete p.material;
const j=Buffer.from(JSON.stringify(d));const jp=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]),body=b.subarray(20+len);const head=Buffer.alloc(20);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(20+jp.length+body.length,8);head.writeUInt32LE(jp.length,12);head.write('JSON',16);const model=Buffer.concat([head,jp,body]);
const report=[];
for(const mode of ['all','no_floor','body_only','none']){
 const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));const g=await loader.parseAsync(model.buffer.slice(model.byteOffset,model.byteOffset+model.byteLength),'');const v=g.userData.vrm;v.update(0);
 const joints=[...v.springBoneManager.joints].filter(j=>j.bone.name.includes('sk_'));let active='';const hits={};const snap=()=>{v.scene.updateMatrixWorld(true);return joints.map(j=>({name:j.bone.name,p:j.child.getWorldPosition(new T.Vector3()).toArray()}))};
 for(const j of joints){if(mode==='none')j.colliderGroups=[];else if(mode!=='all')j.colliderGroups=j.colliderGroups.map(g=>({...g,colliders:g.colliders.filter(c=>!c.parent.name.includes('cf_j_root')&&(mode!=='body_only'||(!c.parent.name.startsWith('KKS_')&&!/arm|hand|head|spine|shoulder|neck|bust/.test(c.parent.name))))}));const f=j.update.bind(j);j.update=(dt)=>{active=j.bone.name;return f(dt)}}
 const cols=new Set(joints.flatMap(j=>j.colliderGroups.flatMap(g=>g.colliders)));for(const c of cols){const f=c.shape.calculateCollision.bind(c.shape);c.shape.calculateCollision=(...a)=>{const dd=f(...a);if(dd<0){const k=c.parent.name;hits[k]??={count:0,max:0};hits[k].count++;hits[k].max=Math.max(hits[k].max,-dd)}return dd}}
 const before=snap();for(let i=0;i<180;i++)v.update(1/60);const rest=snap();const hips=v.humanoid.getNormalizedBoneNode('hips'),left=v.humanoid.getNormalizedBoneNode('leftUpperLeg'),right=v.humanoid.getNormalizedBoneNode('rightUpperLeg');const hp=hips.position.clone();
 for(let i=0;i<360;i++){left.rotation.x=.45*Math.sin(i/60*Math.PI*2);right.rotation.x=-left.rotation.x;hips.position.y=hp.y-.1*(.5+.5*Math.sin(i/60*Math.PI));v.update(1/60)}left.rotation.x=right.rotation.x=0;hips.position.copy(hp);for(let i=0;i<240;i++)v.update(1/60);const after=snap();
 const r={mode,hits,before,rest,after,finite:after.every(j=>j.p.every(Number.isFinite))};report.push(r);console.log(mode,JSON.stringify(hits));
}
fs.writeFileSync(process.argv[3]||'work/skirt_physics_report.json',JSON.stringify(report,null,2));
