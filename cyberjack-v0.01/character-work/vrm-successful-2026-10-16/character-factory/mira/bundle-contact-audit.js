import * as T from 'three';
import {MeshSurfaceCollider} from './mesh-surface-collider.js';
// Explicit snapshot audit; never runs in the frame loop. The shader geometry
// stores dummy positions, so reconstruct its real vertices from its bindings.
export function auditRibbonBody(rig,geometry,body,{snapshot=true}={}){
 body.updateWorldMatrix(true,false);
 const bodyPositions=body.userData.cjGpuSkin?.active?body.userData.cjGpuSkin.posedPositions():body.geometry.attributes.position.array;
 const surface=new MeshSurfaceCollider().update(bodyPositions,body.geometry.index.array,body.matrixWorld);
 const rows=geometry.getAttribute('bundleRow'),blends=geometry.getAttribute('bundleBlend'),weights=geometry.getAttribute('bundleWeights'),vertices=[];
 for(let v=0;v<rows.count;v++){
  const point=new T.Vector3(),row=rows.getX(v),blend=blends.getX(v);
  const t=blend,t2=t*t,t3=t2*t,coeff=[-.5*t+t2-.5*t3,1-2.5*t2+1.5*t3,.5*t+2*t2-1.5*t3,-.5*t2+.5*t3];
  for(let s=0;s<4;s++)for(let k=0;k<3;k++)point.addScaledVector(rig.points[Math.max(0,Math.min(72,row+(s-1)*3))+k],weights.array[v*3+k]*coeff[s]);vertices.push(point);
 }
 let crossings=0,inside=0,maxDepth=0,segments=0;const crossingEdges=[];
 const edge=(a,b)=>{const d=b.clone().sub(a),length=d.length();if(length<1e-7)return;segments++;if(surface.intersections(a,d.multiplyScalar(1/length),length-1e-6).length){crossings++;crossingEdges.push(...a.toArray(),...b.toArray());}};
 for(let j=0;j<18;j++)for(let r=4;r<80;r++){
  const i=j*162+r*2;edge(vertices[i],vertices[i+2]);edge(vertices[i+1],vertices[i+3]);edge(vertices[i],vertices[i+1]);edge(vertices[i+1],vertices[i+2]);
  if(r%4===0)for(let side=0;side<2;side++)if(surface.contains(vertices[i+side])){inside++;maxDepth=Math.max(maxDepth,surface.nearest(vertices[i+side]).distance);}
 }
 return {...(snapshot?{bodySnapshot:{positions:Array.from(bodyPositions),indices:Array.from(body.geometry.index.array),matrix:body.matrixWorld.toArray()},controlPoints:rig.points.map(p=>p.toArray())}:{}),crossingEdges,crossings,inside,maxDepth,segments,vertices:vertices.length,scope:'body-only; excludes head, replacement neck, first four ribbon rows and self collision'};
}
