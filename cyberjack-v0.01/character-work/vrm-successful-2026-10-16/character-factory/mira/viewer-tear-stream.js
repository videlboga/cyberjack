import * as THREE from 'three';
import {surfaceAnchor} from './emotion-surface.js?v=12';
// Bind to an opaque point of the donor lower lash, rather than a skin triangle
// across the eye hole. Current mesh morphs then keep the meniscus on the lid.
export function lowerLidAnchor(head,target){
 const mesh=head.meshes.find(m=>[].concat(head.originalMaterials.get(m)||[]).some(mat=>mat.name?.startsWith('KK cf_m_eyeline_down')));if(!mesh)return null;
 const cache=head.faceEditor.cache.get(mesh),uv=mesh.geometry.attributes.uv.array,ix=mesh.geometry.index.array,source=[].concat(head.originalMaterials.get(mesh)).find(m=>m.map?.image)?.map;if(!cache||!source)return null;
 const canvas=document.createElement('canvas');canvas.width=source.image.width;canvas.height=source.image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source.image,0,0);const alpha=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let best=null,score=Infinity;const p=new THREE.Vector3();
 for(let j=0;j<ix.length;j+=3){const ids=[ix[j],ix[j+1],ix[j+2]];for(let a=0;a<=20;a++)for(let b=0;b<=20-a;b++){const weights=[a/20,b/20,1-(a+b)/20];let u=0,v=0;p.set(0,0,0);for(let k=0;k<3;k++){const id=ids[k];p.x+=cache.position[id*3]*weights[k];p.y+=cache.position[id*3+1]*weights[k];p.z+=cache.position[id*3+2]*weights[k];u+=uv[id*2]*weights[k];v+=uv[id*2+1]*weights[k];}const x=Math.max(0,Math.min(canvas.width-1,Math.floor(u*canvas.width))),y=Math.max(0,Math.min(canvas.height-1,Math.floor((source.flipY?1-v:v)*canvas.height)));if(alpha[(y*canvas.width+x)*4+3]<128)continue;p.applyMatrix4(cache.matrix);if(p.x*target[0]<0)continue;const d=4*(p.x-target[0])**2+(p.y-target[1])**2+.25*(p.z-target[2])**2;if(d<score){score=d;best={mesh,ids,weights,rest:p.toArray()};}}}
 return best;
}
export function tearCrossSection(points,width){
 const out=new Float32Array(points.length*5*3),tangent=new THREE.Vector3(),side=new THREE.Vector3();
 for(let i=0;i<points.length;i++){tangent.copy(points[Math.min(points.length-1,i+1)]).sub(points[Math.max(0,i-1)]);side.set(-tangent.y,tangent.x,0).normalize();const u=i/(points.length-1),taper=Math.pow(Math.sin(Math.PI*(.025+.95*u)),.45);
  for(let j=0;j<5;j++){const v=j/2-1,k=(i*5+j)*3;out[k]=points[i].x+side.x*width*v*taper;out[k+1]=points[i].y+side.y*width*v*taper;out[k+2]=points[i].z+.00027+width*.22*(1-v*v)*taper;}}
 return out;
}
export class TearStream{
 constructor(head,parent,coords,seed,radius){
  this.head=head;this.face=head.socketMesh;this.seed=seed;this.radius=radius;this.root=lowerLidAnchor(head,coords[0]);const knots=coords.map(p=>new THREE.Vector3().fromArray(p));if(this.root)knots[0].fromArray(this.root.rest);
  const curve=new THREE.CatmullRomCurve3(knots,false,'centripetal'),cache=head.faceEditor.cache.get(this.face);this.anchors=curve.getPoints(40).map(p=>surfaceAnchor(cache.position,this.face.geometry.index.array,p.toArray()));this.points=this.anchors.map(()=>new THREE.Vector3());this.temp=new THREE.Vector3();this.matrix=new THREE.Matrix4();
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.points.length*15),3));const ix=[];for(let i=0;i<this.points.length-1;i++)for(let j=0;j<4;j++){const a=i*5+j;ix.push(a,a+5,a+1,a+1,a+5,a+6);}this.geometry.setIndex(ix);
  this.material=new THREE.MeshPhysicalMaterial({color:'#bad3df',metalness:0,roughness:.13,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide});this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=12;parent.add(this.mesh);
  this.dropGeometry=new THREE.SphereGeometry(1,12,10);this.drop=new THREE.Mesh(this.dropGeometry,this.material);this.drop.renderOrder=13;parent.add(this.drop);
 }
 update(amount,time){
  this.mesh.visible=this.drop.visible=amount>.005;if(amount<=.005)return;
  for(let i=0;i<this.anchors.length;i++){const a=this.anchors[i],p=this.points[i];p.set(0,0,0);for(let k=0;k<3;k++){this.face.getVertexPosition(a.ids[k],this.temp);p.addScaledVector(this.temp,a.weights[k]);}p.z+=.00025;}
  if(this.root){const r=this.root,p=this.points[0];this.face.updateWorldMatrix(true,false);r.mesh.updateWorldMatrix(true,false);this.matrix.copy(this.face.matrixWorld).invert().multiply(r.mesh.matrixWorld);p.set(0,0,0);for(let k=0;k<3;k++){r.mesh.getVertexPosition(r.ids[k],this.temp);p.addScaledVector(this.temp,r.weights[k]);}p.applyMatrix4(this.matrix);p.z+=.0003;}
  const phase=(time*.14+this.seed)%1,width=.00082*Math.sqrt(amount);this.geometry.attributes.position.array.set(tearCrossSection(this.points,width));this.geometry.attributes.position.needsUpdate=true;this.geometry.computeVertexNormals();
  const u=phase*(this.points.length-1),i=Math.min(this.points.length-2,Math.floor(u));this.drop.position.lerpVectors(this.points[i],this.points[i+1],u-i);this.drop.position.z+=.00025;const radius=this.radius*Math.sqrt(amount)*(.65+.25*Math.sin(phase*Math.PI));this.drop.scale.set(radius*.65,radius*1.45,radius*.28);
 }
 dispose(){this.mesh.removeFromParent();this.drop.removeFromParent();this.geometry.dispose();this.dropGeometry.dispose();this.material.dispose();}
}
