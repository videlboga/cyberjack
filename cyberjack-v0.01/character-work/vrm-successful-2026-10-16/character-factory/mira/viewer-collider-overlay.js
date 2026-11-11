import * as T from './vendor/three/three.module.js';
export function createColliderOverlay(){
 const scene=new T.Scene(),material=new T.LineBasicMaterial({color:0x21bdc9,transparent:true,opacity:.65,depthTest:false,depthWrite:false}),meshes=[];
 let enabled=false,source=null;
 return {set enabled(v){enabled=v;source=null;},get enabled(){return enabled;},update(shapes){
 if(!enabled||source===shapes)return;source=shapes;
 while(meshes.length>shapes.length){const m=meshes.pop();scene.remove(m);m.geometry.dispose();}
 shapes.forEach((s,index)=>{
 const a=s.center||s.a,b=s.b||a,axis=b.clone().sub(a),len=axis.length();if(len>1e-9)axis.divideScalar(len);else axis.set(0,1,0);
 const u=new T.Vector3().crossVectors(axis,Math.abs(axis.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize(),v=new T.Vector3().crossVectors(axis,u),n=s.depthAxis?.clone().normalize(),rings=[];
 for(let j=0;j<=17;j++){const top=j<=8,theta=top?j/8*Math.PI/2:Math.PI/2+(j-9)/8*Math.PI/2,center=top?b:a,ring=[];
 for(let k=0;k<20;k++){const angle=k/20*Math.PI*2,q=axis.clone().multiplyScalar(Math.cos(theta)).addScaledVector(u,Math.sin(theta)*Math.cos(angle)).addScaledVector(v,Math.sin(theta)*Math.sin(angle)).multiplyScalar(s.radius);
 if(n)q.addScaledVector(n,q.dot(n)*((s.depthScale||1)-1));q.addScaledVector(axis,q.dot(axis)*((s.capScale||1)-1));ring.push(q.add(center));}rings.push(ring);}
 const points=[];const add=(p,q)=>{points.push(p.x,p.y,p.z,q.x,q.y,q.z);};for(let j=0;j<rings.length;j++)for(let k=0;k<20;k++){add(rings[j][k],rings[j][(k+1)%20]);if(j&&k%4===0)add(rings[j-1][k],rings[j][k]);}
 let m=meshes[index];if(!m){m=new T.LineSegments(new T.BufferGeometry(),material);m.frustumCulled=false;m.layers.enableAll();meshes.push(m);scene.add(m);}m.geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
 });},render(renderer,camera){if(!enabled)return;const clear=renderer.autoClear;renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=clear;}};
}
