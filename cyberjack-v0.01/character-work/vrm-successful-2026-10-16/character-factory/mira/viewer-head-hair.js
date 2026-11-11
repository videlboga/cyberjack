import {installHeadTailFollow} from './viewer-head-tail-follow.js?v=1';
import {installHeadSecondary} from './viewer-head-secondary.js?v=iona17';
import * as T from 'three';
import {MeshSurfaceCollider} from './mesh-surface-collider.js';
import {strandGeometry} from './viewer-hair-geometry.js?v=mika30';
import {mergeGeometries} from './vendor/three/utils/BufferGeometryUtils.js';
import {libraryHeadStrands,libraryCrownStrands} from './assets/hair/vroid-builtin/library-head-source.js?v=2';
// Native Back-144 brush paths, native closed sections and the same material
// as Front-031. Only their free ends converge at the existing tail socket.
export function buildGatheredHeadHair(anchor,headMesh,seamNodes=null){
 anchor.updateWorldMatrix(true,true);headMesh.updateWorldMatrix(true,false);
 const matrix=new T.Matrix4().copy(anchor.matrixWorld).invert().multiply(headMesh.matrixWorld),box=new T.Box3(),v=new T.Vector3(),attribute=headMesh.geometry.attributes.position;
 for(let i=0;i<attribute.count;i++)box.expandByPoint(v.fromBufferAttribute(attribute,i).applyMatrix4(matrix));
 const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const seat=new T.Vector3(center.x,center.y+size.y*.53*.94,center.z-size.z*.51*.48);
 const nativeGroup=anchor.getObjectByName('Библиотека волос');
 const nativeMatrix=nativeGroup?new T.Matrix4().copy(anchor.matrixWorld).invert().multiply(nativeGroup.matrixWorld):new T.Matrix4();
 const nativeSeat=seat.clone().applyMatrix4(nativeMatrix.clone().invert());
 const end=[nativeSeat.x/.72,nativeSeat.z/.72,-(nativeSeat.y+.016)/.72];
 const surface=new MeshSurfaceCollider().update(attribute.array,headMesh.geometry.index.array,matrix),inverseNative=nativeMatrix.clone().invert();
 const fitPoint=(p,snap=false)=>{if(p[1]<-.02)return p;const q=new T.Vector3(p[0]*.72,-p[2]*.72-.016,p[1]*.72).applyMatrix4(nativeMatrix),dir=q.clone().sub(center),length=dir.length();if(length<1e-8)return p;dir.multiplyScalar(1/length);const origin=center.clone().addScaledVector(dir,size.length()*2),hit=surface.intersections(origin,dir.clone().negate())[0];if(hit){const radius=origin.distanceTo(center)-hit.distance+.003;if(length<radius||(snap&&p[1]>.16&&p[2]<.035)){q.copy(center).addScaledVector(dir,radius).applyMatrix4(inverseNative);return [q.x/.72,q.z/.72,-(q.y+.016)/.72];}}return p;};
 const pieces=[];
 for(const [sourceIndex,source] of libraryHeadStrands.entries()){
  const nativeEnd=source.points.at(-1),sideFrame=sourceIndex===0||sourceIndex===50;
  if(sideFrame){
   const side=Math.sign(nativeEnd[0]),long=side<0;
   const points=source.points.map((p,i)=>{const q=fitPoint([...p]),t=i/(source.points.length-1),f=T.MathUtils.smoothstep(t,.35,1);
    q[1]-=(long?.09:.035)*f;
    q[0]+=side*(.008*Math.sin(Math.PI*f)-.020*f*f);
    q[2]+=.018*Math.sin(Math.PI*f)-.010*f*f;
    return q;});
   pieces.push(strandGeometry({...source,points,width:source.width*(long?1.45:1.05),sectionDepth:.07}, {tipTaper:.55}).applyMatrix4(nativeMatrix));pieces.at(-1).userData.seam=false;continue;
  }

  if(sourceIndex>36)continue;
  // Broad interleaved locks sweep from the part into the existing tail socket.
  // Keeping the source's low bob ends produced a separate fan above the tie.
  const lock=sourceIndex-1,primary=lock<18,lane=lock%18;
  const jitter=.028*Math.sin(lane*2.31);
  const angle=-1.58+3.16*lane/17+(primary?-.035:.045)+jitter;
  const startPhi=.07+.14*(.5+.5*Math.sin(lane*1.71+(primary?0:2)));
  const points=Array.from({length:24},(_,i)=>{
   const t=i/23,phi=startPhi+(1.855-startPhi)*t;
   const sweep=.20*Math.sin(Math.PI*t)*(.55+.45*Math.sin(lane*.63));
   const a=angle+sweep;
   const lift=(primary?.0015:.003)*Math.sin(Math.PI*t);
   return [(.12+lift)*Math.sin(a)*Math.sin(phi),.075+.145*Math.cos(phi),.025-(.12+lift)*Math.cos(a)*Math.sin(phi)];
  });
  points[0]=[.006*Math.sin(lane*1.73),.220,.025];
  const last=points.at(-1),socket=[end[0]+last[0]*.12,end[1]-.028,end[2]-.020];
  points.push(last.map((x,k)=>x*.65+socket[k]*.35),last.map((x,k)=>x*.3+socket[k]*.7),socket,[socket[0]*.75,socket[1]-.035,socket[2]-.016]);
  const normals=points.map(p=>new T.Vector3(p[0],p[1]-.075,p[2]-.04).normalize().toArray());
  const widthCurve=[[0,.22],[.18,.85],[.42,1],[.72,.88],[1,.42]];

  const strand={...source,points,normals,widthCurve,width:(primary?.040:.021)*(1+.20*Math.sin(lane*2.4)),sectionDepth:.055};
  pieces.push(strandGeometry(strand,{tipTaper:0}).applyMatrix4(nativeMatrix));pieces.at(-1).userData.strandWidth=.036;pieces.at(-1).userData.backFacing=true;
 }
 const backCount=pieces.length,frontRoots=[];
 // Complete native crown-to-fringe paths retain their original taper;
 // cutting them at the crown turned the ends into overlapping leaf shapes.
 for(const [crownIndex,source] of libraryCrownStrands.entries()){
  const endPoint=source.points.at(-1),temple=endPoint[1]<.04&&Math.abs(endPoint[0])>.06;
  const points=source.points.map((p,pointIndex)=>{const q=[...p];
   // Seat the outer temple paths along the skull before building their sections.
   // Their original bob arc and inflated roots formed two shelves above the ears.
   const templeArc=T.MathUtils.smoothstep(Math.abs(p[0]),.045,.085)*(1-T.MathUtils.smoothstep(p[1],.16,.24));
   q[0]*=1-.22*templeArc;
   q[1]-=.018*templeArc;
   const fitted=fitPoint(q);q.splice(0,3,...fitted);
   const side=T.MathUtils.smoothstep(Math.abs(p[0]),.055,.09),low=1-T.MathUtils.smoothstep(p[1],.04,.15);
   const tuck=side*low*(p[0]>0?1:.25);q[2]-=.085*tuck;q[0]*=1-.10*tuck;
   if(temple){const f=1-T.MathUtils.smoothstep(p[1],.015,.085);q[2]-=.055*f;q[1]-=.045*f;q[0]*=1-.12*f;}

   if(crownIndex===3){const tip=T.MathUtils.smoothstep(pointIndex/(source.points.length-1),.35,.80);q[2]+=.003*tip;q[0]+=.030*tip;}
   // Preserve the accepted tuck, but keep its lower section beside the face.
   // The original inward width reduction placed the temple ribbons in the skin.
   const faceBand=(1-T.MathUtils.smoothstep(q[1],.09,.15))*T.MathUtils.smoothstep(q[1],-.06,.015);
   if(temple)q[0]+=Math.sign(q[0])*Math.max(0,.108-Math.abs(q[0]))*faceBand;
   else q[2]+=.012*(1-T.MathUtils.smoothstep(q[1],.13,.18))*T.MathUtils.smoothstep(q[1],.005,.035);
   return q;});
  frontRoots.push(new T.Vector3(...points[0]));
  pieces.push(strandGeometry({...source,points,widthCurve:source.widthCurve?.map(([t,w])=>[t,w*(1+1.1*(1-T.MathUtils.smoothstep(t,0,.38)))*(temple?1-.3*T.MathUtils.smoothstep(t,.35,.7):1)])},{strandWidth:temple?1.18:1.35,tipTaper:temple?.7:0}).applyMatrix4(nativeMatrix));
 }
 // Match the gathered roots and their forward outline to the actual fringe,
 // leaving the rear volume and the tail socket unchanged.
 const root=frontRoots.reduce((sum,p)=>sum.add(p),new T.Vector3()).multiplyScalar(1/frontRoots.length);
 for(const g of pieces.slice(0,backCount)){
  if(g.userData.seam===false)continue;
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){
   const q=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(inverseNative),p=[q.x/.72,q.z/.72,-(q.y+.016)/.72];
   const upper=T.MathUtils.clamp((p[1]-.02)/.20,0,1);
   const widthWeight=T.MathUtils.smoothstep(p[1],.015,.11);
   const crown=T.MathUtils.smoothstep(p[1],.17,.22);
   p[0]*=1-.025*widthWeight;
   p[0]+=root.x*upper*(1-T.MathUtils.smoothstep(Math.abs(p[0]),.01,.065));
   p[1]+=(root.y-.220)*crown+.007*widthWeight*(1-crown);p[2]+=(root.z-.025)*crown;
   q.set(p[0]*.72,-p[2]*.72-.016,p[1]*.72).applyMatrix4(nativeMatrix);a.setXYZ(i,q.x,q.y,q.z);
  }
  g.computeVertexNormals();
 }
 // Keep the gathered structure inside the skull width; library locks cover it.
 let rearHalf=0;
 for(const g of pieces.slice(0,backCount))if(g.userData.seam!==false)
  for(let i=0;i<g.attributes.position.count;i++)rearHalf=Math.max(rearHalf,Math.abs(g.attributes.position.getX(i)-center.x));
 const rearScale=T.MathUtils.clamp(size.x*.43/rearHalf,.65,.92);
 for(const g of pieces.slice(0,backCount))if(g.userData.seam!==false){
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){
   const q=new T.Vector3().fromBufferAttribute(a,i),n=q.clone().applyMatrix4(inverseNative);
   const weight=T.MathUtils.smoothstep(n.z/.72,.025,.10);
   a.setX(i,center.x+(q.x-center.x)*T.MathUtils.lerp(1,rearScale,weight));
  }
  g.computeVertexNormals();
 }
 const overlays=[];
 for(const [i,source] of libraryHeadStrands.entries()){
  if(i===0||i===50)continue;
  const stagger=.5+.5*Math.sin(i*2.399+source.width*19);
  const cut=source.points.findIndex(p=>p[1]<.008+.022*stagger);
  const points=source.points.slice(0,cut<0?source.points.length:Math.max(3,cut)).map(p=>{
   const q=fitPoint([...p]);
   q[1]+=.004;
   const lower=1-T.MathUtils.smoothstep(q[1],.025,.13);
   q[0]+=.012*Math.sin(i*1.73)*lower;
   q[2]-=.006*lower;
   return q;
  });
  if(points.length<3)continue;
  const last=points.at(-1);
  const target=[end[0]+last[0]*.12+.006*Math.sin(i*1.37),end[1]-.040-.016*stagger,end[2]-.025];
  // Follow the gathered locks inward: the tapered ends finish inside the tail,
  // at different depths rather than forming a visible straight fringe.
  points.push(last.map((x,k)=>x*.62+target[k]*.38),last.map((x,k)=>x*.25+target[k]*.75),target);
  const normals=points.map((p,k)=>source.normals?.[Math.min(k,source.normals.length-1)]||new T.Vector3(p[0],p[1]-.075,p[2]-.04).normalize().toArray());
  overlays.push(strandGeometry({...source,points,normals}, {strandWidth:1.12,tipTaper:.9}).applyMatrix4(nativeMatrix));
 }
 const backStrips=pieces.slice(0,backCount).filter(g=>g.userData.seam!==false).map(g=>({positions:Array.from(g.attributes.position.array),normals:Array.from(g.attributes.normal.array),width:g.userData.strandWidth||.08,backFacing:g.userData.backFacing}));
 const visible=pieces.filter((g,i)=>i>=backCount||g.userData.seam===false);
 const geometry=mergeGeometries(visible,false);
 const material=new T.MeshStandardMaterial({color:'#82708e',roughness:.72,side:T.DoubleSide});
 const mesh=new T.Mesh(geometry,material);mesh.name='Иона · Back-144 до затылочного сбора';mesh.userData.sourcePreset='N00-Back-144';anchor.add(mesh);const overlayMesh=new T.Mesh(mergeGeometries(overlays,false),material);overlayMesh.name='Иона · библиотечные пряди поверх затылка';mesh.add(overlayMesh);const updateTail=installHeadTailFollow(overlayMesh,overlays,seat,seamNodes);const updateGathered=installHeadSecondary(overlayMesh,overlays,overlays.length,seamNodes||[seat.clone(),seat.clone(),seat.clone()],seat,{gathered:true});for(const g of overlays)g.dispose();const updateFront=installHeadSecondary(mesh,visible,visible.length-(pieces.length-backCount),seamNodes||[seat.clone(),seat.clone(),seat.clone()],seat,{faceClearance:true});const update=(dt,colliders)=>{updateFront(dt,colliders);updateGathered(dt,colliders);};for(const g of pieces)g.dispose();return {mesh,seat,center:center.clone(),update,updateTail,backStrips,fitEdge(q,padding=0){return q.addScaledVector(q.clone().sub(center).normalize(),padding);}};
}
