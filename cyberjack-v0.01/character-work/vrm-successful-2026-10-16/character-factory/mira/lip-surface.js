import {guideDelta} from './lip-guides.js';
// Standalone parametric mouth prototype. Coordinates are metres, +Z is forward.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const g=(x,c,w)=>Math.exp(-Math.pow((x-c)/w,2));
export const lipDefaults={upperFullness:1,lowerFullness:1,seamBow:.55,seamCentre:-.2,fullnessWidth:.62,cornerMass:.025,taperSharpness:4,width:21,upperHeight:4.5,lowerHeight:6.7,bow:1.2,bowSpacing:.3,upperCentre:1,upperSides:1,upperSpread:.24,lowerMass:1,lowerSpacing:.22,lowerSpread:.3,roundness:.35,cornerLift:.2,seamDepth:.7};
export const lipFields=[['upperFullness','Ширина объёма верхней губы',.65,1.35,.01],['lowerFullness','Ширина объёма нижней губы',.65,1.35,.01],['seamBow','Изгиб смыкания у пиков, мм',-.8,1.5,.02],['seamCentre','Изгиб смыкания в центре, мм',-.8,.8,.02],['fullnessWidth','Ширина полной центральной зоны',.35,1,.01],['cornerMass','Остаточная полнота у уголков',0,.3,.005],['taperSharpness','Резкость сужения к уголкам',2,8,.1],['width','Полуширина рта, мм',17,31,.2],['upperHeight','Высота верхней губы, мм',1.5,6,.1],['lowerHeight','Высота нижней губы, мм',2,8,.1],['bow','Высота пиков, мм',0,3,.05],['bowSpacing','Расстояние пиков от центра',.15,.55,.01],['upperCentre','Центральный бугорок',0,2,.02],['upperSides','Боковые массы верхней губы',0,2,.02],['upperSpread','Ширина боковых масс',.12,.45,.01],['lowerMass','Объём двух масс нижней губы',0,2,.02],['lowerSpacing','Разделение нижних масс',.05,.45,.01],['lowerSpread','Ширина нижних масс',.15,.5,.01],['roundness','Округлость сечения',0,1,.01],['cornerLift','Подъём уголков',-.8,1,.02],['seamDepth','Углубление смыкания',0,1.5,.02]];
export function lipSample(u,t,band,p=lipDefaults,e={}){
 u=clamp(u,-1,1);t=clamp(t,0,1);
 const happy=clamp(e.happy||0,0,1),aa=clamp(e.aa||0,0,1),ou=clamp(e.ou||0,0,1),span=Math.sqrt(Math.max(0,1-u*u)),centre=g(u,0,.2),peaks=g(Math.abs(u),p.bowSpacing,.2);
 const seam=((p.seamBow??.55)*.001*peaks+(p.seamCentre??-.2)*.001*centre+p.cornerLift*.001*u*u)*span+.005*happy*Math.abs(u)**1.7;
 const open=(.00008+.0015*happy+.014*aa+.009*ou)*span;
 const seamY=seam+(band==='upper'?open*(.18+.30*ou):-open*(.82-.30*ou));
 const envelope=(p.cornerMass??.025)+(1-(p.cornerMass??.025))*Math.exp(-Math.pow(Math.abs(u)/((p.fullnessWidth??.62)*(band==='upper'?(p.upperFullness??1):(p.lowerFullness??1))),p.taperSharpness??4));
 const height=envelope*(band==='upper'?(p.upperHeight+p.bow*peaks-.35*p.bow*centre):p.lowerHeight)*(1-.35*happy*Math.abs(u))*(1+.25*ou)*span*.001;
 const exponent=2/(2+.8*p.roundness),angle=Math.PI*t,c=-Math.cos(angle),s=Math.sin(angle),v=.03*t+.97*(1+Math.sign(c)*Math.abs(c)**exponent)/2;
 // Three upper masses and two lower masses; their influence vanishes at corners.
 const mass=band==='upper'?.65*p.upperCentre*g(u,0,.19)+.7*p.upperSides*(g(u,-.38,p.upperSpread)+g(u,.38,p.upperSpread)):.85*p.lowerMass*(g(u,-p.lowerSpacing,p.lowerSpread)+g(u,p.lowerSpacing,p.lowerSpread));
 const depth=(band==='upper'?.003:.0035)*mass*span*envelope*(1+.3*ou)/(1+.22*happy);
 const z=(1-v)*(.0012-.0006*p.seamDepth)*span*envelope+depth*Math.max(0,s)**exponent+.0055*ou*span;
 const d=guideDelta(u,t,band,p.guides,e),contact=guideDelta(u,0,band,p.guides,e),rawY=seamY+(band==='upper'?1:-1)*height*v+d[1];
 const y=band==='upper'?Math.max(seamY+contact[1]+t*.000001*span,rawY):Math.min(seamY+contact[1]-t*.000001*span,rawY);
 return [u*p.width*.001*(1+.22*happy-.55*ou-.06*aa)+d[0],y,z+d[2]];
}
export function lipGeometry(p,e,band,nu=80,nt=20){const positions=[],indices=[],uv=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nt;j++){const u=-1+2*i/nu,t=j/nt;positions.push(...lipSample(u,t,band,p,e));uv.push(i/nu,j/nt);}for(let i=0;i<nu;i++)for(let j=0;j<nt;j++){const a=i*(nt+1)+j,b=a+nt+1;if(band==='upper')indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}return{positions,indices,uv};}
export function mouthCavity(p,e,nu=80){const positions=[],indices=[];for(let i=0;i<=nu;i++){const u=-1+2*i/nu;for(const band of ['upper','lower']){const q=lipSample(u,0,band,p,e);q[2]-=.00035;positions.push(...q);}}for(let i=0;i<nu;i++){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}return{positions,indices};}

// Two halves of an annulus: the inner row is exactly the lip's outer edge.
// Outer boundary is a fixed facial patch; expression motion fades across the skin.
export function mouthSkin(p,e,band,nu=80,nr=18){
 const positions=[],indices=[],uv=[];
 for(let i=0;i<=nu;i++){
  const u=-1+2*i/nu,edge=lipSample(u,1,band,p,e),near=lipSample(u,.96,band,p,e),sign=band==='upper'?1:-1;
  const outer=[u*.052,sign*.033*Math.sqrt(Math.max(0,1-u*u)),-.004-.005*u*u];
  const distance=Math.hypot(outer[0]-edge[0],outer[1]-edge[1]);
  const lipDistance=Math.hypot(edge[0]-near[0],edge[1]-near[1]);
  const slope=clamp((edge[2]-near[2])/Math.max(.00001,lipDistance),-1.2,1.2);
  for(let j=0;j<=nr;j++){
   const r=j/nr,s=r*r*(3-2*r),z=edge[2]*(1-s)+outer[2]*s+slope*Math.min(distance,.003)*r*(1-r)*(1-r);
   positions.push(edge[0]+(outer[0]-edge[0])*r,edge[1]+(outer[1]-edge[1])*r,z);uv.push(i/nu,r);
  }
 }
 for(let i=0;i<nu;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=a+nr+1;if(band==='upper')indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}
 return {positions,indices,uv};
}
