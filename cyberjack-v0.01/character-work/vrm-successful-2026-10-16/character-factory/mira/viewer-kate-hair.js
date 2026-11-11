import * as T from 'three';
export const kateHairControls=[['bangLength','Длина чёлки',.55,1.15,.01,.72],['sideLength','Длина боковых прядей',.65,1.35,.01,1],['backLength','Длина сзади',.65,1.35,.01,1],['wave','Изгиб волн',0,1.5,.01,.85],['tipCurl','Завиток кончиков',0,1.5,.01,.65],['lockWidth','Ширина прядей',.6,1.5,.01,1]];
export class KateHair{
 constructor(data){this.data=data;this.group=new T.Group();this.group.name='Kate · reconstructed VRoid guides';this.group.position.z=.016;this.key='';this.materials=[0,1,2,3].map(i=>new T.MeshStandardMaterial({color:0xc66b38,roughness:.67,side:T.DoubleSide,vertexColors:true}));}
 apply(s){const key=JSON.stringify(kateHairControls.map(([k,,,,,v])=>s[k]??v));if(key!==this.key){this.key=key;this.rebuild(s);}for(const m of this.materials)m.color.set(s.color==='#ffffff'?'#c66b38':s.color);}
 rebuild(s){for(const m of [...this.group.children]){m.geometry.dispose();this.group.remove(m);}const v=k=>s[k]??kateHairControls.find(c=>c[0]===k)[5];
 this.data.snowStrands.forEach((strand,i)=>{
  const bangs=strand.group==='bangs',length=bangs?v('bangLength'):v(strand.group==='sides'?'sideLength':'backLength'),raw=strand.points.map(p=>new T.Vector3(p[0]*.72,-p[2]*.72-.016,p[1]*.68));
  const root=raw[0].clone(),guide=this.data.waveGuides[i%this.data.waveGuides.length],sign=Math.sign(raw.at(-1).x)||1;
  const points=raw.map((p,j)=>{const t=j/(raw.length-1);if(bangs){p.z=root.z+(p.z-root.z)*length;p.x+=sign*(.009*Math.sin(Math.PI*t)+.005*t*t);p.z+=.006*Math.sin(i*1.9)*t*t;}
   else {const end=raw.at(-1).z,extension=(-.145*length*(.78+.035*(Math.floor(i/2)%7))-end)*t*t;p.z+=extension;
    const f=t*(guide.length-1),a=Math.floor(f),b=Math.min(a+1,guide.length-1),g=guide[a].map((x,k)=>x*(1-f+a)+guide[b][k]*(f-a)),linear=guide[0][0]*(1-t)+guide.at(-1)[0]*t;
    p.x+=sign*(.032*v('wave')*Math.sin(t*Math.PI*4)*Math.sin(Math.PI*t/2)+Math.min(.018,Math.max(-.018,(g[0]-linear)*.12))*Math.sin(Math.PI*t));
    const curl=Math.max(0,(t-.72)/.28);p.x+=sign*(.018*v('tipCurl')*Math.sin(curl*Math.PI*1.5));p.z+=.012*v('tipCurl')*(1-Math.cos(curl*Math.PI*1.5));if(p.z<.045&&strand.group==='sides')p.x=sign*Math.max(Math.abs(p.x),.082+.016*Math.sin(Math.PI*t));if(strand.group==='back'&&t>.35)p.y=Math.max(p.y,.038+.012*Math.sin(Math.PI*t));p.y+=.008*v('wave')*Math.sin(t*Math.PI*3+i*.3)*t;
   }return p;});
  const curve=new T.CatmullRomCurve3(points,false,'centripetal'),pos=[],uv=[],colors=[],idx=[],rows=48,cols=10;
  for(let r=0;r<=rows;r++){const t=r/rows,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize(),normal=new T.Vector3(p.x,p.y+.016,Math.max(0,p.z-.05)).normalize();normal.addScaledVector(tangent,-normal.dot(tangent)).normalize();if(normal.lengthSq()<.1)normal.set(0,-1,0);const across=new T.Vector3().crossVectors(tangent,normal).normalize(),taper=Math.max(.018,Math.pow(Math.sin(Math.PI*(.08+.92*t)),.75)),width=Math.max(.005,Math.min(.026,strand.width*.72))*v('lockWidth')*taper;
   for(let c=0;c<=cols;c++){const a=c/cols*Math.PI*2,q=p.clone().addScaledVector(across,Math.cos(a)*width*.5).addScaledVector(normal,Math.sin(a)*width*.09);pos.push(...q.toArray());uv.push(c/cols,t);const shade=.72+.28*Math.pow(Math.max(0,Math.sin(a)),.6),streak=.94+.06*Math.cos(c/cols*Math.PI*8);colors.push(shade*streak,shade*streak,shade*streak);if(r<rows&&c<cols){const x=r*(cols+1)+c,y=x+cols+1;idx.push(x,y,x+1,x+1,y,y+1);}}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();const mesh=new T.Mesh(g,this.materials[i%4]);mesh.name=strand.group+' '+i;this.group.add(mesh);
 });
 }
}
