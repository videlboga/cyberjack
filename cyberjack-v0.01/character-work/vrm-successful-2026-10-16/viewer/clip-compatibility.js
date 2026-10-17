// A decoded transform clip is not necessarily a standalone humanoid pose.
export function inspectBodyClip(clip,sourceRig,boneMap){
 const rig=new Map(sourceRig.map(n=>[n.name,n])),body=new Set(Object.keys(boneMap).filter(n=>!/hitomi|eye/i.test(n)));
 let rotations=0,maxAngle=0,upperAngle=0,invalid=0;const times=[0,.173,.419,.731,.997,1].map(f=>f*clip.duration);
 for(const track of clip.tracks||[]){const name=(track.bone||track.resolvedPath?.split('/').at(-1)||'').replace(/^cm_/,'cf_');if(!body.has(name)||!rig.has(name)||![2,4].includes(track.attribute))continue;
  rotations++;if((track.attribute===2&&track.width!==4)||(track.attribute===4&&track.width!==3)){invalid++;continue}const rest=rig.get(name).rotation,rn=Math.hypot(...rest);
  for(const t of times){const a=track.sample(t);if(!a.every(Number.isFinite)){invalid++;continue}let q=a;
   if(track.attribute===4){const [x,y,z]=a.map(v=>v*Math.PI/360),c1=Math.cos(x),c2=Math.cos(y),c3=Math.cos(z),s1=Math.sin(x),s2=Math.sin(y),s3=Math.sin(z);q=[s1*c2*c3-c1*s2*s3,c1*s2*c3+s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3]}
   const n=Math.hypot(...q);if(n<1e-6||rn<1e-6){invalid++;continue}const dot=Math.min(1,Math.abs(q.reduce((s,v,i)=>s+v*rest[i],0)/(n*rn)));const angle=2*Math.acos(dot);maxAngle=Math.max(maxAngle,angle);if(/^cf_j_(spine0[123]|shoulder_[LR]|arm00_[LR]|forearm01_[LR])$/.test(name))upperAngle=Math.max(upperAngle,angle);
  }
 }
 const code=invalid?'invalid-values':!rotations?'unmapped-body':maxAngle<.001?'rest-only':upperAngle<.01?'partial-body':'body';
 const reason=({'partial-body':'Частичный слой: руки и корпус остаются в исходной стойке. Для него нужна базовая поза; самостоятельно он даст Т-стойку',body:'Есть поза тела', 'invalid-values':'В каналах костей тела некорректные числа или нулевые вращения','unmapped-body':'Нет каналов вращения для поддерживаемого скелета тела','rest-only':'Клип задаёт только исходную позу тела. Это служебный клип или слой, а не самостоятельное движение'})[code];
 return {ok:code==='body',code,reason,rotationBones:rotations,maxAngleRadians:maxAngle,upperBodyAngleRadians:upperAngle,sampleTimes:times};
}
export function inferClipRig(c){
 if(!c.playable)return 'object';const origin=c.origin||c.source||'';
 if(/\/(?:female)\//i.test(origin))return 'female';if(/\/(?:male)\//i.test(origin))return 'male';
 // L/M/S describe proportions, not sex. Only explicit f_/m_ prefixes identify sex.
 if(/^f_/.test(c.name))return 'female';if(/^m_/.test(c.name))return 'male';if(/^[LMS]_/.test(c.name))return 'shared';
 return c.rig||'shared';
}
