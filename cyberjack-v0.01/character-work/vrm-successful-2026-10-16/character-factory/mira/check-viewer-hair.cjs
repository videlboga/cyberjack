const fs=require('fs'),path=require('path');global.ProgressEvent=class{};global.window=global;
require('./anatomy-rig.js');require('./anatomy.js');require('./anatomy-pose.js');require('./dance-data.js');Anatomy.configure(ANATOMY_RIG);
(async()=>{
const THREE=await import(path.resolve('vendor/three/three.module.js'));
const {ViewerHair}=await import(path.resolve('viewer-hair.js'));
const {GLTFLoader}=await import(path.resolve('vendor/three/loaders/GLTFLoader.js'));
let b=fs.readFileSync('assets/hair/shaggy/hair.glb'),len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len));
j.materials=[{}];j.images=[];j.textures=[];j.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(28+len).toString('base64');
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(j),'');
const parent=new THREE.Group(),hair=new ViewerHair(parent);hair.source.add(gltf.scene);
let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
function samples(){parent.updateMatrixWorld(true);mesh.skeleton.update();let points=[];for(let i=0;i<mesh.geometry.attributes.position.count;i+=157){const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);points.push(p);}return points;}
hair.update({});const inv=hair.anchor.matrix.clone();parent.updateMatrixWorld(true);inv.copy(hair.anchor.matrixWorld).invert();const local=samples().map(p=>p.applyMatrix4(inv));let maxError=0,frames=0;
for(const amount of [0,.3,-.3]){const weights=Object.fromEntries(Anatomy.controls.map(c=>[c.name,amount]));for(let i=0;i<ANATOMY_DANCE.frames.length;i++){
 const pose=AnatomyPose.matrices(weights,AnatomyPose.sample(ANATOMY_DANCE,i/ANATOMY_DANCE.fps),ANATOMY_DANCE);hair.update(weights,pose);const actual=samples();actual.forEach((p,k)=>{const expected=local[k].clone().applyMatrix4(hair.anchor.matrixWorld);const e=p.distanceTo(expected);if(!Number.isFinite(e))throw Error('Non-finite vertex');maxError=Math.max(maxError,e);});frames++;
}}
hair.readHash('#hair=none&hair_width=1.3&hair_x=0.02');if(hair.anchor.visible)throw Error('Visibility');const stored=hair.hash(),other=new ViewerHair(new THREE.Group());other.readHash('#'+stored);if(other.settings.width!==1.3||other.settings.x!==.02||other.settings.style!=='none')throw Error('Hash roundtrip');hair.reset();if(hair.settings.width!==1||hair.settings.style!=='shaggy')throw Error('Reset');
const report={frames,variants:3,sampledVertices:local.length,maxAttachmentErrorMeters:maxError,hashRoundtrip:true,reset:true};console.log(report);fs.writeFileSync('work/viewer-hair-validation.json',JSON.stringify(report,null,2));if(maxError>1e-5)throw Error('Hair drift');
})();
