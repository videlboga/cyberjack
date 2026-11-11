import * as T from 'three';
export function strandGeometry(strand,edit={}){
 // VRoid stores Y-up brush paths relative to the head. Convert to our Z-up attachment.
 const original=strand.points.map(p=>new T.Vector3(p[0]*.72,-p[2]*.72-.016,p[1]*.72)),anchor=original[0];
 const pts=original.map((p,i)=>{const t=i/(original.length-1),q=p.clone().sub(anchor);q.z*=edit.length??1;q.x*=edit.volume??1;q.y*=edit.volume??1;q.add(anchor);const sign=Math.sign(anchor.x)||1;q.x+=sign*(edit.wave||0)*.025*Math.sin(t*Math.PI*4)*t*t;q.y+=(edit.wave||0)*.012*Math.sin(t*Math.PI*3)*t*t;const curl=Math.max(0,(t-.65)/.35);q.x+=sign*(edit.curl||0)*.025*(1-Math.cos(curl*Math.PI));q.z+=(edit.curl||0)*.018*Math.sin(curl*Math.PI);return q;});
 const curve=new T.CatmullRomCurve3(pts,false,'centripetal'),rows=Math.min(80,Math.max(16,pts.length*3)),cols=12,pos=[],uv=[],index=[];
 function widthAt(t){const keys=strand.widthCurve;if(!keys?.length)return Math.max(.015,Math.sin(Math.PI*(.03+.97*t)));let a=keys[0];for(const b of keys.slice(1)){if(t<=b[0])return Math.max(.004,T.MathUtils.lerp(a[1],b[1],T.MathUtils.smoothstep(t,a[0],Math.max(a[0]+.0001,b[0]))));a=b;}return Math.max(.004,a[1]);}
 // Transport the section along the curve; native surface normals anchor its roll.
 const nativeNormals=strand.normals?.map(n=>new T.Vector3(n[0],-n[2],n[1]).normalize());
 let across=new T.Vector3(1,0,0),previousTangent=null;
 for(let r=0;r<=rows;r++){
  const t=r/rows,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
  let radial;
  if(nativeNormals?.length){const u=t*(nativeNormals.length-1),i=Math.min(nativeNormals.length-2,Math.floor(u));radial=nativeNormals[i].clone().lerp(nativeNormals[i+1],u-i);}
  else radial=new T.Vector3(p.x,p.y+.016,Math.max(.015,p.z-.04));
  radial.addScaledVector(tangent,-radial.dot(tangent));
  if(previousTangent)across.applyQuaternion(new T.Quaternion().setFromUnitVectors(previousTangent,tangent));
  if(radial.lengthSq()>1e-6){const desired=new T.Vector3().crossVectors(tangent,radial.normalize()).normalize();if(r&&desired.dot(across)<0)desired.negate();across=r?across.lerp(desired,.25).normalize():desired;}
  across.addScaledVector(tangent,-across.dot(tangent));
  if(across.lengthSq()<1e-6){across.set(Math.abs(tangent.x)<.8?1:0,Math.abs(tangent.x)<.8?0:1,0);across.addScaledVector(tangent,-across.dot(tangent));}
  across.normalize();previousTangent=tangent.clone();
  const normal=new T.Vector3().crossVectors(across,tangent).normalize(),w=strand.width*.72*widthAt(t)*(edit.strandWidth??1)*T.MathUtils.lerp(1,Math.max(.008,1-T.MathUtils.smoothstep(t,.72,1)),edit.tipTaper??0);
  for(let c=0;c<=cols;c++){const a=c/cols*Math.PI*2,q=p.clone().addScaledVector(across,Math.cos(a)*w*.5).addScaledVector(normal,Math.sin(a)*w*(strand.sectionDepth??.1));pos.push(...q.toArray());uv.push(c/cols,t);if(r<rows&&c<cols){const x=r*(cols+1)+c,y=x+cols+1;index.push(x,y,x+1,x+1,y,y+1);}}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();const normal=g.attributes.normal;for(let r=0;r<=rows;r++){const a=r*(cols+1),b=a+cols,n=new T.Vector3().fromBufferAttribute(normal,a).add(new T.Vector3().fromBufferAttribute(normal,b)).normalize();normal.setXYZ(a,n.x,n.y,n.z);normal.setXYZ(b,n.x,n.y,n.z);}return g;
}
