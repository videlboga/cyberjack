import{Vector3,Quaternion,PropertyBinding}from'three';import{SPATIAL_TARGETS}from'./anatomical-targets.mjs';
// Calibrate marker offsets from the loaded avatar, not an unconfigured source
// rig whose paired breast transforms may still be collapsed at the midline.
export function fitAvatarAnatomicalTargets(vrm,bank,height,scale){
 const nodes=new Map();vrm.scene.updateMatrixWorld(true);vrm.scene.traverse(n=>{if(n.name)nodes.set(n.name,n);});const result={};
 for(const d of SPATIAL_TARGETS)for(const marker of d.markers||[]){const node=nodes.get(marker.name);let sourceAnchor=marker.anchor,index=bank.rig.findIndex(b=>b.name===sourceAnchor);while(index>=0&&!bank.boneMap[sourceAnchor]){index=bank.rig[index].parentIndex??bank.rig.findIndex(b=>b.name===bank.rig[index].parent);sourceAnchor=bank.rig[index]?.name;}const targetName=bank.boneMap[sourceAnchor],anchor=nodes.get(targetName)||nodes.get(PropertyBinding.sanitizeNodeName(targetName||''));if(!node||!anchor)continue;const delta=node.getWorldPosition(new Vector3()).sub(anchor.getWorldPosition(new Vector3())).applyQuaternion(anchor.getWorldQuaternion(new Quaternion()).invert());delta.x=-delta.x;delta.divideScalar(scale*height);if(!delta.toArray().every(Number.isFinite)||delta.length()>.5)continue;result[marker.name]={anchor:sourceAnchor,offset:delta.toArray(),origin:'loaded-avatar-marker'};}
 return result;
}
