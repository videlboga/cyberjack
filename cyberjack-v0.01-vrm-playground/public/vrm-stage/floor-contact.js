import * as THREE from 'three';

// Sample sole geometry, not ankle pivots: shoe thickness differs per avatar.
// Only root height changes. The clip's joint rotations and raised foot stay intact.
export function createFloorContact(vrm,{floorY=0}={}){
 const root=vrm.scene,point=new THREE.Vector3(),feet=['leftFoot','rightFoot'].map(name=>vrm.humanoid.getRawBoneNode(name));
 const meshes=[];root.traverseVisible(n=>{if(n.isSkinnedMesh&&n.geometry.attributes.position&&n.geometry.attributes.skinIndex&&n.geometry.attributes.skinWeight)meshes.push(n)});
 const belongs=(bone,foot)=>{for(let n=bone;n;n=n.parent)if(n===foot)return true;return false};
 const skeletons=[...new Set(meshes.map(mesh=>mesh.skeleton))];
 function matrices(){root.updateMatrixWorld(true);for(const skeleton of skeletons)skeleton.update()}
 function vertex(sample){sample.mesh.getVertexPosition(sample.index,point);return point.applyMatrix4(sample.mesh.matrixWorld)}
 matrices();
 const candidates=[[],[]];
 for(const mesh of meshes){const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;const flags=feet.map(foot=>mesh.skeleton.bones.map(b=>Boolean(foot&&belongs(b,foot))));
  for(let index=0;index<indices.count;index++){for(let side=0;side<2;side++){let influence=0;for(let j=0;j<4;j++)if(flags[side][indices.getComponent(index,j)])influence+=weights.getComponent(index,j);if(influence>=.5){const sample={mesh,index};const p=vertex(sample);candidates[side].push({...sample,x:p.x,y:p.y,z:p.z})}}}
 }
 const bodySupports=[],seenGeometry=new Set();
 for(const mesh of meshes){if(mesh.name.endsWith('__cartoon_ink')||seenGeometry.has(mesh.geometry.attributes.position)|| (Array.isArray(mesh.material)?mesh.material:[mesh.material]).every(m=>m.isOutline))continue;seenGeometry.add(mesh.geometry.attributes.position);const count=mesh.geometry.attributes.position.count;for(let i=0;i<count;i+=Math.max(1,Math.floor(count/90)))bodySupports.push({mesh,index:i})}
 let mode='feet';
 const supports=[];
 for(const rows of candidates){if(!rows.length)continue;const minimum=rows.reduce((v,p)=>Math.min(v,p.y),Infinity),sole=rows.filter(p=>p.y<=minimum+.025),cells=new Map();
  const minX=sole.reduce((v,p)=>Math.min(v,p.x),Infinity),maxX=sole.reduce((v,p)=>Math.max(v,p.x),-Infinity),minZ=sole.reduce((v,p)=>Math.min(v,p.z),Infinity),maxZ=sole.reduce((v,p)=>Math.max(v,p.z),-Infinity);
  for(const p of sole){const x=Math.min(5,Math.floor((p.x-minX)/(maxX-minX||1)*6)),z=Math.min(9,Math.floor((p.z-minZ)/(maxZ-minZ||1)*10)),key=x+':'+z;if(!cells.has(key)||cells.get(key).y>p.y)cells.set(key,p)}supports.push(...cells.values());
 }
 let offset=0,lastMinimum=null;
 // Non-sole contact: kneeling rests on knees, all fours on knees and hands, lying on the back.
 // Bone pivots are offset by a small radius so the surface, not the joint centre, touches the floor.
 const CONTACT={knees:[['leftLowerLeg',.045],['rightLowerLeg',.045]],'hands-knees':[['leftLowerLeg',.045],['rightLowerLeg',.045],['leftHand',.03],['rightHand',.03]],back:[['hips',.09]],seat:[['hips',.13]],'seat-feet':[['hips',.13]],soles:null,body:null};
 let contact='soles';
 // 'seat' is used for a ground-seated pose: the pelvis carries the weight, no furniture is assumed.
 const boneNodes={};
 function boneNode(name){if(name in boneNodes)return boneNodes[name];const node=vrm.humanoid.getRawBoneNode(name)||null;boneNodes[name]=node;return node}
 function contactMinimum(){const list=CONTACT[contact];if(!list)return null;matrices();let value=Infinity;for(const [name,radius] of list){const node=boneNode(name);if(!node)continue;node.getWorldPosition(point);value=Math.min(value,point.y-radius)}return Number.isFinite(value)?value:null}
 function minimum(){const byBone=contactMinimum();if(byBone!==null)return byBone;matrices();let value=Infinity;for(const sample of (mode==='body'?bodySupports:supports))value=Math.min(value,vertex(sample).y);return value}
 return {setMode(value){mode=value==='body'?'body':'feet'},setContact(value){contact=CONTACT[value]!==undefined?value:'soles'},update(){if(!supports.length)return;const low=minimum();if(!Number.isFinite(low))return;const delta=floorY-low;if(Math.abs(delta)>1e-6){root.position.y+=delta;offset+=delta;root.updateMatrixWorld(true)}lastMinimum=low+delta;},get state(){return {floorY,mode,contact,samples:mode==='body'?bodySupports.length:supports.length,rootY:root.position.y,offset,minimum:lastMinimum}},measure(){return minimum()}};
}
