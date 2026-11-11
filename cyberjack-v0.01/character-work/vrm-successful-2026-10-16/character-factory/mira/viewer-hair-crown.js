import * as T from 'three';
// A continuous scalp surface avoids overlapping ribbon roots on the crown.
export function crownGeometry(edit={},coverage=false){
 const pos=[],uv=[],ix=[],rows=32,cols=128;
 for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
  const a=c/cols*Math.PI*2,front=Math.max(0,Math.cos(a)),limit=coverage?2.10-1.72*Math.pow(front,2):1.48-1.10*Math.pow(front,2),theta=r/rows*limit;
  const groove=.0045*Math.cos(a*12+theta*2.2)*Math.sin(theta)**1.1;
  const x=.006*Math.cos(theta)**2+(.113+groove)*Math.sin(theta)*Math.sin(a),y=.085+(.129+groove)*Math.cos(theta)-.004*Math.cos(a)**2*Math.cos(theta)**2,z=(.030*Math.cos(theta)**2+(.120+groove)*Math.sin(theta))*Math.cos(a);
  pos.push(x*.72*(edit.volume??1),-z*.72*(edit.volume??1)-.016,(.213+(y-.213)*(edit.length??1))*.72);uv.push(c/cols,r/rows);
  if(r<rows&&c<cols){const k=r*(cols+1)+c,n=k+cols+1;ix.push(k,n,k+1,k+1,n,n+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
