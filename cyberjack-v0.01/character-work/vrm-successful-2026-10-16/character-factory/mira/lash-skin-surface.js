import * as THREE from 'three';
// A small posed triangle grid around the eyes. It constrains the actual lash
// cross sections, including closed lids, rather than offsetting roots blindly.
export class LashSkinSurface{
 constructor(head){
  this.mesh=head.socketMesh;this.cell=.004;this.grid=new Map();this.maxZ=new Map();this.triangles=[];this.vertexIds=new Set();this.positions=new Map();const cache=head.faceEditor.cache.get(this.mesh),index=this.mesh.geometry.index?.array;
  if(!cache||!index)return;const rest=id=>new THREE.Vector3().fromArray(cache.position,id*3).applyMatrix4(cache.matrix),inEye=p=>Math.abs(p.x)>.008&&Math.abs(p.x)<.085&&p.y>1.455&&p.y<1.545&&p.z>.018;
  for(let i=0;i<index.length;i+=3){const ids=[index[i],index[i+1],index[i+2]];if(!ids.some(id=>inEye(rest(id))))continue;this.triangles.push(ids);for(const id of ids)this.vertexIds.add(id);}
 }
 update(){
  this.grid.clear();this.maxZ.clear();for(const id of this.vertexIds){let p=this.positions.get(id);if(!p){p=new THREE.Vector3();this.positions.set(id,p);}this.mesh.getVertexPosition(id,p);}
  for(const ids of this.triangles){const p=ids.map(id=>this.positions.get(id)),peakZ=Math.max(p[0].z,p[1].z,p[2].z),x0=Math.floor((Math.min(...p.map(v=>v.x))-.0025)/this.cell),x1=Math.floor((Math.max(...p.map(v=>v.x))+.0025)/this.cell),y0=Math.floor((Math.min(...p.map(v=>v.y))-.0025)/this.cell),y1=Math.floor((Math.max(...p.map(v=>v.y))+.0025)/this.cell);
   if(x1-x0>12||y1-y0>12)continue;
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+':'+y;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(p);this.maxZ.set(key,Math.max(this.maxZ.get(key)??-Infinity,peakZ));}
  }
 }
 depth(x,y){
  let front=-Infinity;const triangles=this.grid.get(Math.floor(x/this.cell)+':'+Math.floor(y/this.cell))||[];
  for(const [a,b,c]of triangles){const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-12)continue;const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w=1-u-v;if(u<-.00001||v<-.00001||w<-.00001)continue;front=Math.max(front,u*a.z+v*b.z+w*c.z);}
  return front;
 }
 lift(point,clearance=.00016){
  const key=Math.floor(point.x/this.cell)+':'+Math.floor(point.y/this.cell);if(point.z>=(this.maxZ.get(key)??-Infinity)+clearance)return point;
  const original=point.z,skin=this.depth(point.x,point.y);let lifted=Number.isFinite(skin)?Math.max(original,skin+clearance):original;
  // Continue support beyond the projected lid edge with a smooth falloff.
  // A hard ray/no-ray switch would pop a lash during a slow blink.
  const triangles=this.grid.get(Math.floor(point.x/this.cell)+':'+Math.floor(point.y/this.cell))||[];
  for(const p of triangles)for(let k=0;k<3;k++){
   const a=p[k],b=p[(k+1)%3],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;if(len<1e-14)continue;
   const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/len)),x=a.x+t*dx,y=a.y+t*dy,d2=(point.x-x)**2+(point.y-y)**2;if(d2>=.0025**2)continue;const d=Math.sqrt(d2);
   const u=d/.0025,weight=1-u*u*(3-2*u),z=a.z+t*(b.z-a.z)+clearance;
   lifted=Math.max(lifted,original+Math.max(0,z-original)*weight);
  }
  point.z=lifted;return point;
 }
}
