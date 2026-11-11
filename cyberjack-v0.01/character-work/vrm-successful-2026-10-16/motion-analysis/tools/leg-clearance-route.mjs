import{Vector3,Quaternion}from'three';import{pack}from'../review/command-pose.mjs';import{armLegContacts}from'./self-collision.mjs';
// A bounded, smooth horizontal detour of the entire leg. Knee/ankle local
// rotations and every joint height are unchanged; do not bend knees backwards
// or lift the root to hide an intersecting trajectory.
export function routeLegsApart(t,frames){
 const original=frames.map(t.unpack),worst=poses=>Math.max(0,...poses.map(p=>Math.max(0,...armLegContacts(t,p).contacts.filter(c=>c.kind==='leg-leg').map(c=>c.penetration)))),before=worst(original);if(before<=.012)return{frames,changed:false,before,after:before};
 let best={frames,cost:before,angle:0};const vertical=new Vector3(0,1,0);
 const combinations=[];for(const left of [-.48,-.36,-.24,-.12,0,.12,.24,.36,.48])for(const right of [-.48,-.36,-.24,-.12,0,.12,.24,.36,.48])if(left||right)combinations.push({left,right});combinations.sort((a,b)=>Math.max(Math.abs(a.left),Math.abs(a.right))-Math.max(Math.abs(b.left),Math.abs(b.right)));for(const {left,right}of combinations){const amplitude=Math.max(Math.abs(left),Math.abs(right)),direction=1,mask='independent';
  const poses=frames.map(t.unpack);for(let i=1;i<poses.length-1;i++){
   const w=Math.sin(Math.PI*i/(poses.length-1))**2;
   for(const [side,sign]of [['L',left],['R',right]]){if(!sign)continue;const j=t.m.index.get('cf_j_thigh00_'+side),parent=t.m.rig[j].parentIndex,q=new Quaternion().setFromAxisAngle(vertical,sign*w).multiply(poses[i][j].worldQ);poses[i][j].q.copy(poses[i][parent].worldQ).invert().multiply(q);t.m.fk(poses[i]);}
  }
  const cost=worst(poses);if(cost<best.cost-1e-5){const routed=structuredClone(frames);for(let i=1;i<poses.length-1;i++)for(const [side,angle]of [['L',left],['R',right]])if(angle){const j=t.m.index.get('cf_j_thigh00_'+side);routed[i][j].q=poses[i][j].q.toArray();}best={frames:routed,cost,angle:amplitude*direction,mask,left,right};}
  if(best.cost<.012)return{frames:best.frames,changed:true,before,after:best.cost,maxHipDetourRadians:Math.abs(best.angle),mask:best.mask,hipYaw:[best.left,best.right],policy:'bounded horizontal whole-leg detour; original knees, ankles, root and heights retained'};
 }
 if(best.cost>.025){const timed=retimeLegsForClearance(t,best.frames),routed=routeSeatedFeet(t,timed.after<best.cost?timed.frames:best.frames);if(routed.after<Math.min(best.cost,timed.after))return{...routed,changed:true,before,maxHipDetourRadians:Math.abs(best.angle),footPathAdjusted:true};if(timed.after<best.cost-1e-5)return{...timed,changed:true,before,maxHipDetourRadians:Math.abs(best.angle),timingAdjusted:true};}
 return{frames:best.frames,changed:best.angle!==0,before,after:best.cost,maxHipDetourRadians:Math.abs(best.angle),mask:best.mask,hipYaw:[best.left,best.right]};
}

