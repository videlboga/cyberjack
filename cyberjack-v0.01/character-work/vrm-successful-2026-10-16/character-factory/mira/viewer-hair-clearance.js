import * as T from 'three';

// Rasterize the head's side surface in depth/height coordinates. Projection only
// touches opted-in hair vertices inside the front half of the actual head.
export function sideSurface(positions,index,resolution=192){
 let minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<positions.length;i+=3){minY=Math.min(minY,positions[i+1]);maxY=Math.max(maxY,positions[i+1]);minZ=Math.min(minZ,positions[i+2]);maxZ=Math.max(maxZ,positions[i+2]);}
 const sy=(resolution-1)/(maxY-minY),sz=(resolution-1)/(maxZ-minZ),grid=new Float32Array(resolution*resolution);grid.fill(-1);
 for(let i=0;i<index.length;i+=3){const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3,ay=(positions[a+1]-minY)*sy,az=(positions[a+2]-minZ)*sz,by=(positions[b+1]-minY)*sy,bz=(positions[b+2]-minZ)*sz,cy=(positions[c+1]-minY)*sy,cz=(positions[c+2]-minZ)*sz,den=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(den)<1e-9)continue;
  for(let y=Math.max(0,Math.floor(Math.min(ay,by,cy)));y<=Math.min(resolution-1,Math.ceil(Math.max(ay,by,cy)));y++)for(let z=Math.max(0,Math.floor(Math.min(az,bz,cz)));z<=Math.min(resolution-1,Math.ceil(Math.max(az,bz,cz)));z++){const u=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/den,v=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-5)continue;const x=Math.abs(u*positions[a]+v*positions[b]+w*positions[c]);grid[z*resolution+y]=Math.max(grid[z*resolution+y],x);}
 }
 return {minY,maxY,minZ,maxZ,sample(y,z){const iy=Math.round((y-minY)*sy),iz=Math.round((z-minZ)*sz);if(iy<0||iy>=resolution||iz<0||iz>=resolution)return -1;let x=-1;for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)if(iy+dy>=0&&iy+dy<resolution&&iz+dz>=0&&iz+dz<resolution)x=Math.max(x,grid[(iz+dz)*resolution+iy+dy]);return x;}};
}
export function clearFaceHair(group,shape,surface){
 shape.updateWorldMatrix(true,true);const inverse=shape.matrixWorld.clone().invert(),point=new T.Vector3();let corrected=0;
 group.traverse(mesh=>{const gap=mesh.userData.faceClearance;if(!mesh.isMesh||!(gap>0)||mesh.userData.faceClearanceApplied)return;const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),back=matrix.clone().invert(),attr=mesh.geometry.attributes.position;
  const section=attr.count%13===0?13:1,rows=attr.count/section,points=[],shift=new Float32Array(rows),signs=new Float32Array(rows);
  for(let i=0;i<attr.count;i++)points.push(new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(matrix));
  for(let row=0;row<rows;row++){
   const sign=Math.sign(points.slice(row*section,(row+1)*section).reduce((sum,p)=>sum+p.x,0))||1;signs[row]=sign;
   for(let j=0;j<section;j++){const p=points[row*section+j];if(p.y>(surface.minY+surface.maxY)*.5||p.z>surface.maxZ-.100)continue;const side=surface.sample(p.y,p.z);if(side>=0)shift[row]=Math.max(shift[row],side+gap-sign*p.x);}
  }
  // Move full ribbon sections together. Independent vertex clamping flattened
  // the cheek-facing half of a curl; a short outward falloff keeps its thickness.
  for(let row=0;row<rows;row++){
   if(points.slice(row*section,(row+1)*section).reduce((sum,p)=>sum+p.z,0)/section>surface.maxZ-.095)continue;
   let delta=shift[row];for(let d=1;d<=2;d++)delta=Math.max(delta,(shift[row-d]||0)*(d===1?.65:.25),(shift[row+d]||0)*(d===1?.65:.25));if(delta<=0)continue;
   for(let j=0;j<section;j++){const i=row*section+j,p=points[i];p.x+=signs[row]*delta;p.applyMatrix4(back);attr.setXYZ(i,p.x,p.y,p.z);corrected++;}
  }
  attr.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.userData.faceClearanceApplied=true;
 });if(corrected)console.info(`Hair/face clearance: ${corrected} vertices moved outside the head`);return corrected;
}

// Rigid strands are restored from HairPhysics.base on every frame. Persist the
// corrected mesh as that rest shape, otherwise rendering undoes the clearance.
export function rebaseFaceHair(group,physics){
 group.traverse(mesh=>{if(!mesh.isMesh||!mesh.userData.faceClearanceApplied||mesh.userData.faceClearancePhysics)return;const chain=physics.chains.get(mesh);if(chain)physics.register(mesh,chain.rigid,chain.profile,chain.motionGroup);mesh.userData.faceClearancePhysics=true;});
}
