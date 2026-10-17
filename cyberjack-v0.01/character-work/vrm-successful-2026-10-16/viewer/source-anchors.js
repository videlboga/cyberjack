import * as THREE from 'three';
// KKBP's Center replaces cf_n_height. cf_j_root may survive only as a
// collider helper, so its translation must be folded into Center, not that helper.
export function sourceWorldPosition(source,map){
 const chain=[];for(let n=source;n;n=map.get(n.parent))chain.unshift(n);
 const matrix=new THREE.Matrix4(),local=new THREE.Matrix4();
 for(const n of chain){local.compose(new THREE.Vector3().fromArray(n.animatedPosition||n.position||[0,0,0]),n.local,new THREE.Vector3().fromArray(n.animatedScale||n.scale||[1,1,1]));matrix.multiply(local)}
 return new THREE.Vector3().setFromMatrixPosition(matrix);
}
export function applySourceAnchor(node,source,map,scene){
 const p=sourceWorldPosition(source,map);p.x=-p.x;
 // The viewer's optional spread and scene orientation remain outside animation.
 scene.updateWorldMatrix(true,false);p.applyMatrix4(scene.matrixWorld);
 node.parent?.updateWorldMatrix(true,false);if(node.parent)node.parent.worldToLocal(p);
 node.position.copy(p);
}
