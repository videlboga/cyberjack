import {mouthBindings} from './viewer-mouth-binding-data.js?v=lip-rolls-2';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
// Evaluate the already sculpted, currently blended mouth. No assumed neutral lip height.
export function blendedVertex(mesh,index,out=[0,0,0]){const g=mesh.geometry,p=g.attributes.position.array,j=index*3;out[0]=p[j];out[1]=p[j+1];out[2]=p[j+2];for(let k=0;k<mesh.morphTargetInfluences.length;k++){const w=mesh.morphTargetInfluences[k],a=g.morphAttributes.position[k]?.array;if(!w||!a)continue;for(let c=0;c<3;c++)out[c]+=w*(g.morphTargetsRelative?a[j+c]:a[j+c]-p[j+c]);}return out;}
function rowAt(row,x){let i=0;while(i<row.length-2&&row[i+1][0]<x)i++;const a=row[i],b=row[i+1],u=clamp((x-a[0])/Math.max(1e-9,b[0]-a[0]));return [a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];}
export function currentLipRows(face){return Object.fromEntries(['lower','lowerSeam','upperSeam'].map(name=>[name,mouthBindings.rows[name].map(v=>blendedVertex(face,v.vertex)).sort((a,b)=>a[0]-b[0])]));}
// Only the short exit corridor is constrained. The exposed tip retains its authored droop.
export function fitTongueVertex(point,rows){const [x,y,z]=point,lower=rowAt(rows.lowerSeam,x),belly=rowAt(rows.lower,x),upper=rowAt(rows.upperSeam,x),lipZ=Math.max(lower[1],belly[1]),gap=upper[0]-lower[0];
 const entering=smooth((z-(lipZ-.014))/.007);if(!entering)return point.slice();
 const passage=smooth((gap-.0015)/.0025),retracted=Math.min(z,lipZ-.007),outZ=z+(retracted-z)*(1-passage)*entering;
 const external=smooth((outZ-(lipZ+.003))/.007),support=entering*(1-external),margin=Math.min(.0009,Math.max(0,gap*.22)),bottom=lower[0]+margin,top=upper[0]-margin;
 const center=(lower[0]+upper[0])*.5,target=top>bottom?clamp(y,bottom,top):center;
 return [x,y+clamp(target-y,-.05,.05)*support,outZ];
}
export function applyTongueClearance(adapter,weight){if(weight<=1e-5)return;
 const head=adapter.head,face=head.socketMesh;if(!face?.geometry?.attributes?.position||!mouthBindings.rows.lowerSeam.every(v=>v.vertex<face.geometry.attributes.position.count))return;
 const rows=currentLipRows(face);
 for(const [mesh,record]of adapter.tongueRecords){if(record.clearance==null)continue;const attr=mesh.geometry.morphAttributes.position[record.clearance];mesh.morphTargetInfluences[record.clearance]=0;const out=attr.array,p=[0,0,0];out.fill(0);let changed=false;
 for(let i=0;i<out.length;i+=3){blendedVertex(mesh,i/3,p);const fit=fitTongueVertex(p,rows);for(let k=0;k<3;k++){out[i+k]=fit[k]-p[k];if(Math.abs(out[i+k])>1e-7)changed=true;}}
 if(changed){attr.needsUpdate=true;mesh.morphTargetInfluences[record.clearance]=1;
 // WebGL2 morph textures in the bundled Three.js are immutable snapshots.
 // BufferAttribute.needsUpdate alone does not upload this animated target.
 mesh.geometry.dispose();
 }
 }
}
