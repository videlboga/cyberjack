// Experimental regional skinning, not a reconstruction of individual tarsal bones.
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function createMidfootDeformer(data){
 let restRef=null,bindings=null;
 function fit(rest){
  if(rest.length!==data.vertexCount*3)throw Error('Midfoot topology mismatch');
  const at=id=>Array.from(rest.slice(id*3,id*3+3));
  const mean=ids=>mul(ids.reduce((s,id)=>add(s,at(id)),[0,0,0]),1/ids.length);
  bindings=data.feet.map(f=>{
   const heel=mean(f.heel),ball=mean(f.ball),forward=sub(ball,heel),length=Math.hypot(...forward),axis=mul(forward,1/length);
   if(!Number.isFinite(length)||length<.01)throw Error('Degenerate midfoot binding');
   // The pivot/transition are a skinning approximation; surface regions are not bone centers.
   const pivot=add(heel,mul(forward,.55));
   const weight=p=>smooth((dot(sub(p,heel),axis)/length-.3)/.6);
   return {...f,heel,ball,axis,pivot,weight,rows:f.ids.map(id=>({id,w:weight(at(id))}))};
  });restRef=rest;
 }
 function binding(rest){if(restRef!==rest||!bindings)fit(rest);return bindings;}
 function rotate(p,b,degrees,w){
  const v=sub(p,b.pivot),a=degrees*Math.PI/180*w,c=Math.cos(a),s=Math.sin(a),u=b.axis,d=dot(u,v),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  return add(b.pivot,v.map((x,k)=>x*c+cross[k]*s+u[k]*d*(1-c)));
 }
 const validate=a=>{for(const side of ['left','right'])if(!Number.isFinite(a[side]??0)||Math.abs(a[side]??0)>8)throw Error('Midfoot twist outside experiment range');};
 return {invalidate(){bindings=null;restRef=null;},
  inspectBinding(rest){return binding(rest).map(({side,heel,ball,axis,pivot})=>({side,heel:[...heel],ball:[...ball],axis:[...axis],pivot:[...pivot]}));},
  apply(rest,source,out,angles={}){validate(angles);if(source.length!==rest.length||out.length!==rest.length)throw Error('Midfoot topology mismatch');out.set(source);for(const b of binding(rest)){const a=angles[b.side]??0;if(!a)continue;for(const {id,w}of b.rows){if(!w)continue;const i=id*3,x=source[i]-b.pivot[0],y=source[i+1]-b.pivot[1],z=source[i+2]-b.pivot[2],u=b.axis,theta=a*Math.PI/180*w,c=Math.cos(theta),s=Math.sin(theta),v=u[0]*x+u[1]*y+u[2]*z;out[i]=b.pivot[0]+x*c+(u[1]*z-u[2]*y)*s+u[0]*v*(1-c);out[i+1]=b.pivot[1]+y*c+(u[2]*x-u[0]*z)*s+u[1]*v*(1-c);out[i+2]=b.pivot[2]+z*c+(u[0]*y-u[1]*x)*s+u[2]*v*(1-c);}}return out;},
  mapPoint(rest,point,side,angle=0){validate({[side]:angle});const b=binding(rest).find(b=>b.side===side);if(!b)throw Error('Unknown foot');return rotate(point,b,angle,b.weight(point));}
 };
}