// If simultaneous unfolding crosses the other leg, stagger the already
// generated leg motions. No new endpoint or joint bend is invented.
export function retimeLegsForClearance(t,frames){
 const original=frames.map(t.unpack),last=frames.length-1,legIds=['L','R'].map(side=>t.m.rig.map((_,i)=>{for(let j=i;j>=0;j=t.m.rig[j].parentIndex)if(t.m.rig[j].name==='cf_j_thigh00_'+side)return i;return -1;}).filter(i=>i>=0)),cost=poses=>Math.max(0,...poses.map(p=>Math.max(0,...armLegContacts(t,p).contacts.filter(c=>c.kind==='leg-leg').map(c=>c.penetration)))),before=cost(original);
 let best={frames,cost:before,changed:false};
 const schedules=[];for(const amount of [.08,.16,.24])for(const delays of [[amount,-amount],[-amount,amount],[amount,0],[0,amount],[-amount,0],[0,-amount]])schedules.push({delays});for(const delay of [.2,.35,.5,.65])for(const reverse of [false,true]){const windows=[[0,1-delay],[delay,1]];schedules.push({windows:reverse?windows.reverse():windows});}
 for(const {delays,windows}of schedules){
  const poses=frames.map(t.unpack);let valid=true;
  for(let i=1;i<last;i++){const u=i/last;for(let side=0;side<2;side++){const x=windows?Math.max(0,Math.min(1,(u-windows[side][0])/(windows[side][1]-windows[side][0]))):null,phase=windows?x*x*(3-2*x):Math.max(0,Math.min(1,u+delays[side]*Math.sin(Math.PI*u))),f=phase*last,a=Math.min(last-1,Math.floor(f)),v=f-a;for(const j of legIds[side]){poses[i][j].p.lerpVectors(original[a][j].p,original[a+1][j].p,v);poses[i][j].q.copy(original[a][j].q).slerp(original[a+1][j].q,v);poses[i][j].s.lerpVectors(original[a][j].s,original[a+1][j].s,v);}}t.m.fk(poses[i]);for(const name of ['leg01_L','leg01_R','foot_L','foot_R','toes_L','toes_R'])if(t.point(poses[i],name).y<Math.min(-.012*t.height,t.point(original[i],name).y-.002)){valid=false;break;}if(!valid)break;}
  if(!valid)continue;const after=cost(poses);if(after<best.cost-1e-5)best={frames:poses.map(pack),cost:after,changed:true,phaseOffsets:delays,phaseWindows:windows};if(after<=.012)break;
 }
 return {...best,before,after:best.cost,policy:'stagger original leg trajectories; endpoints, torso, pelvis and unrequested bones retained'};
}

export function routeSeatedFeet(t,frames){
 const original=frames.map(t.unpack),last=frames.length-1,startF=t.features(original[0]),endF=t.features(original[last]),cost=poses=>Math.max(0,...poses.map(p=>Math.max(0,...armLegContacts(t,p).contacts.filter(c=>c.kind==='leg-leg').map(c=>c.penetration)))),before=cost(original);let best={frames,cost:before,changed:false};const rejected={};const reject=(reason,value)=>{rejected[reason]??={count:0,example:value};rejected[reason].count++;};
 if(Math.max(startF.hipHeight,endF.hipHeight)>.25||Math.max(startF.torsoInclination,endF.torsoInclination)>55||Math.max(endF.leftKnee,endF.rightKnee)>40||Math.min(endF.leftFootForward,endF.rightFootForward)<.25)return {...best,before,after:before};
 for(const lateral of [.06,.12,.20,.28])for(const lift of [.02,.06,.12])for(const mask of ['both','L','R']){
  const poses=frames.map(t.unpack);let valid=true;
  for(let i=1;i<last;i++){const p=poses[i],u=i/last,w=u*u*(3-2*u),arc=Math.sin(Math.PI*u)**2;
   for(const side of ['L','R']){if(mask!=='both'&&mask!==side)continue;const other=side==='L'?'R':'L',out=t.point(p,'thigh00_'+side).sub(t.point(p,'thigh00_'+other)).setY(0).normalize(),target=t.point(original[0],'foot_'+side).lerp(t.point(original[last],'foot_'+side),w).addScaledVector(out,lateral*t.height*arc);target.y+=lift*t.height*arc;const toe=t.point(p,'toes_'+side).y-t.point(p,'foot_'+side).y;target.y=Math.max(target.y,-Math.min(0,toe)+.002*t.height);const pole=t.point(original[0],'leg01_'+side).sub(t.point(original[0],'thigh00_'+side)).lerp(t.point(original[last],'leg01_'+side).sub(t.point(original[last],'thigh00_'+side)),w).addScaledVector(out,.3*t.height*arc),foot=t.m.index.get('cf_j_foot_'+side),orientation=p[foot].worldQ.clone(),error=solveHingedLeg(t,p,side,target,orientation,pole);
    if(error>.02*t.height){reject('reach',{i,side,error});valid=false;break;}const knee=t.point(p,'leg01_'+side),angle=180-t.point(p,'thigh00_'+side).sub(knee).angleTo(t.point(p,'foot_'+side).sub(knee))*180/Math.PI;if(angle>170){reject('knee',{i,side,angle});valid=false;break;}
   }
   if(!valid)break;const free=new Set(['L','R'].filter(side=>mask==='both'||mask===side).flatMap(side=>['thigh00','leg01','foot'].map(n=>t.m.index.get('cf_j_'+n+'_'+side))));t.limitJoints(p);for(let j=0;j<p.length;j++)if(!free.has(j))p[j].q.copy(original[i][j].q);t.m.fk(p);for(const name of ['leg01_L','leg01_R','foot_L','foot_R','toes_L','toes_R'])if(t.point(p,name).y<Math.min(-.012*t.height,t.point(original[i],name).y-.002)){reject('floor',{i,name,y:t.point(p,name).y});valid=false;break;}if(!valid)break;
  }
  if(!valid)continue;const after=cost(poses);if(after<best.cost-1e-5)best={frames:frames.map((frame,i)=>frame.map((joint,j)=>i>0&&i<last&&['L','R'].filter(side=>mask==='both'||mask===side).some(side=>['thigh00','leg01','foot'].some(n=>t.m.index.get('cf_j_'+n+'_'+side)===j))?{...joint,q:poses[i][j].q.toArray()}:joint)),cost:after,changed:true,lateral,lift,mask};if(after<=.012)return {...best,before,after,policy:'seated foot arcs with leg IK; fixed pelvis/torso, bounded knee bend, floor and exact endpoints'};
 }
 return {...best,rejected,before,after:best.cost,policy:'seated foot arcs with leg IK; fixed pelvis/torso, bounded knee bend, floor and exact endpoints'};
}

