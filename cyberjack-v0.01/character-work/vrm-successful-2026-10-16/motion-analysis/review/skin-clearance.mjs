import{Vector3,Matrix4}from'three';
// Signed nearest-surface estimate; deliberately excludes the intended palm
// contact. Used to reject arm paths through skin after avatar-space IK.
export function surfacePenetration(probes,cloud,surfaceAt,nearest){let worst=0,handWorst=0;const contacts=[];for(const {point,radius=0,label}of probes){let closest=null,distance=Infinity;if(nearest){const found=nearest(point);closest=found.sample;distance=found.distance;}else for(const sample of cloud){const d=sample.position.distanceToSquared(point);if(d<distance){distance=d;closest=sample;}}if(!closest||distance>.18**2)continue;const surface=surfaceAt(closest),signed=point.clone().sub(surface.position).dot(surface.normal),penetration=Math.max(0,radius-signed);if(label==='hand-skin')handWorst=Math.max(handWorst,penetration);if(penetration>worst)worst=penetration;if(penetration>.004)contacts.push({label,penetration,point:point.toArray(),surface:surface.position.toArray(),normal:surface.normal.toArray(),radius});}return{worst,handWorst,contacts};}
export function armProbes(upper,elbow,hand){const a=upper.getWorldPosition(new Vector3()),b=elbow.getWorldPosition(new Vector3()),c=hand.getWorldPosition(new Vector3()),probes=[];for(const u of [.45,.65,.85])probes.push({point:a.clone().lerp(b,u),radius:.018,label:'upper-arm'});for(const u of [.15,.35,.55,.75])probes.push({point:b.clone().lerp(c,u),radius:.013,label:'forearm'});return probes;}

// Sample the actual deformed hand skin (including fingers), rather than
// treating its bone pivot as the boundary. Spatial coverage is chosen once;
// positions are read again after each IK trial.
export function createHandSkinProbes(vrm,side,limit=24){const hand=vrm.humanoid.getRawBoneNode(side+'Hand'),samples=[];if(!hand)return()=>[];
 vrm.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh||![].concat(mesh.material||[]).some(m=>/cf_m_body|skin|body/i.test(m.name||'')))return;const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!indices||!weights)return;mesh.skeleton.update();for(let i=0;i<indices.count;i++){let influence=0;for(let j=0;j<4;j++){let b=mesh.skeleton.bones[indices.array[i*4+j]];while(b&&b!==hand)b=b.parent;if(b===hand)influence+=weights.array[i*4+j];}if(influence>.7)samples.push({mesh,i,local:hand.worldToLocal(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld)),distance:Infinity});}});
 const chosen=[];let next=samples[0];while(next&&chosen.length<limit){chosen.push(next);let farthest=-1,candidate;for(const s of samples){s.distance=Math.min(s.distance,s.local.distanceToSquared(next.local));if(s.distance>farthest){farthest=s.distance;candidate=s;}}next=farthest>1e-8?candidate:null;}
 const refresh=createProbeSkinUpdater(chosen);
 return()=>{refresh();return chosen.map(s=>{return {point:s.mesh.getVertexPosition(s.i,new Vector3()).applyMatrix4(s.mesh.matrixWorld),radius:0,label:'hand-skin'};});};
}

// CPU probes read only these vertices. Refresh exactly their influencing slots;
// the renderer still performs its normal full skeleton upload before drawing.
export function createProbeSkinUpdater(samples){
 const slots=new Map(),offset=new Matrix4(),identity=new Matrix4();
 for(const {mesh,i} of samples){const skeleton=mesh.skeleton,indices=mesh.geometry.attributes.skinIndex;let set=slots.get(skeleton);if(!set)slots.set(skeleton,set=new Set());for(let j=0;j<4;j++)set.add(indices.array[i*4+j]);}
 return()=>{for(const [skeleton,indices]of slots){if(!skeleton.boneMatrices||!skeleton.boneInverses){skeleton.update();continue;}for(const i of indices)offset.multiplyMatrices(skeleton.bones[i]?.matrixWorld||identity,skeleton.boneInverses[i]).toArray(skeleton.boneMatrices,i*16);if(skeleton.boneTexture)skeleton.boneTexture.needsUpdate=true;}};
}
