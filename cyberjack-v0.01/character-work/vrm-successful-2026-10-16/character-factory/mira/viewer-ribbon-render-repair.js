import * as T from './vendor/three/three.module.js';
import {createRenderSurfaceRepair} from './work/ribbon-contact-experiments/render-surface-repair.js';
// Same Jacobi reconstruction experiment, adapted to the actual posed triangle
// collider. Unlike the stand's analytic proxies, this uses exact BVH normals.
// Corrections affect render buffers only; roots and simulation are untouched.
export function createCharacterRenderRepair(indices,count,pinned){
 const repair=createRenderSurfaceRepair(indices,count,pinned),nodes=Array.from({length:count},()=>new T.Vector3()),caches=new Map(),direction=new T.Vector3(),sample=new T.Vector3(),candidate=new T.Vector3();
 let collider,revision=-1;const previous=new Float32Array(count*3),result=new Float32Array(count*3);let valid=false;
 function project(point,key){const bounds=collider.nodes[collider.root]?.bounds;if(!bounds||collider.boxDistance(point,bounds)>.008**2)return;let hit=caches.get(key);if(!hit){hit={point:new T.Vector3(),normal:new T.Vector3(),triangle:null};caches.set(key,hit);}if(!collider.nearestInto(point,hit,hit.triangle,.04))return;if(hit.signedDistance<.008)point.copy(hit.point).addScaledVector(hit.normal,.008);}
 function edge(a,b,before,target,key){direction.subVectors(b,a);const length=direction.length();if(length<1e-9)return false;direction.divideScalar(length);const bounds=collider.nodes[collider.root]?.bounds;if(!bounds||!collider.rayBox(a,direction,bounds,length))return false;const hits=collider.intersections(a,direction,length);if(!hits.length)return false;let inside=collider.contains(a),entry=0,best=0;
 const propose=(lo,hi)=>{if(hi-lo<1e-7)return;sample.copy(a).addScaledVector(direction,(lo+hi)*.5);candidate.copy(sample);project(candidate,key);const d=sample.distanceToSquared(candidate);if(d>best){best=d;before.copy(sample);target.copy(candidate);}};
 for(const hit of hits){if(inside)propose(entry,hit.distance);else entry=hit.distance;inside=!inside;}if(inside)propose(entry,length);return best>1e-16;
 }
 return (positions,surface)=>{let changed=!valid||revision!==surface.revision;for(let i=0;!changed&&i<positions.length;i++)if(Math.abs(previous[i]-positions[i])>.00015)changed=true;if(!changed){positions.set(result.subarray(pinned*3),pinned*3);return;}previous.set(positions);revision=surface.revision;valid=true;collider=surface;for(let i=0;i<count;i++)nodes[i].fromArray(positions,i*3);repair.run(nodes,project,4,edge);for(let i=pinned;i<count;i++)nodes[i].toArray(positions,i*3);result.set(positions);};
}
