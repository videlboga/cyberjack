import assert from'node:assert/strict';
import{Bone,Skeleton,BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,SkinnedMesh,MeshBasicMaterial,Vector3}from'three';
import{createProbeSkinUpdater}from'../review/skin-clearance.mjs';
const bones=Array.from({length:80},()=>new Bone());for(let i=1;i<bones.length;i++)bones[0].add(bones[i]);
const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([.2,.3,.4,.5,.6,.7],3));geometry.setAttribute('skinIndex',new Uint16BufferAttribute([2,5,8,0,8,11,14,0],4));geometry.setAttribute('skinWeight',new Float32BufferAttribute([.5,.3,.2,0,.2,.5,.3,0],4));
const mesh=new SkinnedMesh(geometry,new MeshBasicMaterial());mesh.add(bones[0]);mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));const refresh=createProbeSkinUpdater([{mesh,i:0},{mesh,i:1}]);
for(let step=0;step<40;step++){bones.forEach((b,i)=>{b.rotation.set(step*.01,i*.02,step*i*.001);b.position.set(i*.01,step*.002,0);});mesh.updateMatrixWorld(true);refresh();const partial=[0,1].map(i=>mesh.getVertexPosition(i,new Vector3()).toArray());mesh.skeleton.update();const full=[0,1].map(i=>mesh.getVertexPosition(i,new Vector3()).toArray());assert.deepEqual(partial,full);}
console.log('PASS sampled skin deformation exactly matches full skeleton refresh');
