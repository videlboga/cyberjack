import {Vector3} from 'three';
const point=(pose,mixer,name)=>new Vector3().setFromMatrixPosition(pose[mixer.index.get('cf_j_'+name)].world);
export function armMetrics(pose,mixer,side){
 const p=n=>point(pose,mixer,n+'_'+side),shoulder=p('arm00'),elbow=p('forearm01'),hand=p('hand');
 return {height:hand.y,relativeHeight:hand.y-shoulder.y,upperElevation:Math.asin(Math.max(-1,Math.min(1,elbow.clone().sub(shoulder).normalize().y)))*180/Math.PI,elbowBend:elbow.clone().sub(shoulder).angleTo(hand.clone().sub(elbow))*180/Math.PI};
}
// A command describes a change from this base, not an absolute above-head category.
export function armRaised(result,mixer,sides,height){return sides.every(side=>{
 const b=armMetrics(result.base,mixer,side),m=armMetrics(result.mixed,mixer,side);
 return m.height-b.height>height*.03&&m.relativeHeight-b.relativeHeight>height*.03&&(m.upperElevation-b.upperElevation>5||b.elbowBend-m.elbowBend>8);
})}