function solveHingedLeg(t,p,side,target,orientation,pole){
 const thigh=t.m.index.get('cf_j_thigh00_'+side),knee=t.m.index.get('cf_j_leg01_'+side),foot=t.m.index.get('cf_j_foot_'+side),h=t.jointLimits().hinges.find(h=>h.j===knee);if(!h)return Infinity;
 const a=t.point(p,'thigh00_'+side),c=t.point(p,'foot_'+side),axis=target.clone().sub(a),d=axis.length();if(d<1e-6)return Infinity;axis.normalize();const localFoot=c.clone().applyMatrix4(p[knee].world.clone().invert()),parent=t.m.rig[knee].parentIndex,atAngle=angle=>localFoot.clone().multiply(p[knee].s).applyQuaternion(h.rest.clone().multiply(new Quaternion().setFromAxisAngle(h.axis,angle))).add(p[knee].p).applyMatrix4(p[parent].world).distanceTo(a);let lo=0,hi=h.max;for(let iteration=0;iteration<9;iteration++){const middle=(lo+hi)/2;if(atAngle(middle)>d)lo=middle;else hi=middle;}p[knee].q.copy(h.rest).multiply(new Quaternion().setFromAxisAngle(h.axis,(lo+hi)/2));t.m.fk(p);
 const rotate=q=>{const parent=t.m.rig[thigh].parentIndex,world=q.multiply(p[thigh].worldQ.clone());p[thigh].q.copy(p[parent].worldQ).invert().multiply(world);t.m.fk(p);};
 rotate(new Quaternion().setFromUnitVectors(t.point(p,'foot_'+side).sub(a).normalize(),axis));const bend=t.point(p,'leg01_'+side).sub(a);bend.addScaledVector(axis,-bend.dot(axis));const desired=pole.clone().addScaledVector(axis,-pole.dot(axis));if(bend.lengthSq()>1e-9&&desired.lengthSq()>1e-9){bend.normalize();desired.normalize();const turn=Math.atan2(axis.dot(bend.clone().cross(desired)),bend.dot(desired));rotate(new Quaternion().setFromAxisAngle(axis,turn));}
 if(orientation){p[foot].q.copy(p[t.m.rig[foot].parentIndex].worldQ).invert().multiply(orientation);t.m.fk(p);}return t.point(p,'foot_'+side).distanceTo(target);
}
