import{Vector3}from'three';
import{pack}from'../review/command-pose.mjs';
import{solveChain}from'./foot-contacts.mjs';
import{armLegContacts}from'./self-collision.mjs';
// Search a single smooth lateral bypass for the whole arm route. Do not exempt
// the target body part or choose an unrelated IK branch independently per frame.
export function routeArmsAroundBody(t,frames){
 let poses=frames.map(t.unpack),changed=false;
 const worst=(list,side)=>Math.max(0,...list.map(p=>Math.max(0,...armLegContacts(t,p).contacts.filter(c=>c.side===side&&c.arm).map(c=>c.penetration))));
 const before=Math.max(worst(poses,'L'),worst(poses,'R'));
 for(const side of ['L','R']){
  const initial=worst(poses,side);if(initial<=.012)continue;const original=poses.map(pack);let best={poses,cost:initial,amount:0};
  for(const amount of [.06,.12,.20,.28])for(const routeMode of ['outside','up','outside-up'])for(const poleMode of ['source','outside']){
   const candidates=original.map(t.unpack);let valid=true;
   for(let i=1;i<candidates.length-1;i++){
    const p=candidates[i],u=i/(candidates.length-1),weight=Math.sin(Math.PI*u)**2;
    const out=t.point(p,'thigh00_'+side).sub(t.point(p,'thigh00_'+(side==='L'?'R':'L'))).normalize(),origin=t.point(p,'arm00_'+side),pole=poleMode==='source'?t.point(p,'forearm01_'+side).sub(origin):out;
    const up=t.point(p,'neck').sub(t.point(p,'hips')).normalize(),direction=routeMode==='up'?up:routeMode==='outside-up'?out.clone().add(up).normalize():out;const wrist=t.point(p,'hand_'+side),target=wrist.clone().addScaledVector(direction,t.height*amount*weight),names=['arm00','forearm01','hand'].map(n=>'cf_j_'+n+'_'+side),wristLocal=p[t.m.index.get(names[2])].q.clone();
    const error=solveChain(t,p,names,target,undefined,pole);p[t.m.index.get(names[2])].q.copy(wristLocal);t.m.fk(p);
    const elbow=t.features(p)[(side==='L'?'left':'right')+'Elbow'];
    if(error>t.height*.02||elbow>155||t.ground(p)<Math.min(-.012*t.height,t.ground(t.unpack(original[i]))-.003)){valid=false;break;}
   }
   if(!valid)continue;const cost=worst(candidates,side);if(cost<best.cost-1e-5)best={poses:candidates,cost,amount};
  }
  if(best.amount){poses=best.poses;changed=true;}
 }
 return {frames:changed?poses.map(pack):frames,changed,before,after:Math.max(worst(poses,'L'),worst(poses,'R')),policy:'smooth lateral arm bypass; endpoints and body preserved'};
}
