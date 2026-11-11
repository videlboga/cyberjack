// Free long-hair chains. Rest shape anchors only the scalp; the remaining
// chain settles under gravity and can slide along body capsules and the floor.
export function stepMiraDrape(c,targets,steps,h,colliders,groundY,project){
 const pin=1;
 for(let step=0;step<steps;step++){
  for(let i=0;i<c.p.length;i++){
   if(i<=pin){c.p[i].copy(targets[i]);c.old[i].copy(targets[i]);continue;}
   const p=c.p[i],before=p.clone(),velocity=p.clone().sub(c.old[i]).multiplyScalar(.975);
   p.add(velocity);p.y-=3.2*h*h;c.old[i].copy(before);
  }
  for(let pass=0;pass<8;pass++){
   for(let j=1;j<c.p.length;j++){
    const i=pass%2?c.p.length-j:j,a=c.p[i-1],b=c.p[i],rest=targets[i].distanceTo(targets[i-1]),delta=b.clone().sub(a),length=delta.length();
    if(length>1e-8){const w=i-1<=pin?0:.5;delta.multiplyScalar((length-rest)/length);if(w)a.addScaledVector(delta,w);if(i>pin)b.addScaledVector(delta,-(1-w));}
   }
   for(let i=pin+1;i<c.p.length;i++){
    const p=c.p[i];for(const shape of colliders)project(p,shape,.012);
    if(Number.isFinite(groundY)&&p.y<groundY+.012){p.y=groundY+.012;c.old[i].x+=(p.x-c.old[i].x)*.12;c.old[i].z+=(p.z-c.old[i].z)*.12;}
   }
  }
 }
}
