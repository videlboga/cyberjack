import * as THREE from 'three';

const TAU=Math.PI*2;
function ordered(ids,point){
  const entries=ids.map(id=>({id,p:point(id)})),center=entries.reduce((a,v)=>a.map((x,k)=>x+v.p[k]/entries.length),[0,0,0]);
  for(const v of entries)v.angle=(Math.atan2(v.p[1]-center[1],v.p[0]-center[0])+TAU)%TAU;
  return entries.sort((a,b)=>a.angle-b.angle);
}
function boundaryLoops(index){
  const edges=new Map(),adj=new Map();
  for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){const a=index[i+k],b=index[i+(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}
  for(const [key,n] of edges)if(n===1){const [a,b]=key.split(':').map(Number);for(const [x,y] of [[a,b],[b,a]]){if(!adj.has(x))adj.set(x,[]);adj.get(x).push(y);}}
  const seen=new Set(),loops=[];
  for(const start of adj.keys()){if(seen.has(start))continue;const stack=[start],ids=[];while(stack.length){const i=stack.pop();if(seen.has(i))continue;seen.add(i);ids.push(i);stack.push(...adj.get(i));}loops.push(ids);}
  return loops;
}
function bracket(ring,angle){
  let b=ring.findIndex(v=>v.angle>angle);if(b<0)b=0;const a=(b+ring.length-1)%ring.length;
  let x=ring[a].angle,y=ring[b].angle;if(y<=x)y+=TAU;if(angle<x)angle+=TAU;
  return {a,b,t:(angle-x)/(y-x||1)};
}
const mix=(a,b,t)=>a.map((v,k)=>v*(1-t)+b[k]*t);

export function clipBody(base,indices,plane=1.36){
  const map=[],cache=new Map(),out=[];
  function vertex(a,b=a,t=0){if(a>b){[a,b]=[b,a];t=1-t;}const key=a+':'+b;if(!cache.has(key)){cache.set(key,map.length);map.push({a,b,t});}return cache.get(key);}
  for(let i=0;i<indices.length;i+=3){const poly=[];for(let k=0;k<3;k++){
    const a=indices[i+k],b=indices[i+(k+1)%3],inside=base[a*3+2]<=plane,other=base[b*3+2]<=plane;
    if(inside)poly.push(vertex(a));if(inside!==other)poly.push(vertex(a,b,(plane-base[a*3+2])/(base[b*3+2]-base[a*3+2])));
  }for(let k=1;k<poly.length-1;k++)out.push(poly[0],poly[k],poly[k+1]);}
  const whole=new THREE.BufferGeometry();whole.setAttribute('position',new THREE.BufferAttribute(new Float32Array(base.length),3));whole.setIndex(Array.from(indices));
  const p=new Float32Array(map.length*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));geo.setIndex(out);
  function update(source){whole.attributes.position.array.set(source);whole.computeVertexNormals();const fullNormals=whole.attributes.normal;if(!geo.attributes.normal)geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(p.length),3));const n=geo.attributes.normal;for(let i=0;i<map.length;i++){const {a,b,t}=map[i];for(let k=0;k<3;k++)p[i*3+k]=source[a*3+k]*(1-t)+source[b*3+k]*t;const v=new THREE.Vector3().fromBufferAttribute(fullNormals,a).lerp(new THREE.Vector3().fromBufferAttribute(fullNormals,b),t).normalize();n.setXYZ(i,v.x,v.y,v.z);}geo.attributes.position.needsUpdate=true;n.needsUpdate=true;geo.boundingBox=null;geo.computeBoundingSphere();}
  update(base);const ring=map.map((m,i)=>i).filter(i=>Math.abs(p[i*3+2]-plane)<1e-6);
  return {geometry:geo,map,ring,update,dispose(){geo.dispose();whole.dispose();}};
}
// One body mesh owns the entire neck, from the trapezius to the skull socket.
// The donor contributes only the original head aperture, with no neck geometry.
export class HeadSocket{
  constructor(parent,base,index,mesh,manifest){
    Object.assign(this,{parent,headMesh:mesh});
    const clipped=clipBody(base,index,1.335),guide=clipBody(base,index,1.345),bp=clipped.geometry.attributes.position,gp=guide.geometry.attributes.position;
    const bottom=ordered(clipped.ring,i=>[bp.getX(i),bp.getY(i),bp.getZ(i)]),guideRing=ordered(guide.ring,i=>[gp.getX(i),gp.getY(i),gp.getZ(i)]);
    this.bottom=bottom;this.guideRing=guideRing;this.guideMap=guide.map;this.sourceGeometry=new THREE.BufferGeometry();this.sourceGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(base.length),3));this.sourceGeometry.setIndex(Array.from(index));
    parent.updateWorldMatrix(true,false);parent.updateMatrixWorld(true);mesh.skeleton.update();
    const matrix=parent.matrixWorld.clone().invert().multiply(mesh.matrixWorld),point=new THREE.Vector3();
    this.upper=ordered(manifest.socketRing,i=>mesh.getVertexPosition(i,point).applyMatrix4(matrix).toArray());
    this.N=this.upper.length*4;this.rows=16;this.bodyCount=clipped.map.length;
    this.sourceMap=clipped.map.map(q=>q.a===q.b?[[q.a,1]]:[[q.a,1-q.t],[q.b,q.t]]);
    this.bodySources=new Uint32Array(this.bodyCount*2);this.bodyMix=new Float64Array(this.bodyCount*2);
    for(let i=0;i<this.bodyCount;i++){const map=this.sourceMap[i];this.bodySources[i*2]=map[0][0]*3;this.bodySources[i*2+1]=(map[1]?.[0]??map[0][0])*3;this.bodyMix[i*2]=map[0][1];this.bodyMix[i*2+1]=map[1]?.[1]??0;}
    this.fields=this.sourceMap.map(()=>({w:0}));this.rings=[bottom];let next=this.bodyCount;
    const blendMap=q=>{const m=new Map();for(const [v,amount] of [[bottom[q.a],1-q.t],[bottom[q.b],q.t]])for(const [id,w] of this.sourceMap[v.id])m.set(id,(m.get(id)||0)+amount*w);return [...m];};
    for(let row=1;row<=this.rows;row++){
      const ring=[];for(let i=0;i<this.N;i++){const a=Math.floor(i/4),b=(a+1)%this.upper.length,t=i%4/4,x=this.upper[a].angle,y=b===0?this.upper[b].angle+TAU:this.upper[b].angle,angle=x*(1-t)+y*t,id=next++;
        ring.push({id,angle,a,b,t});this.sourceMap.push(blendMap(bracket(bottom,angle)));this.fields.push({w:(row/this.rows)**2*(3-2*row/this.rows)});
      }this.rings.push(ring);
    }
    this.normalSamples=this.rings[1].map(v=>this.rings[1].flatMap((u,i)=>{const d=Math.atan2(Math.sin(v.angle-u.angle),Math.cos(v.angle-u.angle));return Math.abs(d)<.4?[{i,w:Math.exp(-d*d/(2*.14*.14))}]:[];}));
    this.lower=this.rings.at(-1);this.knots=this.upper.map((_,i)=>i*4);
    this.index=Array.from(clipped.geometry.index.array);this.bridgeIndexStart=this.index.length;
    for(let row=0;row<this.rows;row++){
      const a=this.rings[row],b=this.rings[row+1];let i=0,j=0;
      while(i<a.length||j<b.length){const ai=a[i%a.length].id,bj=b[j%b.length].id,na=i<a.length?(i+1<a.length?a[i+1].angle:a[0].angle+TAU):Infinity,nb=j<b.length?(j+1<b.length?b[j+1].angle:b[0].angle+TAU):Infinity;
        if(na<=nb){this.index.push(ai,a[(i+1)%a.length].id,bj);i++;}else{this.index.push(ai,b[(j+1)%b.length].id,bj);j++;}
      }
    }
    this.positions=new Float32Array(next*3);this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setIndex(this.index);this.geometry.userData.ribbonNeck={root:this.bottom.map(v=>v.id),top:this.lower.map(v=>v.id)};
    const contactShell=new Float32Array(next);for(let i=0;i<this.bodyCount;i++){let z=0,y=0;for(const [id,w] of this.sourceMap[i]){z+=base[id*3+2]*w;y+=base[id*3+1]*w;}const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);},rear=smooth(.005,.065,y),lumbar=smooth(.81,.94,z)*(1-smooth(1.15,1.29,z)),neck=smooth(1.30,1.42,z);contactShell[i]=rear*Math.max(.010*lumbar,.006*neck);}for(let i=this.bodyCount;i<next;i++)contactShell[i]=.006;this.geometry.setAttribute('hairContactOffset',new THREE.BufferAttribute(contactShell,1));
    this.originalHeadNormals=mesh.geometry.attributes.normal.array.slice();const hp=mesh.geometry.attributes.position;this.headDuplicates=this.upper.map(v=>{const ids=[];for(let i=0;i<hp.count;i++)if(new THREE.Vector3().fromBufferAttribute(hp,v.id).distanceTo(new THREE.Vector3().fromBufferAttribute(hp,i))<1e-6)ids.push(i);return ids;});
    // The bridge must meet the actual jaw surface, not a fixed vertical axis.
    const boundary=new Set(this.headDuplicates.flat()),ix=mesh.geometry.index.array;
    this.headInterior=this.headDuplicates.map(ids=>{const set=new Set(),own=new Set(ids);for(let t=0;t<ix.length;t+=3)if(own.has(ix[t])||own.has(ix[t+1])||own.has(ix[t+2]))for(let k=0;k<3;k++)if(!boundary.has(ix[t+k]))set.add(ix[t+k]);return [...set];});
    clipped.dispose();guide.dispose();
  }
  deformSource(source,neckWidth=1,selectedOnly=false){
    if(Math.abs(neckWidth-1)<1e-8){this.gpuBody?.setNeck([0,0,0],1);return source;}
    const out=source.slice(),center=[0,0,0];
    for(const v of this.bottom){for(const [id,w]of this.sourceMap[v.id])for(let k=0;k<3;k++)center[k]+=source[id*3+k]*w/this.bottom.length;}
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    this.gpuBody?.setNeck(center,neckWidth);
    const ids=selectedOnly?this.gpuBody?.selected:null,count=ids?ids.length:out.length/3;
    for(let vertex=0;vertex<count;vertex++){const i=(ids?ids[vertex]:vertex)*3;
      const dx=source[i]-center[0],dy=source[i+1]-center[1],radius=Math.hypot(dx,dy);
      // Include the body-owned root. Keep the clavicles and chest outside the
      // field; the generated neck and skull aperture share the same ratio.
      const vertical=smooth((source[i+2]-(center[2]-.055))/.055),local=1-smooth((radius-.075)/.045),factor=1+(neckWidth-1)*vertical*local;
      out[i]=center[0]+dx*factor;out[i+1]=center[1]+dy*factor;
    }
    return out;
  }
  fit(source,headPoints,headAxis=[0,0,1],headTangents=null,neckWidth=1,deformed=false){
    if(!deformed)source=HeadSocket.prototype.deformSource.call(this,source,neckWidth);
    const out=this.gpuBody?.active?this.positions.slice():new Float32Array(this.positions.length),read=map=>{const p=[0,0,0];for(const [id,w] of map)for(let k=0;k<3;k++)p[k]+=source[id*3+k]*w;return p;};
    if(this.bodySources){for(let i=0;i<this.bodyCount;i++){if(this.gpuBody?.active&&this.geometry.attributes.cjGpuBody.array[i])continue;const a=this.bodySources[i*2],b=this.bodySources[i*2+1],u=this.bodyMix[i*2],v=this.bodyMix[i*2+1],j=i*3;out[j]=source[a]*u+source[b]*v;out[j+1]=source[a+1]*u+source[b+1]*v;out[j+2]=source[a+2]*u+source[b+2]*v;}}
    else for(let i=0;i<this.bodyCount;i++){let x=0,y=0,z=0;for(const [id,w]of this.sourceMap[i]){x+=source[id*3]*w;y+=source[id*3+1]*w;z+=source[id*3+2]*w;}out[i*3]=x;out[i*3+1]=y;out[i*3+2]=z;}
    const low=this.bottom.map(v=>Array.from(out.slice(v.id*3,v.id*3+3))),guide=this.guideRing.map(v=>{const q=this.guideMap[v.id];return read(q.a===q.b?[[q.a,1]]:[[q.a,1-q.t],[q.b,q.t]]);});
    const sample=(ring,values,angle)=>{const q=bracket(ring,angle);return new THREE.Vector3().fromArray(mix(values[q.a],values[q.b],q.t));};
    const columns=this.rings[1],count=columns.length;
    // One set of cubic controls and radial profiles per angular column.
    const lowerProfiles=new Float64Array(count*3),upperProfiles=new Float64Array(count*3);
    for(let i=0;i<count;i++){
      const v=columns[i],a=sample(this.bottom,low,v.angle),g=sample(this.guideRing,guide,v.angle),b=new THREE.Vector3().fromArray(mix(headPoints[v.a],headPoints[v.b],v.t)),span=a.distanceTo(b),c=a.clone().add(g.sub(a).multiplyScalar(Math.min(2,span/.03))),d=b.clone().addScaledVector(headTangents?new THREE.Vector3().fromArray(mix(headTangents[v.a],headTangents[v.b],v.t)).normalize():new THREE.Vector3().fromArray(headAxis),-span*.28);
      lowerProfiles.set(a.toArray(),i*3);upperProfiles.set(b.toArray(),i*3);
      for(let row=1;row<=this.rows;row++){const t=row/this.rows,u=1-t,j=this.rings[row][i].id*3,aa=u*u*u,cc=3*u*u*t,dd=3*u*t*t,bb=t*t*t;
        out[j]=a.x*aa+c.x*cc+d.x*dd+b.x*bb;out[j+1]=a.y*aa+c.y*cc+d.y*dd+b.y*bb;out[j+2]=a.z*aa+c.z*cc+d.z*dd+b.z*bb;
      }
    }
    if(Math.abs(neckWidth-1)>1e-8){
      const axis=new THREE.Vector3().fromArray(headAxis).normalize(),bottomCenter=low.reduce((c,p)=>c.add(new THREE.Vector3().fromArray(p)),new THREE.Vector3()).multiplyScalar(1/low.length),topCenter=headPoints.reduce((c,p)=>c.add(new THREE.Vector3().fromArray(p)),new THREE.Vector3()).multiplyScalar(1/headPoints.length),blend=Math.min(1,Math.abs(neckWidth-1)/.3),ax=axis.x,ay=axis.y,az=axis.z;
      for(let i=0;i<count;i++){const j=i*3,lx=lowerProfiles[j]-bottomCenter.x,ly=lowerProfiles[j+1]-bottomCenter.y,lz=lowerProfiles[j+2]-bottomCenter.z,ux=upperProfiles[j]-topCenter.x,uy=upperProfiles[j+1]-topCenter.y,uz=upperProfiles[j+2]-topCenter.z,ld=lx*ax+ly*ay+lz*az,ud=ux*ax+uy*ay+uz*az;lowerProfiles[j]=lx-ax*ld;lowerProfiles[j+1]=ly-ay*ld;lowerProfiles[j+2]=lz-az*ld;upperProfiles[j]=ux-ax*ud;upperProfiles[j+1]=uy-ay*ud;upperProfiles[j+2]=uz-az*ud;}
      for(let row=1;row<this.rows;row++){
        const ring=this.rings[row];let cx=0,cy=0,cz=0;for(const v of ring){const j=v.id*3;cx+=out[j];cy+=out[j+1];cz+=out[j+2];}cx/=count;cy/=count;cz/=count;
        const t=row/this.rows,q=Math.min(1,t/.7),ease=q*q*(3-2*q);
        for(let i=0;i<count;i++){const j=ring[i].id*3,k=i*3,lx=lowerProfiles[k]+(upperProfiles[k]-lowerProfiles[k])*ease,ly=lowerProfiles[k+1]+(upperProfiles[k+1]-lowerProfiles[k+1])*ease,lz=lowerProfiles[k+2]+(upperProfiles[k+2]-lowerProfiles[k+2])*ease,target=Math.sqrt(lx*lx+ly*ly+lz*lz),dx=out[j]-cx,dy=out[j+1]-cy,dz=out[j+2]-cz,dot=dx*ax+dy*ay+dz*az,rx=dx-ax*dot,ry=dy-ay*dot,rz=dz-az*dot,length=Math.sqrt(rx*rx+ry*ry+rz*rz),desired=neckWidth<1?Math.min(length,target):Math.max(length,target)*(1+(neckWidth-1)*.35);
          if(length>1e-9){const factor=(desired/length-1)*blend*16*t*t*(1-t)*(1-t);out[j]+=rx*factor;out[j+1]+=ry*factor;out[j+2]+=rz*factor;}
        }
      }
    }
    return out;
  }
  smoothNormals(attr){
    const source=attr.array,first=this.rings[1][0].id*3,size=this.N*3*this.rows;
    if(!this.normalSnapshot||this.normalSnapshot.length!==size)this.normalSnapshot=new Float32Array(size);
    this.normalSnapshot.set(source.subarray(first,first+size));const snapshot=this.normalSnapshot;
    for(let row=1;row<=this.rows;row++){const ring=this.rings[row],t=Math.min(1,row/this.rows/.45),blend=t*t*(3-2*t),offset=(row-1)*this.N*3;
      for(let i=0;i<ring.length;i++){let x=0,y=0,z=0;for(const q of this.normalSamples[i]){const j=offset+q.i*3;x+=snapshot[j]*q.w;y+=snapshot[j+1]*q.w;z+=snapshot[j+2]*q.w;}const length=Math.hypot(x,y,z)||1,j=ring[i].id*3,k=offset+i*3,nx=snapshot[k]+(x/length-snapshot[k])*blend,ny=snapshot[k+1]+(y/length-snapshot[k+1])*blend,nz=snapshot[k+2]+(z/length-snapshot[k+2])*blend,l=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;source[j]=nx/l;source[j+1]=ny/l;source[j+2]=nz/l;}
    }
  }
  updateNormals(g,start=0,normalizeStart=0){
    const p=g.attributes.position.array,index=g.index.array;
    if(!g.attributes.normal)g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(p.length),3));
    const n=g.attributes.normal.array;if(this.gpuBody?.active&&g===this.geometry){n.fill(0,this.bodyCount*3);for(let i=0;i<this.bodyCount;i++)if(!g.attributes.cjGpuBody.array[i])n.fill(0,i*3,i*3+3);}else n.fill(0);
    for(let j=start;j<index.length;j+=3){const a=index[j]*3,b=index[j+1]*3,c=index[j+2]*3,cbx=p[c]-p[b],cby=p[c+1]-p[b+1],cbz=p[c+2]-p[b+2],abx=p[a]-p[b],aby=p[a+1]-p[b+1],abz=p[a+2]-p[b+2],nx=cby*abz-cbz*aby,ny=cbz*abx-cbx*abz,nz=cbx*aby-cby*abx;
      n[a]+=nx;n[a+1]+=ny;n[a+2]+=nz;n[b]+=nx;n[b+1]+=ny;n[b+2]+=nz;n[c]+=nx;n[c+1]+=ny;n[c+2]+=nz;
    }
    for(let j=normalizeStart;j<n.length;j+=3){const l=Math.sqrt(n[j]*n[j]+n[j+1]*n[j+1]+n[j+2]*n[j+2])||1;n[j]/=l;n[j+1]/=l;n[j+2]/=l;}
    g.attributes.normal.needsUpdate=true;
  }
  bridgeNormals(){this.updateNormals(this.geometry,this.bridgeIndexStart,this.bodyCount*3);}
  update(source,neckWidth=1,worldReady=false){
    let mark=performance.now();const lap=name=>{const now=performance.now();this.onPerformanceSample?.(name,now-mark);mark=now;};
    if(!worldReady){this.parent.updateWorldMatrix(true,false);this.parent.updateMatrixWorld(true);}
    // Mesh.getVertexPosition scans every morph target for every repeated
    // aperture sample. Compile active targets once and memoize shared vertices.
    const mesh=this.headMesh,g=mesh.geometry,position=g.attributes.position,relative=g.morphTargetsRelative,active=[];
    for(let i=0;i<(g.morphAttributes.position?.length||0);i++){const weight=mesh.morphTargetInfluences[i];if(weight!==0)active.push([g.morphAttributes.position[i],weight]);}
    const vertices=new Map(),sampleVertex=(id,out)=>{let value=vertices.get(id);if(!value){const x=position.getX(id),y=position.getY(id),z=position.getZ(id);let dx=0,dy=0,dz=0;for(const [a,w]of active){dx+=(a.getX(id)-(relative?0:x))*w;dy+=(a.getY(id)-(relative?0:y))*w;dz+=(a.getZ(id)-(relative?0:z))*w;}value=new THREE.Vector3(x+dx,y+dy,z+dz);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(id,value);vertices.set(id,value);}return out.copy(value);};
    const matrix=this.parent.matrixWorld.clone().invert().multiply(this.headMesh.matrixWorld),p=new THREE.Vector3(),points=this.upper.map(v=>sampleVertex(v.id,p).applyMatrix4(matrix).toArray()),axis=new THREE.Vector3(0,1,0).transformDirection(matrix).toArray();
    let tangents=this.headInterior.map((ids,j)=>{const tangent=new THREE.Vector3(),b=new THREE.Vector3().fromArray(points[j]);for(const id of ids)tangent.add(sampleVertex(id,new THREE.Vector3()).applyMatrix4(matrix).sub(b));return (tangent.lengthSq()>1e-14?tangent.normalize():new THREE.Vector3().fromArray(axis)).toArray();});
    if(this.smoothTransition){
      // Match the head surface tangent at each aperture vertex. Averaging
      // neighbouring directions around the aperture tilts the side tangents
      // away from their own surface and creates a visible waist below ears.
      const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
      tangents=tangents.map((fallback,i)=>{
        const n=new THREE.Vector3();for(const id of this.headDuplicates[i])n.add(new THREE.Vector3().fromArray(this.originalHeadNormals,id*3));
        n.applyMatrix3(normalMatrix).normalize();
        const v=new THREE.Vector3().fromArray(axis).addScaledVector(n,-new THREE.Vector3().fromArray(axis).dot(n));
        return (v.lengthSq()>1e-8?v.normalize():new THREE.Vector3().fromArray(fallback)).toArray();
      });
    }
    lap('шея · вершины головы');const fittedSource=this.deformSource(source,neckWidth,Boolean(this.gpuBody?.active));this.positions.set(this.fit(fittedSource,points,axis,tangents,neckWidth,true));lap('шея · форма');this.geometry.attributes.position.needsUpdate=true;this.bridgeNormals();
    const bn=this.geometry.attributes.normal;this.smoothNormals(bn);lap('шея · нормали');
    // Keep the original chest shading and continue its boundary normals into
    // the lower neck before gradually adopting the bridge's surface normals.
    let sn;if(this.gpuBody?.active)sn={array:this.gpuBody.sourceNormals(fittedSource)};else{this.sourceGeometry.attributes.position.array.set(fittedSource);this.updateNormals(this.sourceGeometry);sn=this.sourceGeometry.attributes.normal;}lap('тело · нормали');
    const bodyNormals=bn.array,sourceNormals=sn.array;
    for(let i=0;i<this.bodyCount;i++){if(this.gpuBody?.active&&this.geometry.attributes.cjGpuBody.array[i])continue;const a=this.bodySources[i*2],b=this.bodySources[i*2+1],u=this.bodyMix[i*2],v=this.bodyMix[i*2+1],x=sourceNormals[a]*u+sourceNormals[b]*v,y=sourceNormals[a+1]*u+sourceNormals[b+1]*v,z=sourceNormals[a+2]*u+sourceNormals[b+2]*v,length=Math.sqrt(x*x+y*y+z*z)||1,j=i*3;bodyNormals[j]=x/length;bodyNormals[j+1]=y/length;bodyNormals[j+2]=z/length;}
    for(let row=1;row<this.rows*.45;row++){const t=row/(this.rows*.45),w=1-t*t*(3-2*t);for(const v of this.rings[row]){const q=bracket(this.bottom,v.angle),target=new THREE.Vector3().fromBufferAttribute(bn,this.bottom[q.a].id).lerp(new THREE.Vector3().fromBufferAttribute(bn,this.bottom[q.b].id),q.t).normalize(),n=new THREE.Vector3().fromBufferAttribute(bn,v.id).lerp(target,w).normalize();bn.setXYZ(v.id,n.x,n.y,n.z);}}
    const hn=this.headMesh.geometry.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),inverse=normalMatrix.clone().invert();hn.array.set(this.originalHeadNormals);
    const normals=this.upper.map((v,j)=>new THREE.Vector3().fromArray(this.originalHeadNormals,v.id*3).applyMatrix3(normalMatrix).normalize());
    for(let row=Math.floor(this.rows*.72);row<=this.rows;row++){const t=(row/this.rows-.72)/.28,w=Math.max(0,Math.min(1,t)),blend=w*w*(3-2*w);for(const v of this.rings[row]){const target=normals[v.a].clone().lerp(normals[v.b],v.t).normalize(),n=new THREE.Vector3().fromBufferAttribute(bn,v.id).lerp(target,blend).normalize();bn.setXYZ(v.id,n.x,n.y,n.z);}}
    this.upper.forEach((v,j)=>{const n=normals[j].clone().applyMatrix3(inverse).normalize();for(const id of this.headDuplicates[j])hn.setXYZ(id,n.x,n.y,n.z);});
    bn.needsUpdate=true;hn.needsUpdate=true;this.geometry.boundingBox=null;if(!this.gpuBody?.active)this.geometry.computeBoundingSphere();lap('шея · стык');
  }
}
