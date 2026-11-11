import {Vector3,Quaternion} from 'three';
const point=n=>n.getWorldPosition(new Vector3());
// Avatar-local contact frames, calibrated before playback. No Euler angles or
// assumptions about the local axes chosen by a particular VRM exporter.
export function palmFrame(vrm,side){
 const get=n=>vrm.humanoid.getRawBoneNode(side+n),node=get('Hand'),middle=get('MiddleProximal'),index=get('IndexProximal'),ring=get('RingProximal');
 if(!node||!middle||!index||!ring)return null;
 const forward=node.worldToLocal(point(middle)),across=node.worldToLocal(point(index)).sub(node.worldToLocal(point(ring))),normal=forward.clone().cross(across).multiplyScalar(side==='left'?1:-1).normalize();
 if(forward.lengthSq()<1e-10||normal.lengthSq()<.5)return null;
 const offset=forward.clone().multiplyScalar(.55),depths=[];
 // The bone plane is inside the hand. Calibrate the palmar skin, excluding
 // fingers/wrist by a small tangent window around the centre of the palm.
 vrm.scene?.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!indices||!weights)return;mesh.skeleton.update();for(let i=0;i<indices.count;i++){let influence=0;for(let j=0;j<4;j++){let bone=mesh.skeleton.bones[indices.array[i*4+j]];for(;bone&&bone!==node;bone=bone.parent){}if(bone===node)influence+=weights.array[i*4+j];}if(influence<.7)continue;const delta=node.worldToLocal(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld)).sub(offset),depth=delta.dot(normal);if(delta.clone().addScaledVector(normal,-depth).length()<.022&&Math.abs(depth)<.035)depths.push(depth);}});
 depths.sort((a,b)=>a-b);const skinDepth=depths.length?Math.max(0,depths[Math.floor((depths.length-1)*.9)]):0;offset.addScaledVector(normal,skinDepth);
 return {node,offset,normal,forward:forward.normalize(),kind:'palm',skinDepth,surfaceSamples:depths.length};
}
export function soleFrame(vrm,side){
 const node=vrm.humanoid.getRawBoneNode(side+'Foot'),toe=vrm.humanoid.getRawBoneNode(side+'Toes');if(!node||!toe)return null;
 const q=node.getWorldQuaternion(new Quaternion()).invert(),forward=point(toe).sub(point(node)),offset=forward.clone().multiplyScalar(.45),heights=[];
 vrm.scene?.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!indices||!weights)return;mesh.skeleton.update();for(let i=0;i<indices.count;i++){let influence=0;for(let j=0;j<4;j++){const b=mesh.skeleton.bones[indices.array[i*4+j]];if(b===node||b===toe)influence+=weights.array[i*4+j];}if(influence>.5)heights.push(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).y);}});
 heights.sort((a,b)=>a-b);const soleY=heights.length?heights[Math.floor(heights.length*.03)]:0;offset.y=soleY-point(node).y;
 return {node,offset:offset.applyQuaternion(q),normal:new Vector3(0,-1,0).applyQuaternion(q),forward:forward.normalize().applyQuaternion(q),kind:'sole',surfaceSamples:heights.length};
}
export function contactOrientation(frame,current,surfaceNormal,maxAngle=Math.PI/3){
 const desired=surfaceNormal.clone().normalize().negate(),normal=frame.normal.clone().applyQuaternion(current).normalize();
 const delta=new Quaternion().setFromUnitVectors(normal,desired),angle=delta.angleTo(new Quaternion());if(angle>maxAngle)delta.slerp(new Quaternion(),1-maxAngle/angle);
 return {orientation:delta.multiply(current.clone()).normalize(),requestedAngle:angle,appliedAngle:Math.min(angle,maxAngle),limited:angle>maxAngle};
}
export function contactPivot(frame,surface,orientation){return surface.clone().sub(frame.offset.clone().applyQuaternion(orientation));}
export function contactMeasurement(frame,surface,normal){const q=frame.node.getWorldQuaternion(new Quaternion()),center=frame.node.localToWorld(frame.offset.clone()),facing=frame.normal.clone().applyQuaternion(q);return {gap:center.distanceTo(surface),normalError:Math.acos(Math.max(-1,Math.min(1,facing.dot(normal.clone().normalize().negate()))))};}
