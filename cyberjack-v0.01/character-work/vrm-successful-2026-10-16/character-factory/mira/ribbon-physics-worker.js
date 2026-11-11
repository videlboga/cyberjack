let T,createMiraRibbonHair,MeshSurfaceCollider;
const boot=Promise.all([import('./vendor/three/three.module.js'),import('./viewer-ribbon-tryon.js?v=rollback-1'),import('./mesh-surface-collider.js?v=worker-14')]).then(([three,hair,contact])=>{T=three;createMiraRibbonHair=hair.createMiraRibbonHair;MeshSurfaceCollider=contact.MeshSurfaceCollider;}).catch(error=>{self.postMessage({type:'error',message:'Worker import: '+(error.stack||String(error))});throw error;});
let scene,hair,head,body,anchor,fronts,surface,revision=-1,diagnostic='all',sentMode=null;const pool=[];
function mesh(data){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(data.positions,3));if(data.indices)g.setIndex(new T.BufferAttribute(data.indices,1));const m=new T.Mesh(g);if(data.matrix){m.matrixAutoUpdate=false;m.matrix.fromArray(data.matrix);m.updateMatrixWorld(true);}return m;}
self.onmessage=async({data})=>{try{await boot;
 if(data.type==='init'){scene=new T.Scene();head=mesh(data.head);body=mesh(data.body);anchor=new T.Group();anchor.matrixAutoUpdate=false;anchor.matrix.fromArray(data.anchor);anchor.updateMatrixWorld(true);fronts=data.fronts.map(mesh);surface=new MeshSurfaceCollider();hair=createMiraRibbonHair(scene,{partition:data.partition});surface.update(data.body.positions,body.geometry.index.array);hair.update(0,head,body,[],anchor,fronts,{enabled:false,stiffness:.35,damping:.35,motion:.85,wind:0},surface);self.postMessage({type:'ready'});return;}
 if(data.type!=='step')return;
 if(data.recycle)pool.push(data.recycle);
 const started=performance.now();if(data.body){body.geometry.attributes.position.array.set(data.body.subarray(0,body.geometry.attributes.position.array.length));body.geometry.attributes.position.needsUpdate=true;surface.update(data.body,data.indices||surface.sourceIndex||body.geometry.index.array);revision=data.revision;}
 anchor.matrix.fromArray(data.anchor);anchor.updateMatrixWorld(true);
 if(data.reset)hair.update(0,head,body,[],anchor,fronts,{...data.settings,enabled:false},surface);
 hair.update(data.dt,head,body,[],anchor,fronts,data.settings,surface);
 if(data.diagnostic!==diagnostic){hair.setDiagnostic(data.diagnostic);diagnostic=data.diagnostic;}
 const g=scene.children[0].geometry,count=g.attributes.position.array.length;let buffers=pool.pop();if(!buffers||buffers.positions.length!==count)buffers={positions:new Float32Array(count),normals:new Float32Array(count)};
 // Transfer deformation in attachment space. Main-thread root motion must
 // never wait for a physics result or interpolate old world-space anchors.
 const inverse=anchor.matrixWorld.clone().invert(),normalMatrix=new T.Matrix3().getNormalMatrix(inverse),point=new T.Vector3();
 for(let i=0;i<count;i+=3){point.fromArray(g.attributes.position.array,i).applyMatrix4(inverse).toArray(buffers.positions,i);point.fromArray(g.attributes.normal.array,i).applyMatrix3(normalMatrix).normalize().toArray(buffers.normals,i);}
 const indices=sentMode!==diagnostic?g.index.array.slice():null;sentMode=diagnostic;self.postMessage({type:'frame',...buffers,underside:indices?g.attributes.miraUnderside.array.slice():null,indices,diagnostic,revision,solverMS:hair.solveMS,totalMS:performance.now()-started},[buffers.positions.buffer,buffers.normals.buffer,...(indices?[indices.buffer]:[])]);
 }catch(error){self.postMessage({type:'error',message:error.stack||String(error)});}};
