import * as T from './vendor/three/three.module.js';
import {HairPhysics} from './viewer-hair-physics.js?v=runtime92b';
let physics=null,root=null,members=[];
export function stepHairMessage(data){
 if(data.init){physics=new HairPhysics();root=new T.Group();root.matrixAutoUpdate=false;members=data.init.map(row=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(data.positions.slice(row.offset,row.offset+row.count),3));g.setAttribute('normal',new T.BufferAttribute(data.normals.slice(row.offset,row.offset+row.count),3));const mesh=new T.Mesh(g);mesh.matrixAutoUpdate=false;root.add(mesh);physics.register(mesh,row.rigid,row.profile,row.motionGroup);return mesh;});}
 if(!physics)throw Error('Риг волос не подготовлен');
 for(let i=0;i<members.length;i++)members[i].matrix.fromArray(ArrayBuffer.isView(data.matrices)?data.matrices:data.matrices[i],ArrayBuffer.isView(data.matrices)?i*16:0);
 physics.settings=data.settings;physics.cohesion=data.cohesion;physics.groundY=data.groundY;physics.colliders=data.colliders.map(s=>{const out={...s};for(const k of ['center','a','b','depthAxis'])if(s[k])out[k]=new T.Vector3().fromArray(s[k]);return out;});
 if(data.reset)physics.reset();const start=performance.now();physics.update(data.dt,root);const count=members.reduce((n,m)=>n+m.geometry.attributes.position.array.length,0),positions=data.recycle?.positions?.length===count?data.recycle.positions:new Float32Array(count),normals=data.recycle?.normals?.length===count?data.recycle.normals:new Float32Array(count);let offset=0;
 for(const mesh of members){positions.set(mesh.geometry.attributes.position.array,offset);normals.set(mesh.geometry.attributes.normal.array,offset);offset+=mesh.geometry.attributes.position.array.length;}
 return {type:'frame',generation:data.generation,positions,normals,ms:performance.now()-start};
}
if(typeof self!=='undefined')self.onmessage=({data})=>{try{const out=stepHairMessage(data);self.postMessage(out,[out.positions.buffer,out.normals.buffer]);}catch(error){self.postMessage({type:'error',message:error.message});}};
