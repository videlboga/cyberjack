export const mouthCurveControls=[['Контуры рта','mouthCurve_rolls','Валики губ'],['Контуры рта','mouthCurve_binding','Привязка к краям сетки']];
for(const band of ['upper','seam','lower'])for(let i=1;i<6;i++)mouthCurveControls.push(['Контуры рта',`mouthCurve_${band}_${i}`,`${band} ${i}`]);
for(const band of ['upper','lower'])mouthCurveControls.push(['Контуры рта',`mouthCurve_depth_${band}`,`Профиль ${band}`]);
export const curveNodes=[-1,-2/3,-1/3,0,1/3,2/3,1];
// Cubic smoothstep segments remain inside adjacent knot values (no overshoot).
export function mouthCurve(values,band,u){const t=Math.max(0,Math.min(6,(u+1)*3)),i=Math.min(5,Math.floor(t)),f=t-i,w=f*f*(3-2*f),v=k=>k===0||k===6?0:Number(values[`mouthCurve_${band}_${k}`]||0);return v(i)*(1-w)+v(i+1)*w;}
export function curveMouth(point,values){
 const [x,y,z]=point,u=x/.018;if(Math.abs(u)>=1||z<=.058)return Array.from(point);
 const span=Math.sqrt(1-u*u),seam=1.4355+.00035*u*u,dy=y-seam,h=(dy>=0?.0073:.0093)*span,d=Math.abs(dy),end=.025*span;
 if(d>=end)return Array.from(point);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},front=smooth((z-.058)/.005),s=mouthCurve(values,'seam',u)*.002*span;
 const band=dy>=0?'upper':'lower',raw=mouthCurve(values,band,u)*.002*span;
 // Keep the requested outer contours on their respective side of the seam.
 const edge=dy>=0?Math.max(raw,s-h+.001*span):Math.min(raw,s+h-.001*span),t=Math.min(1,d/h),offset=(s*(1-t)+edge*t)*(d<=h?1:1-smooth((d-h)/(end-h)));
 const depth=Number(values[`mouthCurve_depth_${band}`]||0)*.0015*span*Math.sin(Math.PI*t)**2*(d<=h?1:0);
 return [x,y+offset*front,z+depth*front];
}
