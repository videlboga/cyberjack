import * as T from 'three';
// Coordinates and radii follow the posed rig; the same builder is used in QA.
export function bodyHairColliders(anatomy,weights,pose,matrix){
 const rig=anatomy.getRig(),r=anatomy.ratios(weights),transforms=anatomy.transforms(weights),index=Object.fromEntries(rig.bones.map((b,i)=>[b.name,i]));
 const point=name=>{const i=index[name],b=rig.bones[i],tr=transforms[i];return new T.Vector3().fromArray(pose?pose.posed[i]:b.head.map((_,j)=>(tr.A[j*3]*b.head[0]+tr.A[j*3+1]*b.head[1]+tr.A[j*3+2]*b.head[2]+tr.t[j])*r.height)).applyMatrix4(matrix);};
 return [
 ['pelvis','waist',.155,.9],['waist','chest',.13,.7],['chest','upperchest',.14,.65],['upperchest','neck',.055,.8],['neck','head',.035,1],
 ['pelvis','thigh.l',.115,1],['pelvis','thigh.r',.115,1],
 ['thigh.l','shin.l',.105,1],['thigh.r','shin.r',.105,1],
 ['shin.l','foot.l',.07,1],['shin.r','foot.r',.07,1],
 ['shoulder.l','upperarm.l',.08,1],['shoulder.r','upperarm.r',.08,1],
 ['upperarm.l','forearm.l',.045,1],['upperarm.r','forearm.r',.045,1],
 ['forearm.l','hand.l',.035,1],['forearm.r','hand.r',.035,1]
 ].map(([a,b,radius,depthScale])=>({a:point(a),b:point(b),radius:radius*r.height*(a.startsWith('shoulder.')||a.startsWith('upperarm.')||a.startsWith('forearm.')?r.arm_w:a==='neck'?r.neck_w:a==='upperchest'?Math.sqrt(r.neck_w*r.chest_w):1),depthScale,depthAxis:new T.Vector3(0,1,0).applyQuaternion(new T.Quaternion().fromArray(pose?pose.q[index[a]]:[0,0,0,1])).transformDirection(matrix),capScale:['waist','chest'].includes(a)?.25:1,enforceRest:true,bodyPart:a+' → '+b}));
}

// The grafted neck does not share the donor rig's neck axis. Fit its posed
// aperture rings instead, after HeadSocket has updated the body geometry.
export function fittedNeckCollider(mesh){
 const region=mesh.geometry.userData.ribbonNeck,positions=mesh.geometry.attributes.position;
 if(!region?.root?.length||!region?.top?.length)return null;
 mesh.updateWorldMatrix(true,false);
 const point=new T.Vector3(),center=ids=>{const out=new T.Vector3();for(const id of ids)out.add(point.fromBufferAttribute(positions,id).applyMatrix4(mesh.matrixWorld));return out.divideScalar(ids.length);};
 const a=center(region.root),b=center(region.top),axis=b.clone().sub(a).normalize();
 let radius=0;
 for(const id of [...region.root,...region.top]){point.fromBufferAttribute(positions,id).applyMatrix4(mesh.matrixWorld).sub(a);point.addScaledVector(axis,-point.dot(axis));radius=Math.max(radius,point.length());}
 if(!Number.isFinite(radius)||radius<=0)return null;
 return {a,b,radius,depthScale:1,capScale:1,enforceRest:true,supplemental:true,bodyPart:'neck → head'};
}
