// Cache only the input to the retarget/contact pass. Mood, blinking and joint
// limits remain downstream and run normally. No time-based reuse of moving poses.
export function createAvatarPoseCache(){let input=null,key=null,bones=null,position=null;
 function matches(pose,context){if(!input||key!==context||pose.length!==input.length)return false;for(let i=0;i<pose.length;i++)for(const name of ['p','q','s']){const v=pose[i][name],a=input[i][name];if(!(Math.abs(v.x-a[0])<=1e-10)||!(Math.abs(v.y-a[1])<=1e-10)||!(Math.abs(v.z-a[2])<=1e-10)||name==='q'&&!(Math.abs(v.w-a[3])<=1e-10))return false;}return true;}
 return {restore(pose,context,targets,scene){if(!matches(pose,context))return false;for(let i=0;i<targets.length;i++){const n=targets[i][0];n.quaternion.fromArray(bones[i].q);n.position.fromArray(bones[i].p);}scene.position.fromArray(position);scene.updateMatrixWorld(true);return true;},store(pose,context,targets,scene){key=context;input=pose.map(n=>({p:n.p.toArray(),q:n.q.toArray(),s:n.s.toArray()}));bones=targets.map(([n])=>({p:n.position.toArray(),q:n.quaternion.toArray()}));position=scene.position.toArray();}};
}
