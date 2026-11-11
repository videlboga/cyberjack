// Keep exhaustive contact search off the frame's critical path. Every yield is
// transactional: trial transforms are saved, and only a completed solve is shown.
export function createCooperativePoseSolve(scene,{budgetMs=6,now=()=>performance.now()}={}){
 const nodes=[scene],skeletons=new Set();scene.traverse(n=>{if(n!==scene&&n.isBone)nodes.push(n);if(n.isSkinnedMesh)skeletons.add(n.skeleton);});let job=null;
 function capture(){const a=new Float64Array(nodes.length*10);nodes.forEach((n,i)=>{n.position.toArray(a,i*10);n.quaternion.toArray(a,i*10+3);n.scale.toArray(a,i*10+7);});return a;}
 function restore(a){nodes.forEach((n,i)=>{n.position.fromArray(a,i*10);n.quaternion.fromArray(a,i*10+3);n.scale.fromArray(a,i*10+7);});scene.updateMatrixWorld(true);for(const skeleton of skeletons)skeleton.update();}
 return {capture,restore,get pending(){return Boolean(job);},matches:key=>job?.key===key,
 start(iterator,key,complete,visible){if(job)throw Error('A contact solve is already running');job={iterator,key,complete,visible,working:capture()};restore(visible);},
 cancel(){if(!job)return;const old=job;job=null;old.iterator.return?.();restore(old.visible);},
 tick(){if(!job)return;const active=job;restore(active.working);const start=now();try{let result;do{result=active.iterator.next();if(result.done){job=null;active.complete(result.value);return;}}while(now()-start<budgetMs);active.working=capture();restore(active.visible);}catch(error){job=null;restore(active.visible);throw error;}}
 };
}
